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
    this.#ui.on('refresh', () => this.#onRefresh());
  }

  async #onPanelOpen() {
    if (!this.#articleContent) {
      this.#ui.showLoading('Extracting article content...');
      
      const result = this.#extractor.extract();
      
      if (result.error) {
        this.#ui.showError(this.#getErrorMessage(result.error, result.message));
        return;
      }
      
      this.#articleContent = result;
    }

    const mode = this.#ui.getCurrentMode();
    if (mode === 'summary') {
      await this.#showSummary();
    } else if (mode === 'chat') {
      this.#showChatHistory();
    }
  }

  async #onModeChange(mode) {
    if (mode === 'summary') {
      await this.#showSummary();
    } else if (mode === 'chat') {
      this.#showChatHistory();
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

    this.#ui.appendChatMessage('user', message);
    this.#chatHistory.push({ role: 'user', content: message });

    this.#isProcessing = true;
    this.#ui.appendChatMessage('assistant', '...');

    try {
      const response = await this.#sendToAI('chat', message);
      
      this.#chatHistory.pop();
      this.#chatHistory.push({ role: 'user', content: message });
      this.#chatHistory.push({ role: 'assistant', content: response });
      
      this.#ui.showChat(this.#chatHistory);
    } catch (err) {
      console.error('[ArticleController] Chat error:', err);
      this.#chatHistory.pop();
      this.#ui.showChat(this.#chatHistory);
      this.#ui.showToast('Failed to get response. Please try again.');
    } finally {
      this.#isProcessing = false;
    }
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

    if (!this.#articleContent) {
      this.#ui.showError('Article content not available.');
      return;
    }

    if (!this.#checkRateLimit()) {
      this.#ui.showToast('Too many requests. Please wait a moment.');
      return;
    }

    this.#isProcessing = true;
    this.#ui.showLoading('Generating summary...');

    try {
      const summary = await this.#sendToAI('summary');
      this.#summaryCache = summary;
      this.#ui.showResult(summary);
    } catch (err) {
      console.error('[ArticleController] Summary error:', err);
      this.#ui.showError('Failed to generate summary. Please try again.');
    } finally {
      this.#isProcessing = false;
    }
  }

  #showChatHistory() {
    this.#ui.showChat(this.#chatHistory);
  }

  async #sendToAI(action, question = null) {
    const settings = await this.#getSettings();
    
    const payload = {
      action: action === 'summary' ? 'articleSummary' : 'articleChat',
      articleContent: this.#articleContent.textContent.substring(0, 80000),
      articleTitle: this.#articleContent.title,
      articleUrl: this.#articleContent.url,
      language: settings.language || 'en'
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
          reject(new Error(response.error));
          return;
        }
        
        resolve(response?.content || response?.result || 'No response received.');
      });
    });
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
      'blocked': 'This page type is not supported for security reasons (e.g., banking, email, login pages).',
      'not_readable': 'No readable article content found on this page. Try a news article or blog post.',
      'too_short': 'The article is too short to summarize. It needs at least 500 characters.',
      'parse_failed': 'Could not extract the article content. The page structure may not be supported.'
    };
    return messages[errorCode] || defaultMessage || 'An unexpected error occurred.';
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
