import React, { useEffect, useRef } from 'react';
import './ReferenceWaveform.css';

interface Props {
  buffer: AudioBuffer;
  onsets: readonly number[];
  beatGrid: readonly number[];
  /** Display height in CSS pixels. */
  height?: number;
}

/**
 * Waveform with beat-grid + onset overlay (Reference Mode Phase 2).
 *
 * Visual conventions:
 *   - Waveform bars: warm bone color (matches DESIGN.md §3 hardware palette)
 *   - Beat grid: vertical lines at the estimated tempo, every 4th line
 *     (the downbeat candidate) drawn brighter. The user reads this as
 *     "the metronome ticks here".
 *   - Onsets: short red ticks above the waveform, marking real percussive
 *     hits the analyzer found. Density relative to the grid teaches the
 *     user about the rhythmic pattern (lots of hits between grid lines =
 *     16th-note feel, sparse alignment = simple boom-bap).
 *
 * Implementation: HiDPI-aware canvas, single-pass per dependency change.
 * No animation / no scrubbing — Phase 3 may add interactive playhead.
 *
 * Privacy: this component never extracts samples back out — it only paints.
 * The buffer is read once per render via `getChannelData(0)` and only
 * downsampled peaks are written to canvas. There is no readback path that
 * could reconstruct the original audio (per Reference Mode legal posture).
 */
export const ReferenceWaveform: React.FC<Props> = ({
  buffer,
  onsets,
  beatGrid,
  height = 120,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const draw = () => {
      const cssWidth = container.clientWidth;
      if (cssWidth <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = '#161310'; // --display-bg
      ctx.fillRect(0, 0, cssWidth, height);

      // Center line
      const centerY = height * 0.55; // waveform center lower-shifted to leave headroom for onset ticks
      ctx.strokeStyle = 'rgba(122, 115, 99, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(cssWidth, centerY);
      ctx.stroke();

      // Waveform peaks: bucket the channel into N=cssWidth pixels and draw
      // each as a vertical bar from min to max. One pass over channel data.
      const channelData = buffer.getChannelData(0);
      const samplesPerPixel = channelData.length / cssWidth;
      const waveTop = height * 0.18;
      const waveBottom = height - 8;
      const waveCenter = (waveTop + waveBottom) / 2;
      const waveHalfH = (waveBottom - waveTop) / 2;

      ctx.strokeStyle = '#e3ddc9'; // --bone
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < cssWidth; x++) {
        const start = Math.floor(x * samplesPerPixel);
        const end = Math.min(channelData.length, Math.floor((x + 1) * samplesPerPixel));
        let min = 0;
        let max = 0;
        for (let i = start; i < end; i++) {
          const s = channelData[i];
          if (s < min) min = s;
          if (s > max) max = s;
        }
        const yMin = waveCenter - max * waveHalfH;
        const yMax = waveCenter - min * waveHalfH;
        ctx.moveTo(x + 0.5, yMin);
        ctx.lineTo(x + 0.5, yMax);
      }
      ctx.stroke();

      // Beat grid: vertical lines at each beat position. Every 4th
      // (downbeat candidate) brighter so the user can pick out the bar.
      const duration = buffer.duration;
      ctx.lineWidth = 1;
      for (let i = 0; i < beatGrid.length; i++) {
        const x = (beatGrid[i] / duration) * cssWidth;
        const isDownbeat = i % 4 === 0;
        ctx.strokeStyle = isDownbeat
          ? 'rgba(255, 51, 34, 0.5)'  // --display-red, brighter
          : 'rgba(255, 51, 34, 0.18)'; // dim
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 4);
        ctx.lineTo(x + 0.5, height - 4);
        ctx.stroke();
      }

      // Onset ticks: short marks at the top of the canvas.
      ctx.strokeStyle = '#ff7755';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < onsets.length; i++) {
        const x = (onsets[i] / duration) * cssWidth;
        ctx.moveTo(x + 0.5, 2);
        ctx.lineTo(x + 0.5, 12);
      }
      ctx.stroke();
    };

    draw();

    // Redraw on container resize. ResizeObserver is widely supported
    // (Safari 13.1+, all modern Chromium / Firefox).
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [buffer, onsets, beatGrid, height]);

  return (
    <div ref={containerRef} className="reference-waveform">
      <canvas ref={canvasRef} aria-label="楽曲の波形とビート位置" role="img" />
      <div className="reference-waveform-legend">
        <span className="legend-item legend-grid">
          <span className="legend-swatch legend-swatch-grid" /> ビートグリッド (4 拍子目強調)
        </span>
        <span className="legend-item legend-onset">
          <span className="legend-swatch legend-swatch-onset" /> 検出されたヒット
        </span>
      </div>
    </div>
  );
};
