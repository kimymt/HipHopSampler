// Vitest global setup. Runs before every test file.
// Stubs Web Audio APIs that aren't in happy-dom but are used by hooks.

// Loose typing intentionally — we only need an API surface that satisfies
// the hooks under test, not full lib.dom AudioContext compliance.
type AnyCtor = new (...args: unknown[]) => unknown;

const g = globalThis as unknown as { AudioContext?: AnyCtor };

if (typeof g.AudioContext === 'undefined') {
  class FakeAudioContext {
    state = 'running';
    currentTime = 0;
    destination = { connect: () => {}, disconnect: () => {} };

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
      return {
        gain: { value: 1, setValueAtTime: () => {} },
        connect: () => {},
        disconnect: () => {},
      };
    }
    createStereoPanner() {
      return {
        pan: { value: 0, setValueAtTime: () => {} },
        connect: () => {},
        disconnect: () => {},
      };
    }
    decodeAudioData(_buf: ArrayBuffer, ok: (b: unknown) => void) {
      // Default: return a 1-second mono silent buffer.
      ok({
        duration: 1,
        numberOfChannels: 1,
        sampleRate: 44100,
        length: 44100,
        getChannelData: () => new Float32Array(44100),
      });
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  }
  g.AudioContext = FakeAudioContext as unknown as AnyCtor;
}
