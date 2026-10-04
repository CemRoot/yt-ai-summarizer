/**
 * ArticlePageEligibility — which URLs may offer the article reader.
 *
 * Single source for the popup check and the on-page button. The button
 * uses the same blocked-URL heuristics as checkArticlePage (banking, mail,
 * login, checkout). Extractor-only patterns stay stricter at read time.
 */
(function initArticlePageEligibility() {
  if (globalThis.ArticlePageEligibility) return;

  class ArticlePageEligibility {
    /**
     * Sensitive URLs. "auth" is a path token so "/author/" and "authority"
     * still get the button. "/auth" and "/authentication" stay blocked.
     */
    static #BUTTON_BLOCKED = [
      /banking|bank\./i,
      /mail\.(google|yahoo|outlook)/i,
      /(?:^|[/?&#._-])(?:login|sign-?in|oauth|auth(?:entication)?)(?:[/?&#._-]|$)/i,
      /checkout|payment|cart/i,
    ];

    /** Extra refusals when reading the DOM. Not used to hide the button. */
    static #EXTRACTOR_EXTRA = [
      /account\..*\.(com|org|net)/i,
      /password|credential/i,
    ];

    /**
     * @param {unknown} url
     * @returns {boolean}
     */
    static isYouTube(url) {
      return /youtube\.com|youtu\.be/i.test(typeof url === 'string' ? url : '');
    }

    /**
     * @param {unknown} url
     * @returns {boolean}
     */
    static isBrowserPage(url) {
      const u = typeof url === 'string' ? url : '';
      return u.startsWith('chrome://') || u.startsWith('chrome-extension://');
    }

    /**
     * checkArticlePage blocked heuristics (full URL, not hostname only).
     * @param {unknown} url
     * @returns {boolean}
     */
    static isBlockedUrl(url) {
      const u = typeof url === 'string' ? url : '';
      return ArticlePageEligibility.#BUTTON_BLOCKED.some((pattern) => pattern.test(u));
    }

    /**
     * Blocked URL or an extractor-only sensitive page (password, account host).
     * @param {unknown} url
     * @returns {boolean}
     */
    static isSensitivePage(url) {
      const u = typeof url === 'string' ? url : '';
      if (ArticlePageEligibility.isBlockedUrl(u)) return true;
      return ArticlePageEligibility.#EXTRACTOR_EXTRA.some((pattern) => pattern.test(u));
    }

    /**
     * @param {unknown} url
     * @returns {{ isArticle: boolean, reason?: string, isYouTube?: boolean }}
     */
    static classify(url) {
      const u = typeof url === 'string' ? url : '';
      if (ArticlePageEligibility.isBrowserPage(u)) {
        return { isArticle: false, reason: 'BROWSER_PAGE' };
      }
      if (ArticlePageEligibility.isYouTube(u)) {
        return { isArticle: false, reason: 'YOUTUBE', isYouTube: true };
      }
      if (ArticlePageEligibility.isBlockedUrl(u)) {
        return { isArticle: false, reason: 'BLOCKED_PAGE' };
      }
      return { isArticle: true };
    }

    /**
     * On-page button: ordinary http(s) only. YouTube, browser pages, and
     * the checkArticlePage block list are skipped.
     * @param {unknown} url
     * @returns {boolean}
     */
    static canOfferArticleButton(url) {
      const u = typeof url === 'string' ? url : '';
      if (!/^https?:\/\//i.test(u)) return false;
      return ArticlePageEligibility.classify(u).isArticle === true;
    }
  }

  globalThis.ArticlePageEligibility = ArticlePageEligibility;
})();
