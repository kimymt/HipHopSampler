/**
 * Audio latency measurement.
 *
 * Reads the two latency components the browser already exposes on
 * AudioContext, sums them into a "total" estimate, and classifies the
 * result against the project's 100ms target.
 *
 * Why not Audio Worklet round-trip measurement?
 *   We don't have a microphone-loopback path in this app, and a worklet-
 *   based round-trip would only measure software latency without the
 *   hardware output queue. The browser-reported values are what actually
 *   matters for the user-perceived sample → sound delay, and they include
 *   the hardware queue.
 *
 * Spec:
 *   - baseLatency = algorithmic latency of the audio graph (rendering
 *     the AudioBufferSource through the destination)
 *   - outputLatency = time between context.currentTime and when the audio
 *     is actually heard (includes the OS buffer queue + hardware)
 *
 * Both are reported in seconds. We convert to milliseconds for display.
 */

export type LatencyClassification = 'excellent' | 'good' | 'acceptable' | 'poor';

export interface LatencyReport {
  baseLatencyMs: number;
  outputLatencyMs: number;
  totalLatencyMs: number;
  sampleRate: number;
  classification: LatencyClassification;
  /** True if the browser reports both values (older browsers may not). */
  fullySupported: boolean;
}

const PROJECT_TARGET_MS = 100;

const classify = (totalMs: number): LatencyClassification => {
  if (totalMs <= 25) return 'excellent';
  if (totalMs <= 50) return 'good';
  if (totalMs <= PROJECT_TARGET_MS) return 'acceptable';
  return 'poor';
};

/**
 * Read the current latency report from a live AudioContext.
 * Returns null if no context is provided.
 *
 * Note: outputLatency may be 0 immediately after context creation —
 * call this AFTER the user has triggered at least one sound, or after
 * the context has been running long enough to populate hardware-queue stats.
 */
export const getAudioLatency = (ctx: AudioContext | null): LatencyReport | null => {
  if (!ctx) return null;

  // Older browsers don't have outputLatency. baseLatency is widely supported
  // but still optional in some Webkit builds. Coerce undefined → 0 and flag
  // partial support so the UI can warn.
  const baseLatency = (ctx as AudioContext & { baseLatency?: number }).baseLatency ?? 0;
  const outputLatency =
    (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;

  const baseLatencyMs = baseLatency * 1000;
  const outputLatencyMs = outputLatency * 1000;
  const totalLatencyMs = baseLatencyMs + outputLatencyMs;

  return {
    baseLatencyMs,
    outputLatencyMs,
    totalLatencyMs,
    sampleRate: ctx.sampleRate,
    classification: classify(totalLatencyMs),
    fullySupported: baseLatency > 0 && outputLatency > 0,
  };
};

export const PROJECT_LATENCY_TARGET_MS = PROJECT_TARGET_MS;
