// Utility for converting Float32Array PCM to 16-bit linear PCM base64 string
export function float32ToPcm16Base64(float32Array: Float32Array): string {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    // Clamp to -1.0 to 1.0 range
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Convert Int16Array buffer to binary string
  const uint8 = new Uint8Array(pcm16.buffer);
  let binary = "";
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

// Player for scheduled gapless playback of 24kHz raw PCM chunks from Gemini Live
export class LiveAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];

  constructor() {
    // Sample rate for gemini-3.8-live output is 24kHz
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.audioCtx = new AudioContextClass({ sampleRate: 24000 });
    }
  }

  async playChunk(base64Pcm: string) {
    if (!this.audioCtx) return;
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }

    try {
      const binaryString = atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert 16-bit PCM to Float32
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = this.audioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);

      const currentTime = this.audioCtx.currentTime;
      // Schedule playback to prevent gaps or overlapping clicks
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      this.activeSources.push(source);
      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx !== -1) {
          this.activeSources.splice(idx, 1);
        }
      };
    } catch (err) {
      console.error("LiveAudioPlayer decoding error:", err);
    }
  }

  stop() {
    this.activeSources.forEach((src) => {
      try {
        src.stop();
      } catch {
        // Ignore already stopped sources
      }
    });
    this.activeSources = [];
    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    }
  }

  async close() {
    this.stop();
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      await this.audioCtx.close();
    }
    this.audioCtx = null;
  }
}
