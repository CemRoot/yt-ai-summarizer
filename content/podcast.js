/**
 * YouTube AI Summarizer — Podcast Player Engine
 * Uses Web Speech API to play two-host podcast conversations.
 */

const PodcastPlayer = (() => {
  let dialogue = [];
  let currentIndex = 0;
  let isPlaying = false;
  let isPaused = false;
  let currentUtterance = null;
  let playbackRate = 1.0;
  let voiceA = null;
  let voiceB = null;
  let onStateChange = null;
  let voicesLoaded = false;

  function loadVoices() {
    return new Promise((resolve) => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        voicesLoaded = true;
        resolve(voices);
        return;
      }
      speechSynthesis.onvoiceschanged = () => {
        voicesLoaded = true;
        resolve(speechSynthesis.getVoices());
      };
      setTimeout(() => resolve(speechSynthesis.getVoices()), 1000);
    });
  }

  async function pickVoices(lang) {
    const voices = await loadVoices();
    if (voices.length === 0) return;

    const langPrefix = (lang || navigator.language || 'en').substring(0, 2);

    const langVoices = voices.filter(v => v.lang.startsWith(langPrefix));
    const pool = langVoices.length >= 2 ? langVoices : voices.filter(v => v.lang.startsWith('en'));
    const finalPool = pool.length >= 2 ? pool : voices;

    // Try to pick one male-ish and one female-ish voice by name heuristics
    const maleHints = /male|guy|david|james|daniel|mark|alex|tom|google uk english male/i;
    const femaleHints = /female|woman|samantha|victoria|karen|zira|fiona|google uk english female/i;

    const males = finalPool.filter(v => maleHints.test(v.name));
    const females = finalPool.filter(v => femaleHints.test(v.name));

    if (males.length > 0 && females.length > 0) {
      voiceA = males[0];
      voiceB = females[0];
    } else if (finalPool.length >= 2) {
      voiceA = finalPool[0];
      voiceB = finalPool[1];
    } else {
      voiceA = finalPool[0] || null;
      voiceB = finalPool[0] || null;
    }
  }

  function notifyState() {
    if (typeof onStateChange === 'function') {
      onStateChange({
        isPlaying,
        isPaused,
        currentIndex,
        totalLines: dialogue.length,
        currentLine: dialogue[currentIndex] || null,
        rate: playbackRate
      });
    }
  }

  function speakLine(index) {
    if (index >= dialogue.length) {
      isPlaying = false;
      isPaused = false;
      currentIndex = 0;
      notifyState();
      return;
    }

    currentIndex = index;
    const line = dialogue[index];
    const utterance = new SpeechSynthesisUtterance(line.text);

    utterance.voice = line.speaker === 'A' ? voiceA : voiceB;
    utterance.rate = playbackRate;
    utterance.pitch = line.speaker === 'A' ? 1.0 : 1.15;

    currentUtterance = utterance;
    notifyState();

    utterance.onend = () => {
      if (!isPaused && isPlaying) {
        speakLine(index + 1);
      }
    };

    utterance.onerror = (e) => {
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      console.warn('[Podcast] Speech error:', e.error);
      if (isPlaying && !isPaused) {
        speakLine(index + 1);
      }
    };

    speechSynthesis.speak(utterance);
  }

  async function play(script, lang) {
    if (script && Array.isArray(script)) {
      dialogue = script;
      currentIndex = 0;
    }

    if (dialogue.length === 0) return;

    if (isPaused) {
      isPaused = false;
      isPlaying = true;
      speechSynthesis.resume();
      notifyState();
      return;
    }

    await pickVoices(lang);

    speechSynthesis.cancel();
    isPlaying = true;
    isPaused = false;
    speakLine(currentIndex);
  }

  function pause() {
    if (!isPlaying) return;
    isPaused = true;
    speechSynthesis.pause();
    notifyState();
  }

  function stop() {
    speechSynthesis.cancel();
    isPlaying = false;
    isPaused = false;
    currentIndex = 0;
    notifyState();
  }

  function skipForward() {
    if (!isPlaying || currentIndex >= dialogue.length - 1) return;
    speechSynthesis.cancel();
    isPaused = false;
    speakLine(currentIndex + 1);
  }

  function skipBackward() {
    if (!isPlaying || currentIndex <= 0) return;
    speechSynthesis.cancel();
    isPaused = false;
    speakLine(currentIndex - 1);
  }

  function setRate(rate) {
    playbackRate = Math.max(0.5, Math.min(2.0, rate));
    if (isPlaying && !isPaused) {
      const idx = currentIndex;
      speechSynthesis.cancel();
      isPaused = false;
      speakLine(idx);
    }
    notifyState();
  }

  function setOnStateChange(cb) {
    onStateChange = cb;
  }

  function getState() {
    return {
      isPlaying,
      isPaused,
      currentIndex,
      totalLines: dialogue.length,
      currentLine: dialogue[currentIndex] || null,
      rate: playbackRate
    };
  }

  function destroy() {
    stop();
    dialogue = [];
    onStateChange = null;
  }

  return {
    play,
    pause,
    stop,
    skipForward,
    skipBackward,
    setRate,
    setOnStateChange,
    getState,
    destroy
  };
})();

if (typeof window !== 'undefined') {
  window.PodcastPlayer = PodcastPlayer;
}
