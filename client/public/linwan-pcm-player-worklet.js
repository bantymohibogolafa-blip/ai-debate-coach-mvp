class LinWanPcmPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.offset = 0;
    this.started = false;
    this.ended = false;
    this.drained = false;
    this.underrun = false;
    this.playedFrames = 0;
    this.reportCountdown = 0;
    this.port.onmessage = (event) => {
      if (event.data?.type === 'chunk' && event.data.samples?.length) {
        this.queue.push(event.data.samples);
        this.underrun = false;
      } else if (event.data?.type === 'start') {
        this.started = true;
      } else if (event.data?.type === 'end') {
        this.ended = true;
      } else if (event.data?.type === 'clear') {
        this.queue = [];
        this.offset = 0;
        this.started = false;
        this.ended = true;
        this.drained = true;
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0]?.[0];
    if (!output) return true;
    output.fill(0);
    if (!this.started || this.drained) return true;

    let outputOffset = 0;
    while (outputOffset < output.length && this.queue.length) {
      const chunk = this.queue[0];
      const available = chunk.length - this.offset;
      const length = Math.min(available, output.length - outputOffset);
      output.set(chunk.subarray(this.offset, this.offset + length), outputOffset);
      outputOffset += length;
      this.offset += length;
      this.playedFrames += length;
      if (this.offset >= chunk.length) {
        this.queue.shift();
        this.offset = 0;
      }
    }

    this.reportCountdown -= 1;
    if (this.reportCountdown <= 0) {
      this.reportCountdown = 8;
      this.port.postMessage({ type: 'played', frames: this.playedFrames });
    }
    if (!this.queue.length && outputOffset < output.length) {
      if (this.ended) {
        this.drained = true;
        this.port.postMessage({ type: 'played', frames: this.playedFrames });
        this.port.postMessage({ type: 'drained' });
      } else if (!this.underrun) {
        this.underrun = true;
        this.port.postMessage({ type: 'underrun' });
      }
    }
    return true;
  }
}

registerProcessor('linwan-pcm-player', LinWanPcmPlayerProcessor);
