/**
 * Reference Mode persistence (Phase 3 B+C).
 *
 * Stores the *derived numeric data* extracted from a reference track —
 * never the audio itself. Separate database from `hip-hop-sampler` (which
 * holds user-uploaded samples) so the legal isolation is explicit:
 *
 *   audio bytes → hip-hop-sampler DB    (user's own work)
 *   numeric analyses → reference-analyses DB    (private learning notes)
 *
 * Schema (single store):
 *   referenceAnalyses — keyed by id.
 *
 * Each entry: { id, name, bpm, offsetSec, beatPositions, durationSec,
 *               createdAt }. No filename, artist, audio, or waveform.
 *
 * Future export feature must enforce:
 *   1. these entries do NOT escape the device (no upload, no download
 *      of the JSON itself unless via the export consent flow)
 *   2. when included in any project export, the ENTIRE entry is treated
 *      as derived numeric data and the user is reminded that the
 *      reference audio is not present and cannot be reconstructed
 *
 * See sampler-tool/TODO.md "エクスポート機能の必須ガードレール" for the
 * required user-consent flow at export time.
 */

export interface SavedAnalysis {
  /** UUID-ish id. We use crypto.randomUUID() when available. */
  id: string;
  /** User-chosen name. Original filename is intentionally not stored. */
  name: string;
  /** Estimated tempo in BPM (post user adjustments). */
  bpm: number;
  /** Beat-grid offset in seconds (post user adjustments). */
  offsetSec: number;
  /** Derived beat positions in seconds, sorted ascending. */
  beatPositions: number[];
  /** Track duration in seconds — useful for re-rendering grid context. */
  durationSec: number;
  /** Unix ms timestamp at save time. */
  createdAt: number;
}

const DB_NAME = 'reference-analyses';
const DB_VERSION = 1;
const STORE = 'referenceAnalyses';

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
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

const txDone = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export const saveAnalysis = async (entry: SavedAnalysis): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(entry);
  await txDone(tx);
};

export const listAnalyses = async (): Promise<SavedAnalysis[]> => {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const arr = (req.result ?? []) as SavedAnalysis[];
      // Newest first.
      arr.sort((a, b) => b.createdAt - a.createdAt);
      resolve(arr);
    };
    req.onerror = () => reject(req.error);
  });
};

export const deleteAnalysis = async (id: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
};

/** crypto.randomUUID with a fallback for older browsers. */
export const generateId = (): string => {
  try {
    const c = (typeof crypto !== 'undefined' ? crypto : null) as Crypto | null;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {
    /* fallthrough */
  }
  // Fallback: timestamp + random hex
  return `ra-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
