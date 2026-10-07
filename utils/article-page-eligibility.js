/**
 * ArticlePageEligibility — which URLs may offer the article reader.
 *
 * Single source for the popup check and the on-page button.
 *
 * - Popup (classify): permissive. The user asked for the reader explicitly,
 *   so only browser pages, YouTube and sensitive URLs are refused.
 * - On-page button: strict, two gates. canOfferArticleButton(url) refuses
 *   social / app / search / shop hosts and site homepages. Then
 *   shouldOfferForSignals(url, signals) needs evidence from the DOM that
 *   the page is a news article, a blog post or a forum thread.
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
     * Hosts that are feeds, apps, search, video, chat or shops — never the
     * floating button. Matched on the hostname and its subdomains.
     */
    static #NON_ARTICLE_HOSTS = [
      // social networks and feeds
      'instagram.com', 'facebook.com', 'fb.com', 'messenger.com', 'threads.net',
      'twitter.com', 'x.com', 't.co', 'tiktok.com', 'linkedin.com', 'snapchat.com',
      'bsky.app', 'mastodon.social', 'tumblr.com', 'vk.com', 'ok.ru', 'weibo.com',
      'pinterest.com', 'tinder.com', 'bumble.com',
      // chat and mail
      'whatsapp.com', 'telegram.org', 't.me', 'discord.com', 'discord.gg',
      'slack.com', 'teams.microsoft.com', 'zoom.us', 'outlook.live.com',
      'outlook.office.com', 'proton.me', 'icloud.com',
      // video, music, streaming
      'twitch.tv', 'netflix.com', 'primevideo.com', 'disneyplus.com', 'hulu.com',
      'spotify.com', 'soundcloud.com', 'music.apple.com', 'vimeo.com',
      'dailymotion.com', 'kick.com', 'exxen.com', 'blutv.com',
      // AI assistants and productivity apps
      'chatgpt.com', 'chat.openai.com', 'claude.ai', 'gemini.google.com',
      'perplexity.ai', 'notion.so', 'figma.com', 'canva.com', 'miro.com',
      'trello.com', 'atlassian.net', 'airtable.com', 'dropbox.com',
      'office.com', 'live.com', 'docs.google.com', 'drive.google.com',
      'calendar.google.com', 'meet.google.com', 'maps.google.com',
      'translate.google.com', 'photos.google.com', 'web.whatsapp.com',
      // search engines
      'bing.com', 'duckduckgo.com', 'yandex.com', 'yandex.ru', 'baidu.com',
      'search.yahoo.com', 'ecosia.org', 'search.brave.com',
      // code hosting dashboards
      'github.com', 'gitlab.com', 'bitbucket.org',
      // shopping and classifieds
      'amazon.com', 'ebay.com', 'aliexpress.com', 'etsy.com', 'temu.com',
      'shein.com', 'walmart.com', 'trendyol.com', 'hepsiburada.com', 'n11.com',
      'sahibinden.com', 'letgo.com', 'getir.com', 'yemeksepeti.com',
      'booking.com', 'airbnb.com',
    ];

    /** Brands with many country TLDs (google.com.tr, amazon.co.uk, ...). */
    static #NON_ARTICLE_BRANDS = /(?:^|\.)(?:google|amazon|ebay|yandex|bing)\.(?:[a-z]{2,3})(?:\.[a-z]{2})?$/i;

    /**
     * Forum and Q&A threads on big sites that are recognised by URL alone.
     * Their markup changes often, so the path is the stable signal.
     */
    static #KNOWN_THREAD_PAGES = [
      { host: 'reddit.com', path: /^\/r\/[^/]+\/comments\/[a-z0-9]+/i },
      { host: 'news.ycombinator.com', path: /^\/item$/i },
      { host: 'stackoverflow.com', path: /^\/questions\/\d+/i },
      { host: 'stackexchange.com', path: /^\/questions\/\d+/i },
      { host: 'superuser.com', path: /^\/questions\/\d+/i },
      { host: 'serverfault.com', path: /^\/questions\/\d+/i },
      { host: 'askubuntu.com', path: /^\/questions\/\d+/i },
      { host: 'quora.com', path: /^\/[^/]+-[^/]+$/i },
      { host: 'eksisozluk.com', path: /^\/[^/]+--\d+/i },
      { host: 'technopat.net', path: /^\/sosyal\/konu\//i },
      { host: 'donanimhaber.com', path: /--\d+$/i },
      { host: 'medium.com', path: /^\/(?:@[^/]+|[^/]+)\/[^/]+-[0-9a-f]{8,}$/i },
    ];

    /** Schema.org types that mark one article or blog post. */
    static #ARTICLE_TYPES = new Set([
      'article', 'newsarticle', 'reportagenewsarticle', 'analysisnewsarticle',
      'opinionnewsarticle', 'reviewnewsarticle', 'backgroundnewsarticle',
      'askpublicnewsarticle', 'liveblogposting', 'blogposting', 'techarticle',
      'scholarlyarticle', 'report', 'review',
    ]);

    /** Schema.org types that mark a forum thread or a Q&A page. */
    static #FORUM_TYPES = new Set(['discussionforumposting', 'qapage', 'question']);

    /** <meta name="generator"> values of forum software. */
    static #FORUM_GENERATORS = /discourse|phpbb|vbulletin|xenforo|invision|mybb|flarum|nodebb|simple machines|smf|vanilla|bbpress/i;

    /** Any page of a known forum engine (index, board list or thread). */
    static #FORUM_PLATFORM_MARKUP = '#phpbb, body.discourse, #discourse-main, html[data-app="public"][data-template], .vbulletin, #smfheader, body#mybb';

    /**
     * Thread view of a forum engine. Posts there are often <div>s, not <p>s,
     * so this counts as a thread without a paragraph check.
     * phpBB, XenForo, vBulletin, SMF, Invision, Discourse, Flarum, MyBB.
     */
    static #FORUM_THREAD_MARKUP = [
      'body.section-viewtopic',
      'html[data-template="thread_view"]',
      '#postlist .postbitlegacy, #posts .postbit, .postbit-wrapper',
      '#forumposts .post_wrapper',
      '[data-role="commentFeed"]',
      '.topic-post article[data-post-id]',
      '.PostStream-item',
      '#posts .post_body',
    ].join(', ');

    /** Paragraphs shorter than this are menus, captions or teasers. */
    static #MIN_PARAGRAPH_CHARS = 80;

    /** Thresholds for shouldOfferForSignals. */
    static #TEXT_WITH_ARTICLE_META = 500;
    static #TEXT_WITH_FORUM_META = 200;
    static #TEXT_WITHOUT_META = 2000;
    static #PARAGRAPHS_WITHOUT_META = 6;

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
     * @returns {URL|null}
     */
    static #parse(url) {
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return null;
      try {
        return new URL(url);
      } catch {
        return null;
      }
    }

    /**
     * @param {string} hostname
     * @param {string} domain
     * @returns {boolean}
     */
    static #hostIs(hostname, domain) {
      return hostname === domain || hostname.endsWith(`.${domain}`);
    }

    /**
     * Social, chat, video, search, app and shop hosts.
     * @param {unknown} url
     * @returns {boolean}
     */
    static isNonArticleHost(url) {
      const parsed = ArticlePageEligibility.#parse(url);
      if (!parsed) return false;
      const host = parsed.hostname.toLowerCase();
      if (ArticlePageEligibility.#NON_ARTICLE_BRANDS.test(host)) return true;
      return ArticlePageEligibility.#NON_ARTICLE_HOSTS.some(
        (domain) => ArticlePageEligibility.#hostIs(host, domain)
      );
    }

    /**
     * A site's front page or a bare section index ("/", "/index.html").
     * News homepages list teasers; the button belongs on the story itself.
     * @param {unknown} url
     * @returns {boolean}
     */
    static isHomepage(url) {
      const parsed = ArticlePageEligibility.#parse(url);
      if (!parsed) return false;
      const path = parsed.pathname.replace(/\/+$/, '');
      if (path === '' || /^\/(?:index|default|home)\.(?:html?|php|aspx?)$/i.test(path)) {
        return !parsed.search || /^\?(?:utm_[^=]+=[^&]*&?)+$/i.test(parsed.search);
      }
      return false;
    }

    /**
     * Forum / Q&A thread on a site recognised by its URL.
     * @param {unknown} url
     * @returns {boolean}
     */
    static isKnownThreadPage(url) {
      const parsed = ArticlePageEligibility.#parse(url);
      if (!parsed) return false;
      const host = parsed.hostname.toLowerCase();
      return ArticlePageEligibility.#KNOWN_THREAD_PAGES.some(
        (rule) => ArticlePageEligibility.#hostIs(host, rule.host) && rule.path.test(parsed.pathname)
      );
    }

    /**
     * Popup check: permissive, because the user asked for the reader.
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
     * On-page button, URL gate. Known forum threads pass. Social / app
     * hosts and homepages are refused. Everything else still needs
     * shouldOfferForSignals before the button is drawn.
     * @param {unknown} url
     * @returns {boolean}
     */
    static canOfferArticleButton(url) {
      const u = typeof url === 'string' ? url : '';
      if (!/^https?:\/\//i.test(u)) return false;
      if (ArticlePageEligibility.classify(u).isArticle !== true) return false;
      if (ArticlePageEligibility.isKnownThreadPage(u)) return true;
      if (ArticlePageEligibility.isNonArticleHost(u)) return false;
      return !ArticlePageEligibility.isHomepage(u);
    }

    /**
     * Collect @type values from JSON-LD, walking arrays and @graph.
     * @param {unknown} node
     * @param {Set<string>} out
     * @param {number} depth
     */
    static #collectLdTypes(node, out, depth = 0) {
      if (!node || depth > 6) return;
      if (Array.isArray(node)) {
        for (const item of node) ArticlePageEligibility.#collectLdTypes(item, out, depth + 1);
        return;
      }
      if (typeof node !== 'object') return;
      const type = node['@type'];
      for (const t of Array.isArray(type) ? type : [type]) {
        if (typeof t === 'string') out.add(t.replace(/^.*[/#:]/, '').toLowerCase());
      }
      if (node['@graph']) ArticlePageEligibility.#collectLdTypes(node['@graph'], out, depth + 1);
      if (node.mainEntity) ArticlePageEligibility.#collectLdTypes(node.mainEntity, out, depth + 1);
    }

    /**
     * Read the DOM once and return plain data for shouldOfferForSignals.
     * Cheap: a few selectors and up to 400 paragraphs.
     * @param {Document} doc
     * @returns {{ articleSchema: boolean, forumSchema: boolean, ogArticle: boolean,
     *   forumPlatform: boolean, forumThread: boolean, paragraphChars: number, paragraphCount: number,
     *   bodyChars: number, bodyCount: number }}
     *   paragraph* counts every real paragraph; body* the largest group of
     *   sibling paragraphs (the story body).
     */
    static collectPageSignals(doc) {
      const types = new Set();
      for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          ArticlePageEligibility.#collectLdTypes(JSON.parse(script.textContent || ''), types);
        } catch {
          // Broken JSON-LD on the page; ignore it.
        }
      }
      for (const el of doc.querySelectorAll('[itemtype]')) {
        const itemtype = el.getAttribute('itemtype') || '';
        for (const t of itemtype.split(/\s+/)) {
          if (t) types.add(t.replace(/^.*[/#:]/, '').toLowerCase());
        }
      }

      const meta = (selector) => (doc.querySelector(selector)?.getAttribute('content') || '').trim();
      const ogType = meta('meta[property="og:type"]').toLowerCase();
      const generator = meta('meta[name="generator"]');
      const forumMarkup = !!doc.querySelector(ArticlePageEligibility.#FORUM_PLATFORM_MARKUP);
      const forumThread = !!doc.querySelector(ArticlePageEligibility.#FORUM_THREAD_MARKUP);

      const root = doc.querySelector('[itemprop="articleBody"], article, main, [role="main"]') || doc.body || doc;
      let paragraphChars = 0;
      let paragraphCount = 0;
      // Story text sits in one container as sibling paragraphs. Teaser
      // cards on a section page are one paragraph per card, often a link.
      const clusters = new Map();
      const paragraphs = root.querySelectorAll('p');
      const limit = Math.min(paragraphs.length, 400);
      for (let i = 0; i < limit; i += 1) {
        const p = paragraphs[i];
        if (p.closest?.('a, nav, aside, footer, header, [role="navigation"]')) continue;
        const len = (p.textContent || '').replace(/\s+/g, ' ').trim().length;
        if (len < ArticlePageEligibility.#MIN_PARAGRAPH_CHARS) continue;
        paragraphChars += len;
        paragraphCount += 1;
        const key = p.parentElement || root;
        const c = clusters.get(key) || { chars: 0, count: 0 };
        c.chars += len;
        c.count += 1;
        clusters.set(key, c);
      }
      let bodyChars = 0;
      let bodyCount = 0;
      for (const c of clusters.values()) {
        if (c.chars > bodyChars) {
          bodyChars = c.chars;
          bodyCount = c.count;
        }
      }

      return {
        articleSchema: [...types].some((t) => ArticlePageEligibility.#ARTICLE_TYPES.has(t)),
        forumSchema: [...types].some((t) => ArticlePageEligibility.#FORUM_TYPES.has(t)),
        ogArticle: ogType === 'article' || ogType.startsWith('article:'),
        forumPlatform: ArticlePageEligibility.#FORUM_GENERATORS.test(generator) || forumMarkup || forumThread,
        forumThread,
        paragraphChars,
        paragraphCount,
        bodyChars,
        bodyCount,
      };
    }

    /**
     * On-page button, content gate. Pure: takes collectPageSignals output.
     * @param {unknown} url
     * @param {ReturnType<typeof ArticlePageEligibility.collectPageSignals>} signals
     * @returns {boolean}
     */
    static shouldOfferForSignals(url, signals) {
      if (!ArticlePageEligibility.canOfferArticleButton(url)) return false;
      if (ArticlePageEligibility.isKnownThreadPage(url)) return true;
      if (!signals) return false;

      if (signals.forumThread) return true;

      const chars = Number(signals.paragraphChars) || 0;
      const count = Number(signals.paragraphCount) || 0;

      if ((signals.forumSchema || signals.forumPlatform)
        && chars >= ArticlePageEligibility.#TEXT_WITH_FORUM_META) {
        return true;
      }
      if ((signals.articleSchema || signals.ogArticle)
        && chars >= ArticlePageEligibility.#TEXT_WITH_ARTICLE_META) {
        return true;
      }
      // No metadata: only a long body of sibling paragraphs counts.
      const bodyChars = Number(signals.bodyChars ?? chars) || 0;
      const bodyCount = Number(signals.bodyCount ?? count) || 0;
      return bodyChars >= ArticlePageEligibility.#TEXT_WITHOUT_META
        && bodyCount >= ArticlePageEligibility.#PARAGRAPHS_WITHOUT_META;
    }

    /**
     * Both gates against a live document.
     * @param {unknown} url
     * @param {Document} doc
     * @returns {boolean}
     */
    static canOfferArticleButtonOnPage(url, doc) {
      if (!ArticlePageEligibility.canOfferArticleButton(url)) return false;
      if (ArticlePageEligibility.isKnownThreadPage(url)) return true;
      return ArticlePageEligibility.shouldOfferForSignals(
        url,
        ArticlePageEligibility.collectPageSignals(doc)
      );
    }
  }

  globalThis.ArticlePageEligibility = ArticlePageEligibility;
})();
