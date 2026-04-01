/**
 * Gemini TTS çıktısını (base64 PCM, 24 kHz mono s16le) WAV kapsayıcısında indirilebilir Blob olarak üretir.
 * @see https://ai.google.dev/gemini-api/docs/speech-generation — inlineData PCM, ffmpeg örneği 24000 Hz mono
 */
class YtaiGeminiWavExport {

  static #SAMPLE_RATE = 24000;
  static #NUM_CHANNELS = 1;
  static #BITS_PER_SAMPLE = 16;

  static #writeAscii(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  /**
   * @param {string} base64Pcm — Gemini `inlineData.data` (ham PCM, WAV başlığı yok)
   * @returns {Blob} audio/wav
   */
  static pcmBase64ToWavBlob(base64Pcm) {
    const raw = atob(base64Pcm);
    const pcmBytes = raw.length;
    const rate = this.#SAMPLE_RATE;
    const ch = this.#NUM_CHANNELS;
    const bps = this.#BITS_PER_SAMPLE;
    const blockAlign = (ch * bps) / 8;
    const byteRate = rate * blockAlign;
    const headerSize = 44;
    const out = new ArrayBuffer(headerSize + pcmBytes);
    const view = new DataView(out);

    this.#writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmBytes, true);
    this.#writeAscii(view, 8, 'WAVE');
    this.#writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, ch, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bps, true);
    this.#writeAscii(view, 36, 'data');
    view.setUint32(40, pcmBytes, true);

    const dest = new Uint8Array(out, headerSize);
    for (let i = 0; i < pcmBytes; i++) dest[i] = raw.charCodeAt(i);

    return new Blob([out], { type: 'audio/wav' });
  }

  /**
   * @param {string} base64Pcm
   * @param {string} filename — .wav ile biterse korunur
   */
  static triggerDownload(base64Pcm, filename) {
    if (!base64Pcm || typeof base64Pcm !== 'string') return;
    const base = (filename || 'ytai-podcast').replace(/[^a-zA-Z0-9._-]+/g, '_');
    const name = base.toLowerCase().endsWith('.wav') ? base : `${base}.wav`;
    const blob = this.pcmBase64ToWavBlob(base64Pcm);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.YtaiGeminiWavExport = YtaiGeminiWavExport;
}
