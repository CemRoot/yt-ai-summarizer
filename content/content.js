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
const auth = globalThis.SupabaseAuth;
const deviceFp = globalThis.DeviceFingerprint;

if (!ui || !storage || !tx || !player) {
  console.error('[YTAI] Content script deps missing — check script order in manifest.json', {
    SummarizerUI: !!ui,
    storage: !!storage,
    tx: !!tx,
    player: !!player
  });
}

/**
 * Returns true if user has access to AI (either BYOK key or active Supabase session).
 * Caches session result for 30s to avoid repeated async calls.
 */
let _sessionCache = { session: null, ts: 0 };

/**
 * After chrome://extensions Reload, this tab still runs the OLD content script;
 * chrome.runtime APIs throw "Extension context invalidated" until the user refreshes the tab.
 */
function ytaiExtensionContextValid() {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/** True when extension was reloaded / disabled and this content script is stale. */
function ytaiShouldSilenceStaleExtensionError(err) {
  const chunks = [];
  if (err && typeof err === 'object') {
    if (err.message) chunks.push(String(err.message));
    if (err.stack) chunks.push(String(err.stack));
  } else {
    chunks.push(String(err));
  }
  const blob = chunks.join(' ').toLowerCase();
  return (
    blob.includes('extension context invalidated')
    || blob.includes('context invalidated')
    || blob.includes('receiving end does not exist')
  );
}

function ytaiLogInitFailure(label, err) {
  if (ytaiShouldSilenceStaleExtensionError(err)) return;
  console.error(`[YTAI] ${label} failed`, err);
}

async function hasAccess() {
  const hasKey = await storage.hasAnyByokApiKey();
  if (hasKey) return true;
  if (auth) {
    const now = Date.now();
    if (_sessionCache.session && (now - _sessionCache.ts) < 30000) return true;
    try {
      const session = await auth.getSession();
      if (session) {
        _sessionCache = { session, ts: now };
        return true;
      }
    } catch { /* no session */ }
  }
  return false;
}

class SummarizerController {

  static #instance = null;

  #currentVideoId = null;
  #combinedCache = null;  // { videoId, summary, keypoints, detailed }
  #podcastCache = null;   // { videoId, dialogue, audioBase64 }
  #chatCache = null;      // { videoId, messages: [] }
  #summaryCacheByVideo = new Map();
  #chatCacheByVideo = new Map();
  /** Separate pipeline flags: switching tabs keeps the other jobs running in the background while the UI stays on the correct tab. */
  #summaryBusy = false;
  #podcastBusy = false;
  #chatBusy = false;
  #initTimeout = null;

  constructor() {
    if (SummarizerController.#instance) return SummarizerController.#instance;
    SummarizerController.#instance = this;
    this.#bindEvents();
    this.#setupNavigationListeners();
    this.initialize().catch((e) => ytaiLogInitFailure('initialize', e));
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
      try {
        if (!ytaiExtensionContextValid()) return false;
        if (sender.id !== chrome.runtime.id) return false;

        if (message.action === 'settingsUpdated') {
          this.initialize()
            .then(() => { ui.refreshFooterProviderLabel?.(); })
            .catch((e) => ytaiLogInitFailure('initialize (settings)', e));
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
      } catch (err) {
        ytaiLogInitFailure('onMessage', err);
      }
      return false;
    });

    const panelAuthKey = typeof storage?.getPanelAuthSyncStorageKey === 'function'
      ? storage.getPanelAuthSyncStorageKey()
      : '';
    if (panelAuthKey && typeof chrome.storage?.onChanged?.addListener === 'function') {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes[panelAuthKey]) return;
        if (!ytaiExtensionContextValid()) return;
        this.#refreshPanelAuthAndCredits().catch((e) => ytaiLogInitFailure('panelAuthStorageSync', e));
      });
    }
  }

  // ─── Navigation ────────────────────────────────────────────────────

  #setupNavigationListeners() {
    // Method 1: YouTube's custom SPA navigation event (most reliable)
    document.addEventListener('yt-navigate-finish', () => {
      if (!ytaiExtensionContextValid()) return;
      if (this.#isYoutubeVideoPage()) {
        this.#debouncedInitialize();
      } else {
        this.#enterNonWatchState();
      }
    });

    // Method 2: Browser back/forward
    window.addEventListener('popstate', () => {
      if (!ytaiExtensionContextValid()) return;
      if (this.#isYoutubeVideoPage()) {
        this.#debouncedInitialize();
      } else {
        this.#enterNonWatchState();
      }
    });

    // Method 3: URL polling (catches pushState navigations not covered above)
    let lastUrl = window.location.href;
    setInterval(() => {
      if (!ytaiExtensionContextValid()) return;
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
      if (!ytaiExtensionContextValid()) return;
      this.#currentVideoId = null; // force re-init on SPA nav
      this.initialize().catch((e) => ytaiLogInitFailure('initialize (nav)', e));
    }, 800);
  }

  /** YouTube watch page, Shorts, or embed — extension should activate.
   *  Excludes music.youtube.com (different DOM, no transcript support). */
  #isYoutubeVideoPage() {
    const host = window.location.hostname || '';
    if (host === 'music.youtube.com') return false;
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

  #chatHelperText() {
    const lang = String(navigator?.language || '').toLowerCase();
    return lang.startsWith('tr')
      ? 'Sohbete başlamak için bir YouTube videosu açın.'
      : 'Open a YouTube video to start chatting.';
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
    ui.togglePanel(false);
  }

  async #whenBodyReady() {
    for (let i = 0; i < 80 && !document.body; i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
    return !!document.body;
  }

  // ─── Initialization ────────────────────────────────────────────────

  async initialize() {
    if (!ytaiExtensionContextValid()) return;
    if (!ui || !storage || !tx || !player) return;
    if (!this.#isYoutubeVideoPage()) {
      this.#enterNonWatchState();
      return;
    }

    try {
      await this.#initializeBody();
    } catch (err) {
      ytaiLogInitFailure('initialize', err);
    }
  }

  async #initializeBody() {
    if (!(await this.#whenBodyReady())) {
      console.error('[YTAI] document.body missing — cannot mount panel');
      return;
    }

    const videoId = tx.getVideoId();

    ui.init();

    // Pass auth session + credits to UI (non-blocking)
    if (auth) {
      auth.getSession()
        .then((session) => {
          ui.updateAuthBadge?.(session);
          if (session) {
            chrome.runtime.sendMessage({ action: 'checkCredits' })
              .then(async (cred) => {
                if (cred && !cred.error) {
                  await this.#applyManagedCreditsSnapshot(cred);
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }

    if (!videoId) {
      if (ui.isPanelOpen() && ui.getCurrentMode() === 'chat') {
        ui.showChatUI([], {
          disabled: true,
          helperText: this.#chatHelperText(),
          noticeMessage: this.#getErrorPresentation('VIDEO_ID_MISSING').message
        });
      }
      return;
    }

    if (videoId === this.#currentVideoId) {
      const canUseAI = await hasAccess();
      if (ui.isPanelOpen()) {
        if (canUseAI) {
          if (ui.getCurrentMode() === 'chat') this.requestChat();
          else this.onPanelOpen();
        } else {
          ui.showApiKeyPrompt();
        }
      }
      return;
    }

    this.#currentVideoId = videoId;
    this.#summaryBusy = false;
    this.#podcastBusy = false;
    this.#chatBusy = false;
    this.#combinedCache = this.#summaryCacheByVideo.get(videoId) || null;
    // Intentional: summary/chat caches are lightweight text and restored per-video from maps;
    // podcast payload is larger (audio) so we keep it ephemeral to the active video session only.
    this.#podcastCache = null;
    this.#chatCache = this.#chatCacheByVideo.get(videoId) || null;
    player.destroy();

    const canUseAI = await hasAccess();
    if (!canUseAI && ui.isPanelOpen()) {
      ui.showApiKeyPrompt();
    }

    const settings = await storage.getSettings();
    if (settings.autoRun && canUseAI) {
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

  /** Persist managed-user credit snapshot so early gates match the badge after refresh. */
  async #applyManagedCreditsSnapshot(cred) {
    if (!cred || cred.error) return;
    await storage.saveSettings({ credits: cred.credits, userPlan: cred.plan });
    ui.updateCredits(cred.credits, cred.plan);
    if (cred.plan === 'pro') ui.showManageSubscription?.();
  }

  /**
   * BYOK: always allow. If local `credits` is exhausted (0), refresh from Edge before blocking summarize/chat.
   */
  /**
   * If the Edge path will not run (no credits / not can_use), we need the *selected* provider’s key.
   * Avoids a long transcript fetch then a misleading NO_CREDITS when another provider’s key is saved.
   * @returns {Promise<{ ok: true } | { ok: false, mapped: { title: string, message: string, retryable: boolean } }>}
   */
  async #assertSelectedProviderTextKey() {
    const api = globalThis.ApiClient;
    let managedOk = false;
    if (auth && api && typeof api.checkCredits === 'function') {
      const live = await api.checkCredits().catch(() => null);
      if (live?.can_use) managedOk = true;
    }
    if (managedOk) return { ok: true };

    const s = await storage.getSettings();
    const provider = s.provider || 'groq';
    const key = String(provider === 'ollama' ? (s.ollamaApiKey || '') : (s.groqApiKey || '')).trim();
    if (key) {
      if (provider === 'groq' && !key.startsWith('gsk_')) {
        return { ok: false, mapped: this.#getErrorPresentation('API_KEY_INVALID') };
      }
      return { ok: true };
    }
    return { ok: false, mapped: this.#getErrorPresentation('PROVIDER_KEY_MISSING') };
  }

  async #ensureManagedCreditsNotExhausted() {
    const hasKey = await storage.hasAnyByokApiKey();
    if (hasKey) return true;

    const savedSettings = await storage.getSettings();
    const cc = savedSettings?.credits;
    // Positive balance or sentinel (-1 === "unknown, assume ok"): short-circuit so the
    // common path stays zero-RTT. For undefined/null (fresh session) or 0 (exhausted)
    // we fall through to a live checkCredits — managed-only users with just-consumed
    // free credits should NOT be routed to the BYOK fallback path (which used to
    // surface "Invalid API Key").
    if (typeof cc === 'number' && (cc > 0 || cc === -1)) return true;

    const api = globalThis.ApiClient;
    if (!auth || !api || typeof api.checkCredits !== 'function') {
      ui.showUpgradePrompt();
      ui.updateCredits(0, 'free');
      return false;
    }

    const live = await api.checkCredits().catch(() => null);
    if (!live || live.error) {
      // Transient managed failure for a user who has no BYOK key. Let the service-worker
      // path run — its `buildNoByokKeyError` now emits MANAGED_UNAVAILABLE (retryable UI)
      // instead of the old misleading "Invalid API Key". Returning true here keeps the
      // error messaging single-sourced in one place.
      return true;
    }

    await this.#applyManagedCreditsSnapshot(live);
    if (live.can_use === false) {
      ui.showUpgradePrompt();
      return false;
    }
    return true;
  }

  /** After popup/welcome sign-in or sign-out: sync header badge + credits without F5. */
  async #refreshPanelAuthAndCredits() {
    if (!ytaiExtensionContextValid()) return;
    _sessionCache = { session: null, ts: 0 };
    if (!auth) return;
    if (typeof auth.invalidateSessionCache === 'function') auth.invalidateSessionCache();
    try {
      const session = await auth.getSession();
      ui.updateAuthBadge?.(session);
      if (session) {
        const cred = await chrome.runtime.sendMessage({ action: 'checkCredits' }).catch(() => null);
        if (cred && !cred.error) {
          await this.#applyManagedCreditsSnapshot(cred);
          if (cred.plan !== 'pro') ui.dismissManageSubscriptionButton?.();
        }
      } else {
        ui.dismissManageSubscriptionButton?.();
        ui.updateCredits(null, 'free');
      }
    } catch (err) {
      ytaiLogInitFailure('refreshPanelAuthAndCredits', err);
    }
    try { ui.refreshFooterProviderLabel?.(); } catch { /* ignore */ }
    // Header is refreshed; the body could still be showing a stale `showApiKeyPrompt` — re-render it via `hasAccess()`.
    try {
      if (ui.isPanelOpen() && tx.getVideoId()) {
        if (ui.getCurrentMode() === 'chat') this.requestChat();
        else this.onPanelOpen();
      }
    } catch (e) {
      ytaiLogInitFailure('refreshPanelBodyAfterAuth', e);
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

    const canUseAI = await hasAccess();
    if (!canUseAI) { ui.showApiKeyPrompt(); return; }

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

    // 4) Early credit gate — avoid transcript extraction if credits exhausted (refresh if local cache is stale)
    if (!(await this.#ensureManagedCreditsNotExhausted())) return;
    const providerGate = await this.#assertSelectedProviderTextKey();
    if (!providerGate.ok) {
      const { mapped } = providerGate;
      ui.showError(mapped.title, mapped.message, mapped.retryable);
      return;
    }

    // 5) Start generating
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
      if (response.error) {
        throw this.#errorFromSwResponse(response);
      }

      this.#combinedCache = {
        videoId,
        summary: response.summary,
        keypoints: response.keypoints,
        detailed: response.detailed
      };
      this.#summaryCacheByVideo.set(videoId, this.#combinedCache);

      if (response.provider) ui.updateProviderLabel(response.provider);

      if (response.credits_remaining !== undefined) {
        ui.updateCredits(response.credits_remaining, response.plan || (response.credits_remaining > 100 ? 'pro' : 'free'));
        await storage.saveSettings({ credits: response.credits_remaining });
      }
      if (response.credits_used) ui.showCreditsUsed(response.credits_used);

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
        void this.#handleError(error).catch((e) => ytaiLogInitFailure('handleError', e));
      }
    } finally {
      this.#summaryBusy = false;
    }
  }

  // ─── Podcast ──────────────────────────────────────────────────────

  /**
   * Align with service-worker `getManagedMode`: valid session + `checkCredits().can_use`.
   * Session-only checks in the content script miss Pro users when `getSession` is stale;
   * BYOK Gemini setup must not appear for managed podcast.
   *
   * Conservative: if `checkCredits()` fails transiently (null/error), we return false to
   * match service-worker `getManagedMode` — otherwise users with no Gemini BYOK key see
   * a misleading "Writing podcast script…" spinner that fails later with `GEMINI_KEY_MISSING`.
   */
  async #canUseManagedPodcast() {
    // globalThis.ApiClient is the singleton INSTANCE (see utils/api-client.js), not the class — no .getInstance().
    const api = globalThis.ApiClient;
    if (!auth || !api || typeof api.checkCredits !== 'function') return false;

    let session = await auth.getSession().catch(() => null);
    if (!session?.access_token) {
      try {
        const st = await storage.getAuthState();
        if (st?.supabaseAccessToken && String(st.supabaseAccessToken).length > 20) {
          session = await auth.getSession().catch(() => null);
        }
      } catch { /* ignore */ }
    }
    if (!session?.access_token) return false;

    const credits = await api.checkCredits().catch(() => null);
    return Boolean(credits?.can_use);
  }

  /**
   * True when the user has an active Supabase session regardless of credit state.
   * Drives the "Your Google sign-in covers summaries and chat; podcast needs a
   * separate Gemini key" note in `ui.showPodcastKeyPrompt(isManagedUser)` — a
   * managed user with exhausted credits or a transient `checkCredits` failure
   * should still see the explanatory note, not the plain BYOK setup screen.
   */
  async #hasSupabaseSession() {
    if (!auth) return false;
    try {
      const session = await auth.getSession();
      return Boolean(session?.access_token);
    } catch {
      return false;
    }
  }

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
    const canManagedPodcast = await this.#canUseManagedPodcast();
    if (!settings.geminiApiKey?.trim() && !canManagedPodcast) {
      const isManagedUser = await this.#hasSupabaseSession();
      ui.showPodcastKeyPrompt(isManagedUser);
      return;
    }

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

    // Pre-flight credit gate — mirrors requestSummary (line 553) and sendChatMessage
    // (line 836). Without this, a managed user with 0 credits would see a ~2-second
    // "Writing podcast script..." spinner, then the edge 402 propagation, rather than
    // the upgrade prompt immediately. BYOK users skip this check inside the helper.
    if (!(await this.#ensureManagedCreditsNotExhausted())) return;

    this.#podcastBusy = true;
    ui.showPodcastLoading('Writing podcast script...');

    try {
      const settings = await storage.getSettings();
      const response = await chrome.runtime.sendMessage({
        action: 'generatePodcast',
        data: { summaryText: text, language: settings.language || 'auto', videoId }
      });

      if (!response) throw new Error('No response from extension.');
      if (response.error) {
        if (response.errorCode) {
          throw this.#errorFromSwResponse(response);
        }
        if (response.error === 'GEMINI_KEY_MISSING') {
          if (ui.getCurrentMode() === 'podcast') {
            const isManagedUser = await this.#hasSupabaseSession();
            ui.showPodcastKeyPrompt(isManagedUser);
          }
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
        if (
          typeof response.error === 'string'
          && (response.error.startsWith('GEMINI_QUOTA_EXCEEDED')
            || response.error.includes('exceeded your current quota'))
        ) {
          if (ui.getCurrentMode() === 'podcast') {
            ui.showError(
              'Gemini quota (podcast audio)',
              'Managed podcast uses Gemini for text-to-speech. This project’s Gemini key hit quota or billing limits. Enable billing in Google AI Studio or add your own Gemini key under Settings for podcast.',
              true
            );
          }
          return;
        }
        if (typeof response.error === 'string' && response.error.startsWith('GEMINI_API_KEY_INVALID')) {
          if (ui.getCurrentMode() === 'podcast') {
            ui.showError(
              'Gemini key (TTS)',
              'Supabase GEMINI_API_KEY is invalid or not allowed for TTS. Regenerate the key in Google AI Studio and update Edge secrets.',
              false
            );
          }
          return;
        }
        if (typeof response.error === 'string' && response.error.startsWith('GEMINI_TTS_ERROR')) {
          if (ui.getCurrentMode() === 'podcast') {
            ui.showError('Podcast audio failed', response.error.replace(/^GEMINI_TTS_ERROR:\s*/i, '').slice(0, 400), true);
          }
          return;
        }
        throw new Error(response.error);
      }

      this.#podcastCache = { videoId, dialogue: response.dialogue, audioBase64: response.audioBase64 };
      if (response.credits_remaining !== undefined) {
        ui.updateCredits(
          response.credits_remaining,
          response.plan || (response.credits_remaining > 100 ? 'pro' : 'free')
        );
        await storage.saveSettings({ credits: response.credits_remaining });
      }
      if (response.credits_used) ui.showCreditsUsed(response.credits_used);
      if (ui.getCurrentMode() === 'podcast') {
        ui.showPodcastPlayer(this.#podcastCache);
      }

    } catch (error) {
      if (ui.getCurrentMode() === 'podcast') {
        void this.#handleError(error).catch((e) => ytaiLogInitFailure('handleError', e));
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
        helperText: this.#chatHelperText(),
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

    const canUseAI = await hasAccess();
    if (!canUseAI) {
      const chatCache = this.#ensureChatCache(videoId);
      const mapped = this.#getErrorPresentation('API_KEY_MISSING');
      chatCache.messages.push({ role: 'error', text: mapped.message });
      ui.addChatMessage('error', mapped.message);
      return;
    }

    if (!(await this.#ensureManagedCreditsNotExhausted())) {
      const chatCache = this.#ensureChatCache(videoId);
      const mapped = this.#getErrorPresentation('NO_CREDITS');
      chatCache.messages.push({ role: 'error', text: mapped.message });
      ui.addChatMessage('error', mapped.message);
      return;
    }

    const providerGate = await this.#assertSelectedProviderTextKey();
    if (!providerGate.ok) {
      const chatCache = this.#ensureChatCache(videoId);
      const { mapped } = providerGate;
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
          history: chatCache.messages.slice(0, -1),
        }
      });

      if (!response) throw new Error('API_ERROR: No response from extension. Please reload.');
      if (response.error) {
        throw this.#errorFromSwResponse(response);
      }

      chatCache.messages.push({ role: 'ai', text: response.answer });
      ui.addChatMessage('ai', response.answer);

      if (response.credits_remaining !== undefined) {
        ui.updateCredits(response.credits_remaining, response.plan || (response.credits_remaining > 100 ? 'pro' : 'free'));
        await storage.saveSettings({ credits: response.credits_remaining });
      }
      if (response.credits_used) ui.showCreditsUsed(response.credits_used);

    } catch (error) {
      const code = this.#normalizeErrorCode(error);
      if (code === 'NO_CREDITS' || code === 'INSUFFICIENT_CREDITS') {
        const hasByok = await storage.hasAnyByokApiKey();
        if (!hasByok) {
          if (code === 'INSUFFICIENT_CREDITS') {
            const estimated = typeof error?.estimatedCredits === 'number' ? error.estimatedCredits : null;
            const available = typeof error?.availableCredits === 'number' ? error.availableCredits : null;
            ui.showInsufficientCreditsPrompt({ estimated, available });
            if (typeof available === 'number') ui.updateCredits(available, 'free');
          } else {
            ui.showUpgradePrompt();
            ui.updateCredits(0, 'free');
          }
        }
        const mapped = this.#getErrorPresentation(code);
        chatCache.messages.push({ role: 'error', text: mapped.message });
        ui.addChatMessage('error', mapped.message);
      } else {
        const mapped = this.#getErrorPresentation(code);
        chatCache.messages.push({ role: 'error', text: mapped.message });
        ui.addChatMessage('error', mapped.message);
      }
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

    hasAccess().then(async (canUseAI) => {
      if (!canUseAI) { ui.showApiKeyPrompt(); return; }
      const cached = await storage.getCachedSummary(videoId, mode);
      if (cached?.content) {
        ui.showResult(cached.content);
      } else {
        ui.showReadyPrompt();
      }
    });
  }

  // ─── Error handling ───────────────────────────────────────────────

  /**
   * Build a typed Error from a service-worker response that carried a
   * serialized ApiError. Preserves errorCode, upgradeUrl, and the
   * `estimated_credits` / `available_credits` pre-flight hint so the UI can
   * show "bu video ~N kredi, sende M var" when appropriate.
   */
  #errorFromSwResponse(response) {
    const err = new Error(response.error || 'Unknown error');
    if (response.errorCode) err.code = response.errorCode;
    if (response.upgradeUrl) err.upgradeUrl = response.upgradeUrl;
    if (typeof response.estimated_credits === 'number') err.estimatedCredits = response.estimated_credits;
    if (typeof response.available_credits === 'number') err.availableCredits = response.available_credits;
    return err;
  }

  #normalizeErrorCode(error) {
    const code = error?.code || '';
    const errorMsg = String(error?.message || error || '').trim();
    if (!errorMsg && !code) return 'UNKNOWN_ERROR';

    if (code === 'INSUFFICIENT_CREDITS' || errorMsg === 'INSUFFICIENT_CREDITS') return 'INSUFFICIENT_CREDITS';
    if (code === 'NO_CREDITS' || errorMsg === 'NO_CREDITS') return 'NO_CREDITS';
    if (code === 'PROVIDER_KEY_MISSING' || errorMsg === 'PROVIDER_KEY_MISSING') {
      return 'PROVIDER_KEY_MISSING';
    }
    if (code === 'AI_QUOTA_EXCEEDED') return 'AI_QUOTA_EXCEEDED';
    if (code === 'GEMINI_KEY_INVALID') return 'GEMINI_MANAGED_TTS_KEY';
    if (code === 'RATE_LIMITED') return 'MANAGED_RATE_LIMIT';
    if (code === 'MANAGED_UNAVAILABLE') return 'MANAGED_UNAVAILABLE';
    if (code === 'SESSION_EXPIRED' || code === 'NOT_AUTHENTICATED') return 'SESSION_EXPIRED';

    if (errorMsg === 'NOT_ON_VIDEO_PAGE') return 'NOT_ON_VIDEO_PAGE';
    if (errorMsg === 'VIDEO_ID_MISSING' || errorMsg === 'NO_VIDEO_ID') return 'VIDEO_ID_MISSING';
    if (errorMsg === 'API_KEY_MISSING') return 'API_KEY_MISSING';
    if (errorMsg === 'INVALID_API_KEY' || errorMsg === 'API_KEY_INVALID') return 'API_KEY_INVALID';
    if (errorMsg === 'RATE_LIMITED' || errorMsg === 'GEMINI_RATE_LIMITED') return 'PROVIDER_RATE_LIMIT';

    if (
      errorMsg.startsWith('GEMINI_QUOTA_EXCEEDED')
      || /exceeded your current quota|Resource exhausted|GEMINI_QUOTA/i.test(errorMsg)
    ) {
      return 'AI_QUOTA_EXCEEDED';
    }

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

  async #handleError(error) {
    const code = this.#normalizeErrorCode(error);
    if (code === 'NO_CREDITS') {
      if (await storage.hasAnyByokApiKey()) {
        ui.showReadyPrompt();
        return;
      }
      ui.showUpgradePrompt();
      ui.updateCredits(0, 'free');
      return;
    }
    if (code === 'INSUFFICIENT_CREDITS') {
      const estimated = typeof error?.estimatedCredits === 'number' ? error.estimatedCredits : null;
      const available = typeof error?.availableCredits === 'number' ? error.availableCredits : null;
      if (await storage.hasAnyByokApiKey()) {
        ui.showReadyPrompt();
        return;
      }
      ui.showInsufficientCreditsPrompt({ estimated, available });
      if (typeof available === 'number') ui.updateCredits(available, 'free');
      return;
    }
    const mapped = this.#getErrorPresentation(code);
    ui.showError(mapped.title, mapped.message, mapped.retryable);
  }

  /* original #handleError removed — replaced by the method above */

  #getErrorPresentation(errorCode) {
    const errorMap = {
      NO_CREDITS: {
        title: 'Credits Exhausted',
        message: 'Your free credits are used up. Upgrade to Pro or use your own API key.',
        retryable: false
      },
      INSUFFICIENT_CREDITS: {
        title: 'Not Enough Credits',
        message: 'This video needs more credits than you have. Upgrade to Pro, use your own API key, or try a shorter video.',
        retryable: false
      },
      MANAGED_RATE_LIMIT: {
        title: 'Rate Limited',
        message: 'Too many requests on managed AI. Wait a moment or use your own API key.',
        retryable: true
      },
      SESSION_EXPIRED: {
        title: 'Session Expired',
        message: 'Your session has expired. Please sign in again from Settings.',
        retryable: false
      },
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
      PROVIDER_KEY_MISSING: {
        title: 'Provider API Key Missing',
        message:
          'The AI provider you selected has no API key saved. Open Settings, paste the key for that provider, or switch to the provider whose key you already added.',
        retryable: false
      },
      API_KEY_INVALID: {
        title: 'Invalid API Key',
        message: 'Your API key looks invalid. Please check your settings.',
        retryable: false
      },
      MANAGED_UNAVAILABLE: {
        title: 'Managed AI Unavailable',
        message: 'Cloud AI is temporarily unreachable (session or credits check failed). Please try again in a moment, or add your own API key in Settings.',
        retryable: true
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
      AI_QUOTA_EXCEEDED: {
        title: 'AI quota limit',
        message:
          'Managed fallback (Google Gemini) hit quota or billing limits. Open Google AI Studio → billing / API key, or set platform primary to a working model. Podcast TTS also uses Gemini.',
        retryable: true
      },
      GEMINI_MANAGED_TTS_KEY: {
        title: 'Gemini key (podcast audio)',
        message:
          'Supabase GEMINI_API_KEY failed for TTS (invalid key or no access). Regenerate in Google AI Studio and update Edge secrets, or use your own Gemini key in Settings for podcast.',
        retryable: false
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
