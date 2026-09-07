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

/** Read raw ArrayBuffer + mime by sourceId. Returns undefined if not found. */
export const loadAudio = async (sourceId: string): Promise<AudioStoreEntry | undefined> => {
  const db = await openDB();
  const tx = db.transaction(AUDIO_STORE, 'readonly');
  return promisifyReq<AudioStoreEntry | undefined>(tx.objectStore(AUDIO_STORE).get(sourceId));
};

/** Collect orphan bytes inside the SAME transaction as their reference changes. */
const collectInTransaction = (tx: IDBTransaction) => {
  const pads = tx.objectStore(PADS_STORE).getAll();
  pads.onsuccess = () => {
    const references = new Set((pads.result as PadMetadata[]).map((p) => p.sourceId));
    const cursor = tx.objectStore(AUDIO_STORE).openKeyCursor();
    cursor.onsuccess = () => {
      const entry = cursor.result;
      if (!entry) return;
      if (!references.has(entry.primaryKey as string)) tx.objectStore(AUDIO_STORE).delete(entry.primaryKey);
      entry.continue();
    };
  };
};

/** Audio and references either commit together or are both rolled back. */
export const saveSample = async (
  padId: string, data: Omit<PadMetadata, 'padId'>, arrayBuffer: ArrayBuffer, mimeType: string,
): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction([AUDIO_STORE, PADS_STORE], 'readwrite');
  const done = promisifyTx(tx);
  tx.objectStore(AUDIO_STORE).put({ sourceId: data.sourceId, arrayBuffer, mimeType, savedAt: Date.now() });
  tx.objectStore(PADS_STORE).put({ ...data, padId, savedAt: Date.now() });
  collectInTransaction(tx);
  return done;
};

export const savePad = (padId: string, data: Omit<PadMetadata, 'padId'>): Promise<void> =>
  savePads([{ padId, data }]);

/** Patch only an existing pad, never recreate one after deletion. */
export const updatePad = async (padId: string, partial: Partial<PadMetadata>): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(PADS_STORE, 'readwrite');
  const done = promisifyTx(tx);
  const store = tx.objectStore(PADS_STORE);
  const request = store.get(padId);
  request.onsuccess = () => {
    if (request.result) store.put({ ...request.result, ...partial, padId, sourceId: request.result.sourceId, savedAt: Date.now() });
  };
  return done;
};

/** Atomic chop/replacement. Reject a stale reference whose audio was deleted. */
export const savePads = async (
  entries: { padId: string; data: Omit<PadMetadata, 'padId'> }[],
): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction([AUDIO_STORE, PADS_STORE], 'readwrite');
  const done = promisifyTx(tx);
  let remaining = entries.length;
  if (!remaining) return done;
  for (const { padId, data } of entries) {
    const request = tx.objectStore(AUDIO_STORE).getKey(data.sourceId);
    request.onsuccess = () => {
      if (request.result === undefined) { tx.abort(); return; }
      tx.objectStore(PADS_STORE).put({ ...data, padId, savedAt: Date.now() });
      if (--remaining === 0) collectInTransaction(tx);
    };
  }
  return done;
};

/** Migration cleanup: recover orphan bytes left by older app versions. */
export const collectOrphanAudio = async (): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction([AUDIO_STORE, PADS_STORE], 'readwrite');
  const done = promisifyTx(tx);
  collectInTransaction(tx);
  return done;
};

/** Read all pad metadata. */
export const loadAllPads = async (): Promise<PadMetadata[]> => {
  const db = await openDB();
  const tx = db.transaction(PADS_STORE, 'readonly');
  return promisifyReq<PadMetadata[]>(tx.objectStore(PADS_STORE).getAll());
};

/** Deletion and audio GC are atomic, also across browser tabs. */
export const removePad = async (padId: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction([AUDIO_STORE, PADS_STORE], 'readwrite');
  const done = promisifyTx(tx);
  tx.objectStore(PADS_STORE).delete(padId);
  collectInTransaction(tx);
  return done;
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
