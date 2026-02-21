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
  let playbackRate = 1.0;
  let duration = 0;
  let onStateChange = null;
  let progressInterval = null;
  let stoppingForSeek = false;

  function getCurrentTime() {
    if (isPlaying && audioContext) {
      return Math.min((audioContext.currentTime - startTime) * playbackRate, duration);
    }
    return Math.min(pauseOffset, duration);
  }

  function notifyState() {
    if (typeof onStateChange === 'function') {
      onStateChange({
        isPlaying,
        currentTime: getCurrentTime(),
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
    isPlaying = false;
    notifyState();
  }

  function stopSource() {
    if (sourceNode) {
      stoppingForSeek = true;
      try { sourceNode.stop(); } catch { /* ignore */ }
      sourceNode.disconnect();
      sourceNode = null;
      stoppingForSeek = false;
    }
  }

  function startPlayback(offset) {
    if (!audioBuffer || !audioContext) return;

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    stopSource();

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.value = playbackRate;
    sourceNode.connect(audioContext.destination);

    sourceNode.onended = () => {
      if (stoppingForSeek) return;

      const elapsed = getCurrentTime();
      if (elapsed >= duration - 0.1) {
        isPlaying = false;
        pauseOffset = 0;
        stopProgressPolling();
        notifyState();
      }
    };

    const safeOffset = Math.max(0, Math.min(offset, duration - 0.01));
    sourceNode.start(0, safeOffset);
    startTime = audioContext.currentTime - (safeOffset / playbackRate);
    isPlaying = true;
    startProgressPolling();
    notifyState();
  }

  function play() {
    startPlayback(pauseOffset);
  }

  function pause() {
    if (!isPlaying) return;
    pauseOffset = getCurrentTime();
    stopSource();
    isPlaying = false;
    stopProgressPolling();
    notifyState();
  }

  function togglePlayPause(base64Data) {
    if (!audioBuffer && base64Data) {
      loadAudio(base64Data).then(() => play());
      return;
    }
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function stop() {
    stopSource();
    isPlaying = false;
    pauseOffset = 0;
    stopProgressPolling();
    notifyState();
  }

  function seek(time) {
    const target = Math.max(0, Math.min(time, duration));
    if (isPlaying) {
      startPlayback(target);
    } else {
      pauseOffset = target;
      notifyState();
    }
  }

  function skipForward(seconds = 10) {
    seek(getCurrentTime() + seconds);
  }

  function skipBackward(seconds = 10) {
    seek(Math.max(0, getCurrentTime() - seconds));
  }

  function setRate(rate) {
    playbackRate = Math.max(0.5, Math.min(2.0, rate));
    if (isPlaying && sourceNode) {
      const currentPos = getCurrentTime();
      sourceNode.playbackRate.value = playbackRate;
      startTime = audioContext.currentTime - (currentPos / playbackRate);
    }
    notifyState();
  }

  function setOnStateChange(cb) { onStateChange = cb; }

  function getState() {
    return {
      isPlaying,
      currentTime: getCurrentTime(),
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
    loadAudio, play, pause, togglePlayPause, stop,
    seek, skipForward, skipBackward, setRate,
    setOnStateChange, getState, formatTime, destroy
  };
})();

if (typeof window !== 'undefined') {
  window.PodcastPlayer = PodcastPlayer;
}
