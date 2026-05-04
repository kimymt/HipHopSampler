import React, { useEffect, useRef, useState } from 'react';
import './SampleDisplay.css';

const HANDLE_HIT_PX = 10;
const CHOP_HIT_PX = 8;

export const SampleDisplay = ({
  sample,
  onTrim,
  onLoopStart,
  onLoopStop,
  onSetIn,
  onSetOut,
  chopBoundaries,
  onChopBoundaryDrag,
}) => {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [draggingChop, setDraggingChop] = useState(null); // boundary index
  const [looping, setLooping] = useState(false);
  const [playheadTime, setPlayheadTime] = useState(null);
  const loopControllerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (!sample || !sample.buffer) {
      ctx.fillStyle = '#0a0908';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const audioBuffer = sample.buffer;
    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / canvas.width);
    const amp = canvas.height / 2;

    ctx.fillStyle = '#0a0908';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startX = (sample.startTime / audioBuffer.duration) * canvas.width;
    const endX = (sample.endTime / audioBuffer.duration) * canvas.width;

    ctx.fillStyle = 'rgba(20, 16, 12, 0.55)';
    if (startX > 0) ctx.fillRect(0, 0, startX, canvas.height);
    if (endX < canvas.width) ctx.fillRect(endX, 0, canvas.width - endX, canvas.height);

    ctx.strokeStyle = '#3a3328';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.lineTo(canvas.width, amp);
    ctx.stroke();

    let minValue = 1.0;
    let maxValue = -1.0;
    ctx.lineWidth = 2;
    for (let i = 0; i < canvas.width; i++) {
      const inTrim = i >= startX && i <= endX;
      ctx.strokeStyle = inTrim ? '#ff6f3d' : '#5a3a28';
      minValue = 1.0;
      maxValue = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = channelData[i * step + j];
        if (datum < minValue) minValue = datum;
        if (datum > maxValue) maxValue = datum;
      }
      ctx.beginPath();
      ctx.moveTo(i, amp - maxValue * amp);
      ctx.lineTo(i, amp - minValue * amp);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 204, 26, 0.06)';
    ctx.fillRect(startX, 0, endX - startX, canvas.height);

    // Chop group boundaries (other slices), drawn beneath IN/OUT for stacking
    if (chopBoundaries) {
      const { times, currentIndex } = chopBoundaries;
      times.forEach((t, idx) => {
        // Skip the two boundaries that match this pad's IN and OUT — those are
        // drawn as the bigger yellow markers below.
        if (idx === currentIndex || idx === currentIndex + 1) return;
        const x = (t / audioBuffer.duration) * canvas.width;
        ctx.strokeStyle = '#9a8a4a';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, 8);
        ctx.lineTo(x, canvas.height - 8);
        ctx.stroke();
        ctx.setLineDash([]);
        // Slice number tag at top
        ctx.fillStyle = 'rgba(154, 138, 74, 0.85)';
        ctx.font = '700 8px JetBrains Mono, Menlo, monospace';
        ctx.fillText(`${idx + 1}`, x - 3, 8);
      });
    }

    // IN / OUT (current pad's slice)
    ctx.strokeStyle = '#ffcc1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0); ctx.lineTo(startX, canvas.height);
    ctx.moveTo(endX, 0); ctx.lineTo(endX, canvas.height);
    ctx.stroke();

    ctx.fillStyle = '#ffcc1a';
    [startX, endX].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x - 5, 0); ctx.lineTo(x + 5, 0); ctx.lineTo(x, 6); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 5, canvas.height); ctx.lineTo(x + 5, canvas.height); ctx.lineTo(x, canvas.height - 6); ctx.fill();
    });

    ctx.fillStyle = '#ffcc1a';
    ctx.font = '700 9px JetBrains Mono, Menlo, monospace';
    ctx.fillText('IN', startX + 4, 14);
    ctx.fillText('OUT', endX - 22, 14);

    // Playhead (loop preview)
    if (playheadTime != null) {
      const phX = (playheadTime / audioBuffer.duration) * canvas.width;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(phX, 0); ctx.lineTo(phX, canvas.height);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(phX, amp, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [sample, playheadTime, chopBoundaries]);

  useEffect(() => {
    if (!looping || !loopControllerRef.current) return;
    let raf;
    const tick = () => {
      const pos = loopControllerRef.current?.getPosition();
      if (pos != null) setPlayheadTime(pos);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [looping]);

  useEffect(() => {
    return () => {
      loopControllerRef.current?.stop();
      loopControllerRef.current = null;
      setLooping(false);
      setPlayheadTime(null);
    };
  }, [sample?.buffer]);

  const xToTime = (clientX) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(1, x / rect.width)) * sample.buffer.duration;
  };

  const xToPx = (clientX) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * canvas.width;
  };

  const handlePointerDown = (e) => {
    if (!sample || !sample.buffer) return;
    const canvas = canvasRef.current;
    const startPx = (sample.startTime / sample.buffer.duration) * canvas.width;
    const endPx = (sample.endTime / sample.buffer.duration) * canvas.width;
    const px = xToPx(e.clientX);

    // 1. IN / OUT have priority (yellow markers)
    if (Math.abs(px - startPx) < HANDLE_HIT_PX) { setDragging('start'); return; }
    if (Math.abs(px - endPx) < HANDLE_HIT_PX) { setDragging('end'); return; }

    // 2. Chop boundaries (other slices' edges) — pick the nearest if within hit zone
    if (chopBoundaries) {
      const { times, currentIndex } = chopBoundaries;
      let bestIdx = -1;
      let bestDist = CHOP_HIT_PX;
      times.forEach((t, idx) => {
        if (idx === currentIndex || idx === currentIndex + 1) return; // skip — those are IN/OUT above
        if (idx === 0 || idx === times.length - 1) return; // outer edges of the chop range; not draggable here
        const x = (t / sample.buffer.duration) * canvas.width;
        const d = Math.abs(px - x);
        if (d < bestDist) { bestDist = d; bestIdx = idx; }
      });
      if (bestIdx >= 0) setDraggingChop(bestIdx);
    }
  };

  useEffect(() => {
    if (!dragging || !sample || !sample.buffer) return;
    const onMove = (e) => {
      const t = xToTime(e.clientX);
      if (dragging === 'start') {
        const next = Math.min(t, sample.endTime - 0.01);
        onTrim(Math.max(0, next), sample.endTime);
      } else {
        const next = Math.max(t, sample.startTime + 0.01);
        onTrim(sample.startTime, Math.min(sample.buffer.duration, next));
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, sample, onTrim]);

  useEffect(() => {
    if (draggingChop == null || !sample || !sample.buffer) return;
    const onMove = (e) => {
      const t = xToTime(e.clientX);
      onChopBoundaryDrag?.(draggingChop, t);
    };
    const onUp = () => setDraggingChop(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [draggingChop, sample, onChopBoundaryDrag]);

  const startLoop = () => {
    const ctrl = onLoopStart?.();
    if (ctrl) {
      loopControllerRef.current = ctrl;
      setLooping(true);
    }
  };

  const stopLoop = () => {
    loopControllerRef.current?.stop();
    loopControllerRef.current = null;
    onLoopStop?.();
    setLooping(false);
    setPlayheadTime(null);
  };

  const handleSetIn = () => {
    const pos = loopControllerRef.current?.getPosition();
    if (pos != null) onSetIn?.(pos);
  };

  const handleSetOut = () => {
    const pos = loopControllerRef.current?.getPosition();
    if (pos != null) onSetOut?.(pos);
  };

  if (!sample || !sample.buffer) {
    return <div className="sample-display empty">▬ NO SAMPLE LOADED ▬</div>;
  }

  const trimDuration = sample.endTime - sample.startTime;
  const fullDuration = sample.buffer.duration;
  const isTrimmed = sample.startTime > 0.001 || sample.endTime < fullDuration - 0.001;
  const inChopGroup = !!chopBoundaries;

  return (
    <div className="sample-display">
      <div className="display-label">
        <span><span className="label-tag">WAVE</span> · {sample.name}</span>
        <span className={isTrimmed ? 'duration-trimmed' : ''}>
          {trimDuration.toFixed(2)}s / {fullDuration.toFixed(2)}s
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={90}
        onPointerDown={handlePointerDown}
        style={{
          cursor: dragging || draggingChop != null ? 'ew-resize' : 'default',
          touchAction: 'none',
        }}
      />

      <div className="loop-controls">
        <button
          className={`loop-btn ${looping ? 'playing' : ''}`}
          onClick={looping ? stopLoop : startLoop}
        >
          {looping ? '■ STOP LOOP' : '↻ LOOP PLAY'}
        </button>

        {looping && (
          <>
            <button className="set-btn set-in" onClick={handleSetIn} title="Set IN at current playhead">
              ← SET IN HERE
            </button>
            <button className="set-btn set-out" onClick={handleSetOut} title="Set OUT at current playhead">
              SET OUT HERE →
            </button>
          </>
        )}
      </div>

      <div className="trim-info">
        <span className="trim-marker">IN</span>
        <span className="trim-time">{sample.startTime.toFixed(2)}s</span>
        <span className="trim-arrow">→</span>
        <span className="trim-marker">OUT</span>
        <span className="trim-time">{sample.endTime.toFixed(2)}s</span>
        {isTrimmed && <span className="trim-badge">TRIMMED</span>}
        {inChopGroup && <span className="chop-badge">CHOP {chopBoundaries.currentIndex + 1}/{chopBoundaries.times.length - 1}</span>}
      </div>

      <div className="trim-hint">
        {looping
          ? '🔊 ループ再生中。聞きながら SET IN / SET OUT で位置を決める'
          : inChopGroup
            ? '黄色マーカー = このパッドのIN/OUT。茶色の点線 = 他パッドの境界 (ドラッグで再配分)'
            : '波形の黄色マーカーをドラッグ、または ↻ LOOP PLAY で耳で聴きながら設定'}
      </div>
    </div>
  );
};
