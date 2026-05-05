/**
 * IndexedDB persistence for the sampler.
 *
 * Two-store schema (chosen so AUTO CHOP siblings dedupe their source bytes):
 *
 *   audio  — keyed by sourceId. Raw ArrayBuffer + mimeType, written once per file.
 *   pads   — keyed by padId. Metadata (sourceId reference, name, trim, mixer, chop info).
 *
 * Why split: a 5-min loop chopped into 16 slices stays one ArrayBuffer on disk
 * instead of 16 copies. Pad metadata (volume / trim) updates are cheap.
 */
import type { AudioStoreEntry, PadMetadata } from '../types';

const DB_NAME = 'hip-hop-sampler';
const DB_VERSION = 1;
const AUDIO_STORE = 'audio';
const PADS_STORE = 'pads';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: 'sourceId' });
      }
      if (!db.objectStoreNames.contains(PADS_STORE)) {
        db.createObjectStore(PADS_STORE, { keyPath: 'padId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

const promisifyTx = (tx: IDBTransaction): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IDB transaction aborted'));
  });

const promisifyReq = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const generateSourceId = (): string =>
  `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Write the raw ArrayBuffer for a source. Idempotent on sourceId. */
export const saveAudio = async (sourceId: string, arrayBuffer: ArrayBuffer, mimeType: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(AUDIO_STORE, 'readwrite');
  tx.objectStore(AUDIO_STORE).put({ sourceId, arrayBuffer, mimeType, savedAt: Date.now() });
  return promisifyTx(tx);
};

/** Read raw ArrayBuffer + mime by sourceId. Returns undefined if not found. */
export const loadAudio = async (sourceId: string): Promise<AudioStoreEntry | undefined> => {
  const db = await openDB();
  const tx = db.transaction(AUDIO_STORE, 'readonly');
  return promisifyReq<AudioStoreEntry | undefined>(tx.objectStore(AUDIO_STORE).get(sourceId));
};

/** Save pad metadata. Caller decides what to store. */
export const savePad = async (padId: string, data: Omit<PadMetadata, 'padId'>): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(PADS_STORE, 'readwrite');
  tx.objectStore(PADS_STORE).put({ padId, ...data, savedAt: Date.now() });
  return promisifyTx(tx);
};

/** Patch pad metadata. No-op if pad doesn't exist. */
export const updatePad = async (padId: string, partial: Partial<PadMetadata>): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(PADS_STORE, 'readwrite');
  const store = tx.objectStore(PADS_STORE);
  const existing = await promisifyReq<PadMetadata | undefined>(store.get(padId));
  if (existing) {
    store.put({ ...existing, ...partial, savedAt: Date.now() });
  }
  return promisifyTx(tx);
};

/** Atomic multi-pad write. */
export const savePads = async (
  entries: { padId: string; data: Omit<PadMetadata, 'padId'> }[],
): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(PADS_STORE, 'readwrite');
  const store = tx.objectStore(PADS_STORE);
  entries.forEach(({ padId, data }) => {
    store.put({ padId, ...data, savedAt: Date.now() });
  });
  return promisifyTx(tx);
};

/** Read all pad metadata. */
export const loadAllPads = async (): Promise<PadMetadata[]> => {
  const db = await openDB();
  const tx = db.transaction(PADS_STORE, 'readonly');
  return promisifyReq<PadMetadata[]>(tx.objectStore(PADS_STORE).getAll());
};

/** Remove a pad and (if no other pad uses its source) garbage-collect the audio. */
export const removePad = async (padId: string): Promise<void> => {
  const db = await openDB();
  // Read pad first to know the sourceId
  const readTx = db.transaction(PADS_STORE, 'readonly');
  const pad = await promisifyReq<PadMetadata | undefined>(readTx.objectStore(PADS_STORE).get(padId));
  await promisifyTx(readTx);
  if (!pad) return;

  const sourceId = pad.sourceId;

  // Delete the pad
  const tx = db.transaction(PADS_STORE, 'readwrite');
  tx.objectStore(PADS_STORE).delete(padId);
  await promisifyTx(tx);

  // Check if any other pad still references this sourceId
  if (!sourceId) return;
  const checkTx = db.transaction(PADS_STORE, 'readonly');
  const remaining = await promisifyReq<PadMetadata[]>(checkTx.objectStore(PADS_STORE).getAll());
  await promisifyTx(checkTx);
  const stillReferenced = remaining.some((p) => p.sourceId === sourceId);
  if (!stillReferenced) {
    const cleanupTx = db.transaction(AUDIO_STORE, 'readwrite');
    cleanupTx.objectStore(AUDIO_STORE).delete(sourceId);
    await promisifyTx(cleanupTx);
  }
};

/** Wipe everything. */
export const clearAll = async (): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction([AUDIO_STORE, PADS_STORE], 'readwrite');
  tx.objectStore(AUDIO_STORE).clear();
  tx.objectStore(PADS_STORE).clear();
  return promisifyTx(tx);
};

/** Ask the browser to keep our storage even under pressure. */
export const requestPersistentStorage = async (): Promise<boolean> => {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
};

/** Returns null if the API is unavailable. */
export const estimateQuota = async (): Promise<{ usage: number; quota: number; percent: number } | null> => {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const percent = quota ? usage / quota : 0;
    return { usage, quota, percent };
  } catch {
    return null;
  }
};

export const isPersisted = async (): Promise<boolean> => {
  if (!navigator.storage?.persisted) return false;
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
};
