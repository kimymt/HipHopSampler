import { useCallback, useEffect, useState } from 'react';
import {
  listAnalyses,
  saveAnalysis,
  deleteAnalysis,
  generateId,
  type SavedAnalysis,
} from '../utils/referenceStore';

/**
 * React surface over the referenceAnalyses IndexedDB store.
 *
 * Loads the list once on mount, exposes add/remove/refresh helpers, and
 * keeps an in-memory copy so the UI doesn't have to round-trip to IDB
 * on every render. CRUD calls update the in-memory list optimistically
 * after the IDB write resolves (no rollback — IDB rarely fails on writes
 * when the schema is correct).
 */
export const useSavedAnalyses = () => {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listAnalyses();
      setAnalyses(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load saved analyses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (entry: Omit<SavedAnalysis, 'id' | 'createdAt'>): Promise<SavedAnalysis> => {
      const full: SavedAnalysis = {
        ...entry,
        id: generateId(),
        createdAt: Date.now(),
      };
      await saveAnalysis(full);
      setAnalyses((prev) => [full, ...prev]);
      return full;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await deleteAnalysis(id);
    setAnalyses((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { analyses, loading, error, refresh, add, remove };
};
