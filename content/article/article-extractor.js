/**
 * Gleano - Article Extractor
 * Extracts readable article content from web pages using Mozilla Readability
 */

class ArticleExtractor {
  static #instance = null;

  static #BLOCKED_PATTERNS = [
    /banking|bank\./i,
    /mail\.(google|yahoo|outlook)/i,
    /login|signin|auth|oauth/i,
    /checkout|payment|cart/i,
    /account\..*\.(com|org|net)/i,
    /password|credential/i
  ];

  static #MIN_CONTENT_LENGTH = 500;
  static #MAX_CONTENT_LENGTH = 100000;

  #lastExtraction = null;

  constructor() {
    if (ArticleExtractor.#instance) {
      return ArticleExtractor.#instance;
    }
    ArticleExtractor.#instance = this;
  }

  static getInstance() {
    if (!ArticleExtractor.#instance) {
      ArticleExtractor.#instance = new ArticleExtractor();
    }
    return ArticleExtractor.#instance;
  }

  /**
   * Check if current URL is blocked (sensitive pages)
   */
  isBlockedPage(url = window.location.href) {
    return ArticleExtractor.#BLOCKED_PATTERNS.some(pattern => pattern.test(url));
  }

  /**
   * Check if page likely contains readable article content
   */
  isProbablyReaderable() {
    if (typeof isProbablyReaderable === 'function') {
      return isProbablyReaderable(document);
    }
    
    const article = document.querySelector('article, [role="article"], .article, .post, .entry-content');
    if (article) return true;

    const paragraphs = document.querySelectorAll('p');
    let totalTextLength = 0;
    for (const p of paragraphs) {
      totalTextLength += p.textContent.trim().length;
      if (totalTextLength > ArticleExtractor.#MIN_CONTENT_LENGTH) return true;
    }
    
    return false;
  }

  /**
   * Extract article content from current page
   * @returns {Object|null} Article data or null if extraction fails
   */
  extract() {
    if (this.isBlockedPage()) {
      return { error: 'blocked', message: 'This page type is not supported for security reasons.' };
    }

    if (!this.isProbablyReaderable()) {
      return { error: 'not_readable', message: 'No readable article content found on this page.' };
    }

    try {
      const documentClone = document.cloneNode(true);
      
      const reader = new Readability(documentClone, {
        charThreshold: 100,
        keepClasses: false,
        disableJSONLD: false
      });

      const article = reader.parse();

      if (!article || !article.textContent) {
        return { error: 'parse_failed', message: 'Could not extract article content.' };
      }

      if (article.textContent.length < ArticleExtractor.#MIN_CONTENT_LENGTH) {
        return { 
          error: 'too_short', 
          message: `Article is too short (${article.textContent.length} chars). Minimum ${ArticleExtractor.#MIN_CONTENT_LENGTH} required.` 
        };
      }

      let textContent = article.textContent;
      if (textContent.length > ArticleExtractor.#MAX_CONTENT_LENGTH) {
        textContent = textContent.substring(0, ArticleExtractor.#MAX_CONTENT_LENGTH) + '\n\n[Content truncated...]';
      }

      this.#lastExtraction = {
        title: article.title || document.title || 'Untitled',
        content: article.content,
        textContent: textContent,
        excerpt: article.excerpt || this.#generateExcerpt(textContent),
        byline: article.byline || this.#extractAuthor(),
        siteName: article.siteName || this.#extractSiteName(),
        lang: article.lang || document.documentElement.lang || 'en',
        dir: article.dir || document.documentElement.dir || 'ltr',
        publishedTime: article.publishedTime || this.#extractPublishDate(),
        length: textContent.length,
        wordCount: this.#countWords(textContent),
        url: window.location.href,
        extractedAt: Date.now()
      };

      return this.#lastExtraction;
    } catch (err) {
      console.error('[ArticleExtractor] Extraction failed:', err);
      return { error: 'exception', message: err.message };
    }
  }

  /**
   * Get metadata without full content extraction
   */
  getMetadata() {
    return {
      url: window.location.href,
      title: document.title,
      siteName: this.#extractSiteName(),
      author: this.#extractAuthor(),
      publishedTime: this.#extractPublishDate(),
      description: this.#extractDescription(),
      lang: document.documentElement.lang || 'en',
      isBlocked: this.isBlockedPage(),
      isProbablyReaderable: this.isProbablyReaderable()
    };
  }

  /**
   * Get last extraction result (cached)
   */
  getLastExtraction() {
    return this.#lastExtraction;
  }

  /**
   * Clear cached extraction
   */
  clearCache() {
    this.#lastExtraction = null;
  }

  #generateExcerpt(text, maxLength = 200) {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLength) return clean;
    const truncated = clean.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '...';
  }

  #countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  #extractAuthor() {
    const selectors = [
      'meta[name="author"]',
      'meta[property="article:author"]',
      'meta[name="twitter:creator"]',
      '[rel="author"]',
      '.author-name',
      '.byline-name',
      '[itemprop="author"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        return el.content || el.textContent?.trim() || null;
      }
    }
    return null;
  }

  #extractSiteName() {
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName?.content) return ogSiteName.content;

    const appName = document.querySelector('meta[name="application-name"]');
    if (appName?.content) return appName.content;

    try {
      return new URL(window.location.href).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  #extractPublishDate() {
    const selectors = [
      'meta[property="article:published_time"]',
      'meta[name="pubdate"]',
      'meta[name="publishdate"]',
      'meta[name="date"]',
      'time[datetime]',
      '[itemprop="datePublished"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const value = el.content || el.getAttribute('datetime') || el.textContent?.trim();
        if (value) return value;
      }
    }
    return null;
  }

  #extractDescription() {
    const selectors = [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el?.content) return el.content;
    }
    return null;
  }
}

if (typeof window !== 'undefined') {
  window.ArticleExtractor = ArticleExtractor;
}
