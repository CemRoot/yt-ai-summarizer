/**
 * SummarizerController — Main Orchestration Layer
 * @architecture Singleton class
 * @version 2.0.0 — OOP refactor
 *
 * ARCHITECTURAL CHANGE: Removed window._ytai* globals.
 * Cross-module communication now uses CustomEvents dispatched on document.
 * SummarizerUI listens for 'ytai:request-summary', 'ytai:panel-open', etc.
 * This eliminates global namespace pollution and race conditions.
 */
class SummarizerController {

  static #instance = null;

  #currentVideoId = null;
  #combinedCache = null;  // { videoId, summary, keypoints, detailed }
  #podcastCache = null;   // { videoId, dialogue, audioBase64 }
  #chatCache = null;      // { videoId, messages: [] }
  #isProcessing = false;
  #initTimeout = null;

  constructor() {
    if (SummarizerController.#instance) return SummarizerController.#instance;
    SummarizerController.#instance = this;
    this.#bindEvents();
    this.#setupNavigationListeners();
    this.initialize().catch(() => {});
  }

  static getInstance() {
    if (!SummarizerController.#instance) {
      SummarizerController.#instance = new SummarizerController();
    }
    return SummarizerController.#instance;
  }

  // ─── Event bindings ────────────────────────────────────────────────

  #bindEvents() {
    // Listen for UI-originated requests (replaces window._ytai* globals)
    document.addEventListener('ytai:request-summary', (e) => {
      const { mode = 'summary', forceRefresh = false } = e.detail || {};
      this.requestSummary(mode, forceRefresh).catch(() => {});
    });
    document.addEventListener('ytai:request-podcast', () => {
      this.requestPodcast().catch(() => {});
    });
    document.addEventListener('ytai:request-chat', () => {
      this.requestChat();
    });
    document.addEventListener('ytai:send-chat-message', (e) => {
      const { text } = e.detail || {};
      if (text) this.sendChatMessage(text).catch(() => {});
    });
    document.addEventListener('ytai:panel-open', () => {
      this.onPanelOpen();
    });

    // Listen for messages from service worker / popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id) return;

      if (message.action === 'settingsUpdated') {
        this.initialize().catch(() => {});
        sendResponse({ ok: true });
      } else if (message.action === 'triggerSummary') {
        SummarizerUI.autoOpen();
        this.requestSummary(message.mode || 'summary', true).catch(() => {});
        sendResponse({ ok: true });
      } else if (message.action === 'progress') {
        SummarizerUI.showLoading(message.text, message.progress);
        sendResponse({ ok: true });
      } else if (message.action === 'podcastProgress') {
        SummarizerUI.showPodcastLoading(message.text);
        sendResponse({ ok: true });
      }

      return false;
    });
  }

  // ─── Navigation ────────────────────────────────────────────────────

  #setupNavigationListeners() {
    // Method 1: YouTube's custom SPA navigation event (most reliable)
    document.addEventListener('yt-navigate-finish', () => {
      if (window.location.pathname === '/watch') {
        this.#debouncedInitialize();
      } else {
        this.#currentVideoId = null;
      }
    });

    // Method 2: Browser back/forward
    window.addEventListener('popstate', () => {
      if (window.location.pathname === '/watch') {
        this.#debouncedInitialize();
      }
    });

    // Method 3: URL polling (catches pushState navigations not covered above)
    let lastUrl = window.location.href;
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        if (window.location.pathname === '/watch') {
          this.#debouncedInitialize();
        }
      }
    }, 1000);
  }

  #debouncedInitialize() {
    clearTimeout(this.#initTimeout);
    this.#initTimeout = setTimeout(() => {
      this.#currentVideoId = null; // force re-init on SPA nav
      this.initialize().catch(() => {});
    }, 800);
  }

  // ─── Initialization ────────────────────────────────────────────────

  async initialize() {
    const videoId = TranscriptExtractor.getVideoId();
    if (!videoId) return;
    if (videoId === this.#currentVideoId) return;

    this.#currentVideoId = videoId;
    this.#isProcessing = false;
    this.#combinedCache = null;
    this.#podcastCache = null;
    this.#chatCache = null;
    PodcastPlayer.destroy();

    SummarizerUI.init();

    const hasKey = await StorageHelper.hasApiKey();
    if (!hasKey && SummarizerUI.isPanelOpen()) {
      SummarizerUI.showApiKeyPrompt();
    }

    const settings = await StorageHelper.getSettings();
    if (settings.autoRun && hasKey) {
      SummarizerUI.autoOpen();
      const cached = await StorageHelper.getCachedSummary(videoId, settings.defaultMode || 'summary');
      if (cached?.content) {
        SummarizerUI.showResult(cached.content);
      } else {
        SummarizerUI.showReadyPrompt();
      }
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────

  async requestSummary(mode = 'summary', forceRefresh = false) {
    if (this.#isProcessing) return;

    const videoId = TranscriptExtractor.getVideoId();
    if (!videoId) return;

    const hasKey = await StorageHelper.hasApiKey();
    if (!hasKey) {
      SummarizerUI.showApiKeyPrompt();
      return;
    }

    // Serve from in-memory cache (instant tab switch)
    if (!forceRefresh && this.#combinedCache?.videoId === videoId && this.#combinedCache[mode]) {
      SummarizerUI.showResult(this.#combinedCache[mode]);
      return;
    }

    // Serve from persistent cache
    if (!forceRefresh) {
      const cached = await StorageHelper.getCachedSummary(videoId, mode);
      if (cached?.content) {
        SummarizerUI.showResult(cached.content);
        return;
      }
    }

    this.#isProcessing = true;
    SummarizerUI.showLoading(null, 0);

    try {
      SummarizerUI.showLoading('Extracting transcript...', 0.1);
      const transcript = await TranscriptExtractor.getTranscript();
      if (!transcript?.fullText) throw new Error('NO_TRANSCRIPT');

      SummarizerUI.showLoading('Sending to AI...', 0.2);

      const settings = await StorageHelper.getSettings();
      const response = await chrome.runtime.sendMessage({
        action: 'summarizeAll',
        data: {
          transcript: transcript.fullText,
          language: settings.language || 'auto',
          videoId
        }
      });

      if (!response) throw new Error('API_ERROR: No response from extension. Please reload the page.');
      if (response.error) throw new Error(response.error);

      this.#combinedCache = {
        videoId,
        summary: response.summary,
        keypoints: response.keypoints,
        detailed: response.detailed
      };

      if (response.provider) SummarizerUI.updateProviderLabel(response.provider);

      // Persist all modes to storage
      for (const m of ['summary', 'keypoints', 'detailed']) {
        if (response[m]) {
          StorageHelper.cacheSummary(videoId, m, {
            content: response[m],
            model: response.model
          }).catch(() => {});
        }
      }

      SummarizerUI.showResult(response[mode]);

    } catch (error) {
      this.#handleError(error);
    } finally {
      this.#isProcessing = false;
    }
  }

  // ─── Podcast ──────────────────────────────────────────────────────

  async requestPodcast() {
    const videoId = TranscriptExtractor.getVideoId();
    if (!videoId) return;

    const settings = await StorageHelper.getSettings();
    if (!settings.geminiApiKey) {
      SummarizerUI.showPodcastKeyPrompt();
      return;
    }

    if (this.#podcastCache?.videoId === videoId && this.#podcastCache.dialogue) {
      SummarizerUI.showPodcastPlayer(this.#podcastCache);
      return;
    }

    const summaryText = this.#combinedCache?.summary;
    if (!summaryText) {
      const cached = await StorageHelper.getCachedSummary(videoId, 'summary');
      if (cached?.content) {
        return this.#generatePodcastFromText(cached.content, videoId);
      }
      SummarizerUI.showPodcastPlayer(null);
      return;
    }

    return this.#generatePodcastFromText(summaryText, videoId);
  }

  async #generatePodcastFromText(text, videoId) {
    if (this.#isProcessing) return;
    this.#isProcessing = true;
    SummarizerUI.showPodcastLoading('Writing podcast script...');

    try {
      const settings = await StorageHelper.getSettings();
      const response = await chrome.runtime.sendMessage({
        action: 'generatePodcast',
        data: { summaryText: text, language: settings.language || 'auto' }
      });

      if (!response) throw new Error('No response from extension.');
      if (response.error) {
        if (response.error === 'GEMINI_KEY_MISSING') { SummarizerUI.showPodcastKeyPrompt(); return; }
        if (response.error === 'GEMINI_REGION_BLOCKED') {
          SummarizerUI.showError('Region Not Supported', 'Gemini TTS is not available in your region. This is a Google restriction.', false);
          return;
        }
        if (response.error === 'GEMINI_RATE_LIMITED') {
          SummarizerUI.showError('Rate Limited', 'Too many requests. Please wait a moment and try again.', true);
          return;
        }
        throw new Error(response.error);
      }

      this.#podcastCache = { videoId, dialogue: response.dialogue, audioBase64: response.audioBase64 };
      SummarizerUI.showPodcastPlayer(this.#podcastCache);

    } catch (error) {
      this.#handleError(error);
    } finally {
      this.#isProcessing = false;
    }
  }

  // ─── Chat ─────────────────────────────────────────────────────────

  requestChat() {
    const videoId = TranscriptExtractor.getVideoId();
    if (!videoId) return;

    if (!this.#chatCache || this.#chatCache.videoId !== videoId) {
      this.#chatCache = { videoId, messages: [] };
    }

    SummarizerUI.showChatUI(this.#chatCache.messages);
  }

  async sendChatMessage(text) {
    if (this.#isProcessing) return;
    const videoId = TranscriptExtractor.getVideoId();
    if (!videoId) return;

    const hasKey = await StorageHelper.hasApiKey();
    if (!hasKey) { SummarizerUI.showApiKeyPrompt(); return; }

    if (!this.#chatCache || this.#chatCache.videoId !== videoId) {
      this.#chatCache = { videoId, messages: [] };
    }

    this.#chatCache.messages.push({ role: 'user', text });
    SummarizerUI.addChatMessage('user', text);

    this.#isProcessing = true;
    SummarizerUI.addChatMessage('loading', '');

    try {
      const transcript = await TranscriptExtractor.getTranscript();
      if (!transcript?.fullText) throw new Error('NO_TRANSCRIPT');

      const settings = await StorageHelper.getSettings();
      const response = await chrome.runtime.sendMessage({
        action: 'chatWithVideo',
        data: {
          transcript: transcript.fullText,
          language: settings.language || 'auto',
          videoId,
          question: text,
          history: this.#chatCache.messages.slice(0, -1)
        }
      });

      if (!response) throw new Error('API_ERROR: No response from extension. Please reload.');
      if (response.error) throw new Error(response.error);

      this.#chatCache.messages.push({ role: 'ai', text: response.answer });
      SummarizerUI.addChatMessage('ai', response.answer);

    } catch (error) {
      const msg = error?.message?.replace('API_ERROR: ', '') || 'Failed to get answer.';
      this.#chatCache.messages.push({ role: 'error', text: msg });
      SummarizerUI.addChatMessage('error', msg);
    } finally {
      this.#isProcessing = false;
    }
  }

  // ─── Panel open handler ───────────────────────────────────────────

  onPanelOpen() {
    const videoId = TranscriptExtractor.getVideoId();
    if (!videoId) return;

    const mode = SummarizerUI.getCurrentMode();

    if (this.#combinedCache?.videoId === videoId && this.#combinedCache[mode]) {
      SummarizerUI.showResult(this.#combinedCache[mode]);
      return;
    }

    StorageHelper.hasApiKey().then(async (hasKey) => {
      if (!hasKey) { SummarizerUI.showApiKeyPrompt(); return; }
      const cached = await StorageHelper.getCachedSummary(videoId, mode);
      if (cached?.content) {
        SummarizerUI.showResult(cached.content);
      } else {
        SummarizerUI.showReadyPrompt();
      }
    });
  }

  // ─── Error handling ───────────────────────────────────────────────

  #handleError(error) {
    const errorMsg = error?.message || error?.toString() || 'Unknown error';
    const errorMap = {
      'NO_VIDEO_ID':       { title: 'No Video Found',    message: 'Could not detect a YouTube video on this page.',                                              retryable: false },
      'NO_TRANSCRIPT':     { title: chrome.i18n?.getMessage('noTranscript') || 'No Transcript', message: "This video doesn't have captions/subtitles available.", retryable: false },
      'EMPTY_TRANSCRIPT':  { title: 'Empty Transcript',  message: 'The transcript was found but appears to be empty.',                                            retryable: true  },
      'INVALID_API_KEY':   { title: 'Invalid API Key',   message: 'Your API key is invalid. Please check your settings.',                                         retryable: false },
      'RATE_LIMITED':      { title: 'Rate Limited',      message: 'Too many requests. Please wait a moment and try again.',                                       retryable: true  }
    };

    const mapped = errorMap[errorMsg] || {
      title:     chrome.i18n?.getMessage('errorGeneric') || 'Error',
      message:   errorMsg.startsWith('API_ERROR') ? errorMsg.replace('API_ERROR: ', '') : 'An unexpected error occurred.',
      retryable: true
    };

    SummarizerUI.showError(mapped.title, mapped.message, mapped.retryable);
  }
}

// Instantiate — constructor wires everything up
SummarizerController.getInstance();
