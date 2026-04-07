/**
 * SummarizerController — Main Orchestration Layer
 * @architecture Singleton class
 * @version 2.0.0 — OOP refactor
 *
 * ARCHITECTURAL CHANGE: Removed window._ytai* globals.
 * Cross-module communication now uses CustomEvents dispatched on document.
 * SummarizerUI (singleton as `ui`) listens for 'ytai:request-summary', 'ytai:panel-open', etc.
 * This eliminates global namespace pollution and race conditions.
 */

try {
  document.documentElement.setAttribute('data-ytai-extension', 'loading');
} catch (e) { /* ignore */ }

// Singleton instances (must NOT use class names — those are already declared in other files' global scope)
const ui = globalThis.SummarizerUI;
const storage = globalThis.StorageHelper;
const tx = globalThis.TranscriptExtractor;
const player = globalThis.PodcastPlayer;

if (!ui || !storage || !tx || !player) {
  console.error('[YTAI] Content script deps missing — check script order in manifest.json', {
    SummarizerUI: !!ui,
    storage: !!storage,
    tx: !!tx,
    player: !!player
  });
}

const CHAT_HELPER_TEXT = 'Open a YouTube video to start chatting.';

class SummarizerController {

  static #instance = null;

  #currentVideoId = null;
  #combinedCache = null;  // { videoId, summary, keypoints, detailed }
  #podcastCache = null;   // { videoId, dialogue, audioBase64 }
  #chatCache = null;      // { videoId, messages: [] }
  #summaryCacheByVideo = new Map();
  #chatCacheByVideo = new Map();
  /** Ayrı pipeline bayrakları: sekme değişince diğer iş arka planda sürer, UI doğru sekmede kalır */
  #summaryBusy = false;
  #podcastBusy = false;
  #chatBusy = false;
  #initTimeout = null;

