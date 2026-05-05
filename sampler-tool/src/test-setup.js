// Vitest global setup. Runs before every test file.
// Stubs Web Audio APIs that aren't in happy-dom but are used by hooks.
import { vi } from 'vitest';

// AudioContext / OfflineAudioContext stubs — happy-dom doesn't provide them.
// Tests that need real audio decoding mock these per-file.
if (typeof globalThis.AudioContext === 'undefined') {
  globalThis.AudioContext = class {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.destination = { connect: () => {}, disconnect: () => {} };
    }
    createBufferSource() {
      return {
        buffer: null,
        start: () => {},
        stop: () => {},
        connect: () => {},
        disconnect: () => {},
        addEventListener: () => {},
      };
    }
    createGain() {
      return { gain: { value: 1, setValueAtTime: () => {} }, connect: () => {}, disconnect: () => {} };
    }
    createStereoPanner() {
      return { pan: { value: 0, setValueAtTime: () => {} }, connect: () => {}, disconnect: () => {} };
    }
    decodeAudioData(_buf, ok) {
      // Default: return a 1-second mono silent buffer.
      ok({ duration: 1, numberOfChannels: 1, sampleRate: 44100, length: 44100, getChannelData: () => new Float32Array(44100) });
    }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { return Promise.resolve(); }
  };
}
