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

  #extractor = null;
  #ui = null;
  #articleContent = null;
  #chatHistory = [];
  #requestTimestamps = [];
  #summaryCache = null;
  #isProcessing = false;

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
    
    console.log('[ArticleController] Initialized');
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
    this.#ui.on('modeChange', (data) => this.#onModeChange(data.mode));
    this.#ui.on('chatMessage', (data) => this.#onChatMessage(data.message));
    this.#ui.on('generateSummary', () => this.#showSummary(true));
    this.#ui.on('refresh', () => this.#onRefresh());
  }

  #ensureArticleContent() {
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

    // Default to Chat tab — do NOT auto-generate the summary (saves credits).
    const mode = this.#ui.getCurrentMode();
    if (mode === 'summary') {
      this.#showSummaryState();
    } else {
      this.#showChatHistory();
    }
  }

  #loadInitialCredits() {
    try {
      chrome.storage.local.get(['settings'], (result) => {
        const s = result?.settings || {};
        const plan = String(s.userPlan || '').toLowerCase();
        // Only show credits for managed (signed-in) users, not BYOK.
        if (plan && plan !== 'anonymous' && typeof s.credits === 'number') {
          this.#ui.updateCredits(s.credits);
        }
      });
    } catch { /* ignore */ }
  }

  #onModeChange(mode) {
    if (!this.#ensureArticleContent()) return;

    if (mode === 'summary') {
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
    
    if (!this.#checkRateLimit()) {
      this.#ui.showToast('Too many requests. Please wait a moment.');
      return;
    }

    if (!this.#articleContent) {
      this.#ui.showError('Article content not available. Please refresh.');
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
    } catch (err) {
      console.error('[ArticleController] Chat error:', err);
      // Remove the user message on error
      this.#chatHistory.pop();
      this.#ui.showChat(this.#chatHistory);
      this.#ui.showToast(this.#friendlyError(err));
    } finally {
      this.#isProcessing = false;
    }
  }

  #updateCredits(credits) {
    if (typeof credits === 'number') {
      this.#ui.updateCredits(credits);
    }
  }

  #friendlyError(err) {
    // Prefer the structured error code; fall back to matching the message text.
    const code = String(err?.code || '').toUpperCase();
    const msg = String(err?.message || '');
    const has = (re) => re.test(code) || re.test(msg);

    if (has(/NO_CREDITS|INSUFFICIENT_CREDITS/)) {
      return 'You are out of credits. Upgrade to Pro or add your own API key in settings.';
    }
    // Provider-side exhaustion/failure (Gemini/Ollama) — this is a system issue,
    // NOT the user's own rate cap. Tell them it's on us and to open a ticket.
    if (has(/AI_QUOTA_EXCEEDED|GEMINI_QUOTA|PROVIDER_UNAVAILABLE|SERVER_ERROR|PROVIDER_EMPTY_RESPONSE/)) {
      return 'System error: the AI service is temporarily unavailable. Please try again later, and if it persists, open a support ticket.';
    }
    // Our own per-account burst cap.
    if (has(/RATE_LIMITED|TOO MANY REQUESTS/)) {
      return "You've made a lot of requests in a short time. Please take a short break — or upgrade to Pro to skip the wait.";
    }
    if (has(/NO_API_KEY/)) {
      return 'Please sign in or add an API key in settings.';
    }
    if (has(/SESSION_EXPIRED|NOT_AUTHENTICATED/)) {
      return 'Your session expired. Please sign in again.';
    }
    return 'Something went wrong. Please try again.';
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
    if (this.#summaryCache && !forceRefresh) {
      this.#ui.showResult(this.#summaryCache);
      return;
    }

    if (!this.#ensureArticleContent()) return;

    if (this.#isProcessing) return;

    if (!this.#checkRateLimit()) {
      this.#ui.showToast('Too many requests. Please wait a moment.');
      return;
    }

    this.#isProcessing = true;
    this.#ui.showLoading('Generating summary...');

    try {
      const { content, credits } = await this.#sendToAI('summary');
      this.#summaryCache = content;
      this.#ui.showResult(content);
      this.#updateCredits(credits);
    } catch (err) {
      console.error('[ArticleController] Summary error:', err);
      this.#ui.showError(this.#friendlyError(err));
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
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], (result) => {
        resolve(result.settings || {});
      });
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
  if (typeof ArticleExtractor === 'undefined' || typeof ArticleUI === 'undefined') {
    console.error('[ArticleController] Dependencies not loaded');
    return;
  }
  
  const controller = ArticleController.getInstance();
  controller.init();
  
  window.gleanoArticleController = controller;
})();
