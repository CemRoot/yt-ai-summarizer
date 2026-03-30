/**
 * SummarizerUI — Panel UI Manager
 * @architecture Singleton class
 * @version 2.0.0 — OOP refactor + speaker mapping bug fix
 *
 * BUG FIX: Speaker mapping was checking for 'A'/'B' which the LLM never
 * produces. Dialogue always contains 'Alex'/'Sam'. Dead code removed,
 * CSS class assignment simplified and now always correct.
 *
 * DESIGN: YouTube-native design language — matches YouTube's panel aesthetics,
 * typography (Roboto), and color tokens exactly.
 *
 * ARCHITECTURE: Cross-module calls replaced with CustomEvents.
 * No more window._ytai* globals.
 */
class SummarizerUI {

  static #instance = null;

  #panelRoot = null;
  #isOpen = false;
  #currentMode = 'summary';
  #isDarkTheme = false;
  #factInterval = null;

  static #ICONS = {
    brain:    `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`,
    play:     `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    close:    `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
    copy:     `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`,
    refresh:  `<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`,
    settings: `<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
    key:      `<svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>`,
    error:    `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    sparkle:  `<svg viewBox="0 0 24 24"><path d="M21.58 7.19a2.51 2.51 0 00-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.51 2.51 0 001.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81z" fill="#FF0000"/><path d="M10 15.5l5.5-3.5L10 8.5v7z" fill="#fff"/></svg>`,
    send:     `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`,
    ai:       `<svg viewBox="0 0 24 24"><path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zM7.5 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S9.83 13 9 13s-1.5-.67-1.5-1.5zM16 17H8v-2h8v2zm-1-4c-.83 0-1.5-.67-1.5-1.5S14.17 10 15 10s1.5.67 1.5 1.5S15.83 13 15 13z"/></svg>`
  };

  static #FUN_FACTS = [
    "A pair of flies breeding only in April–May could cover Earth in a 14-meter layer if all eggs survived.",
    "An ant can carry 50 times its own body weight.",
    "Honey never spoils — archaeologists found 3,000-year-old edible honey in Egyptian tombs.",
    "Octopuses have three hearts and blue blood.",
    "A group of flamingos is called a 'flamboyance'.",
    "There are more possible chess games than atoms in the observable universe.",
    "Cows have best friends and get stressed when separated.",
    "The Eiffel Tower grows about 6 inches taller in summer due to heat expansion.",
    "Sharks existed before trees. Sharks: ~400M years. Trees: ~350M years.",
    "A day on Venus is longer than a year on Venus.",
    "Wombat poop is cube-shaped.",
    "Scotland's national animal is the unicorn.",
    "You can't hum while holding your nose. (You just tried, didn't you?)",
    "The inventor of the Pringles can is buried in one.",
    "Nintendo was founded in 1889 as a playing card company.",
    "The shortest war in history lasted 38 minutes (Britain vs. Zanzibar, 1896).",
    "A cloud weighs about 1.1 million pounds on average.",
    "Hot water can freeze faster than cold water — the Mpemba effect.",
    "A bolt of lightning is 5× hotter than the surface of the Sun.",
    "Cleopatra lived closer to the Moon landing than to the Great Pyramid's construction.",
    "Humans share 60% of DNA with bananas.",
    "Sea otters hold hands while sleeping to keep from drifting apart.",
    "A teaspoon of a neutron star weighs about 6 billion tons.",
    "Venus is the only planet that spins clockwise.",
    "Dolphins sleep with one eye open.",
    "If you could fold a piece of paper 42 times, it would reach the Moon.",
    "Oxford University is older than the Aztec Empire.",
  ];

  static #TAB_LABELS = {
    en: { summary: 'Summary', keypoints: 'Key Points', detailed: 'Detailed', podcast: 'Podcast', chat: 'Chat' },
    tr: { summary: 'Özet',    keypoints: 'Önemli Noktalar', detailed: 'Detaylı', podcast: 'Podcast', chat: 'Sohbet' },
    es: { summary: 'Resumen', keypoints: 'Puntos Clave',   detailed: 'Detallado', podcast: 'Podcast', chat: 'Chat' },
    fr: { summary: 'Résumé',  keypoints: 'Points Clés',    detailed: 'Détaillée', podcast: 'Podcast', chat: 'Chat' },
    de: { summary: 'Zusammenfassung', keypoints: 'Kernpunkte', detailed: 'Detail', podcast: 'Podcast', chat: 'Chat' },
    pt: { summary: 'Resumo',  keypoints: 'Pontos-Chave',   detailed: 'Detalhada', podcast: 'Podcast', chat: 'Chat' },
    ja: { summary: '要約',    keypoints: 'ポイント',        detailed: '詳細分析',  podcast: 'ポッドキャスト', chat: 'チャット' },
    ko: { summary: '요약',    keypoints: '핵심',            detailed: '상세',      podcast: '팟캐스트', chat: '채팅' },
    zh: { summary: '摘要',    keypoints: '要点',            detailed: '详细',      podcast: '播客', chat: '聊天' },
    ar: { summary: 'ملخص',    keypoints: 'نقاط',            detailed: 'تحليل',     podcast: 'بودكاست', chat: 'دردشة' },
    ru: { summary: 'Резюме',  keypoints: 'Ключевые',        detailed: 'Подробный', podcast: 'Подкаст', chat: 'Чат' }
  };

  static #READY_TEXT = {
    tr: { title: 'Bu videoyu özetleyelim mi?',       desc: 'AI ile özet, önemli noktalar ve detaylı analiz alın.',         btn: 'Özetlemeyi Başlat' },
    es: { title: '¿Resumir este video?',              desc: 'Obtén resumen, puntos clave y análisis detallado con IA.',     btn: 'Iniciar Resumen' },
    fr: { title: 'Résumer cette vidéo ?',             desc: 'Obtenez un résumé, points clés et analyse détaillée par IA.', btn: 'Démarrer le résumé' },
    de: { title: 'Dieses Video zusammenfassen?',      desc: 'Erhalten Sie eine KI-Zusammenfassung und Detailanalyse.',     btn: 'Zusammenfassung starten' },
    ja: { title: 'この動画を要約しますか？',          desc: 'AIで要約、ポイント、詳細分析を取得します。',                  btn: '要約を開始' },
    ko: { title: '이 동영상을 요약할까요?',           desc: 'AI로 요약, 핵심 포인트, 상세 분석을 받으세요.',              btn: '요약 시작' },
    zh: { title: '要总结这个视频吗？',                desc: '通过AI获取摘要、要点和详细分析。',                            btn: '开始总结' },
  };

  static #UNSUPPORTED_REGIONS = {
    zh: '抱歉，此功能在您所在的地区暂不可用。Gemini TTS 目前不支持此地区。',
    fa: 'متأسفانه، این قابلیت در منطقه شما در دسترس نیست.',
    ru: 'К сожалению, эта функция недоступна в вашем регионе.',
  };

  constructor() {
    if (SummarizerUI.#instance) return SummarizerUI.#instance;
    SummarizerUI.#instance = this;
  }

  static getInstance() {
    if (!SummarizerUI.#instance) {
      SummarizerUI.#instance = new SummarizerUI();
    }
    return SummarizerUI.#instance;
  }

  // ─── Utilities ─────────────────────────────────────────────────────

  #escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  #detectTheme() {
    const html = document.documentElement;
    this.#isDarkTheme =
      html.hasAttribute('dark') ||
      document.body?.style?.backgroundColor === 'rgb(15, 15, 15)' ||
      getComputedStyle(document.body).backgroundColor === 'rgb(15, 15, 15)' ||
      window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return this.#isDarkTheme;
  }

  #uiLang() {
    const lang = (navigator.language || 'en').substring(0, 2);
    return SummarizerUI.#TAB_LABELS[lang] ? lang : 'en';
  }

  // ─── DOM Construction ─────────────────────────────────────────────

  #createRoot() {
    if (this.#panelRoot) return this.#panelRoot;
    this.#panelRoot = document.createElement('div');
    this.#panelRoot.id = 'yt-ai-summarizer-root';
    this.#detectTheme();
    if (this.#isDarkTheme) this.#panelRoot.classList.add('ytai-dark');
    document.body.appendChild(this.#panelRoot);
    return this.#panelRoot;
  }

  #createToggleButton() {
    const btn = document.createElement('button');
    btn.className = 'ytai-toggle-btn';
    btn.title = 'YouTube AI Summarizer';
    btn.innerHTML = SummarizerUI.#ICONS.brain;
    btn.addEventListener('click', () => this.togglePanel());
    return btn;
  }

  /** Clears extension summary cache (same action as popup); lives in footer next to copy/refresh. */
  #wireClearCacheButton(clearBtn) {
    clearBtn.className = 'ytai-icon-btn ytai-clear-cache-btn';
    const tr = this.#uiLang() === 'tr';
    clearBtn.title = tr
      ? 'Kayıtlı özet önbelleğini temizle'
      : 'Clear cached summaries stored by this extension';
    clearBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
    clearBtn.addEventListener('click', async () => {
      await StorageHelper.clearCache();
      clearBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
      setTimeout(() => {
        clearBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
      }, 2000);
    });
  }

  #createPanel() {
    const panel = document.createElement('div');
    panel.className = 'ytai-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'ytai-header';
    const panelTitles = { tr: 'AI Özetleyici', es: 'Resumen IA', fr: 'Résumeur IA', de: 'KI-Zusammenfassung', ja: 'AI要約', ko: 'AI 요약', zh: 'AI摘要' };
    const panelTitle = panelTitles[this.#uiLang()] || 'AI Summarizer';
    header.innerHTML = `
      <div class="ytai-header-left">
        <div class="ytai-header-logo">${SummarizerUI.#ICONS.sparkle}</div>
        <span class="ytai-header-title">${panelTitle}</span>
      </div>
    `;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ytai-icon-btn ytai-close-btn';
    closeBtn.innerHTML = SummarizerUI.#ICONS.close;
    closeBtn.addEventListener('click', () => this.togglePanel(false));
    const headerActions = document.createElement('div');
    headerActions.className = 'ytai-header-actions';
    headerActions.appendChild(closeBtn);
    header.appendChild(headerActions);

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'ytai-tabs';
    const labels = SummarizerUI.#TAB_LABELS[this.#uiLang()] || SummarizerUI.#TAB_LABELS.en;
    const tabData = [
      { id: 'summary',   label: labels.summary },
      { id: 'keypoints', label: labels.keypoints },
      { id: 'detailed',  label: labels.detailed },
      { id: 'podcast',   label: labels.podcast },
      { id: 'chat',      label: labels.chat }
    ];
    tabData.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = `ytai-tab${tab.id === this.#currentMode ? ' active' : ''}`;
      btn.dataset.mode = tab.id;
      btn.textContent = tab.label;
      btn.addEventListener('click', () => this.switchMode(tab.id));
      tabs.appendChild(btn);
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
        <button class="ytai-icon-btn ytai-copy-btn" title="Copy to clipboard">${SummarizerUI.#ICONS.copy}</button>
        <button class="ytai-icon-btn ytai-refresh-btn" title="Regenerate">${SummarizerUI.#ICONS.refresh}</button>
      </div>
    `;

    this.#updateProviderLabelEl(footer.querySelector('.ytai-provider-label'));

    const footerActions = footer.querySelector('.ytai-footer-actions');
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    this.#wireClearCacheButton(clearBtn);
    footerActions.insertBefore(clearBtn, footerActions.firstChild);

    footer.querySelector('.ytai-copy-btn').addEventListener('click', () => this.#copyResult());
    footer.querySelector('.ytai-refresh-btn').addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('ytai:request-summary', { detail: { mode: this.#currentMode, forceRefresh: true } }));
    });

    panel.appendChild(header);
    panel.appendChild(tabs);
    panel.appendChild(content);
    panel.appendChild(footer);

    return panel;
  }

  // ─── Onboarding tooltip ────────────────────────────────────────────

  #showOnboardingTooltip(toggleBtn) {
    chrome.storage?.local?.get?.({ ytaiTooltipShown: false }, (r) => {
      if (r.ytaiTooltipShown) return;

      const tip = document.createElement('div');
      tip.className = 'ytai-onboard-tip';
      tip.innerHTML = `<span class="ytai-tip-wave">👋</span><span class="ytai-tip-text">Hey! I'm here.<br>Click me to summarize!</span>`;

      tip.addEventListener('click', () => {
        tip.classList.add('ytai-tip-hide');
        setTimeout(() => tip.remove(), 400);
        toggleBtn.click();
      });

      this.#panelRoot.appendChild(tip);
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

  // ─── Init ─────────────────────────────────────────────────────────

  init() {
    const existing = document.getElementById('yt-ai-summarizer-root');
    if (existing) {
      this.#panelRoot = existing;
      return;
    }

    this.#createRoot();
    const toggleBtn = this.#createToggleButton();
    const panel = this.#createPanel();
    this.#panelRoot.appendChild(toggleBtn);
    this.#panelRoot.appendChild(panel);
    this.#showOnboardingTooltip(toggleBtn);

    // Theme observer
    const applyTheme = () => {
      const wasDark = this.#isDarkTheme;
      this.#detectTheme();
      if (wasDark !== this.#isDarkTheme) {
        this.#panelRoot.classList.toggle('ytai-dark', this.#isDarkTheme);
      }
    };
    new MutationObserver(applyTheme).observe(document.documentElement, {
      attributes: true, attributeFilter: ['dark', 'style']
    });
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

    // Fullscreen detection
    document.addEventListener('fullscreenchange', () => {
      this.#panelRoot?.classList.toggle('ytai-is-fullscreen', !!document.fullscreenElement);
    });
  }

  // ─── Panel toggle ─────────────────────────────────────────────────

  togglePanel(forceState) {
    this.#isOpen = typeof forceState === 'boolean' ? forceState : !this.#isOpen;
    const panel = this.#panelRoot?.querySelector('.ytai-panel');
    const toggleBtn = this.#panelRoot?.querySelector('.ytai-toggle-btn');

    panel?.classList.toggle('open', this.#isOpen);
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', this.#isOpen);
      toggleBtn.style.display = this.#isOpen ? 'none' : '';
    }

    if (this.#isOpen) {
      document.dispatchEvent(new CustomEvent('ytai:panel-open'));
    }
  }

  autoOpen() {
    if (!this.#isOpen) {
      this.#isOpen = true;
      this.#panelRoot?.querySelector('.ytai-panel')?.classList.add('open');
      const toggleBtn = this.#panelRoot?.querySelector('.ytai-toggle-btn');
      if (toggleBtn) { toggleBtn.classList.add('active'); toggleBtn.style.display = 'none'; }
    }
  }

  // ─── Mode switching ───────────────────────────────────────────────

  switchMode(mode) {
    this.#currentMode = mode;
    this.#panelRoot?.querySelectorAll('.ytai-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === mode);
    });

    const footer = this.#panelRoot?.querySelector('.ytai-footer');
    if (footer) footer.style.display = (mode === 'chat' || mode === 'podcast') ? 'none' : '';

    if (mode === 'chat') {
      globalThis.PodcastPlayer?.stop?.();
      document.dispatchEvent(new CustomEvent('ytai:request-chat'));
      return;
    }
    if (mode === 'podcast') {
      document.dispatchEvent(new CustomEvent('ytai:request-podcast'));
      return;
    }

    globalThis.PodcastPlayer?.stop?.();
    document.dispatchEvent(new CustomEvent('ytai:request-summary', { detail: { mode, forceRefresh: false } }));
  }

  // ─── Fun facts ────────────────────────────────────────────────────

  #startFactRotation() {
    this.#stopFactRotation();
    const el = this.#panelRoot?.querySelector('.ytai-fun-fact-text');
    if (!el) return;
    const facts = SummarizerUI.#FUN_FACTS;
    el.textContent = facts[Math.floor(Math.random() * facts.length)];
    this.#factInterval = setInterval(() => {
      if (!el.parentNode) { this.#stopFactRotation(); return; }
      el.style.opacity = '0';
      setTimeout(() => {
        el.textContent = facts[Math.floor(Math.random() * facts.length)];
        el.style.opacity = '1';
      }, 300);
    }, 5000);
  }

  #stopFactRotation() {
    if (this.#factInterval) { clearInterval(this.#factInterval); this.#factInterval = null; }
  }

  // ─── Loading state ────────────────────────────────────────────────

  showLoading(message, progress = -1) {
    const content = this.#panelRoot?.querySelector('.ytai-content');
    if (!content) return;

    if (progress >= 0) {
      const fill = content.querySelector('.ytai-progress-fill');
      if (fill) {
        fill.style.width = `${Math.round(progress * 100)}%`;
        const txt = content.querySelector('.ytai-loading-text');
        if (txt && message) txt.textContent = message;
        return;
      }
    }

    this.#stopFactRotation();
    const safeMsg = this.#escapeHtml(message || chrome.i18n?.getMessage('loading') || 'Analyzing video...');

    content.innerHTML = `
      <div class="ytai-loading">
        <div class="ytai-spinner"></div>
        <div class="ytai-loading-text">${safeMsg}</div>
        ${progress >= 0 ? `
          <div class="ytai-progress-bar">
            <div class="ytai-progress-fill" style="width:${Math.round(progress * 100)}%"></div>
          </div>` : ''}
        <div class="ytai-fun-fact">
          <span class="ytai-fun-fact-label">💡 Did you know?</span>
          <span class="ytai-fun-fact-text"></span>
        </div>
      </div>`;

    this.#startFactRotation();
  }

  // ─── Ready prompt ─────────────────────────────────────────────────

  showReadyPrompt() {
    const content = this.#panelRoot?.querySelector('.ytai-content');
    if (!content) return;

    const uiLang = this.#uiLang();
    const t = SummarizerUI.#READY_TEXT[uiLang] || {
      title: 'Summarize this video?',
      desc: 'Get an AI-powered summary, key points, and detailed analysis.',
      btn: 'Start Summarizing'
    };

    content.innerHTML = `
      <div class="ytai-ready-prompt">
        <div class="ytai-ready-icon">${SummarizerUI.#ICONS.sparkle}</div>
        <div class="ytai-ready-title">${this.#escapeHtml(t.title)}</div>
        <div class="ytai-ready-desc">${this.#escapeHtml(t.desc)}</div>
        <button class="ytai-btn ytai-btn-primary ytai-start-btn">
          ${SummarizerUI.#ICONS.play}
          <span>${this.#escapeHtml(t.btn)}</span>
        </button>
      </div>`;

    content.querySelector('.ytai-start-btn')?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('ytai:request-summary', { detail: { mode: this.#currentMode, forceRefresh: false } }));
    });
  }

  // ─── API key prompt ───────────────────────────────────────────────

  showApiKeyPrompt() {
    const content = this.#panelRoot?.querySelector('.ytai-content');
    if (!content) return;
    content.innerHTML = `
      <div class="ytai-api-prompt">
        ${SummarizerUI.#ICONS.key}
        <p>${this.#escapeHtml(chrome.i18n?.getMessage('apiKeyRequired') || 'Please set up your API key to get started.')}</p>
        <button class="ytai-btn ytai-btn-primary ytai-setup-btn">
          ${SummarizerUI.#ICONS.settings}
          <span>${this.#escapeHtml(chrome.i18n?.getMessage('settings') || 'Open Settings')}</span>
        </button>
      </div>`;
    content.querySelector('.ytai-setup-btn')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openSettings' }).catch(() => {});
    });
  }

  // ─── Error state ──────────────────────────────────────────────────

  showError(title, message, retryable = true) {
    this.#stopFactRotation();
    const content = this.#panelRoot?.querySelector('.ytai-content');
    if (!content) return;
    content.innerHTML = `
      <div class="ytai-error">
        ${SummarizerUI.#ICONS.error}
        <div class="ytai-error-title">${this.#escapeHtml(title)}</div>
        <div class="ytai-error-msg">${this.#escapeHtml(message)}</div>
        ${retryable ? `<button class="ytai-btn ytai-btn-primary ytai-retry-btn">Try Again</button>` : ''}
      </div>`;
    content.querySelector('.ytai-retry-btn')?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('ytai:request-summary', { detail: { mode: this.#currentMode, forceRefresh: true } }));
    });
  }

  // ─── Podcast player ───────────────────────────────────────────────

  showPodcastPlayer(data) {
    this.#stopFactRotation();
    const content = this.#panelRoot?.querySelector('.ytai-content');
    if (!content) return;

    if (!data) {
      const isTR = this.#uiLang() === 'tr';
      content.innerHTML = `
        <div class="ytai-podcast-empty">
          <div class="ytai-podcast-icon">🎙️</div>
          <div class="ytai-ready-title">AI Podcast</div>
          <div class="ytai-ready-desc">${this.#escapeHtml(isTR ? 'Önce bir özet oluşturun, ardından Podcast sekmesine gelin.' : 'Generate a summary first, then come to the Podcast tab.')}</div>
        </div>`;
      return;
    }

    const { dialogue, audioBase64 } = data;
    const pp = globalThis.PodcastPlayer;
    const dur = pp?.formatTime ? pp.formatTime(0) : '0:00';

    // BUG FIX: Removed dead 'A'/'B' speaker checks — LLM always returns 'Alex'/'Sam'
    content.innerHTML = `
      <div class="ytai-podcast-player">
        <div class="ytai-podcast-header">
          <div class="ytai-podcast-icon-large">🎙️</div>
          <div class="ytai-podcast-title">AI Podcast</div>
          <div class="ytai-podcast-meta" id="ytaiPodcastDuration">Loading audio...</div>
        </div>
        <div class="ytai-podcast-subtitle" id="ytaiPodcastSubtitle">
          <span class="ytai-podcast-speaker speaker-a">Alex &amp; Sam</span>
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
          <button class="ytai-podcast-ctrl ytai-podcast-play" id="ytaiPodcastPlayPause">
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
            // BUG FIX: speaker is always 'Alex' or 'Sam' — no 'A'/'B' mapping needed
            const cls = line.speaker === 'Alex' ? 'speaker-a' : 'speaker-b';
            return `<div class="ytai-podcast-line" data-index="${i}">
              <span class="ytai-line-speaker ${cls}">${this.#escapeHtml(line.speaker)}</span>
              <span class="ytai-line-text">${this.#escapeHtml(line.text)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;

    // Wire up audio player (use globalThis — bare PodcastPlayer can be the class in another script scope)
    if (!pp?.loadAudio) return;
    pp.loadAudio(audioBase64).then(() => {
      const state = pp.getState();
      const fmt = pp.formatTime(state.duration);
      const durEl = content.querySelector('#ytaiPodcastDuration');
      const totalEl = content.querySelector('#ytaiPodcastTotalTime');
      if (durEl) durEl.textContent = fmt;
      if (totalEl) totalEl.textContent = fmt;
    });

    pp.setOnStateChange((state) => {
      const playIcon = content.querySelector('.play-icon');
      const pauseIcon = content.querySelector('.pause-icon');
      if (playIcon && pauseIcon) {
        playIcon.style.display = state.isPlaying ? 'none' : 'block';
        pauseIcon.style.display = state.isPlaying ? 'block' : 'none';
      }
      const fill = content.querySelector('#ytaiPodcastProgressFill');
      const timeEl = content.querySelector('#ytaiPodcastTime');
      if (fill && state.duration > 0) fill.style.width = `${(state.currentTime / state.duration) * 100}%`;
      if (timeEl) timeEl.textContent = pp.formatTime(state.currentTime);
    });

    content.querySelector('#ytaiPodcastPlayPause')?.addEventListener('click', () => {
      pp.togglePlayPause(audioBase64);
    });
    content.querySelector('#ytaiPodcastBack')?.addEventListener('click', () => pp.skipBackward(10));
    content.querySelector('#ytaiPodcastFwd')?.addEventListener('click', () => pp.skipForward(10));
    content.querySelector('#ytaiPodcastProgressBar')?.addEventListener('click', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const d = pp.getState().duration;
      pp.seek(ratio * d);
    });
    content.querySelectorAll('.ytai-rate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        content.querySelectorAll('.ytai-rate-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        pp.setRate(parseFloat(btn.dataset.rate));
      });
    });
  }

  showPodcastKeyPrompt() {
    const content = this.#panelRoot?.querySelector('.ytai-content');
    if (!content) return;

    const uiLang = this.#uiLang();
    const regionMsg = SummarizerUI.#UNSUPPORTED_REGIONS[uiLang];
    if (regionMsg) {
      content.innerHTML = `
        <div class="ytai-podcast-empty">
          <div class="ytai-podcast-icon">🚫</div>
          <div class="ytai-ready-title" style="color:var(--ytai-error)">Region Not Supported</div>
          <div class="ytai-ready-desc">${this.#escapeHtml(regionMsg)}</div>
        </div>`;
      return;
    }

    const isTR = uiLang === 'tr';
    content.innerHTML = `
      <div class="ytai-podcast-setup">
        <div class="ytai-podcast-icon">🎙️</div>
        <div class="ytai-ready-title">${isTR ? 'AI Podcast Kurulumu' : 'AI Podcast Setup'}</div>
        <div class="ytai-ready-desc" style="max-width:300px">
          ${isTR
            ? 'Podcast özelliği Google Gemini TTS kullanır. Ücretsiz Gemini API anahtarı gerekiyor.'
            : 'Podcast uses Gemini TTS for natural voices. You need a free Gemini API key — no credit card required!'}
        </div>
        <div class="ytai-podcast-steps">
          <div class="ytai-step"><span class="ytai-step-num">1</span><span>${isTR ? '<a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> adresine gidin' : 'Go to <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a>'}</span></div>
          <div class="ytai-step"><span class="ytai-step-num">2</span><span>${isTR ? 'Google hesabınızla giriş yapın' : 'Sign in with your Google account'}</span></div>
          <div class="ytai-step"><span class="ytai-step-num">3</span><span>${isTR ? '"Create API Key" butonuna tıklayın' : 'Click "Create API Key"'}</span></div>
          <div class="ytai-step"><span class="ytai-step-num">4</span><span>${isTR ? 'Anahtarı aşağıya yapıştırın' : 'Paste your key below'}</span></div>
        </div>
        <div class="ytai-gemini-key-inline">
          <div class="ytai-gemini-key-row">
            <input type="password" class="ytai-gemini-key-input" placeholder="${isTR ? 'Gemini API anahtarınızı yapıştırın' : 'Paste your Gemini API key'}" spellcheck="false" autocomplete="off" />
            <button class="ytai-gemini-key-toggle" title="${isTR ? 'Göster/Gizle' : 'Show/Hide'}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <button class="ytai-btn ytai-btn-primary ytai-gemini-save-btn" disabled>
            <span>${isTR ? 'Kaydet &amp; Podcast Oluştur' : 'Save &amp; Generate Podcast'}</span>
          </button>
          <div class="ytai-gemini-key-error" style="display:none"></div>
        </div>
      </div>`;

    const input = content.querySelector('.ytai-gemini-key-input');
    const toggleBtn = content.querySelector('.ytai-gemini-key-toggle');
    const saveBtn = content.querySelector('.ytai-gemini-save-btn');
    const errorEl = content.querySelector('.ytai-gemini-key-error');

    toggleBtn?.addEventListener('click', () => { input.type = input.type === 'password' ? 'text' : 'password'; });
    input?.addEventListener('input', () => { saveBtn.disabled = input.value.trim().length < 10; });
    saveBtn?.addEventListener('click', async () => {
      const key = input.value.trim();
      if (!key) return;
      errorEl.style.display = 'none';
      if (!key.startsWith('AIza')) {
        errorEl.textContent = isTR ? 'Geçersiz anahtar. "AIza" ile başlamalıdır.' : 'Invalid key. Must start with "AIza".';
        errorEl.style.display = 'block';
        return;
      }
      try {
        const currentSettings = await StorageHelper.getSettings();
        currentSettings.geminiApiKey = key;
        await StorageHelper.saveSettings(currentSettings);
        document.dispatchEvent(new CustomEvent('ytai:request-podcast'));
      } catch {
        errorEl.textContent = isTR ? 'Kaydedilemedi.' : 'Failed to save. Try again.';
        errorEl.style.display = 'block';
      }
    });
    input?.focus();
  }

  showPodcastLoading(message) {
    const content = this.#panelRoot?.querySelector('.ytai-content');
    if (!content) return;
    content.innerHTML = `
      <div class="ytai-loading">
        <div style="font-size:48px;margin-bottom:8px">🎙️</div>
        <div class="ytai-spinner"></div>
        <div class="ytai-loading-text">${this.#escapeHtml(message || 'Generating podcast...')}</div>
        <div class="ytai-fun-fact">
          <span class="ytai-fun-fact-label">💡 Did you know?</span>
          <span class="ytai-fun-fact-text"></span>
        </div>
      </div>`;
    this.#startFactRotation();
  }

  // ─── Chat UI ──────────────────────────────────────────────────────

  showChatUI(messages) {
    this.#stopFactRotation();
    const content = this.#panelRoot?.querySelector('.ytai-content');
    if (!content) return;

    const isTR = this.#uiLang() === 'tr';

    let html = `<div class="ytai-chat-container"><div class="ytai-chat-messages" id="ytaiChatMessages">`;

    if (!messages?.length) {
      html += `
        <div class="ytai-chat-empty">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="var(--ytai-text-faint)"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>
          <div class="ytai-chat-empty-title">${isTR ? 'Videoya dair sorularınızı sorun' : 'Ask questions about this video'}</div>
          <div class="ytai-chat-empty-desc">${isTR ? 'Yapay zeka videonun transkriptine dayanarak yanıt verecektir.' : 'The AI will answer based on the video transcript.'}</div>
        </div>`;
    } else {
      messages.forEach(msg => {
        const isUser = msg.role === 'user';
        const avatarHTML = isUser
          ? `<div class="ytai-chat-avatar ytai-avatar-user">U</div>`
          : `<div class="ytai-chat-avatar ytai-avatar-ai">${SummarizerUI.#ICONS.ai}</div>`;
        html += `
          <div class="ytai-chat-msg ${isUser ? 'user' : 'ai'}">
            ${isUser ? '' : avatarHTML}
            <div class="ytai-chat-bubble">${isUser ? this.#escapeHtml(msg.text) : this.#markdownToHtml(msg.text)}</div>
            ${isUser ? avatarHTML : ''}
          </div>`;
      });
    }

    html += `
      </div>
      <div class="ytai-chat-input-area">
        <div class="ytai-chat-input-wrap">
          <textarea id="ytaiChatInput" placeholder="${isTR ? 'Bir soru sorun...' : 'Ask a question...'}" rows="1"></textarea>
          <button id="ytaiChatSendBtn" disabled>${SummarizerUI.#ICONS.send}</button>
        </div>
      </div>
    </div>`;

    content.innerHTML = html;

    const messagesEl = content.querySelector('#ytaiChatMessages');
    const inputEl = content.querySelector('#ytaiChatInput');
    const sendBtn = content.querySelector('#ytaiChatSendBtn');

    if (messages?.length) messagesEl.scrollTop = messagesEl.scrollHeight;

    inputEl.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
      sendBtn.disabled = this.value.trim().length === 0;
    });

    const triggerSend = () => {
      const text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = '';
      inputEl.style.height = 'auto';
      sendBtn.disabled = true;
      document.dispatchEvent(new CustomEvent('ytai:send-chat-message', { detail: { text } }));
    };

    sendBtn.addEventListener('click', triggerSend);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); triggerSend(); }
    });

    setTimeout(() => inputEl.focus(), 100);
  }

  addChatMessage(role, text) {
    const messagesEl = this.#panelRoot?.querySelector('#ytaiChatMessages');
    if (!messagesEl) return;

    messagesEl.querySelector('.ytai-chat-empty')?.remove();

    if (role === 'ai' || role === 'error') {
      messagesEl.querySelector('.ytai-chat-loading')?.remove();
    }

    if (role === 'loading') {
      messagesEl.insertAdjacentHTML('beforeend', `
        <div class="ytai-chat-msg ai ytai-chat-loading">
          <div class="ytai-chat-avatar ytai-avatar-ai">${SummarizerUI.#ICONS.ai}</div>
          <div class="ytai-chat-bubble">
            <span class="ytai-typing"></span><span class="ytai-typing"></span><span class="ytai-typing"></span>
          </div>
        </div>`);
    } else {
      const isUser = role === 'user';
      const isError = role === 'error';
      const avatarHTML = isUser
        ? `<div class="ytai-chat-avatar ytai-avatar-user">U</div>`
        : `<div class="ytai-chat-avatar ytai-avatar-ai">${SummarizerUI.#ICONS.ai}</div>`;
      messagesEl.insertAdjacentHTML('beforeend', `
        <div class="ytai-chat-msg ${isUser ? 'user' : 'ai'} ${isError ? 'error' : ''}">
          ${isUser ? '' : avatarHTML}
          <div class="ytai-chat-bubble">${isUser ? this.#escapeHtml(text) : this.#markdownToHtml(text)}</div>
          ${isUser ? avatarHTML : ''}
        </div>`);
    }

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ─── Result display ───────────────────────────────────────────────

  showResult(markdownText) {
    this.#stopFactRotation();
    const content = this.#panelRoot?.querySelector('.ytai-content');
    if (!content) return;
    content.innerHTML = `<div class="ytai-result">${this.#markdownToHtml(markdownText)}</div>`;
  }

  // ─── Markdown renderer ────────────────────────────────────────────

  #markdownToHtml(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^\d+\.\s+(.+)$/gm, '<oli>$1</oli>')
      .replace(/^[-*]\s+(.+)$/gm, '<uli>$1</uli>')
      .replace(/((?:<oli>.*<\/oli>\n?)+)/g, m => `<ol>${m.replace(/<\/?oli>/g, t => t === '<oli>' ? '<li>' : '</li>')}</ol>`)
      .replace(/((?:<uli>.*<\/uli>\n?)+)/g, m => `<ul>${m.replace(/<\/?uli>/g, t => t === '<uli>' ? '<li>' : '</li>')}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    if (!html.startsWith('<')) html = `<p>${html}</p>`;
    return html;
  }

  // ─── Copy result ──────────────────────────────────────────────────

  async #copyResult() {
    const content = this.#panelRoot?.querySelector('.ytai-result');
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content.innerText);
      this.showToast(chrome.i18n?.getMessage('copied') || 'Copied to clipboard!');
    } catch {
      this.showToast('Failed to copy');
    }
  }

  // ─── Toast ────────────────────────────────────────────────────────

  showToast(message, duration = 2500) {
    this.#panelRoot?.querySelector('.ytai-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'ytai-toast';
    toast.textContent = message;
    this.#panelRoot?.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ─── Provider label ───────────────────────────────────────────────

  #updateProviderLabelEl(el) {
    if (!el) return;
    chrome.storage?.local?.get?.({ provider: 'groq' }, (r) => {
      if (el) el.textContent = r.provider === 'ollama' ? 'Powered by Ollama Cloud' : 'Powered by Groq';
    });
  }

  updateProviderLabel(provider) {
    const label = this.#panelRoot?.querySelector('.ytai-provider-label');
    if (!label) return;
    if (provider) {
      label.textContent = provider === 'ollama' ? 'Powered by Ollama Cloud' : 'Powered by Groq';
    } else {
      this.#updateProviderLabelEl(label);
    }
  }

  // ─── Public getters ───────────────────────────────────────────────

  isPanelOpen() { return this.#isOpen; }
  getCurrentMode() { return this.#currentMode; }

  destroy() {
    this.#panelRoot?.remove();
    this.#panelRoot = null;
    this.#isOpen = false;
    SummarizerUI.#instance = null;
  }
}

// Export singleton — reassign lexical binding so bare `SummarizerUI` resolves to the instance
const _uiInstance = SummarizerUI.getInstance();
SummarizerUI = _uiInstance;

if (typeof window !== 'undefined') {
  window.SummarizerUI = _uiInstance;
}
if (typeof globalThis !== 'undefined') {
  globalThis.SummarizerUI = _uiInstance;
}
