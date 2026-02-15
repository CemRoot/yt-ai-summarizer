/**
 * YouTube AI Summarizer - UI Panel Manager
 * Creates and manages the summary panel injected into YouTube pages
 */

const SummarizerUI = (() => {
  let panelRoot = null;
  let panelElement = null;
  let isOpen = false;
  let currentMode = 'summary';
  let isDarkTheme = false;

  // SVG Icons
  const ICONS = {
    brain: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`,
    close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
    copy: `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`,
    settings: `<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
    key: `<svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>`,
    error: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    sparkle: `<svg viewBox="0 0 24 24"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>`
  };

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Detect YouTube dark theme
   */
  function detectTheme() {
    const html = document.documentElement;
    isDarkTheme = html.hasAttribute('dark') ||
                  document.body?.style?.backgroundColor === 'rgb(15, 15, 15)' ||
                  getComputedStyle(document.body).backgroundColor === 'rgb(15, 15, 15)';
    return isDarkTheme;
  }

  /**
   * Create the main panel root element
   */
  function createRoot() {
    if (panelRoot) return panelRoot;

    panelRoot = document.createElement('div');
    panelRoot.id = 'yt-ai-summarizer-root';

    detectTheme();
    if (isDarkTheme) {
      panelRoot.classList.add('ytai-dark');
    }

    document.body.appendChild(panelRoot);
    return panelRoot;
  }

  /**
   * Create the toggle button
   */
  function createToggleButton() {
    const btn = document.createElement('button');
    btn.className = 'ytai-toggle-btn';
    btn.title = 'YouTube AI Summarizer';
    btn.innerHTML = ICONS.brain;
    btn.addEventListener('click', togglePanel);
    return btn;
  }

  /**
   * Create the panel element
   */
  function createPanel() {
    const panel = document.createElement('div');
    panel.className = 'ytai-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'ytai-header';
    header.innerHTML = `
      <div class="ytai-header-title">
        ${ICONS.sparkle}
        <span>AI Summarizer</span>
      </div>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ytai-close-btn';
    closeBtn.innerHTML = ICONS.close;
    closeBtn.addEventListener('click', () => togglePanel(false));
    header.appendChild(closeBtn);

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'ytai-tabs';

    const tabData = [
      { id: 'summary', label: chrome.i18n?.getMessage('summary') || 'Summary' },
      { id: 'keypoints', label: chrome.i18n?.getMessage('keyPoints') || 'Key Points' },
      { id: 'detailed', label: chrome.i18n?.getMessage('detailed') || 'Detailed' }
    ];

    tabData.forEach((tab) => {
      const tabBtn = document.createElement('button');
      tabBtn.className = `ytai-tab${tab.id === currentMode ? ' active' : ''}`;
      tabBtn.dataset.mode = tab.id;
      tabBtn.textContent = tab.label;
      tabBtn.addEventListener('click', () => switchMode(tab.id));
      tabs.appendChild(tabBtn);
    });

    // Content area
    const content = document.createElement('div');
    content.className = 'ytai-content';

    // Footer
    const footer = document.createElement('div');
    footer.className = 'ytai-footer';
    footer.innerHTML = `
      <span class="ytai-footer-info">Powered by Groq AI</span>
      <div class="ytai-footer-actions">
        <button class="ytai-icon-btn ytai-copy-btn" title="Copy to clipboard">${ICONS.copy}</button>
        <button class="ytai-icon-btn ytai-refresh-btn" title="Regenerate">${ICONS.refresh}</button>
      </div>
    `;

    footer.querySelector('.ytai-copy-btn').addEventListener('click', copyResult);
    footer.querySelector('.ytai-refresh-btn').addEventListener('click', () => {
      if (typeof window._ytaiRequestSummary === 'function') {
        window._ytaiRequestSummary(currentMode, true);
      }
    });

    panel.appendChild(header);
    panel.appendChild(tabs);
    panel.appendChild(content);
    panel.appendChild(footer);

    return panel;
  }

  /**
   * Initialize the UI
   */
  function init() {
    if (document.getElementById('yt-ai-summarizer-root')) {
      panelRoot = document.getElementById('yt-ai-summarizer-root');
      panelElement = panelRoot.querySelector('.ytai-panel');
      return;
    }

    const root = createRoot();
    const toggleBtn = createToggleButton();
    panelElement = createPanel();

    root.appendChild(toggleBtn);
    root.appendChild(panelElement);

    // Watch for theme changes
    const themeObserver = new MutationObserver(() => {
      const wasDark = isDarkTheme;
      detectTheme();
      if (wasDark !== isDarkTheme) {
        if (isDarkTheme) {
          panelRoot.classList.add('ytai-dark');
        } else {
          panelRoot.classList.remove('ytai-dark');
        }
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dark', 'style']
    });
  }

  /**
   * Toggle panel open/closed
   */
  function togglePanel(forceState) {
    const shouldOpen = typeof forceState === 'boolean' ? forceState : !isOpen;
    isOpen = shouldOpen;

    const panel = panelRoot?.querySelector('.ytai-panel');
    const toggleBtn = panelRoot?.querySelector('.ytai-toggle-btn');

    if (panel) {
      panel.classList.toggle('open', isOpen);
    }
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', isOpen);
    }

    // Trigger summary on first open
    if (isOpen && typeof window._ytaiOnPanelOpen === 'function') {
      window._ytaiOnPanelOpen();
    }
  }

  /**
   * Switch between summary modes
   */
  function switchMode(mode) {
    currentMode = mode;

    const tabs = panelRoot?.querySelectorAll('.ytai-tab');
    tabs?.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    if (typeof window._ytaiRequestSummary === 'function') {
      window._ytaiRequestSummary(mode, false);
    }
  }

  /**
   * Show loading state (XSS-safe)
   */
  function showLoading(message, progress = -1) {
    const content = panelRoot?.querySelector('.ytai-content');
    if (!content) return;

    if (progress >= 0) {
      const progressFill = content.querySelector('.ytai-progress-fill');
      if (progressFill) {
        progressFill.style.width = `${Math.round(progress * 100)}%`;
        const loadingText = content.querySelector('.ytai-loading-text');
        if (loadingText && message) loadingText.textContent = message;
        return;
      }
    }

    const safeMessage = escapeHtml(message || chrome.i18n?.getMessage('loading') || 'Analyzing video...');

    content.innerHTML = `
      <div class="ytai-loading">
        <div class="ytai-spinner"></div>
        <div class="ytai-loading-text">${safeMessage}</div>
        ${progress >= 0 ? `
          <div class="ytai-progress-bar">
            <div class="ytai-progress-fill" style="width: ${Math.round(progress * 100)}%"></div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Show API key prompt
   */
  function showApiKeyPrompt() {
    const content = panelRoot?.querySelector('.ytai-content');
    if (!content) return;

    content.innerHTML = `
      <div class="ytai-api-prompt">
        ${ICONS.key}
        <p>${escapeHtml(chrome.i18n?.getMessage('apiKeyRequired') || 'Please set up your Groq API key to get started.')}</p>
        <button class="ytai-btn ytai-btn-primary ytai-setup-btn">
          ${ICONS.settings}
          <span>${escapeHtml(chrome.i18n?.getMessage('settings') || 'Open Settings')}</span>
        </button>
      </div>
    `;

    content.querySelector('.ytai-setup-btn')?.addEventListener('click', () => {
      // Open settings page in a new tab (reliable method)
      chrome.runtime.sendMessage({ action: 'openSettings' }).catch(() => {});
    });
  }

  /**
   * Show error state (XSS-safe)
   */
  function showError(title, message, retryable = true) {
    const content = panelRoot?.querySelector('.ytai-content');
    if (!content) return;

    content.innerHTML = `
      <div class="ytai-error">
        ${ICONS.error}
        <div class="ytai-error-title">${escapeHtml(title)}</div>
        <div class="ytai-error-msg">${escapeHtml(message)}</div>
        ${retryable ? `<button class="ytai-btn ytai-btn-primary ytai-retry-btn">Try Again</button>` : ''}
      </div>
    `;

    content.querySelector('.ytai-retry-btn')?.addEventListener('click', () => {
      if (typeof window._ytaiRequestSummary === 'function') {
        window._ytaiRequestSummary(currentMode, true);
      }
    });
  }

  /**
   * Show result
   */
  function showResult(markdownText) {
    const content = panelRoot?.querySelector('.ytai-content');
    if (!content) return;

    const html = markdownToHtml(markdownText);
    content.innerHTML = `<div class="ytai-result">${html}</div>`;
  }

  /**
   * Markdown to HTML converter with proper ordered/unordered list handling
   */
  function markdownToHtml(text) {
    if (!text) return '';

    let html = text
      // Escape HTML first
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h3>$1</h3>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Ordered list items (mark with special tag)
      .replace(/^\d+\.\s+(.+)$/gm, '<oli>$1</oli>')
      // Unordered list items
      .replace(/^[-*]\s+(.+)$/gm, '<uli>$1</uli>')
      // Wrap consecutive ordered items in <ol>
      .replace(/((?:<oli>.*<\/oli>\n?)+)/g, (match) => {
        const items = match.replace(/<\/?oli>/g, (tag) =>
          tag === '<oli>' ? '<li>' : '</li>'
        );
        return `<ol>${items}</ol>`;
      })
      // Wrap consecutive unordered items in <ul>
      .replace(/((?:<uli>.*<\/uli>\n?)+)/g, (match) => {
        const items = match.replace(/<\/?uli>/g, (tag) =>
          tag === '<uli>' ? '<li>' : '</li>'
        );
        return `<ul>${items}</ul>`;
      })
      // Paragraphs (double newlines)
      .replace(/\n\n/g, '</p><p>')
      // Single newlines
      .replace(/\n/g, '<br>');

    if (!html.startsWith('<')) {
      html = `<p>${html}</p>`;
    }

    return html;
  }

  /**
   * Copy result to clipboard
   */
  async function copyResult() {
    const content = panelRoot?.querySelector('.ytai-result');
    if (!content) return;

    const text = content.innerText;
    try {
      await navigator.clipboard.writeText(text);
      showToast(chrome.i18n?.getMessage('copied') || 'Copied to clipboard!');
    } catch {
      showToast('Failed to copy');
    }
  }

  /**
   * Show a toast notification
   */
  function showToast(message, duration = 2500) {
    const existing = panelRoot?.querySelector('.ytai-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'ytai-toast';
    toast.textContent = message;
    panelRoot?.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Clean up the UI
   */
  function destroy() {
    panelRoot?.remove();
    panelRoot = null;
    panelElement = null;
    isOpen = false;
  }

  function isPanelOpen() { return isOpen; }
  function getCurrentMode() { return currentMode; }

  /**
   * Auto open panel without triggering onPanelOpen callback (prevents double summary)
   */
  function autoOpen() {
    if (!isOpen) {
      isOpen = true;
      panelRoot?.querySelector('.ytai-panel')?.classList.add('open');
      panelRoot?.querySelector('.ytai-toggle-btn')?.classList.add('active');
    }
  }

  return {
    init,
    destroy,
    togglePanel,
    autoOpen,
    showLoading,
    showApiKeyPrompt,
    showError,
    showResult,
    showToast,
    isPanelOpen,
    getCurrentMode,
    switchMode
  };
})();

if (typeof window !== 'undefined') {
  window.SummarizerUI = SummarizerUI;
}
