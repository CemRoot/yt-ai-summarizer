/**
 * Gleano — shadow root for the article button and panel.
 *
 * Page stylesheets do not cross a shadow boundary. Without it, rules such as
 * `* + * { margin-top: 1em }` or `button { padding: … }` on news sites moved
 * the panel down, cut off its footer and squeezed the close icon to 0px.
 *
 * The root is closed, so page scripts cannot read the summary or click the
 * panel's buttons. The launcher and the reader run in the same isolated world
 * and share the reference through this class.
 */
(function initGleanoShadowHost() {
  if (globalThis.GleanoShadowHost) return;

  class GleanoShadowHost {
    static #HOST_ID = 'gleano-article-root';
    static #STYLESHEET = 'content/article/article.css';

    /** Inline style beats page rules of the same importance, such as `* + * { margin-top }`. */
    static #HOST_STYLE = [
      'all: initial',
      'display: block',
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 0',
      'height: 0',
      'margin: 0',
      'padding: 0',
      'border: 0',
      'z-index: 2147483647',
    ].join(';');

    static #host = null;
    static #root = null;
    static #layer = null;

    /**
     * The layer every Gleano node is appended to. Creates the host on first use.
     * @returns {HTMLElement}
     */
    static layer() {
      if (GleanoShadowHost.#layer && GleanoShadowHost.#host?.isConnected) {
        return GleanoShadowHost.#layer;
      }
      GleanoShadowHost.#mount();
      return GleanoShadowHost.#layer;
    }

    /**
     * Element inside the shadow root, or null. Never creates the host.
     * @param {string} id
     * @returns {HTMLElement|null}
     */
    static byId(id) {
      if (!GleanoShadowHost.#root || !GleanoShadowHost.#host?.isConnected) return null;
      return GleanoShadowHost.#root.getElementById(id);
    }

    /** Removes the host and everything in it. */
    static remove() {
      GleanoShadowHost.#host?.remove();
      GleanoShadowHost.#host = null;
      GleanoShadowHost.#root = null;
      GleanoShadowHost.#layer = null;
    }

    static #mount() {
      // A host left by an earlier copy of the extension (reload/update) has a
      // closed root this copy cannot reach. Replace it.
      document.getElementById(GleanoShadowHost.#HOST_ID)?.remove();

      const host = document.createElement('gleano-article-root');
      host.id = GleanoShadowHost.#HOST_ID;
      host.setAttribute('style', GleanoShadowHost.#HOST_STYLE);
      const root = host.attachShadow({ mode: 'closed' });

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL(GleanoShadowHost.#STYLESHEET);

      // Hidden until the stylesheet applies, so an unstyled button never flashes.
      const layer = document.createElement('div');
      layer.className = 'gleano-layer';
      layer.style.display = 'none';
      const reveal = () => { layer.style.display = ''; };
      link.addEventListener('load', reveal, { once: true });
      link.addEventListener('error', reveal, { once: true });

      root.append(link, layer);
      // <html>, not <body>: some sites replace or restyle body children.
      (document.documentElement || document.body).appendChild(host);

      GleanoShadowHost.#host = host;
      GleanoShadowHost.#root = root;
      GleanoShadowHost.#layer = layer;
    }
  }

  globalThis.GleanoShadowHost = GleanoShadowHost;
})();
