/**
 * Gleano - Article UI
 * Side panel UI for article summarization and chat
 */

class ArticleUI {
  static #instance = null;

  static #msg(key, fallback = '') {
    try {
      return chrome.i18n?.getMessage(key) || fallback;
    } catch {
      return fallback;
    }
  }

  static #LOGO_URL = chrome.runtime.getURL('icons/icon32.png');

  static #logoImg(size = 20) {
    return `<img src="${ArticleUI.#LOGO_URL}" width="${size}" height="${size}" alt="" class="gleano-logo-img" aria-hidden="true">`;
  }

  static #ICONS = {
    close: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
    article: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/></svg>'
  };

  #panelRoot = null;
  #isOpen = false;
  #currentMode = 'chat';
  #isDarkMode = false;
  #chatMessages = [];
  #eventHandlers = {};
  #themeMediaQuery = null;
  #themeChangeHandler = null;

  constructor() {
    if (ArticleUI.#instance) {
      return ArticleUI.#instance;
    }
    ArticleUI.#instance = this;
  }

  static getInstance() {
    if (!ArticleUI.#instance) {
      ArticleUI.#instance = new ArticleUI();
    }
    return ArticleUI.#instance;
  }

  init() {
    if (this.#panelRoot) return;
    
    this.#detectTheme();
    this.#createToggleButton();
    this.#createPanel();
    this.#setupEventListeners();
  }

  destroy() {
    if (this.#themeMediaQuery && this.#themeChangeHandler) {
      this.#themeMediaQuery.removeEventListener('change', this.#themeChangeHandler);
    }
    this.#themeMediaQuery = null;
    this.#themeChangeHandler = null;
    if (this.#panelRoot) {
      this.#panelRoot.remove();
      this.#panelRoot = null;
    }
    const btn = document.getElementById('gleano-article-toggle');
    if (btn) btn.remove();
    this.#isOpen = false;
    this.#chatMessages = [];
    ArticleUI.#instance = null;
  }

  #detectTheme() {
    // Follow the OS/system theme, NOT the website's theme. Day = light, night = dark.
    this.#themeMediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') || null;
    this.#isDarkMode = !!this.#themeMediaQuery?.matches;

    // Update live when the system theme changes.
    this.#themeChangeHandler = (e) => {
      this.#isDarkMode = e.matches;
      this.#applyTheme();
    };
    this.#themeMediaQuery?.addEventListener('change', this.#themeChangeHandler);
  }

  #applyTheme() {
    this.#panelRoot?.classList.toggle('dark', this.#isDarkMode);
    const btn = document.getElementById('gleano-article-toggle');
    btn?.classList.toggle('dark', this.#isDarkMode);
  }

  #scrollToBottom() {
    // The scroll container is .gleano-content (overflow-y: auto), NOT #gleanoResult.
    const content = this.#panelRoot?.querySelector('.gleano-content');
    if (!content) return;
    requestAnimationFrame(() => {
      content.scrollTop = content.scrollHeight;
    });
  }

  #createToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'gleano-article-toggle';
    btn.className = 'gleano-toggle-btn' + (this.#isDarkMode ? ' dark' : '');
    btn.innerHTML = ArticleUI.#ICONS.article;
    btn.title = ArticleUI.#msg('articleReaderTitle', 'Gleano - Read & Chat');
    btn.addEventListener('click', () => this.toggle());
    document.body.appendChild(btn);
  }

  #createPanel() {
    const panel = document.createElement('div');
    panel.id = 'gleano-article-panel';
    panel.className = 'gleano-panel' + (this.#isDarkMode ? ' dark' : '');
    
    panel.innerHTML = `
      <div class="gleano-header">
        <div class="gleano-header-left">
          <div class="gleano-header-logo">${ArticleUI.#logoImg(22)}</div>
          <span class="gleano-header-title">Gleano</span>
        </div>
        <div class="gleano-header-right">
          <span class="gleano-credit-badge" id="gleanoCreditBadge" title="Remaining credits" style="display: none;"></span>
          <button class="gleano-close-btn" title="Close">${ArticleUI.#ICONS.close}</button>
        </div>
      </div>
      
      <nav class="gleano-tabs">
        <button class="gleano-tab active" data-mode="chat">${ArticleUI.#msg('articleChatTab', 'Chat')}</button>
        <button class="gleano-tab" data-mode="summary">${ArticleUI.#msg('articleSummaryTab', 'Summary')}</button>
      </nav>
      
      <div class="gleano-content">
        <div class="gleano-result" id="gleanoResult"></div>
      </div>
      
      <div class="gleano-chat-input" id="gleanoChatInput">
        <input type="text" placeholder="${ArticleUI.#msg('articleChatPlaceholder', 'Ask about this article...')}" id="gleanoChatText" />
        <button class="gleano-send-btn" id="gleanoChatSend">${ArticleUI.#ICONS.send}</button>
      </div>
      
      <div class="gleano-footer">
        <button class="gleano-action-btn" id="gleanoCopy" title="Copy">${ArticleUI.#ICONS.copy}</button>
        <button class="gleano-action-btn" id="gleanoRefresh" title="Regenerate" style="display: none;">${ArticleUI.#ICONS.refresh}</button>
      </div>
    `;
    
    document.body.appendChild(panel);
    this.#panelRoot = panel;
  }

  #setupEventListeners() {
    const closeBtn = this.#panelRoot.querySelector('.gleano-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    const tabs = this.#panelRoot.querySelectorAll('.gleano-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => this.#switchMode(tab.dataset.mode));
    });

    const chatInput = document.getElementById('gleanoChatText');
    const chatSend = document.getElementById('gleanoChatSend');
    
    chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.#sendChatMessage();
      }
    });
    
    chatSend?.addEventListener('click', () => this.#sendChatMessage());

    document.getElementById('gleanoCopy')?.addEventListener('click', () => this.#copyContent());
    document.getElementById('gleanoRefresh')?.addEventListener('click', () => this.#emitEvent('refresh'));
  }

  #switchMode(mode) {
    if (this.#currentMode === mode) return;
    
    this.#currentMode = mode;
    
    const tabs = this.#panelRoot.querySelectorAll('.gleano-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    const chatInput = document.getElementById('gleanoChatInput');
    if (chatInput) {
      chatInput.style.display = mode === 'chat' ? 'flex' : 'none';
    }

    const refreshBtn = document.getElementById('gleanoRefresh');
    if (refreshBtn) {
      refreshBtn.style.display = mode === 'summary' ? 'flex' : 'none';
    }

    this.#emitEvent('modeChange', { mode });
  }

  #sendChatMessage() {
    const input = document.getElementById('gleanoChatText');
    const message = input?.value?.trim();
    if (!message) return;
    
    input.value = '';
    this.#emitEvent('chatMessage', { message });
  }

  #copyContent() {
    const result = document.getElementById('gleanoResult');
    if (result?.textContent) {
      navigator.clipboard.writeText(result.textContent).then(() => {
        this.showToast(ArticleUI.#msg('copied', 'Copied to clipboard!'));
      });
    }
  }

  #emitEvent(eventName, detail = {}) {
    document.dispatchEvent(new CustomEvent(`gleano:${eventName}`, { detail }));
  }

  on(eventName, handler) {
    this.#eventHandlers[eventName] = handler;
    document.addEventListener(`gleano:${eventName}`, (e) => handler(e.detail));
  }

  toggle() {
    if (this.#isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (!this.#panelRoot) this.init();
    this.#panelRoot.classList.add('open');
    this.#isOpen = true;
    this.#emitEvent('panelOpen');
  }

  close() {
    this.#panelRoot?.classList.remove('open');
    this.#isOpen = false;
    this.#emitEvent('panelClose');
  }

  isOpen() {
    return this.#isOpen;
  }

  getCurrentMode() {
    return this.#currentMode;
  }

  updateCredits(credits) {
    const badge = document.getElementById('gleanoCreditBadge');
    if (!badge) return;
    if (typeof credits === 'number' && credits >= 0) {
      badge.textContent = `${credits} ⚡`;
      badge.style.display = 'inline-flex';
    }
  }

  /**
   * Shows the summary "ready" state with a Generate button.
   * Does NOT trigger AI — user must click to spend credits.
   */
  showSummaryPrompt(meta = {}) {
    const result = document.getElementById('gleanoResult');
    if (!result) return;
    const title = meta.title ? this.#escape(meta.title) : '';
    const excerpt = meta.excerpt ? this.#escape(meta.excerpt) : '';
    result.innerHTML = `
      <div class="gleano-ready">
        ${title ? `<div class="gleano-ready-title">${title}</div>` : ''}
        ${excerpt ? `<p class="gleano-ready-excerpt">${excerpt}</p>` : ''}
        <button class="gleano-generate-btn" id="gleanoGenerateBtn">
          ${ArticleUI.#logoImg(16)}
          <span>Generate Summary</span>
        </button>
        <p class="gleano-ready-hint">Uses 1 credit. Or just ask a question in the Chat tab.</p>
      </div>
    `;
    document.getElementById('gleanoGenerateBtn')?.addEventListener('click', () => {
      this.#emitEvent('generateSummary');
    });
  }

  showLoading(message = ArticleUI.#msg('articleLoading', 'Analyzing article...')) {
    const result = document.getElementById('gleanoResult');
    if (result) {
      result.innerHTML = `
        <div class="gleano-loading">
          <div class="gleano-spinner"></div>
          <p>${message}</p>
        </div>
      `;
    }
  }

  showResult(content, isHtml = false) {
    const result = document.getElementById('gleanoResult');
    if (result) {
      if (isHtml) {
        result.innerHTML = content;
      } else {
        result.innerHTML = this.#formatMarkdown(content);
      }
    }
  }

  showError(message, title = '') {
    const result = document.getElementById('gleanoResult');
    if (result) {
      const safeTitle = title ? `<p class="gleano-error-title">${this.#escape(title)}</p>` : '';
      result.innerHTML = `
        <div class="gleano-error">
          ${safeTitle}
          <p>${this.#escape(message)}</p>
        </div>
      `;
    }
  }

  showChat(messages) {
    this.#chatMessages = messages;
    const result = document.getElementById('gleanoResult');
    if (!result) return;

    if (messages.length === 0) {
      result.innerHTML = `
        <div class="gleano-chat-empty">
          <div class="gleano-chat-empty-icon">${ArticleUI.#logoImg(32)}</div>
          <p>Ask anything about this article</p>
          <p class="gleano-hint">Answers are based only on the article content. Switch to the Summary tab for a quick recap.</p>
        </div>
      `;
      return;
    }

    result.innerHTML = messages.map(msg => {
      const isTyping = msg.content === '...';
      const content = isTyping 
        ? '<div class="typing-dots"><span></span><span></span><span></span></div>'
        : this.#formatMarkdown(msg.content);
      return `
        <div class="gleano-chat-msg ${msg.role}">
          <div class="gleano-chat-bubble">${content}</div>
        </div>
      `;
    }).join('');

    this.#scrollToBottom();
  }

  appendChatMessage(role, content) {
    this.#chatMessages.push({ role, content });
    this.showChat(this.#chatMessages);
  }

  showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = 'gleano-toast';
    toast.textContent = message;
    this.#panelRoot?.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  #escape(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  #formatMarkdown(text) {
    if (!text) return '';
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.+)$/gm, (match) => {
        if (match.startsWith('<')) return match;
        return `<p>${match}</p>`;
      })
      .replace(/<p><\/p>/g, '');
  }
}

if (typeof window !== 'undefined') {
  window.ArticleUI = ArticleUI;
}
