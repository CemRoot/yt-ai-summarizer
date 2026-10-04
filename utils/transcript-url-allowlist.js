/**
 * TranscriptUrlAllowlist — https host check for caption-track URLs.
 *
 * The service worker fetches these URLs with credentials. They arrive from
 * the content script and can be spoofed by the YouTube page, so an
 * unvalidated fetch is a cross-origin privilege leak.
 * @see https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
 */
class TranscriptUrlAllowlist {

  /** Registrable hosts. Exact matches and subdomains only. */
  static #ALLOWED_HOSTS = ['youtube.com', 'youtu.be', 'googlevideo.com', 'ytimg.com'];

  /**
   * @param {unknown} trackUrl
   * @returns {boolean}
   */
  static isAllowed(trackUrl) {
    if (typeof trackUrl !== 'string' || trackUrl.length === 0) return false;

    let url;
    try {
      url = new URL(trackUrl);
    } catch {
      return false;
    }

    if (url.protocol !== 'https:') return false;
    if (url.username !== '' || url.password !== '') return false;

    return TranscriptUrlAllowlist.#hostAllowed(url.hostname);
  }

  /**
   * @param {string} hostname WHATWG hostname
   * @returns {boolean}
   */
  static #hostAllowed(hostname) {
    // The URL parser keeps a trailing DNS root dot (`youtube.com.`).
    const host = hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
    if (!host) return false;

    for (const allowed of TranscriptUrlAllowlist.#ALLOWED_HOSTS) {
      if (host === allowed || host.endsWith(`.${allowed}`)) return true;
    }
    return false;
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.TranscriptUrlAllowlist = TranscriptUrlAllowlist;
}
