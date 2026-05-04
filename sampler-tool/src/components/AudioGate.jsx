import React from 'react';
import './AudioGate.css';

/**
 * Full-screen overlay shown when the AudioContext exists but is suspended
 * (autoplay policy or background-recovery). One tap unlocks audio.
 *
 * Only renders when:
 *   - An AudioContext has been created (isInitialized=true)
 *   - The context is currently suspended
 * The very first session start (uninitialized) doesn't show this — the user
 * implicitly creates the context by interacting (pad click, play).
 */
export const AudioGate = ({ contextState, isInitialized, onResume }) => {
  if (!isInitialized || contextState !== 'suspended') return null;

  return (
    <div className="audio-gate" role="dialog" aria-modal="true" onClick={onResume}>
      <div className="audio-gate-card">
        <div className="audio-gate-icon">🔊</div>
        <h3>音声を再開</h3>
        <p>バックグラウンドから戻りました。<br />画面のどこかをタップすると音が鳴るようになります。</p>
        <button className="audio-gate-btn" onClick={onResume}>タップで音声を有効化</button>
      </div>
    </div>
  );
};
