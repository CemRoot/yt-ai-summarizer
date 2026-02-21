/**
 * YouTube AI Summarizer — Podcast Audio Player
 * Plays PCM audio from Gemini TTS via AudioContext.
 */

const PodcastPlayer = (() => {
  let audioContext = null;
  let sourceNode = null;
  let audioBuffer = null;
  let startTime = 0;
  let pauseOffset = 0;
  let isPlaying = false;
  let isPaused = false;
  let playbackRate = 1.0;
  let duration = 0;
  let onStateChange = null;
  let progressInterval = null;

  function notifyState() {
    if (typeof onStateChange === 'function') {
      const currentTime = isPlaying && !isPaused
        ? (audioContext.currentTime - startTime) * playbackRate
        : pauseOffset;
      onStateChange({
        isPlaying,
        isPaused,
        currentTime: Math.min(currentTime, duration),
        duration,
        rate: playbackRate
      });
    }
  }

  function startProgressPolling() {
    stopProgressPolling();
    progressInterval = setInterval(notifyState, 250);
  }

  function stopProgressPolling() {
    if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
  }

  async function loadAudio(base64Data) {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Gemini TTS returns raw PCM s16le 24kHz mono
    const raw = atob(base64Data);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const sampleRate = 24000;
    const numSamples = bytes.length / 2;
    audioBuffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    const view = new DataView(bytes.buffer);
    for (let i = 0; i < numSamples; i++) {
      channelData[i] = view.getInt16(i * 2, true) / 32768;
    }

    duration = audioBuffer.duration;
    pauseOffset = 0;
    notifyState();
  }

  function play() {
    if (!audioBuffer || !audioContext) return;

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    if (sourceNode) {
      try { sourceNode.stop(); } catch { /* ignore */ }
    }

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.value = playbackRate;
    sourceNode.connect(audioContext.destination);

    sourceNode.onended = () => {
      if (isPlaying && !isPaused) {
        isPlaying = false;
        isPaused = false;
        pauseOffset = 0;
        stopProgressPolling();
        notifyState();
      }
    };

    sourceNode.start(0, pauseOffset);
    startTime = audioContext.currentTime - (pauseOffset / playbackRate);
    isPlaying = true;
    isPaused = false;
    startProgressPolling();
    notifyState();
  }

  function pause() {
    if (!isPlaying || isPaused) return;
    pauseOffset = (audioContext.currentTime - startTime) * playbackRate;
    try { sourceNode.stop(); } catch { /* ignore */ }
    isPaused = true;
    stopProgressPolling();
    notifyState();
  }

  function togglePlayPause(base64Data) {
    if (!audioBuffer && base64Data) {
      loadAudio(base64Data).then(() => play());
      return;
    }
    if (isPlaying && !isPaused) {
      pause();
    } else {
      play();
    }
  }

  function stop() {
    if (sourceNode) {
      try { sourceNode.stop(); } catch { /* ignore */ }
    }
    isPlaying = false;
    isPaused = false;
    pauseOffset = 0;
    stopProgressPolling();
    notifyState();
  }

  function seek(time) {
    pauseOffset = Math.max(0, Math.min(time, duration));
    if (isPlaying && !isPaused) {
      play();
    } else {
      notifyState();
    }
  }

  function skipForward(seconds = 10) {
    const current = isPlaying && !isPaused
      ? (audioContext.currentTime - startTime) * playbackRate
      : pauseOffset;
    seek(current + seconds);
  }

  function skipBackward(seconds = 10) {
    const current = isPlaying && !isPaused
      ? (audioContext.currentTime - startTime) * playbackRate
      : pauseOffset;
    seek(Math.max(0, current - seconds));
  }

  function setRate(rate) {
    playbackRate = Math.max(0.5, Math.min(2.0, rate));
    if (isPlaying && !isPaused && sourceNode) {
      sourceNode.playbackRate.value = playbackRate;
    }
    notifyState();
  }

  function setOnStateChange(cb) { onStateChange = cb; }

  function getState() {
    const currentTime = isPlaying && !isPaused && audioContext
      ? (audioContext.currentTime - startTime) * playbackRate
      : pauseOffset;
    return {
      isPlaying,
      isPaused,
      currentTime: Math.min(currentTime, duration),
      duration,
      rate: playbackRate
    };
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function destroy() {
    stop();
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    audioBuffer = null;
    onStateChange = null;
  }

  return {
    loadAudio,
    play,
    pause,
    togglePlayPause,
    stop,
    seek,
    skipForward,
    skipBackward,
    setRate,
    setOnStateChange,
    getState,
    formatTime,
    destroy
  };
})();

if (typeof window !== 'undefined') {
  window.PodcastPlayer = PodcastPlayer;
}
