/**
 * Gleano - Article Controller
 * Orchestrates article extraction, AI summarization, and chat
 */

class ArticleController {
  static #instance = null;

  static #RATE_LIMIT = {
    maxRequests: 10,
    windowMs: 60000
  };

  /**
   * Canonical error code -> user-facing presentation. Frozen once (single object in
   * memory, O(1) lookup) so error rendering never allocates or branches on every call.
   */
  static #ERROR_PRESENTATION = Object.freeze({
    PROVIDER_KEY_MISSING: {
      title: 'Provider API key missing',
      message: 'The selected AI provider has no API key saved. Open Settings and add the key for that provider, or switch to the provider whose key you already added.',
      retryable: false
    },
    API_KEY_INVALID: {
      title: 'Invalid API key',
      message: 'Your API key looks invalid or was rejected. Check it in Settings.',
      retryable: false
    },
    NO_CREDITS: {
      title: 'Credits exhausted',
      message: 'You are out of credits. Upgrade to Pro, or add your own API key in Settings.',
      retryable: false
    },
    INSUFFICIENT_CREDITS: {
      title: 'Not enough credits',
      message: 'This needs more credits than you have. Upgrade to Pro, add your own API key, or try a shorter article.',
      retryable: false
    },
    PROVIDER_RATE_LIMIT: {
      title: 'Rate limited',
      message: 'Too many requests right now. Please wait a moment and try again.',
      retryable: true
    },
    PROVIDER_NOT_FOUND: {
      title: 'AI endpoint not found',
      message: 'The AI endpoint or model was not found (404). Check the selected model/provider in Settings.',
      retryable: false
    },
    PROVIDER_UNAVAILABLE: {
      title: 'Service unavailable',
      message: 'The AI service is temporarily unavailable. Please try again soon.',
      retryable: true
    },
    MANAGED_UNAVAILABLE: {
      title: 'Cloud AI unavailable',
      message: 'Cloud AI is temporarily unreachable. Please try again in a moment, or add your own API key in Settings.',
      retryable: true
    },
    AI_QUOTA_EXCEEDED: {
      title: 'AI temporarily unavailable',
      message: 'The AI service is temporarily over capacity on our side. Please try again later; if it persists, open a support ticket.',
      retryable: true
    },
    NETWORK_ERROR: {
      title: 'Network issue',
      message: 'Network connection issue detected. Check your connection and try again.',
      retryable: true
    },
    EMPTY_CONTENT: {
      title: 'Article unavailable',
      message: 'The article content could not be read. Please refresh the page and try again.',
      retryable: true
    },
    UNKNOWN_ERROR: {
      title: 'Something went wrong',
      message: 'Something went wrong. Please try again.',
      retryable: true
    }
  });

  #extractor = null;
  #ui = null;
  #articleContent = null;
  #chatHistory = [];
  #requestTimestamps = [];
  #summaryCache = null;
  #isProcessing = false;
  /** What to re-run after "Try again" or a successful sign-in from the error card. */
  #lastAction = null;

  /** Codes whose fix is in Settings (keys, provider, credits). */
  static #SETTINGS_CODES = new Set([
    'PROVIDER_KEY_MISSING', 'API_KEY_INVALID', 'NO_CREDITS', 'INSUFFICIENT_CREDITS', 'PROVIDER_NOT_FOUND'
  ]);

  constructor() {
    if (ArticleController.#instance) {
      return ArticleController.#instance;
    }
    ArticleController.#instance = this;
  }

  static getInstance() {
    if (!ArticleController.#instance) {
      ArticleController.#instance = new ArticleController();
    }
    return ArticleController.#instance;
  }

  async init() {
    this.#extractor = ArticleExtractor.getInstance();
    this.#ui = ArticleUI.getInstance();
    
    this.#ui.init();
    this.#setupEventHandlers();
    this.#watchAccountChanges();
  }

  /** Floating button / popup inject (service worker, isolated world). */
  startSummary() {
    this.#onStartSummary();
  }

  destroy() {
    this.#ui?.destroy();
    this.#extractor?.clearCache();
    this.#articleContent = null;
    this.#chatHistory = [];
    this.#summaryCache = null;
    ArticleController.#instance = null;
  }

  #setupEventHandlers() {
    this.#ui.on('panelOpen', () => this.#onPanelOpen());
    this.#ui.on('start-summary', () => this.#onStartSummary());
    this.#ui.on('modeChange', (data) => this.#onModeChange(data.mode));
    this.#ui.on('chatMessage', (data) => this.#onChatMessage(data.message));
    this.#ui.on('generateSummary', () => this.#showSummary(true));
    this.#ui.on('refresh', () => this.#onRefresh());
    this.#ui.on('errorAction', (data) => { void this.#onErrorAction(data); });
  }

  #forgetArticleIfPageChanged() {
    const current = location.href;
    if (!this.#articleContent || this.#articleContent.url === current) return;
    this.#articleContent = null;
    this.#summaryCache = null;
    this.#chatHistory = [];
    this.#extractor?.clearCache();
  }

  #ensureArticleContent() {
    this.#forgetArticleIfPageChanged();
    if (this.#articleContent) return true;

    const result = this.#extractor.extract();
    if (result.error) {
      this.#ui.showError(this.#getErrorMessage(result.error, result.message));
      return false;
    }
    this.#articleContent = result;
    return true;
  }

  async #onPanelOpen() {
    if (!this.#ensureArticleContent()) return;

    // Show current credit balance if available (managed users).
    this.#loadInitialCredits();

    // The button and the popup inject both open on Summary and start it.
    // Chat is a tab the user can choose afterwards.
    if (this.#ui.getCurrentMode() === 'summary') {
      await this.#showSummary(false);
    } else {
      this.#showChatHistory();
    }
  }

  /**
   * Floating button or service-worker inject. Switches to Summary, opens the
   * panel, and starts one summary. A second call while one is running returns
   * inside #showSummary.
   */
  #onStartSummary() {
    this.#ui.activateSummary();
    if (!this.#ui.isOpen()) {
      this.#ui.open();
      return;
    }
    void this.#showSummary(false);
  }

  #loadInitialCredits() {
    try {
      // StorageHelper writes settings as TOP-LEVEL keys (not nested under `settings`).
      chrome.storage.local.get(['userPlan', 'credits'], (result) => {
        const s = result || {};
        const plan = String(s.userPlan || '').toLowerCase();
        // Only show credits for managed (signed-in) users, not BYOK. A cleared
        // session resets credits to -1, which hides the badge.
        const managed = plan && plan !== 'anonymous' && typeof s.credits === 'number' && s.credits >= 0;
        this.#ui.updateCredits(managed ? s.credits : null);
      });
    } catch { /* ignore */ }
  }

  /** Sign-in, sign-out or an ended session elsewhere: keep the credit badge honest. */
  #watchAccountChanges() {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.credits || changes.userPlan || changes.supabaseRefreshToken) {
          this.#loadInitialCredits();
        }
      });
    } catch { /* extension context gone */ }
  }

  #onModeChange(mode) {
    if (!this.#ensureArticleContent()) return;

    if (mode === 'summary') {
      if (this.#isProcessing) {
        this.#ui.showLoading('Generating summary...');
        return;
      }
      this.#showSummaryState();
    } else if (mode === 'chat') {
      this.#showChatHistory();
    }
  }

  /**
   * Shows either the cached summary or the "Generate Summary" prompt.
   * Never triggers an AI call automatically.
   */
  #showSummaryState() {
    if (this.#summaryCache) {
      this.#ui.showResult(this.#summaryCache);
    } else {
      this.#ui.showSummaryPrompt({
        title: this.#articleContent?.title,
        excerpt: this.#articleContent?.excerpt
      });
    }
  }

  async #onChatMessage(message) {
    if (!message.trim() || this.#isProcessing) return;
    this.#forgetArticleIfPageChanged();
    
    if (!this.#checkRateLimit()) {
      this.#ui.showToast('Too many requests. Please wait a moment.');
      return;
    }

    if (!this.#ensureArticleContent()) return;

    this.#lastAction = { type: 'chat', message };

    // Pre-flight: instant, no network round-trip when the user has neither a key nor a session.
    const missing = await this.#missingAccessCode();
    if (missing) {
      await this.#showChatError({ code: missing });
      return;
    }

    // Add user message to history first
    this.#chatHistory.push({ role: 'user', content: message });
    this.#ui.showChat(this.#chatHistory);

    this.#isProcessing = true;
    
    // Show typing indicator
    const typingHistory = [...this.#chatHistory, { role: 'assistant', content: '...' }];
    this.#ui.showChat(typingHistory);

    try {
      const { content, credits } = await this.#sendToAI('chat', message);
      
      // Add AI response to history
      this.#chatHistory.push({ role: 'assistant', content });
      this.#ui.showChat(this.#chatHistory);
      this.#updateCredits(credits);
      this.#lastAction = null;
    } catch (err) {
      console.warn('[Gleano] Chat failed:', err?.code || '', err?.message || err);
      // Remove the failed user turn from the AI history, then show a persistent error bubble.
      this.#chatHistory.pop();
      await this.#showChatError(err);
    } finally {
      this.#isProcessing = false;
    }
  }

  /**
   * Render a persistent error bubble after the current history WITHOUT polluting
   * `#chatHistory` (the array sent to the AI), so retries stay clean and memory is unaffected.
   */
  async #showChatError(err) {
    const presented = await this.#presentError(err);
    // Sign-in problems need buttons, so they get the full card instead of a bubble.
    if (presented.signIn) {
      this.#renderErrorCard(presented);
      return;
    }
    this.#ui.showChat([...this.#chatHistory, { role: 'error', content: presented.message }]);
  }

  #updateCredits(credits) {
    if (typeof credits === 'number') {
      this.#ui.updateCredits(credits);
    }
  }

  /**
   * Map a raw error (structured code or message text) to a canonical error code.
   * Ordered if/else: most specific first. Pure string work — no allocation beyond a few
   * locals — so it stays cheap on the error path.
   */
  #normalizeErrorCode(err) {
    const code = String(err?.code || '').toUpperCase();
    const msg = String(err?.message || err || '').trim();
    if (!code && !msg) return 'UNKNOWN_ERROR';

    // 1) Structured codes (set by the service worker / ApiClient).
    if (code === 'NEEDS_AUTH_OR_KEY' || code === 'NOT_AUTHENTICATED') return 'NEEDS_AUTH_OR_KEY';
    if (code === 'SESSION_ENDED' || code === 'SESSION_EXPIRED') return 'SESSION_ENDED';
    if (code === 'AUTH_UNAVAILABLE') return 'AUTH_UNAVAILABLE';
    if (code === 'PROVIDER_KEY_MISSING') return 'PROVIDER_KEY_MISSING';
    if (code === 'INSUFFICIENT_CREDITS') return 'INSUFFICIENT_CREDITS';
    if (code === 'NO_CREDITS') return 'NO_CREDITS';
    if (code === 'RATE_LIMITED') return 'PROVIDER_RATE_LIMIT';
    if (code === 'AI_QUOTA_EXCEEDED') return 'AI_QUOTA_EXCEEDED';
    if (code === 'MANAGED_UNAVAILABLE') return 'MANAGED_UNAVAILABLE';
    if (code === 'API_KEY_INVALID' || code === 'GEMINI_KEY_INVALID') return 'API_KEY_INVALID';

    // 2) Plain message strings thrown by the service worker / providers.
    if (msg === 'NEEDS_AUTH_OR_KEY' || msg === 'NO_API_KEY') return 'NEEDS_AUTH_OR_KEY';
    if (msg === 'PROVIDER_KEY_MISSING') return 'PROVIDER_KEY_MISSING';
    if (msg === 'INSUFFICIENT_CREDITS') return 'INSUFFICIENT_CREDITS';
    if (msg === 'NO_CREDITS') return 'NO_CREDITS';
    if (msg === 'INVALID_API_KEY' || msg === 'API_KEY_INVALID') return 'API_KEY_INVALID';
    if (msg === 'RATE_LIMITED' || msg === 'GEMINI_RATE_LIMITED' || /too many requests/i.test(msg)) return 'PROVIDER_RATE_LIMIT';
    if (msg === 'INSUFFICIENT_CONTENT' || msg === 'EMPTY_QUESTION') return 'EMPTY_CONTENT';

    if (/exceeded your current quota|resource exhausted|GEMINI_QUOTA/i.test(msg)) return 'AI_QUOTA_EXCEEDED';

    // 3) BYOK provider HTTP errors: "API_ERROR: <status> - <message>".
    if (msg.startsWith('API_ERROR')) {
      const statusMatch = msg.match(/API_ERROR:\s*(\d{3})/);
      const status = statusMatch ? Number(statusMatch[1]) : null;
      if (status === 401 || status === 403) return 'API_KEY_INVALID';
      if (status === 404) return 'PROVIDER_NOT_FOUND';
      if (status === 429) return 'PROVIDER_RATE_LIMIT';
      if (status && status >= 500) return 'PROVIDER_UNAVAILABLE';
      return 'PROVIDER_UNAVAILABLE';
    }

    if (/failed to fetch|networkerror|network request failed|err_network/i.test(msg)) return 'NETWORK_ERROR';
    if (msg === 'PROVIDER_UNAVAILABLE') return 'PROVIDER_UNAVAILABLE';

    return 'UNKNOWN_ERROR';
  }

  /**
   * @returns {Promise<{ code: string, title: string, message: string, retryable: boolean, signIn: boolean }>}
   */
  async #presentError(err) {
    const code = this.#normalizeErrorCode(err);
    if (GleanoAuthState.AUTH_CODES.includes(code)) {
      const { email } = await GleanoAuthState.describe();
      return { code, ...GleanoAuthState.presentation(code, { email }) };
    }
    const map = ArticleController.#ERROR_PRESENTATION;
    return { code, signIn: false, ...(map[code] || map.UNKNOWN_ERROR) };
  }

  /** Error card with the buttons that fix it: sign in, settings, or retry. */
  #renderErrorCard(presented) {
    const labels = GleanoAuthState.labels();
    const actions = [];
    if (presented.signIn) {
      actions.push({ id: 'signIn', label: labels.signIn, primary: true, google: true });
      actions.push({ id: 'settings', label: labels.useOwnKey });
    } else if (ArticleController.#SETTINGS_CODES.has(presented.code)) {
      actions.push({ id: 'settings', label: ArticleController.#msg('settings', 'Open Settings'), primary: true });
    }
    if (presented.retryable) {
      actions.push({ id: 'retry', label: labels.retry, primary: actions.length === 0 });
    }
    this.#ui.showError(presented.message, presented.title, {
      tone: presented.signIn ? 'info' : 'error',
      actions
    });
  }

  static #msg(key, fallback) {
    try {
      return chrome.i18n?.getMessage(key) || fallback;
    } catch {
      return fallback;
    }
  }

  async #onErrorAction({ id, button } = {}) {
    if (id === 'settings') {
      chrome.runtime.sendMessage({ action: 'openSettings' }).catch(() => {});
      return;
    }
    if (id === 'retry') {
      await this.#rerunLastAction();
      return;
    }
    if (id !== 'signIn') return;

    const labels = GleanoAuthState.labels();
    const labelEl = button?.querySelector('span:last-child');
    if (button) button.disabled = true;
    if (labelEl) labelEl.textContent = labels.signingIn;

    const result = await GleanoAuthState.startGoogleSignIn();
    if (result.ok) {
      this.#loadInitialCredits();
      await this.#rerunLastAction();
      return;
    }
    if (button) button.disabled = false;
    if (labelEl) labelEl.textContent = labels.signIn;
    if (!/cancel/i.test(result.error || '')) this.#ui.showToast(labels.signInFailed, 3000);
  }

  async #rerunLastAction() {
    const last = this.#lastAction;
    if (last?.type === 'chat') {
      if (this.#ui.getCurrentMode() !== 'chat') this.#ui.showChat(this.#chatHistory);
      await this.#onChatMessage(last.message);
      return;
    }
    if (this.#ui.getCurrentMode() !== 'summary') return;
    await this.#showSummary(true);
  }

  /**
   * Fast, presence-only access pre-flight. API keys are stored obfuscated, so we cannot
   * (and must not) deobfuscate here — but a non-empty stored value still means a key exists.
   * @returns {Promise<null|'NEEDS_AUTH_OR_KEY'|'SESSION_ENDED'>} null when the request may go ahead
   */
  async #missingAccessCode() {
    const { status, hasByokKey } = await GleanoAuthState.describe();
    if (hasByokKey || status === 'signed_in') return null;
    return status === 'session_ended' ? 'SESSION_ENDED' : 'NEEDS_AUTH_OR_KEY';
  }

  async #onRefresh() {
    if (this.#isProcessing) return;
    
    const mode = this.#ui.getCurrentMode();
    if (mode === 'summary') {
      this.#summaryCache = null;
      await this.#showSummary(true);
    }
  }

  async #showSummary(forceRefresh = false) {
    this.#forgetArticleIfPageChanged();
    if (this.#summaryCache && !forceRefresh) {
      if (this.#ui.getCurrentMode() === 'summary') {
        this.#ui.showResult(this.#summaryCache);
      }
      return;
    }

    if (this.#isProcessing) return;

    if (!this.#ensureArticleContent()) return;

    if (!this.#checkRateLimit()) {
      this.#ui.showToast('Too many requests. Please wait a moment.');
      return;
    }

    // Set before the first await so a second click cannot pass the guard.
    this.#isProcessing = true;
    this.#lastAction = { type: 'summary' };
    try {
      // Pre-flight: avoid the spinner when the user has neither a key nor a session.
      const missing = await this.#missingAccessCode();
      if (missing) {
        if (this.#ui.getCurrentMode() === 'summary') {
          this.#renderErrorCard(await this.#presentError({ code: missing }));
        }
        return;
      }

      if (this.#ui.getCurrentMode() === 'summary') {
        this.#ui.showLoading('Generating summary...');
      }

      const requestedUrl = this.#articleContent?.url;
      const { content, credits } = await this.#sendToAI('summary');
      if (location.href !== requestedUrl) return;
      this.#summaryCache = content;
      if (this.#ui.getCurrentMode() === 'summary') {
        this.#ui.showResult(content);
      }
      this.#updateCredits(credits);
      this.#lastAction = null;
    } catch (err) {
      console.warn('[Gleano] Summary failed:', err?.code || '', err?.message || err);
      const presented = await this.#presentError(err);
      if (this.#ui.getCurrentMode() === 'summary') {
        this.#renderErrorCard(presented);
      }
    } finally {
      this.#isProcessing = false;
    }
  }

  #showChatHistory() {
    this.#ui.showChat(this.#chatHistory);
  }

  async #sendToAI(action, question = null) {
    const settings = await this.#getSettings();
    
    // Auto-detect language from article or use user's question language
    const articleLang = this.#articleContent.lang || 'auto';
    const detectedLang = this.#detectLanguage(question || this.#articleContent.textContent.substring(0, 500));
    const language = settings.language !== 'auto' ? settings.language : (detectedLang || articleLang);
    
    const payload = {
      action: action === 'summary' ? 'articleSummary' : 'articleChat',
      articleContent: this.#articleContent.textContent.substring(0, 80000),
      articleTitle: this.#articleContent.title,
      articleUrl: this.#articleContent.url,
      articleLang: articleLang,
      language: language
    };

    if (action === 'chat') {
      payload.question = question;
      payload.history = this.#chatHistory.slice(-10);
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response?.error) {
          const e = new Error(response.error);
          if (response.errorCode) e.code = response.errorCode;
          reject(e);
          return;
        }
        
        resolve({
          content: response?.content || response?.result || 'No response received.',
          credits: typeof response?.credits_remaining === 'number' ? response.credits_remaining : null
        });
      });
    });
  }

  #detectLanguage(text) {
    if (!text) return 'en';
    const sample = text.substring(0, 200).toLowerCase();
    
    // Turkish indicators
    if (/[şğüöçıİŞĞÜÖÇ]/.test(sample) || /\b(ve|bir|bu|için|ile|da|de|mi|mı)\b/.test(sample)) return 'tr';
    // Arabic
    if (/[\u0600-\u06FF]/.test(sample)) return 'ar';
    // Chinese
    if (/[\u4e00-\u9fff]/.test(sample)) return 'zh';
    // Japanese
    if (/[\u3040-\u30ff]/.test(sample)) return 'ja';
    // Korean
    if (/[\uac00-\ud7af]/.test(sample)) return 'ko';
    // Russian/Cyrillic
    if (/[\u0400-\u04FF]/.test(sample)) return 'ru';
    // Spanish
    if (/[áéíóúñ¿¡]/.test(sample) || /\b(el|la|los|las|es|son|que|por|para)\b/.test(sample)) return 'es';
    // French
    if (/[àâçéèêëîïôùûü]/.test(sample) || /\b(le|la|les|est|sont|que|pour|dans)\b/.test(sample)) return 'fr';
    // German
    if (/[äöüß]/.test(sample) || /\b(der|die|das|und|ist|sind|für)\b/.test(sample)) return 'de';
    
    return 'auto';
  }

  async #getSettings() {
    // StorageHelper persists settings as TOP-LEVEL keys (not nested under `settings`).
    // Read only the fields the article controller needs to avoid pulling caches.
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ['language', 'groqApiKey', 'ollamaApiKey', 'geminiApiKey', 'supabaseAccessToken', 'userPlan', 'credits'],
        (result) => resolve(result || {})
      );
    });
  }

  #checkRateLimit() {
    const now = Date.now();
    const windowStart = now - ArticleController.#RATE_LIMIT.windowMs;
    
    this.#requestTimestamps = this.#requestTimestamps.filter(ts => ts > windowStart);
    
    if (this.#requestTimestamps.length >= ArticleController.#RATE_LIMIT.maxRequests) {
      return false;
    }
    
    this.#requestTimestamps.push(now);
    return true;
  }

  #getErrorMessage(errorCode, defaultMessage) {
    const messages = {
      'blocked': chrome.i18n?.getMessage('articleBlocked') || 'This page type is not supported for security reasons (e.g., banking, email, login pages).',
      'not_readable': chrome.i18n?.getMessage('articleNotFound') || 'No readable article content found on this page. Try a news article or blog post.',
      'too_short': chrome.i18n?.getMessage('articleTooShort') || 'The article is too short to summarize. It needs at least 500 characters.',
      'parse_failed': chrome.i18n?.getMessage('articleError') || 'Could not extract the article content. The page structure may not be supported.'
    };
    return messages[errorCode] || defaultMessage || chrome.i18n?.getMessage('articleError') || 'An unexpected error occurred.';
  }

  getArticleMetadata() {
    return this.#extractor?.getMetadata() || null;
  }
}

(function initArticleReader() {
  if (
    typeof ArticleExtractor === 'undefined'
    || typeof ArticleUI === 'undefined'
    || typeof GleanoShadowHost === 'undefined'
    || typeof GleanoAuthState === 'undefined'
  ) {
    console.error('[ArticleController] Dependencies not loaded');
    return;
  }
  
  const controller = ArticleController.getInstance();
  controller.init();
  
  window.gleanoArticleController = controller;
})();
