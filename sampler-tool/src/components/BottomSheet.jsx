import React, { useEffect, useRef, useState } from 'react';
import './BottomSheet.css';

/**
 * Mobile bottom sheet. Snaps between half (default) and full height.
 * Drag the handle down past 100px to dismiss.
 */
export const BottomSheet = ({ open, onClose, title, children }) => {
  const [snap, setSnap] = useState('half'); // 'half' | 'full'
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef(null);

  useEffect(() => {
    if (open) setSnap('half');
  }, [open]);

  if (!open) return null;

  const handlePointerDown = (e) => {
    startYRef.current = e.clientY;
  };

  const handlePointerMove = (e) => {
    if (startYRef.current == null) return;
    const dy = e.clientY - startYRef.current;
    if (snap === 'half' && dy < -40) {
      setSnap('full');
      startYRef.current = null;
      setDragOffset(0);
    } else if (dy > 0) {
      setDragOffset(dy);
    }
  };

  const handlePointerUp = () => {
    if (dragOffset > 100) {
      onClose?.();
    }
    startYRef.current = null;
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
          onPointerDown={handlePointerDown}
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
        <div className="bottom-sheet-body">{children}</div>
      </div>
    </div>
  );
};
