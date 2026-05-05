/**
 * BitCrusher AudioWorklet — sample-rate reduction + bit-depth quantization.
 *
 * Two parameters:
 *   - bits (1..16): quantization bit depth. Lower = grittier.
 *   - reduction (1..50): downsample factor. Higher = more aliasing/dirt.
 *
 * Works on any channel count — processes each channel independently.
 *
 * Lives in public/ (not src/) so the browser can fetch it as a separate
 * worklet module via audioContext.audioWorklet.addModule('/bitcrusher-worklet.js').
 */
class BitCrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 16, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
      { name: 'reduction', defaultValue: 1, minValue: 1, maxValue: 50, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this._phaseCounter = 0;
    this._heldSamples = []; // per-channel "last held" sample for downsampling
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !output || input.length === 0) return true;

    const bits = parameters.bits[0];
    const reduction = Math.max(1, Math.floor(parameters.reduction[0]));
    const step = Math.pow(2, bits - 1);

    while (this._heldSamples.length < input.length) {
      this._heldSamples.push(0);
    }

    for (let ch = 0; ch < input.length; ch++) {
      const inCh = input[ch];
      const outCh = output[ch];
      if (!inCh || !outCh) continue;

      let phase = this._phaseCounter;
      let held = this._heldSamples[ch];

      for (let i = 0; i < inCh.length; i++) {
        if (phase % reduction === 0) {
          // quantize to the bit depth
          held = Math.round(inCh[i] * step) / step;
        }
        outCh[i] = held;
        phase++;
      }

      this._heldSamples[ch] = held;
    }
    this._phaseCounter += input[0].length;

    return true;
  }
}

registerProcessor('bitcrusher', BitCrusherProcessor);
