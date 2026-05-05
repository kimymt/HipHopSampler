import React, { useEffect, useRef, useState } from 'react';
import './BottomSheet.css';

/**
 * Mobile bottom sheet. Snaps between half (default) and full height.
 *
 * Two drag surfaces:
 *  1. The handle area (top grip + header) — full drag-to-resize/dismiss.
 *  2. The body — drag-up-to-expand only, when the body is scrolled to the
 *     top. This lets users pull the sheet to full from anywhere instead of
 *     hunting for the small grip. Body scroll always wins when the body has
 *     content scrolled below the top, so reading long content stays smooth.
 *
 * `touch-action: pan-y` on the body explicitly tells iOS Safari "vertical
 * pan = scroll", which removes the latency before native scroll engages on
 * touch.
 */
export const BottomSheet = ({ open, onClose, title, children }) => {
  const [snap, setSnap] = useState('half'); // 'half' | 'full'
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef(null);
  const bodyRef = useRef(null);
  // When a drag starts inside the body, we only intercept it for sheet
  // resize/dismiss if the body itself can't scroll further in that direction
  // (i.e. scrollTop === 0 and user drags up, OR scrollTop === 0 and snap is
  // already half and user drags down). Otherwise we let native scroll win.
  const dragKindRef = useRef(null); // 'handle' | 'body' | null

  useEffect(() => {
    if (open) setSnap('half');
  }, [open]);

  if (!open) return null;

  const handleHandleDown = (e) => {
    startYRef.current = e.clientY;
    dragKindRef.current = 'handle';
  };

  const handleBodyDown = (e) => {
    // Skip drag detection when the gesture starts on an interactive child
    // (button, input, slider). Otherwise sliders / buttons would never get
    // their first move event.
    const target = e.target;
    if (target instanceof Element && target.closest('button, input, select, [role="slider"], [role="button"]')) {
      return;
    }
    startYRef.current = e.clientY;
    dragKindRef.current = 'body';
  };

  const handlePointerMove = (e) => {
    if (startYRef.current == null) return;
    const dy = e.clientY - startYRef.current;

    if (dragKindRef.current === 'body') {
      const bodyEl = bodyRef.current;
      const scrollTop = bodyEl?.scrollTop ?? 0;
      // If the body has scrolled below the top, native scroll is responsible
      // for vertical motion — don't fight it.
      if (scrollTop > 0) {
        startYRef.current = null;
        dragKindRef.current = null;
        return;
      }
      // Body at top + dragging UP from half → expand to full (one-shot).
      if (snap === 'half' && dy < -40) {
        setSnap('full');
        startYRef.current = null;
        dragKindRef.current = null;
        setDragOffset(0);
        return;
      }
      // Don't dismiss from body drag-down — keeps interactive content safe.
      // (Dismiss is reserved for the handle area.)
      return;
    }

    // Handle area drag: full resize + dismiss behavior.
    if (snap === 'half' && dy < -40) {
      setSnap('full');
      startYRef.current = null;
      dragKindRef.current = null;
      setDragOffset(0);
    } else if (dy > 0) {
      setDragOffset(dy);
    }
  };

  const handlePointerUp = () => {
    if (dragKindRef.current === 'handle' && dragOffset > 100) {
      onClose?.();
    }
    startYRef.current = null;
    dragKindRef.current = null;
    setDragOffset(0);
  };

  return (
    <div
      className={`bottom-sheet-root ${snap}`}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Detail'}
    >
      <div className="bottom-sheet-backdrop" onClick={onClose} />
      <div
        className={`bottom-sheet-card ${snap}`}
        style={{ transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined }}
      >
        <div
          className="bottom-sheet-handle-area"
          onPointerDown={handleHandleDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ touchAction: 'none' }}
        >
          <div className="bottom-sheet-handle" />
        </div>
        <div className="bottom-sheet-header">
          <span className="bottom-sheet-title">{title}</span>
          <button
            className="bottom-sheet-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div
          ref={bodyRef}
          className="bottom-sheet-body"
          onPointerDown={handleBodyDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
