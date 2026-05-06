import { useCallback, useEffect, useState } from 'react';
import {
  detectWebLLMSupport,
  getStoredOptIn,
  setStoredOptIn,
  loadWebLLM,
  isWebLLMCached,
  inferPreset,
  type WebLLMState,
  type VibeInferenceResult,
} from '../ai/webllmClient';

// Computed once at module load. Extracted from the useState lazy initializer
// because TS struggles to narrow a discriminated union return inside an
// inline arrow body — moving it out lets the narrowing work normally.
const initialWebLLMState = (): WebLLMState => {
  const support = detectWebLLMSupport();
  if (support.supported === true) return { status: 'idle' };
  // TS narrowing on `false` literal works here when we explicitly match the
  // tag rather than using truthiness. Avoids a Vite/TS quirk where the
  // discriminator was being widened to plain `boolean`.
  const reason = (support as { supported: false; reason: string }).reason;
  return { status: 'unsupported', reason };
};

/**
 * React surface over webllmClient.
 *
 * Why a hook (not Context): only the EffectPanel area cares about WebLLM
 * state. Adding a Provider would push the dynamic import into the React tree
 * even when no consumer is mounted. The hook stays local to the components
 * that use it — Settings (toggle) and EffectVibeChips (vibe input, Phase 2B.2).
 *
 * Auto-init on mount: if the user previously opted in AND the support check
 * passes, we kick off the engine load immediately. The library handles its
 * own caching, so re-loads after first download are near-instant.
 */
export const useWebLLM = () => {
  const [state, setState] = useState<WebLLMState>(() => initialWebLLMState());

  const [optIn, setOptIn] = useState<boolean>(() => getStoredOptIn());

  // Auto-load on mount if already opted in and supported.
  //
  // CRITICAL: deps must NOT include `state.status`. The first `setState({loading})`
  // call from inside startLoad triggers a re-render → useEffect cleanup runs →
  // `cancelled` becomes true → every subsequent progress callback AND the final
  // `setState({status:'ready'})` is skipped, leaving the UI pinned at "0%". The
  // user-reported reload bug from v0.2.0.3 was exactly this: cached path loads
  // fast but the ready transition never reaches the UI because cancellation
  // races the state propagation.
  //
  // We gate by detectWebLLMSupport inside the effect so unsupported browsers
  // don't trigger the load. The dictionary fallback in inferPreset still works
  // either way.
  useEffect(() => {
    if (!optIn) return;
    const support = detectWebLLMSupport();
    if (!support.supported) return;

    let cancelled = false;
    const startLoad = async () => {
      try {
        const cached = await isWebLLMCached();
        if (cancelled) return;
        setState({
          status: 'loading',
          progress: 0,
          text: cached ? 'モデルを準備中…' : '初回ダウンロード中… (約 300MB)',
        });
        await loadWebLLM((progress, text) => {
          if (cancelled) return;
          setState({ status: 'loading', progress, text });
        });
        if (cancelled) return;
        setState({ status: 'ready' });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', message });
      }
    };
    startLoad();

    return () => {
      cancelled = true;
    };
  }, [optIn]);

  /** User toggle handler. Persists opt-in and (if turning on) kicks off load. */
  const setOptedIn = useCallback((on: boolean) => {
    setStoredOptIn(on);
    setOptIn(on);
    if (!on) {
      // Don't unload the running engine — model stays in memory until reload.
      // Just stop showing loading UI if it's mid-init.
      setState((s) => (s.status === 'loading' ? { status: 'idle' } : s));
    }
  }, []);

  /** Manual retry after error. */
  const retry = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  /**
   * Run inference. Returns null if both LLM and dictionary miss. Safe to call
   * regardless of state — when state is not 'ready' it short-circuits to the
   * dictionary lookup inside the client.
   */
  const infer = useCallback(
    async (vibe: string): Promise<VibeInferenceResult | null> => inferPreset(vibe),
    [],
  );

  return {
    state,
    optIn,
    setOptedIn,
    retry,
    infer,
  };
};
