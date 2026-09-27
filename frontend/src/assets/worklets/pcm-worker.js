const quantumSize = 128;

class TestProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.quantaPerFrame = 12;
    this.quantaCount = 0;
    this.frame = new Int16Array(quantumSize * this.quantaPerFrame);
  }

  process(inputs, outputs, parameters) {
    const offset = quantumSize * this.quantaCount;
    const input = inputs[0][0]; // mono
    if (input) {
      for (let i = 0; i < input.length; i++) {
        this.frame[offset + i] = Math.max(-32768, Math.min(32767, Math.floor(input[i] * 0x7fff)));
      }
      this.quantaCount++;
      if (this.quantaCount === this.quantaPerFrame) {
        this.port.postMessage(this.frame);
        this.quantaCount = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-worker', TestProcessor);