  constructor() {
    if (SummarizerController.#instance) return SummarizerController.#instance;
    SummarizerController.#instance = this;
    this.#bindEvents();
    this.#setupNavigationListeners();
    this.initialize().catch((e) => console.error('[YTAI] initialize failed', e));
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
        this.initialize().catch((e) => console.error('[YTAI] initialize (settings) failed', e));
        sendResponse({ ok: true });
      } else if (message.action === 'triggerSummary') {
        ui.autoOpen();
        this.requestSummary(message.mode || 'summary', true).catch(() => {});
        sendResponse({ ok: true });
      } else if (message.action === 'progress') {
        if (this.#isTextResultMode(ui.getCurrentMode())) {
          ui.showLoading(message.text, message.progress);
        }
        sendResponse({ ok: true });
      } else if (message.action === 'podcastProgress') {
        if (ui.getCurrentMode() === 'podcast') {
          ui.showPodcastLoading(message.text);
        }
        sendResponse({ ok: true });
      }

      return false;
    });
  }

  // ─── Navigation ────────────────────────────────────────────────────

  #setupNavigationListeners() {
    // Method 1: YouTube's custom SPA navigation event (most reliable)
    document.addEventListener('yt-navigate-finish', () => {
      if (this.#isYoutubeVideoPage()) {
        this.#debouncedInitialize();
      } else {
        this.#enterNonWatchState();
      }
    });

    // Method 2: Browser back/forward
    window.addEventListener('popstate', () => {
      if (this.#isYoutubeVideoPage()) {
        this.#debouncedInitialize();
      } else {
        this.#enterNonWatchState();
      }
    });

    // Method 3: URL polling (catches pushState navigations not covered above)
    let lastUrl = window.location.href;
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        if (this.#isYoutubeVideoPage()) {
          this.#debouncedInitialize();
        } else {
          this.#enterNonWatchState();
        }
      }
    }, 1000);
  }

  #debouncedInitialize() {
    clearTimeout(this.#initTimeout);
    this.#initTimeout = setTimeout(() => {
      this.#currentVideoId = null; // force re-init on SPA nav
      this.initialize().catch((e) => console.error('[YTAI] initialize (nav) failed', e));
    }, 800);
  }

  /** YouTube watch page, Shorts, or embed — extension should activate */
  #isYoutubeVideoPage() {
    const raw = window.location.pathname || '/';
    const p = raw.replace(/\/+$/, '') || '/';
    return p === '/watch' || p.startsWith('/shorts/') || /^\/embed\/[a-zA-Z0-9_-]{11}/.test(p);
  }

  #isWatchPage() {
    const raw = window.location.pathname || '/';
    const p = raw.replace(/\/+$/, '') || '/';
    return p === '/watch';
  }

  #isValidVideoId(videoId) {
    return typeof videoId === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(videoId);
  }

  #getChatPageContext() {
    if (!this.#isWatchPage()) {
      return { ok: false, errorCode: 'NOT_ON_VIDEO_PAGE' };
    }
    const videoId = tx.getVideoId();
    if (!this.#isValidVideoId(videoId)) {
      return { ok: false, errorCode: 'VIDEO_ID_MISSING' };
    }
    return { ok: true, videoId };
  }

  #ensureChatCache(videoId) {
    let cache = this.#chatCacheByVideo.get(videoId);
    if (!cache) {
      cache = { videoId, messages: [] };
      this.#chatCacheByVideo.set(videoId, cache);
    }
    this.#chatCache = cache;
    return cache;
  }

  #enterNonWatchState() {
    this.#currentVideoId = null;
    this.#summaryBusy = false;
    this.#podcastBusy = false;
    this.#chatBusy = false;
    this.#combinedCache = null;
    this.#podcastCache = null;
    this.#chatCache = null;
    player.destroy();

    if (ui.getCurrentMode?.() === 'chat') {
      ui.showChatUI([], {
        disabled: true,
        helperText: CHAT_HELPER_TEXT,
        noticeMessage: this.#getErrorPresentation('NOT_ON_VIDEO_PAGE').message
      });
    }
  }

  async #whenBodyReady() {
    for (let i = 0; i < 80 && !document.body; i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
    return !!document.body;
  }

  // ─── Initialization ────────────────────────────────────────────────

  async initialize() {
    if (!ui || !storage || !tx || !player) return;
    if (!this.#isYoutubeVideoPage()) {
      this.#enterNonWatchState();
      return;
    }

    if (!(await this.#whenBodyReady())) {
      console.error('[YTAI] document.body missing — cannot mount panel');
      return;
    }

    const videoId = tx.getVideoId();

    // Mount floating button + panel on any watch / Shorts / embed page (even if ID not parsed yet)
    ui.init();

    if (!videoId) {
      if (ui.isPanelOpen() && ui.getCurrentMode() === 'chat') {
        ui.showChatUI([], {
          disabled: true,
          helperText: CHAT_HELPER_TEXT,
          noticeMessage: this.#getErrorPresentation('VIDEO_ID_MISSING').message
        });
      }
      return;
    }
    if (videoId === this.#currentVideoId) return;

    this.#currentVideoId = videoId;
    this.#summaryBusy = false;
    this.#podcastBusy = false;
    this.#chatBusy = false;
    this.#combinedCache = this.#summaryCacheByVideo.get(videoId) || null;
    this.#podcastCache = null;
    this.#chatCache = this.#chatCacheByVideo.get(videoId) || null;
    player.destroy();

    const hasKey = await storage.hasApiKey();
    if (!hasKey && ui.isPanelOpen()) {
      ui.showApiKeyPrompt();
    }

    const settings = await storage.getSettings();
    if (settings.autoRun && hasKey) {
      ui.autoOpen();
      const cached = await storage.getCachedSummary(videoId, settings.defaultMode || 'summary');
      if (cached?.content) {
        const existing = this.#summaryCacheByVideo.get(videoId) || { videoId };
        existing[settings.defaultMode || 'summary'] = cached.content;
        this.#summaryCacheByVideo.set(videoId, existing);
        this.#combinedCache = existing;
        ui.showResult(cached.content);
      } else {
        ui.showReadyPrompt();
      }
    }

    if (ui.isPanelOpen()) {
      if (ui.getCurrentMode() === 'chat') this.requestChat();
      else this.onPanelOpen();
    }
  }

  #isTextResultMode(mode) {
    return mode === 'summary' || mode === 'keypoints' || mode === 'detailed';
  }

  // ─── Summary ──────────────────────────────────────────────────────

  async requestSummary(mode = 'summary', forceRefresh = false) {
    const videoId = tx.getVideoId();
    if (!videoId) return;

    const inMemory = this.#combinedCache?.videoId === videoId
      ? this.#combinedCache
      : this.#summaryCacheByVideo.get(videoId);

    // 1) In-memory cache → instant tab switch (even while busy)
    if (!forceRefresh && inMemory?.[mode]) {
      this.#combinedCache = inMemory;
      ui.showResult(inMemory[mode]);
      return;
    }

    // 2) Already generating → show loading for current tab, don't start a second request
    if (this.#summaryBusy) {
      ui.showLoading(null, -1);
      return;
    }

    const hasKey = await storage.hasApiKey();
    if (!hasKey) { ui.showApiKeyPrompt(); return; }

    // 3) Persistent cache
    if (!forceRefresh) {
      const cached = await storage.getCachedSummary(videoId, mode);
      if (cached?.content) {
        const existing = this.#summaryCacheByVideo.get(videoId) || { videoId };
        existing[mode] = cached.content;
        this.#summaryCacheByVideo.set(videoId, existing);
        this.#combinedCache = existing;
        ui.showResult(cached.content);
        return;
      }
    }

    // 4) Start generating
    this.#summaryBusy = true;
    ui.showLoading(null, 0);

    try {
      ui.showLoading('Extracting transcript...', 0.1);
      const transcript = await tx.getTranscript();
      if (!transcript?.fullText) throw new Error('NO_TRANSCRIPT');

      if (this.#isTextResultMode(ui.getCurrentMode())) {
        ui.showLoading('Sending to AI...', 0.2);
      }

      const settings = await storage.getSettings();
      const response = await chrome.runtime.sendMessage({
        action: 'summarizeAll',
        data: { transcript: transcript.fullText, language: settings.language || 'auto', videoId }
      });

      if (!response) throw new Error('API_ERROR: No response from extension. Please reload the page.');
      if (response.error) throw new Error(response.error);

      this.#combinedCache = {
        videoId,
        summary: response.summary,
        keypoints: response.keypoints,
        detailed: response.detailed
      };
      this.#summaryCacheByVideo.set(videoId, this.#combinedCache);

      if (response.provider) ui.updateProviderLabel(response.provider);

      for (const m of ['summary', 'keypoints', 'detailed']) {
        if (response[m]) {
          storage.cacheSummary(videoId, m, { content: response[m], model: response.model }).catch(() => {});
        }
      }

      const cur = ui.getCurrentMode();
      if (this.#isTextResultMode(cur) && this.#combinedCache[cur]) {
        ui.showResult(this.#combinedCache[cur]);
      }

    } catch (error) {
      if (this.#isTextResultMode(ui.getCurrentMode())) {
        this.#handleError(error);
      }
    } finally {
      this.#summaryBusy = false;
    }
  }

  // ─── Podcast ──────────────────────────────────────────────────────

  async requestPodcast() {
    const videoId = tx.getVideoId();
    if (!videoId) return;

    // 1) Cached podcast → instant show
    if (this.#podcastCache?.videoId === videoId && this.#podcastCache.dialogue) {
      ui.showPodcastPlayer(this.#podcastCache);
      return;
    }

    // 2) Already generating → show loading, don't start second request
    if (this.#podcastBusy) {
      ui.showPodcastLoading('Generating podcast...');
      return;
    }

    const settings = await storage.getSettings();
    if (!settings.geminiApiKey) { ui.showPodcastKeyPrompt(); return; }

    const summaryText = this.#combinedCache?.summary;
    if (!summaryText) {
      const cached = await storage.getCachedSummary(videoId, 'summary');
      if (cached?.content) {
        return this.#generatePodcastFromText(cached.content, videoId);
      }
      ui.showPodcastPlayer(null);
      return;
    }

    return this.#generatePodcastFromText(summaryText, videoId);
  }

  async #generatePodcastFromText(text, videoId) {
    if (this.#podcastBusy) {
      ui.showPodcastLoading('Generating podcast...');
      return;
    }
    this.#podcastBusy = true;
    ui.showPodcastLoading('Writing podcast script...');

    try {
      const settings = await storage.getSettings();
      const response = await chrome.runtime.sendMessage({
        action: 'generatePodcast',
        data: { summaryText: text, language: settings.language || 'auto' }
      });

      if (!response) throw new Error('No response from extension.');
      if (response.error) {
        if (response.error === 'GEMINI_KEY_MISSING') {
          if (ui.getCurrentMode() === 'podcast') ui.showPodcastKeyPrompt();
          return;
        }
        if (response.error === 'GEMINI_REGION_BLOCKED') {
          if (ui.getCurrentMode() === 'podcast') {
            ui.showError('Region Not Supported', 'Gemini TTS is not available in your region. This is a Google restriction.', false);
          }
          return;
        }
        if (response.error === 'GEMINI_RATE_LIMITED') {
          if (ui.getCurrentMode() === 'podcast') {
            ui.showError('Rate Limited', 'Too many requests. Please wait a moment and try again.', true);
          }
          return;
        }
        throw new Error(response.error);
      }

      this.#podcastCache = { videoId, dialogue: response.dialogue, audioBase64: response.audioBase64 };
      if (ui.getCurrentMode() === 'podcast') {
        ui.showPodcastPlayer(this.#podcastCache);
      }

    } catch (error) {
      if (ui.getCurrentMode() === 'podcast') {
        this.#handleError(error);
      }
    } finally {
      this.#podcastBusy = false;
    }
  }

  // ─── Chat ─────────────────────────────────────────────────────────

  requestChat() {
    const ctx = this.#getChatPageContext();
    if (!ctx.ok) {
      const mapped = this.#getErrorPresentation(ctx.errorCode);
      ui.showChatUI([], {
        disabled: true,
        helperText: CHAT_HELPER_TEXT,
        noticeMessage: mapped.message
      });
      return;
    }

    const chatCache = this.#ensureChatCache(ctx.videoId);
    ui.showChatUI(chatCache.messages);
  }

  async sendChatMessage(text) {
    if (this.#chatBusy) return;
    const ctx = this.#getChatPageContext();
    if (!ctx.ok) {
      this.requestChat();
      return;
    }
    const videoId = ctx.videoId;

    const hasKey = await storage.hasApiKey();
    if (!hasKey) {
      const chatCache = this.#ensureChatCache(videoId);
      const mapped = this.#getErrorPresentation('API_KEY_MISSING');
      chatCache.messages.push({ role: 'error', text: mapped.message });
      ui.addChatMessage('error', mapped.message);
      return;
    }

    const chatCache = this.#ensureChatCache(videoId);

    this.#chatCache = chatCache;
    chatCache.messages.push({ role: 'user', text });
    ui.addChatMessage('user', text);

    this.#chatBusy = true;
    ui.addChatMessage('loading', '');

    try {
      const transcript = await tx.getTranscript();
      if (!transcript?.fullText) throw new Error('NO_TRANSCRIPT');

      const settings = await storage.getSettings();
      const response = await chrome.runtime.sendMessage({
        action: 'chatWithVideo',
        data: {
          transcript: transcript.fullText,
          language: settings.language || 'auto',
          videoId,
          question: text,
          history: chatCache.messages.slice(0, -1)
        }
      });

      if (!response) throw new Error('API_ERROR: No response from extension. Please reload.');
      if (response.error) throw new Error(response.error);

      chatCache.messages.push({ role: 'ai', text: response.answer });
      ui.addChatMessage('ai', response.answer);

    } catch (error) {
      const mapped = this.#getErrorPresentation(this.#normalizeErrorCode(error));
      chatCache.messages.push({ role: 'error', text: mapped.message });
      ui.addChatMessage('error', mapped.message);
    } finally {
      this.#chatBusy = false;
    }
  }

  // ─── Panel open handler ───────────────────────────────────────────

  onPanelOpen() {
    const videoId = tx.getVideoId();
    if (!videoId) return;

    const mode = ui.getCurrentMode();

    if (this.#combinedCache?.videoId === videoId && this.#combinedCache[mode]) {
      ui.showResult(this.#combinedCache[mode]);
      return;
    }

    storage.hasApiKey().then(async (hasKey) => {
      if (!hasKey) { ui.showApiKeyPrompt(); return; }
      const cached = await storage.getCachedSummary(videoId, mode);
      if (cached?.content) {
        ui.showResult(cached.content);
      } else {
        ui.showReadyPrompt();
      }
    });
  }

  // ─── Error handling ───────────────────────────────────────────────

  #handleError(error) {
    const mapped = this.#getErrorPresentation(this.#normalizeErrorCode(error));
    ui.showError(mapped.title, mapped.message, mapped.retryable);
  }

  #normalizeErrorCode(error) {
    const errorMsg = String(error?.message || error || '').trim();
    if (!errorMsg) return 'UNKNOWN_ERROR';

    if (errorMsg === 'NOT_ON_VIDEO_PAGE') return 'NOT_ON_VIDEO_PAGE';
    if (errorMsg === 'VIDEO_ID_MISSING' || errorMsg === 'NO_VIDEO_ID') return 'VIDEO_ID_MISSING';
    if (errorMsg === 'API_KEY_MISSING') return 'API_KEY_MISSING';
    if (errorMsg === 'INVALID_API_KEY' || errorMsg === 'API_KEY_INVALID') return 'API_KEY_INVALID';
    if (errorMsg === 'RATE_LIMITED' || errorMsg === 'GEMINI_RATE_LIMITED') return 'PROVIDER_RATE_LIMIT';

    if (
      errorMsg === 'NO_TRANSCRIPT'
      || errorMsg === 'TRANSCRIPT_UNAVAILABLE'
      || errorMsg === 'TRANSCRIPT_NOT_READY'
      || errorMsg === 'TRANSCRIPT_EMPTY_RETRYABLE'
      || errorMsg === 'TRANSCRIPT_EMPTY_FINAL'
      || errorMsg === 'EMPTY_TRANSCRIPT'
      || errorMsg === 'TRANSCRIPT_REQUEST_STALE'
    ) {
      return 'TRANSCRIPT_UNAVAILABLE';
    }

    if (/failed to fetch|networkerror|network request failed|err_network/i.test(errorMsg)) {
      return 'NETWORK_ERROR';
    }

    if (errorMsg.startsWith('API_ERROR')) {
      const statusMatch = errorMsg.match(/API_ERROR:\s*(\d{3})/);
      const status = statusMatch ? Number(statusMatch[1]) : null;
      if (status === 401 || status === 403) return 'API_KEY_INVALID';
      if (status === 429) return 'PROVIDER_RATE_LIMIT';
      if (status && status >= 500) return 'PROVIDER_UNAVAILABLE';
      return 'PROVIDER_UNAVAILABLE';
    }

    if (errorMsg === 'PROVIDER_UNAVAILABLE') return 'PROVIDER_UNAVAILABLE';
    return 'UNKNOWN_ERROR';
  }

  #getErrorPresentation(errorCode) {
    const errorMap = {
      NOT_ON_VIDEO_PAGE: {
        title: 'Open a Video',
        message: 'You are not on a YouTube video page. Open a video to use Chat.',
        retryable: false
      },
      VIDEO_ID_MISSING: {
        title: 'Video Not Ready',
        message: 'We could not detect this video yet. Wait a moment and try again.',
        retryable: true
      },
      TRANSCRIPT_UNAVAILABLE: {
        title: chrome.i18n?.getMessage('noTranscript') || 'No Transcript',
        message: "This video's captions are unavailable right now.",
        retryable: true
      },
      API_KEY_MISSING: {
        title: 'API Key Required',
        message: 'Please add your API key in Settings to use Chat.',
        retryable: false
      },
      API_KEY_INVALID: {
        title: 'Invalid API Key',
        message: 'Your API key looks invalid. Please check your settings.',
        retryable: false
      },
      PROVIDER_RATE_LIMIT: {
        title: 'Rate Limited',
        message: 'Too many requests right now. Please wait a moment and try again.',
        retryable: true
      },
      PROVIDER_UNAVAILABLE: {
        title: 'Service Unavailable',
        message: 'The AI service is temporarily unavailable. Please try again soon.',
        retryable: true
      },
      NETWORK_ERROR: {
        title: 'Network Issue',
        message: 'Network connection issue detected. Check your connection and try again.',
        retryable: true
      },
      UNKNOWN_ERROR: {
        title: chrome.i18n?.getMessage('errorGeneric') || 'Error',
        message: 'Something went wrong. Please try again.',
        retryable: true
      }
    };
    return errorMap[errorCode] || errorMap.UNKNOWN_ERROR;
  }
}

// Instantiate — constructor wires everything up
if (ui && storage && tx && player) {
  SummarizerController.getInstance();
  try {
    document.documentElement.setAttribute('data-ytai-extension', chrome.runtime.id);
  } catch (e) { /* ignore */ }
} else {
  console.error('[YTAI] Boot aborted: content script globals not available');
}
