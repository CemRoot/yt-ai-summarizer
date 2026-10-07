/**
 * Gleano — on-page article button.
 *
 * Draws the same floating control as the article reader and asks the
 * service worker to inject the reader on click. Does not build a second panel.
 */
(function initArticleLauncher() {
class ArticleLauncher {
  static #instance = null;

  /** Same glyph as ArticleUI's article icon, so the control does not change after inject. */
  static #ICON = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/></svg>';

  /** When to look at the page after load or navigation. */
  static #RECHECK_DELAYS_MS = [0, 1200, 3500, 8000];

  #busy = false;
  #mounted = false;
  #timers = [];

  constructor() {
    if (ArticleLauncher.#instance) return ArticleLauncher.#instance;
    ArticleLauncher.#instance = this;
  }

  static getInstance() {
    if (!ArticleLauncher.#instance) {
      ArticleLauncher.#instance = new ArticleLauncher();
    }
    return ArticleLauncher.#instance;
  }

  mount() {
    if (this.#mounted) return;
    this.#mounted = true;
    this.#scheduleChecks();
    window.addEventListener('popstate', () => this.#scheduleChecks());
    window.addEventListener('pageshow', () => this.#scheduleChecks());
    window.navigation?.addEventListener?.('navigatesuccess', () => this.#scheduleChecks());
  }

  /** URL gate only. Cheap; used on click. */
  #urlAllowed() {
    if (typeof ArticlePageEligibility === 'undefined') return false;
    return ArticlePageEligibility.canOfferArticleButton(location.href);
  }

  /** URL gate plus DOM evidence (article / forum markup, real paragraphs). */
  #pageAllowed() {
    if (typeof ArticlePageEligibility === 'undefined') return false;
    return ArticlePageEligibility.canOfferArticleButtonOnPage(location.href, document);
  }

  /**
   * Re-check after navigation. Some sites render the story after
   * document_idle, so a page that fails is checked again a few times.
   */
  #scheduleChecks() {
    for (const id of this.#timers) clearTimeout(id);
    this.#timers = [];
    const href = location.href;
    for (const delay of ArticleLauncher.#RECHECK_DELAYS_MS) {
      this.#timers.push(setTimeout(() => {
        if (location.href !== href) return;
        this.#sync();
      }, delay));
    }
  }

  #sync() {
    const existing = document.getElementById('gleano-article-toggle');
    if (!this.#pageAllowed()) {
      if (existing && !document.getElementById('gleano-article-panel')) existing.remove();
      return;
    }
    if (existing || !document.body) return;
    for (const id of this.#timers) clearTimeout(id);
    this.#timers = [];

    const btn = document.createElement('button');
    btn.id = 'gleano-article-toggle';
    btn.type = 'button';
    btn.className = 'gleano-toggle-btn';
    btn.title = chrome.i18n?.getMessage('articleReaderTitle') || 'Gleano';
    btn.innerHTML = ArticleLauncher.#ICON;
    if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) {
      btn.classList.add('dark');
    }
    btn.addEventListener('click', () => { void this.#onClick(); });
    document.body.appendChild(btn);
  }

  async #onClick() {
    if (this.#busy) return;
    if (!this.#urlAllowed()) {
      document.getElementById('gleano-article-toggle')?.remove();
      return;
    }

    this.#busy = true;
    const btn = document.getElementById('gleano-article-toggle');
    if (btn) btn.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'injectArticleReader',
        startSummary: true,
      });
      if (response?.error) {
        console.error('[ArticleLauncher]', response.error);
      }
    } catch (err) {
      console.error('[ArticleLauncher]', err?.message || err);
    } finally {
      this.#busy = false;
      const again = document.getElementById('gleano-article-toggle');
      if (again) again.disabled = false;
    }
  }
}

  const launcher = ArticleLauncher.getInstance();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => launcher.mount(), { once: true });
  } else {
    launcher.mount();
  }
})();
