/**
 * PodcastPlayer — Web Audio API Podcast Engine
 * @architecture Singleton class
 * @version 2.0.0 — OOP refactor + rate-change bug fix
 *
 * BUG FIX: setRate() now correctly stores the position BEFORE
 * updating playbackRate, preventing position drift on rate change.
 */
class PodcastPlayer {

  static #instance = null;

  #audioContext = null;
  #sourceNode = null;
  #audioBuffer = null;
  #startTime = 0;
  #pauseOffset = 0;
  #isPlaying = false;
  #playbackRate = 1.0;
  #duration = 0;
  #onStateChange = null;
  #progressInterval = null;
  #stoppingForSeek = false;

  constructor() {
    if (PodcastPlayer.#instance) return PodcastPlayer.#instance;
    PodcastPlayer.#instance = this;
  }

  static getInstance() {
    if (!PodcastPlayer.#instance) {
      PodcastPlayer.#instance = new PodcastPlayer();
    }
    return PodcastPlayer.#instance;
  }

  // ─── State ─────────────────────────────────────────────────────────

  #getCurrentTime() {
    if (this.#isPlaying && this.#audioContext) {
      return Math.min(
        (this.#audioContext.currentTime - this.#startTime) * this.#playbackRate,
        this.#duration
      );
    }
    return Math.min(this.#pauseOffset, this.#duration);
  }

  #notifyState() {
    if (typeof this.#onStateChange === 'function') {
      this.#onStateChange({
        isPlaying: this.#isPlaying,
        currentTime: this.#getCurrentTime(),
        duration: this.#duration,
        rate: this.#playbackRate
      });
    }
  }

  #startProgressPolling() {
    this.#stopProgressPolling();
    this.#progressInterval = setInterval(() => this.#notifyState(), 250);
  }

  #stopProgressPolling() {
    if (this.#progressInterval) {
      clearInterval(this.#progressInterval);
      this.#progressInterval = null;
    }
  }

  // ─── Audio loading ─────────────────────────────────────────────────

  async loadAudio(base64Data) {
    if (!this.#audioContext) {
      this.#audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const raw = atob(base64Data);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const sampleRate = 24000;
    const numSamples = bytes.length / 2;
    this.#audioBuffer = this.#audioContext.createBuffer(1, numSamples, sampleRate);
    const channelData = this.#audioBuffer.getChannelData(0);

    const view = new DataView(bytes.buffer);
    for (let i = 0; i < numSamples; i++) {
      channelData[i] = view.getInt16(i * 2, true) / 32768;
    }

    this.#duration = this.#audioBuffer.duration;
    this.#pauseOffset = 0;
    this.#isPlaying = false;
    this.#notifyState();
  }

  // ─── Playback control ─────────────────────────────────────────────

  #stopSource() {
    if (this.#sourceNode) {
      this.#stoppingForSeek = true;
      try { this.#sourceNode.stop(); } catch {}
      this.#sourceNode.disconnect();
      this.#sourceNode = null;
      this.#stoppingForSeek = false;
    }
  }

  #startPlayback(offset) {
    if (!this.#audioBuffer || !this.#audioContext) return;

    if (this.#audioContext.state === 'suspended') {
      this.#audioContext.resume();
    }

    this.#stopSource();

    this.#sourceNode = this.#audioContext.createBufferSource();
    this.#sourceNode.buffer = this.#audioBuffer;
    this.#sourceNode.playbackRate.value = this.#playbackRate;
    this.#sourceNode.connect(this.#audioContext.destination);

    this.#sourceNode.onended = () => {
      if (this.#stoppingForSeek) return;
      const elapsed = this.#getCurrentTime();
      if (elapsed >= this.#duration - 0.1) {
        this.#isPlaying = false;
        this.#pauseOffset = 0;
        this.#stopProgressPolling();
        this.#notifyState();
      }
    };

    const safeOffset = Math.max(0, Math.min(offset, this.#duration - 0.01));
    this.#sourceNode.start(0, safeOffset);
    this.#startTime = this.#audioContext.currentTime - (safeOffset / this.#playbackRate);
    this.#isPlaying = true;
    this.#startProgressPolling();
    this.#notifyState();
  }

  play() {
    this.#startPlayback(this.#pauseOffset);
  }

  pause() {
    if (!this.#isPlaying) return;
    this.#pauseOffset = this.#getCurrentTime();
    this.#stopSource();
    this.#isPlaying = false;
    this.#stopProgressPolling();
    this.#notifyState();
  }

  togglePlayPause(base64Data) {
    if (!this.#audioBuffer && base64Data) {
      this.loadAudio(base64Data).then(() => this.play());
      return;
    }
    if (this.#isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  stop() {
    this.#stopSource();
    this.#isPlaying = false;
    this.#pauseOffset = 0;
    this.#stopProgressPolling();
    this.#notifyState();
  }

  seek(time) {
    const target = Math.max(0, Math.min(time, this.#duration));
    if (this.#isPlaying) {
      this.#startPlayback(target);
    } else {
      this.#pauseOffset = target;
      this.#notifyState();
    }
  }

  skipForward(seconds = 10) {
    this.seek(this.#getCurrentTime() + seconds);
  }

  skipBackward(seconds = 10) {
    this.seek(Math.max(0, this.#getCurrentTime() - seconds));
  }

  /**
   * BUG FIX: Read current position BEFORE updating rate, then
   * recalculate startTime with the NEW rate so the position is preserved.
   */
  setRate(rate) {
    const currentPos = this.#getCurrentTime(); // capture BEFORE rate change
    this.#playbackRate = Math.max(0.5, Math.min(2.0, rate));

    if (this.#isPlaying && this.#sourceNode) {
      this.#sourceNode.playbackRate.value = this.#playbackRate;
      // Recalculate startTime so getCurrentTime() returns currentPos correctly
      this.#startTime = this.#audioContext.currentTime - (currentPos / this.#playbackRate);
    }
    this.#notifyState();
  }

  setOnStateChange(cb) {
    this.#onStateChange = cb;
  }

  getState() {
    return {
      isPlaying: this.#isPlaying,
      currentTime: this.#getCurrentTime(),
      duration: this.#duration,
      rate: this.#playbackRate
    };
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  destroy() {
    this.stop();
    if (this.#audioContext) {
      this.#audioContext.close().catch(() => {});
      this.#audioContext = null;
    }
    this.#audioBuffer = null;
    this.#onStateChange = null;
    PodcastPlayer.#instance = null;
  }
}

// Export singleton — reassign lexical binding so bare `PodcastPlayer` resolves to the instance
const _podcastInstance = PodcastPlayer.getInstance();
PodcastPlayer = _podcastInstance;

if (typeof window !== 'undefined') {
  window.PodcastPlayer = _podcastInstance;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PodcastPlayer = _podcastInstance;
}
