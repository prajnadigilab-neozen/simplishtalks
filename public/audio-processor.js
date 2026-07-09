class VoiceCoachProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || !input[0]) return true;

        const channelData = input[0];

        // Calculate volume (RMS)
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
            sum += channelData[i] * channelData[i];

            // Add to PCM buffer
            this.buffer[this.bufferIndex++] = channelData[i];

            // When buffer is full, send to main thread
            if (this.bufferIndex >= this.bufferSize) {
                this.sendPcmData();
            }
        }

        const rms = Math.sqrt(sum / channelData.length);
        this.port.postMessage({ type: 'volume', volume: rms });

        return true;
    }

    sendPcmData() {
        // Convert Float32 (-1 to 1) to Int16 (-32768 to 32767)
        const pcmData = new Int16Array(this.bufferSize);
        for (let i = 0; i < this.bufferSize; i++) {
            pcmData[i] = Math.max(-32768, Math.min(32767, Math.floor(this.buffer[i] * 32768)));
        }

        this.port.postMessage({
            type: 'pcm',
            data: pcmData.buffer
        }, [pcmData.buffer]);

        this.bufferIndex = 0;
    }
}

registerProcessor('voice-coach-processor', VoiceCoachProcessor);
