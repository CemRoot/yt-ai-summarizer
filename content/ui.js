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
    play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
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
   * Detect dark theme from YouTube DOM attribute, computed styles,
   * and OS-level preference (matchMedia).
   */
  function detectTheme() {
    const html = document.documentElement;
    isDarkTheme = html.hasAttribute('dark') ||
                  document.body?.style?.backgroundColor === 'rgb(15, 15, 15)' ||
                  getComputedStyle(document.body).backgroundColor === 'rgb(15, 15, 15)' ||
                  window.matchMedia?.('(prefers-color-scheme: dark)').matches;
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
    const PANEL_TITLE = {
      tr: 'AI Özetleyici', es: 'Resumen IA', fr: 'Résumeur IA',
      de: 'KI-Zusammenfassung', pt: 'Resumo IA', ja: 'AI要約',
      ko: 'AI 요약', zh: 'AI摘要', ar: 'ملخص AI', ru: 'ИИ-Резюме'
    };
    const panelTitle = PANEL_TITLE[(navigator.language || '').substring(0, 2)] || 'AI Summarizer';

    header.innerHTML = `
      <div class="ytai-header-title">
        ${ICONS.sparkle}
        <span>${panelTitle}</span>
      </div>
    `;

    const clearCacheBtn = document.createElement('button');
    clearCacheBtn.className = 'ytai-clear-cache-btn';
    clearCacheBtn.title = (navigator.language || '').startsWith('tr') ? 'Önbelleği temizle' : 'Clear cache';
    clearCacheBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
    clearCacheBtn.addEventListener('click', async () => {
      await StorageHelper.clearCache();
      clearCacheBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
      setTimeout(() => {
        clearCacheBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
      }, 2000);
    });
    header.appendChild(clearCacheBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ytai-close-btn';
    closeBtn.innerHTML = ICONS.close;
    closeBtn.addEventListener('click', () => togglePanel(false));
    header.appendChild(closeBtn);

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'ytai-tabs';

    const TAB_LABELS = {
      en: { summary: 'Summary', keypoints: 'Key Points', detailed: 'Detailed', podcast: '🎙️ Podcast' },
      tr: { summary: 'Özet', keypoints: 'Önemli Noktalar', detailed: 'Detaylı', podcast: '🎙️ Podcast' },
      es: { summary: 'Resumen', keypoints: 'Puntos Clave', detailed: 'Detallado', podcast: '🎙️ Podcast' },
      fr: { summary: 'Résumé', keypoints: 'Points Clés', detailed: 'Détaillée', podcast: '🎙️ Podcast' },
      de: { summary: 'Zusammenfassung', keypoints: 'Kernpunkte', detailed: 'Detail', podcast: '🎙️ Podcast' },
      pt: { summary: 'Resumo', keypoints: 'Pontos-Chave', detailed: 'Detalhada', podcast: '🎙️ Podcast' },
      ja: { summary: '要約', keypoints: 'ポイント', detailed: '詳細分析', podcast: '🎙️ Podcast' },
      ko: { summary: '요약', keypoints: '핵심', detailed: '상세', podcast: '🎙️ Podcast' },
      zh: { summary: '摘要', keypoints: '要点', detailed: '详细', podcast: '🎙️ Podcast' },
      ar: { summary: 'ملخص', keypoints: 'نقاط', detailed: 'تحليل', podcast: '🎙️ Podcast' },
      ru: { summary: 'Резюме', keypoints: 'Ключевые', detailed: 'Подробный', podcast: '🎙️ Podcast' }
    };

    function resolveUILang() {
      const browserLang = (navigator.language || 'en').substring(0, 2);
      return TAB_LABELS[browserLang] ? browserLang : 'en';
    }

    const uiLang = resolveUILang();
    const labels = TAB_LABELS[uiLang] || TAB_LABELS.en;

    const tabData = [
      { id: 'summary',   label: labels.summary },
      { id: 'keypoints', label: labels.keypoints },
      { id: 'detailed',  label: labels.detailed },
      { id: 'podcast',   label: labels.podcast }
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
      <span class="ytai-footer-info ytai-provider-label">Powered by AI</span>
      <div class="ytai-footer-actions">
        <button class="ytai-icon-btn ytai-copy-btn" title="Copy to clipboard">${ICONS.copy}</button>
        <button class="ytai-icon-btn ytai-refresh-btn" title="Regenerate">${ICONS.refresh}</button>
      </div>
    `;

    updateProviderLabel();

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
   * Show a one-time onboarding tooltip next to the toggle button
   */
  function showOnboardingTooltip(toggleBtn) {
    chrome.storage?.local?.get?.({ ytaiTooltipShown: false }, (r) => {
      if (r.ytaiTooltipShown) return;

      const tip = document.createElement('div');
      tip.className = 'ytai-onboard-tip';
      tip.innerHTML = `
        <span class="ytai-tip-wave">👋</span>
        <span class="ytai-tip-text">Hey! I'm here.<br>Click me to summarize!</span>
      `;

      tip.addEventListener('click', () => {
        tip.classList.add('ytai-tip-hide');
        setTimeout(() => tip.remove(), 400);
        toggleBtn.click();
      });

      panelRoot.appendChild(tip);
      requestAnimationFrame(() => tip.classList.add('ytai-tip-show'));

      chrome.storage?.local?.set?.({ ytaiTooltipShown: true });

      setTimeout(() => {
        if (tip.parentNode) {
          tip.classList.add('ytai-tip-hide');
          setTimeout(() => tip.remove(), 400);
        }
      }, 8000);
    });
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

    showOnboardingTooltip(toggleBtn);

    function applyThemeClass() {
      const wasDark = isDarkTheme;
      detectTheme();
      if (wasDark !== isDarkTheme) {
        panelRoot.classList.toggle('ytai-dark', isDarkTheme);
      }
    }

    // YouTube DOM attribute changes (dark attr toggled on <html>)
    const themeObserver = new MutationObserver(applyThemeClass);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dark', 'style']
    });

    // OS / browser-level color-scheme changes
    window.matchMedia?.('(prefers-color-scheme: dark)')
      .addEventListener('change', applyThemeClass);
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

    if (mode === 'podcast') {
      if (typeof window._ytaiRequestPodcast === 'function') {
        window._ytaiRequestPodcast();
      }
      return;
    }

    // Stop podcast when switching away
    if (typeof window.PodcastPlayer !== 'undefined') {
      window.PodcastPlayer.stop();
    }

    if (typeof window._ytaiRequestSummary === 'function') {
      window._ytaiRequestSummary(mode, false);
    }
  }

  // Fun facts shown during loading — rotates every 5 seconds
  const FUN_FACTS = [
    "A pair of flies breeding only in April–May could cover the Earth in a 14-meter layer of flies if all eggs survived.",
    "An ant can carry 50 times its own body weight.",
    "The chance of dying by falling out of bed is 1 in 2 million.",
    "Honey never spoils. Archaeologists found 3,000-year-old honey in Egyptian tombs — still edible.",
    "Octopuses have three hearts and blue blood.",
    "A group of flamingos is called a 'flamboyance'.",
    "Bananas are radioactive — they contain potassium-40.",
    "There are more possible chess games than atoms in the observable universe.",
    "Cows have best friends and get stressed when separated.",
    "The Eiffel Tower grows about 6 inches taller in summer due to heat expansion.",
    "Sharks existed before trees. Sharks: ~400M years, trees: ~350M years.",
    "A day on Venus is longer than a year on Venus.",
    "Wombat poop is cube-shaped.",
    "Scotland's national animal is the unicorn.",
    "The world's oldest known joke is a fart joke from 1900 BC Sumeria.",
    "You can't hum while holding your nose. (You just tried, didn't you?)",
    "The inventor of the Pringles can is buried in one.",
    "A jiffy is an actual unit of time: 1/100th of a second.",
    "Nintendo was founded in 1889 as a playing card company.",
    "Your brain uses 20% of your body's total energy.",
    "The shortest war in history lasted 38 minutes (Britain vs. Zanzibar, 1896).",
    "Astronauts grow up to 2 inches taller in space.",
    "A cloud weighs about 1.1 million pounds on average.",
    "Hot water freezes faster than cold water. It's called the Mpemba effect.",
    "There are more bacteria in your mouth than people on Earth.",
    "The dot over the letters 'i' and 'j' is called a 'tittle'.",
    "A bolt of lightning is 5x hotter than the surface of the Sun.",
    "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.",
    "Humans share 60% of their DNA with bananas.",
    "The average person walks the equivalent of 5 trips around Earth in a lifetime.",
    "An octopus has no bones — it can squeeze through any gap larger than its beak.",
    "The heart of a blue whale is so big a child could swim through its arteries.",
    "The fingerprints of a koala are virtually indistinguishable from a human's.",
    "There are more stars in the universe than grains of sand on all of Earth's beaches.",
    "A teaspoon of a neutron star weighs about 6 billion tons.",
    "Venus is the only planet that spins clockwise.",
    "Elephants are the only animals that can't jump.",
    "A single strand of spider silk is thinner than a human hair but 5x stronger than steel.",
    "The total weight of all ants on Earth roughly equals the total weight of all humans.",
    "Oxford University is older than the Aztec Empire.",
    "Sea otters hold hands while sleeping to keep from drifting apart.",
    "The Hawaiian alphabet has only 12 letters.",
    "Light from the Sun takes 8 minutes and 20 seconds to reach Earth.",
    "Your nose can remember 50,000 different scents.",
    "A photon takes 40,000 years to travel from the Sun's core to its surface, then only 8 minutes to reach Earth.",
    "If you could fold a piece of paper 42 times, it would reach the Moon.",
    "The average cumulus cloud weighs about 500 tons — equivalent to 100 elephants.",
    "Dolphins sleep with one eye open.",
    "A cockroach can live for weeks without its head.",
    "The longest hiccuping spree lasted 68 years."
  ];

  let _factInterval = null;

  function startFactRotation() {
    stopFactRotation();
    const el = panelRoot?.querySelector('.ytai-fun-fact-text');
    if (!el) return;
    el.textContent = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
    _factInterval = setInterval(() => {
      if (!el.parentNode) { stopFactRotation(); return; }
      el.style.opacity = '0';
      setTimeout(() => {
        el.textContent = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
        el.style.opacity = '1';
      }, 300);
    }, 5000);
  }

  function stopFactRotation() {
    if (_factInterval) { clearInterval(_factInterval); _factInterval = null; }
  }

  /**
   * Show loading state (XSS-safe) with rotating fun facts
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

    stopFactRotation();
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
        <div class="ytai-fun-fact">
          <span class="ytai-fun-fact-label">💡 Did you know?</span>
          <span class="ytai-fun-fact-text"></span>
        </div>
      </div>
    `;

    startFactRotation();
  }

  /**
   * Show "ready to summarize" prompt — user must click Start to begin
   */
  function showReadyPrompt() {
    const content = panelRoot?.querySelector('.ytai-content');
    if (!content) return;

    const READY_TEXT = {
      tr: { title: 'Bu videoyu özetleyelim mi?', desc: 'AI ile özet, önemli noktalar ve detaylı analiz alın.', btn: 'Özetlemeyi Başlat' },
      es: { title: '¿Resumir este video?', desc: 'Obtén resumen, puntos clave y análisis detallado con IA.', btn: 'Iniciar Resumen' },
      fr: { title: 'Résumer cette vidéo ?', desc: 'Obtenez un résumé, points clés et analyse détaillée par IA.', btn: 'Démarrer le résumé' },
      de: { title: 'Dieses Video zusammenfassen?', desc: 'Erhalten Sie eine KI-Zusammenfassung, Kernpunkte und Detailanalyse.', btn: 'Zusammenfassung starten' },
      ja: { title: 'この動画を要約しますか？', desc: 'AIで要約、ポイント、詳細分析を取得します。', btn: '要約を開始' },
      ko: { title: '이 동영상을 요약할까요?', desc: 'AI로 요약, 핵심 포인트, 상세 분석을 받으세요.', btn: '요약 시작' },
      zh: { title: '要总结这个视频吗？', desc: '通过AI获取摘要、要点和详细分析。', btn: '开始总结' },
    };
    const uiLang = (navigator.language || 'en').substring(0, 2);
    const t = READY_TEXT[uiLang] || {
      title: 'Summarize this video?',
      desc: 'Get an AI-powered summary, key points, and detailed analysis.',
      btn: 'Start Summarizing'
    };

    content.innerHTML = `
      <div class="ytai-ready-prompt">
        <div class="ytai-ready-icon">${ICONS.sparkle}</div>
        <div class="ytai-ready-title">${escapeHtml(t.title)}</div>
        <div class="ytai-ready-desc">${escapeHtml(t.desc)}</div>
        <button class="ytai-btn ytai-btn-primary ytai-start-btn">
          ${ICONS.play}
          <span>${escapeHtml(t.btn)}</span>
        </button>
      </div>
    `;

    content.querySelector('.ytai-start-btn')?.addEventListener('click', () => {
      if (typeof window._ytaiRequestSummary === 'function') {
        window._ytaiRequestSummary(currentMode, false);
      }
    });
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
    stopFactRotation();
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

  // Unsupported regions for Gemini API
  const UNSUPPORTED_REGIONS = {
    zh: { msg: '抱歉，此功能在您所在的地区暂不可用。Gemini TTS 目前不支持此地区。' },
    fa: { msg: 'متأسفانه، این قابلیت در منطقه شما در دسترس نیست. Gemini TTS در حال حاضر از این منطقه پشتیبانی نمی‌کند.' },
    ru: { msg: 'К сожалению, эта функция недоступна в вашем регионе. Gemini TTS пока не поддерживает ваш регион.' },
    ko_KP: { msg: '죄송합니다. 이 기능은 귀하의 지역에서 사용할 수 없습니다.' }
  };

  /**
   * Show podcast player UI with real audio controls
   */
  function showPodcastPlayer(data) {
    stopFactRotation();
    const content = panelRoot?.querySelector('.ytai-content');
    if (!content) return;

    if (!data) {
      const uiLang = (navigator.language || 'en').substring(0, 2);
      const noSummaryMsg = uiLang === 'tr'
        ? 'Önce bir özet oluşturun, ardından Podcast sekmesine gelin.'
        : 'Generate a summary first, then come to the Podcast tab.';
      content.innerHTML = `
        <div class="ytai-podcast-empty">
          <div class="ytai-podcast-icon">🎙️</div>
          <div class="ytai-ready-title">AI Podcast</div>
          <div class="ytai-ready-desc">${escapeHtml(noSummaryMsg)}</div>
        </div>
      `;
      return;
    }

    const { dialogue, audioBase64 } = data;
    const dur = PodcastPlayer.formatTime(0);

    content.innerHTML = `
      <div class="ytai-podcast-player">
        <div class="ytai-podcast-header">
          <div class="ytai-podcast-icon-large">🎙️</div>
          <div class="ytai-podcast-title">AI Podcast</div>
          <div class="ytai-podcast-meta" id="ytaiPodcastDuration">Loading audio...</div>
        </div>

        <div class="ytai-podcast-subtitle" id="ytaiPodcastSubtitle">
          <span class="ytai-podcast-speaker speaker-a">Alex & Sam</span>
          <span class="ytai-podcast-text">Press play to listen</span>
        </div>

        <div class="ytai-podcast-progress-wrap">
          <div class="ytai-podcast-progress" id="ytaiPodcastProgressBar">
            <div class="ytai-podcast-progress-fill" id="ytaiPodcastProgressFill"></div>
          </div>
          <div class="ytai-podcast-progress-label">
            <span id="ytaiPodcastTime">${dur}</span> / <span id="ytaiPodcastTotalTime">${dur}</span>
          </div>
        </div>

        <div class="ytai-podcast-controls">
          <button class="ytai-podcast-ctrl" id="ytaiPodcastBack" title="Back 10s">
            <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
          </button>
          <button class="ytai-podcast-ctrl ytai-podcast-play" id="ytaiPodcastPlayPause" title="Play">
            <svg viewBox="0 0 24 24" class="play-icon"><path d="M8 5v14l11-7z"/></svg>
            <svg viewBox="0 0 24 24" class="pause-icon" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </button>
          <button class="ytai-podcast-ctrl" id="ytaiPodcastFwd" title="Forward 10s">
            <svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg>
          </button>
        </div>

        <div class="ytai-podcast-rate">
          <button class="ytai-rate-btn" data-rate="0.75">0.75x</button>
          <button class="ytai-rate-btn active" data-rate="1">1x</button>
          <button class="ytai-rate-btn" data-rate="1.25">1.25x</button>
          <button class="ytai-rate-btn" data-rate="1.5">1.5x</button>
        </div>

        <div class="ytai-podcast-transcript" id="ytaiPodcastTranscript">
          ${dialogue.map((line, i) => {
            const name = line.speaker === 'A' ? 'Alex' : (line.speaker === 'B' ? 'Sam' : line.speaker);
            const cls = (line.speaker === 'A' || line.speaker === 'Alex') ? 'speaker-a' : 'speaker-b';
            return `<div class="ytai-podcast-line" data-index="${i}">
              <span class="ytai-line-speaker ${cls}">${escapeHtml(name)}</span>
              <span class="ytai-line-text">${escapeHtml(line.text)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;

    // Load audio into player
    PodcastPlayer.loadAudio(audioBase64).then(() => {
      const state = PodcastPlayer.getState();
      const durationEl = content.querySelector('#ytaiPodcastDuration');
      const totalTimeEl = content.querySelector('#ytaiPodcastTotalTime');
      if (durationEl) durationEl.textContent = PodcastPlayer.formatTime(state.duration);
      if (totalTimeEl) totalTimeEl.textContent = PodcastPlayer.formatTime(state.duration);
    });

    PodcastPlayer.setOnStateChange((state) => {
      const playIcon = content.querySelector('.play-icon');
      const pauseIcon = content.querySelector('.pause-icon');
      if (playIcon && pauseIcon) {
        playIcon.style.display = state.isPlaying ? 'none' : 'block';
        pauseIcon.style.display = state.isPlaying ? 'block' : 'none';
      }

      const progressFill = content.querySelector('#ytaiPodcastProgressFill');
      const timeEl = content.querySelector('#ytaiPodcastTime');
      if (progressFill && state.duration > 0) {
        progressFill.style.width = `${(state.currentTime / state.duration) * 100}%`;
      }
      if (timeEl) timeEl.textContent = PodcastPlayer.formatTime(state.currentTime);
    });

    // Controls
    content.querySelector('#ytaiPodcastPlayPause')?.addEventListener('click', () => {
      PodcastPlayer.togglePlayPause(audioBase64);
    });
    content.querySelector('#ytaiPodcastBack')?.addEventListener('click', () => PodcastPlayer.skipBackward(10));
    content.querySelector('#ytaiPodcastFwd')?.addEventListener('click', () => PodcastPlayer.skipForward(10));

    // Progress bar click to seek
    content.querySelector('#ytaiPodcastProgressBar')?.addEventListener('click', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const state = PodcastPlayer.getState();
      PodcastPlayer.seek(ratio * state.duration);
    });

    // Rate buttons
    content.querySelectorAll('.ytai-rate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        content.querySelectorAll('.ytai-rate-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        PodcastPlayer.setRate(parseFloat(btn.dataset.rate));
      });
    });
  }

  /**
   * Show Gemini key setup prompt inside the podcast tab
   */
  function showPodcastKeyPrompt() {
    const content = panelRoot?.querySelector('.ytai-content');
    if (!content) return;

    const uiLang = (navigator.language || 'en').substring(0, 2);

    const regionMsg = UNSUPPORTED_REGIONS[uiLang];
    if (regionMsg) {
      content.innerHTML = `
        <div class="ytai-podcast-empty">
          <div class="ytai-podcast-icon">🚫</div>
          <div class="ytai-ready-title" style="color:var(--ytai-error)">Region Not Supported</div>
          <div class="ytai-ready-desc">${escapeHtml(regionMsg.msg)}</div>
        </div>
      `;
      return;
    }

    const isTR = uiLang === 'tr';

    content.innerHTML = `
      <div class="ytai-podcast-setup">
        <div class="ytai-podcast-icon">🎙️</div>
        <div class="ytai-ready-title">${isTR ? 'AI Podcast Kurulumu' : 'AI Podcast Setup'}</div>
        <div class="ytai-ready-desc" style="max-width:300px">
          ${isTR
            ? 'Podcast özelliği Google Gemini TTS kullanır. Ücretsiz bir Gemini API anahtarı gerekiyor — kredi kartı gerekmez!'
            : 'Podcast uses Google Gemini TTS for natural voices. You need a free Gemini API key — no credit card required!'}
        </div>

        <div class="ytai-podcast-steps">
          <div class="ytai-step">
            <span class="ytai-step-num">1</span>
            <span>${isTR ? '<a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> adresine gidin' : 'Go to <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a>'}</span>
          </div>
          <div class="ytai-step">
            <span class="ytai-step-num">2</span>
            <span>${isTR ? 'Google hesabınızla giriş yapın' : 'Sign in with your Google account'}</span>
          </div>
          <div class="ytai-step">
            <span class="ytai-step-num">3</span>
            <span>${isTR ? '"Create API Key" butonuna tıklayın' : 'Click "Create API Key"'}</span>
          </div>
          <div class="ytai-step">
            <span class="ytai-step-num">4</span>
            <span>${isTR ? 'Anahtarı aşağıya yapıştırın' : 'Paste your key below'}</span>
          </div>
        </div>

        <div class="ytai-gemini-key-inline">
          <div class="ytai-gemini-key-row">
            <input type="password" class="ytai-gemini-key-input" placeholder="${isTR ? 'Gemini API anahtarınızı yapıştırın' : 'Paste your Gemini API key'}" spellcheck="false" autocomplete="off" />
            <button class="ytai-gemini-key-toggle" title="${isTR ? 'Göster/Gizle' : 'Show/Hide'}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <button class="ytai-btn ytai-btn-primary ytai-gemini-save-btn" disabled>
            <span>${isTR ? 'Kaydet & Podcast Oluştur' : 'Save & Generate Podcast'}</span>
          </button>
          <div class="ytai-gemini-key-error" style="display:none"></div>
        </div>
      </div>
    `;

    const input = content.querySelector('.ytai-gemini-key-input');
    const toggleBtn = content.querySelector('.ytai-gemini-key-toggle');
    const saveBtn = content.querySelector('.ytai-gemini-save-btn');
    const errorEl = content.querySelector('.ytai-gemini-key-error');

    toggleBtn?.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    input?.addEventListener('input', () => {
      const val = input.value.trim();
      saveBtn.disabled = val.length < 10;
    });

    saveBtn?.addEventListener('click', async () => {
      const key = input.value.trim();
      if (!key) return;

      errorEl.style.display = 'none';

      if (!key.startsWith('AIza')) {
        errorEl.textContent = isTR
          ? 'Geçersiz API anahtarı. Anahtar "AIza" ile başlamalıdır.'
          : 'Invalid API key. Key should start with "AIza".';
        errorEl.style.display = 'block';
        return;
      }

      try {
        const currentSettings = await StorageHelper.getSettings();
        currentSettings.geminiApiKey = key;
        await StorageHelper.saveSettings(currentSettings);
        if (typeof window._ytaiRequestPodcast === 'function') {
          window._ytaiRequestPodcast();
        }
      } catch (e) {
        errorEl.textContent = isTR ? 'Kaydedilemedi. Tekrar deneyin.' : 'Failed to save. Try again.';
        errorEl.style.display = 'block';
      }
    });

    input?.focus();
  }

  /**
   * Show podcast loading
   */
  function showPodcastLoading(message) {
    const content = panelRoot?.querySelector('.ytai-content');
    if (!content) return;

    content.innerHTML = `
      <div class="ytai-loading">
        <div class="ytai-podcast-icon-large" style="font-size:48px;margin-bottom:8px">🎙️</div>
        <div class="ytai-spinner"></div>
        <div class="ytai-loading-text">${escapeHtml(message || 'Generating podcast...')}</div>
        <div class="ytai-fun-fact">
          <span class="ytai-fun-fact-label">💡 Did you know?</span>
          <span class="ytai-fun-fact-text"></span>
        </div>
      </div>
    `;
    startFactRotation();
  }

  /**
   * Show result
   */
  function showResult(markdownText) {
    stopFactRotation();
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

  function updateProviderLabel(provider) {
    const label = panelRoot?.querySelector('.ytai-provider-label');
    if (!label) return;
    if (provider) {
      label.textContent = provider === 'ollama' ? 'Powered by Ollama Cloud' : 'Powered by Groq';
      return;
    }
    chrome.storage?.local?.get?.({ provider: 'groq' }, (r) => {
      if (label) label.textContent = r.provider === 'ollama' ? 'Powered by Ollama Cloud' : 'Powered by Groq';
    });
  }

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
    showReadyPrompt,
    showApiKeyPrompt,
    showError,
    showResult,
    showPodcastPlayer,
    showPodcastKeyPrompt,
    showPodcastLoading,
    showToast,
    isPanelOpen,
    getCurrentMode,
    switchMode,
    updateProviderLabel
  };
})();

if (typeof window !== 'undefined') {
  window.SummarizerUI = SummarizerUI;
}
