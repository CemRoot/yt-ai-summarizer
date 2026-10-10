/**
 * SupabaseAuth — Supabase Google OAuth (PKCE) for Chrome Extension
 * @architecture Singleton class — depends on StorageHelper (loaded before this file)
 *
 * Uses raw fetch against Supabase Auth REST API.
 * No Supabase JS client needed (CSP script-src 'self' blocks CDN).
 *
 * Token refresh has one owner: the service worker. Every YouTube tab, the popup
 * and the SW each load this class. When each refreshed on its own, two contexts
 * spent the same rotating refresh token; Supabase treats reuse outside its 10 s
 * window as theft and revokes the whole session, and the old code then called
 * the global /logout. That is why users were signed out after a Chrome restart
 * with several tabs open. Now:
 * - pages ask the SW to refresh (`supabaseRefreshSession`), the SW runs one
 *   refresh at a time and re-reads storage first;
 * - only a refresh token that Supabase rejects ends the session, and only
 *   locally; network errors and 5xx keep the stored tokens (AUTH_UNAVAILABLE);
 * - user sign-out uses scope=local so other devices stay signed in.
 * @see https://supabase.com/docs/guides/auth/sessions (refresh token reuse detection)
 * @see https://supabase.com/docs/guides/auth/signout (sign-out scopes)
 */
class AuthUnavailableError extends Error {
  constructor(message) {
    super(message || 'Could not reach the sign-in service.');
    this.name = 'AuthUnavailableError';
    this.code = 'AUTH_UNAVAILABLE';
  }
}

class SupabaseAuth {

  static #instance = null;

  #SUPABASE_URL = 'https://smvnsfznxctkegjbckmt.supabase.co';
  #SUPABASE_ANON_KEY = 'sb_publishable_lMBLuB0JDmoIDGRT6j6e4A_GTSDHU0g';

  #session = null; // { access_token, refresh_token, expires_at, user }
  /** Service worker only: the refresh in progress, shared by concurrent callers. */
  #refreshInFlight = null;
  #listeners = [];

  /** Renew this long before expiry. */
  static #EXPIRY_MARGIN_MS = 60_000;

  /** Supabase error codes that mean the refresh token can never work again. */
  static #DEAD_REFRESH_CODES = new Set([
    'refresh_token_not_found',
    'refresh_token_already_used',
    'session_not_found',
    'session_expired',
    'invalid_grant',
    'user_not_found',
    'user_banned'
  ]);

  constructor() {
    if (SupabaseAuth.#instance) return SupabaseAuth.#instance;
    SupabaseAuth.#instance = this;
  }

  static getInstance() {
    if (!SupabaseAuth.#instance) {
      SupabaseAuth.#instance = new SupabaseAuth();
    }
    return SupabaseAuth.#instance;
  }

  async #authDbg(level, tag, message, detail) {
    try {
      if (typeof AuthDebugLogger !== 'undefined' && AuthDebugLogger.log) {
        await AuthDebugLogger.log(level, tag, message, detail);
      }
    } catch { /* ignore */ }
  }

  // ─── Public API ────────────────────────────────────────────────────

  async signIn() {
    await this.#authDbg('info', 'signIn', 'start', null);
    const { verifier, challenge } = await this.#generatePKCE();

    const redirectUrl = chrome.identity.getRedirectURL();
    await this.#authDbg(
      'info',
      'signIn',
      'redirectUrl (Supabase Auth must allow this exact URL)',
      redirectUrl
    );
    const params = new URLSearchParams({
      provider: 'google',
      redirect_to: redirectUrl,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${this.#SUPABASE_URL}/auth/v1/authorize?${params}`;
    await this.#authDbg('info', 'signIn', 'launchWebAuthFlow', `${this.#SUPABASE_URL}/auth/v1/authorize?provider=google&…`);

    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        (callbackUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!callbackUrl) {
            reject(new Error('Auth cancelled'));
          } else {
            resolve(callbackUrl);
          }
        }
      );
    }).catch(async (e) => {
      await this.#authDbg('error', 'signIn', 'launchWebAuthFlow', e?.message || String(e));
      throw e;
    });

    let parsed;
    try {
      parsed = new URL(responseUrl);
    } catch (e) {
      await this.#authDbg('error', 'signIn', 'invalid callback URL', String(responseUrl).slice(0, 200));
      throw new Error('Invalid auth callback URL');
    }

    const code = parsed.searchParams.get('code')
      || new URLSearchParams(parsed.hash.slice(1)).get('code');

    await this.#authDbg(
      'info',
      'signIn',
      'callback',
      JSON.stringify({
        codePresent: !!code,
        searchLen: parsed.search?.length || 0,
        hashLen: parsed.hash?.length || 0,
      })
    );

    if (!code) {
      await this.#authDbg('error', 'signIn', 'No auth code in response', null);
      throw new Error('No auth code in response');
    }

    const tokenRes = await fetch(`${this.#SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.#SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      await this.#authDbg('error', 'signIn', 'token exchange failed', `status=${tokenRes.status} body=${body.slice(0, 800)}`);
      throw new Error(`Token exchange failed (${tokenRes.status}): ${body}`);
    }

    await this.#authDbg('info', 'signIn', 'token exchange ok', null);
    const tokens = await tokenRes.json();
    await this.#setSession(tokens);
    await globalThis.GleanoAuthState?.clearEnded();
    return this.#session;
  }

  /** User-initiated sign-out. Ends this browser's session only (scope=local). */
  async signOut() {
    const token = this.#session?.access_token
      || (await globalThis.StorageHelper?.getAuthState?.().catch(() => null))?.supabaseAccessToken;
    if (token) {
      try {
        await fetch(`${this.#SUPABASE_URL}/auth/v1/logout?scope=local`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: this.#SUPABASE_ANON_KEY,
          },
        });
      } catch { /* best-effort */ }
    }
    this.#session = null;
    const store = globalThis.StorageHelper;
    if (store) await store.clearAuthState();
    // Signing out on purpose is not "your session ended".
    await globalThis.GleanoAuthState?.clearEnded();
    this.#notifyListeners(null);
  }

  /**
   * The session cannot be used any more (refresh token rejected, or the backend
   * keeps refusing a freshly refreshed token). Clears it locally and records it
   * so the UI can ask the user to sign in again. Never calls /logout: that would
   * revoke the user's sessions on other devices.
   * @param {string} reason
   */
  async endSession(reason) {
    const store = globalThis.StorageHelper;
    let email = this.#session?.user?.email || '';
    if (!email && store) {
      try { email = (await store.getAuthState())?.supabaseUser?.email || ''; } catch { /* ignore */ }
    }
    this.#session = null;
    if (store) await store.clearAuthState();
    await globalThis.GleanoAuthState?.markEnded({ email, reason });
    try { await store?.bumpPanelAuthSyncNonce?.(); } catch { /* ignore */ }
    await this.#authDbg('warn', 'session', 'ended', reason);
    this.#notifyListeners(null);
  }

  /**
   * Content/popup contexts keep their own `#session` RAM. After SW updates `chrome.storage.local`
   * (sign-in/out from popup), call this so the next `getSession()` reloads from storage — otherwise
   * the old JWT is returned until expiry (panel badge/credits stay wrong until e.g. Summarize).
   */
  invalidateSessionCache() {
    this.#session = null;
  }

  /**
   * A session with a usable access token, renewed when needed.
   * Returns null when the user is not signed in or the session has ended.
   * Throws AuthUnavailableError (code AUTH_UNAVAILABLE) when the refresh could not
   * reach Supabase; the stored session is kept for the next try.
   * @param {{ forceRefresh?: boolean }} [opts] forceRefresh: the backend rejected the current token
   */
  async getSession({ forceRefresh = false } = {}) {
    if (!forceRefresh && this.#isFresh(this.#session)) {
      return this.#session;
    }

    // Another context may have refreshed (and rotated the refresh token) since we last read it.
    await this.#loadFromStorage();
    if (!this.#session) return null;
    if (!forceRefresh && this.#isFresh(this.#session)) return this.#session;

    await this.#refresh(this.#session.access_token);
    return this.#session;
  }

  /**
   * Stored session without refreshing it. For display only (name, email);
   * the access token may be expired.
   */
  async getStoredSession() {
    if (!this.#session) await this.#loadFromStorage();
    return this.#session;
  }

  /**
   * Service worker handler for `supabaseRefreshSession`.
   * @param {string} staleAccessToken the token the caller saw as expired or rejected
   * @returns {Promise<{ status: 'ok'|'ended'|'unavailable' }>}
   */
  async refreshForContext(staleAccessToken) {
    try {
      const status = await this.#refreshInWorker(staleAccessToken);
      return { status };
    } catch (err) {
      return { status: 'unavailable', message: err?.message || '' };
    }
  }

  isAuthenticated() {
    return this.#isFresh(this.#session);
  }

  getAuthHeaders() {
    if (!this.#session?.access_token) return null;
    return {
      Authorization: `Bearer ${this.#session.access_token}`,
      apikey: this.#SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    };
  }

  async getUser() {
    const session = await this.getSession();
    return session?.user || null;
  }

  onSessionChange(fn) {
    this.#listeners.push(fn);
    return () => {
      this.#listeners = this.#listeners.filter(l => l !== fn);
    };
  }

  // ─── PKCE helpers ──────────────────────────────────────────────────

  async #generatePKCE() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const verifier = this.#base64UrlEncode(array);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = this.#base64UrlEncode(new Uint8Array(digest));
    return { verifier, challenge };
  }

  #base64UrlEncode(bytes) {
    const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // ─── Token management ─────────────────────────────────────────────

  #isFresh(session) {
    return !!(session?.access_token && Date.now() < (session.expires_at || 0) - SupabaseAuth.#EXPIRY_MARGIN_MS);
  }

  static #isWorker() {
    return typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope;
  }

  async #setSession(tokens) {
    const expiresIn = tokens.expires_in || 3600;
    this.#session = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: typeof tokens.expires_at === 'number'
        ? tokens.expires_at * 1000
        : Date.now() + expiresIn * 1000,
      user: tokens.user || this.#session?.user || null,
    };

    if (!this.#session.user && tokens.access_token) {
      try {
        this.#session.user = await this.#fetchUser(tokens.access_token);
      } catch { /* will retry on next getUser() */ }
    }

    await this.#saveToStorage();
    this.#notifyListeners(this.#session);
  }

  /**
   * Renew the session. Pages delegate to the service worker so only one context
   * ever spends a refresh token.
   */
  async #refresh(staleAccessToken) {
    if (SupabaseAuth.#isWorker() || !chrome.runtime?.sendMessage) {
      await this.#refreshInWorker(staleAccessToken);
      return;
    }

    let res;
    try {
      res = await chrome.runtime.sendMessage({ action: 'supabaseRefreshSession', staleAccessToken });
    } catch (err) {
      throw new AuthUnavailableError(err?.message);
    }
    if (res?.status === 'ok') {
      await this.#loadFromStorage();
      return;
    }
    if (res?.status === 'ended') {
      this.#session = null;
      return;
    }
    throw new AuthUnavailableError(res?.message);
  }

  /** One refresh at a time per service worker; concurrent callers share it. */
  #refreshInWorker(staleAccessToken) {
    if (!this.#refreshInFlight) {
      this.#refreshInFlight = this.#doRefresh(staleAccessToken)
        .finally(() => { this.#refreshInFlight = null; });
    }
    return this.#refreshInFlight;
  }

  /** @returns {Promise<'ok'|'ended'>} throws AuthUnavailableError on transient failure */
  async #doRefresh(staleAccessToken) {
    await this.#loadFromStorage();
    const current = this.#session;
    if (!current) return 'ended';

    // Someone already refreshed after the caller read its token: use that result.
    if (staleAccessToken && current.access_token !== staleAccessToken && this.#isFresh(current)) {
      return 'ok';
    }

    if (!current.refresh_token) {
      await this.endSession('no_refresh_token');
      return 'ended';
    }

    let res;
    try {
      res = await fetch(`${this.#SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.#SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      });
    } catch (err) {
      await this.#authDbg('warn', 'refresh', 'network error', err?.message || String(err));
      throw new AuthUnavailableError(err?.message);
    }

    if (res.ok) {
      const tokens = await res.json();
      await this.#setSession(tokens);
      return 'ok';
    }

    const body = await res.json().catch(() => ({}));
    if (SupabaseAuth.isDeadRefreshResponse(res.status, body)) {
      await this.#authDbg('warn', 'refresh', 'rejected', `status=${res.status} code=${body?.error_code || body?.error || ''}`);
      await this.endSession(String(body?.error_code || body?.error || `status_${res.status}`));
      return 'ended';
    }

    await this.#authDbg('warn', 'refresh', 'unavailable', `status=${res.status}`);
    throw new AuthUnavailableError(`Refresh failed (${res.status})`);
  }

  /**
   * True when Supabase says the refresh token is permanently unusable. Rate limits,
   * 5xx and unknown 401/403 bodies (e.g. a bad anon key) are not: signing the user
   * out for those would repeat on every restart.
   * @param {number} status
   * @param {{ error_code?: string, error?: string, msg?: string, message?: string }} body
   */
  static isDeadRefreshResponse(status, body) {
    if (status === 400) return true;
    if (status !== 401 && status !== 403) return false;
    const code = String(body?.error_code || body?.error || '').toLowerCase();
    if (SupabaseAuth.#DEAD_REFRESH_CODES.has(code)) return true;
    const text = String(body?.msg || body?.message || body?.error_description || '');
    return /invalid refresh token|refresh token (not found|already used)|session (not found|expired)/i.test(text);
  }

  async #fetchUser(accessToken) {
    const res = await fetch(`${this.#SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: this.#SUPABASE_ANON_KEY,
      },
    });
    if (!res.ok) throw new Error(`getUser failed (${res.status})`);
    return res.json();
  }

  // ─── Persistence via StorageHelper ─────────────────────────────────

  async #saveToStorage() {
    const store = globalThis.StorageHelper;
    if (!store) return;
    const prev = await store.getAuthState();
    const prevId = prev?.supabaseUser?.id ?? null;
    const newId = this.#session?.user?.id ?? null;
    // Previous Google account's cached credits must not leak into the next session (local snapshot only).
    const creditSnapshotReset =
      prevId && newId && prevId !== newId
        ? { userPlan: 'anonymous', credits: -1 }
        : {};
    const saved = await store.saveAuthState({
      ...creditSnapshotReset,
      supabaseAccessToken: this.#session.access_token,
      supabaseRefreshToken: this.#session.refresh_token,
      supabaseTokenExpiresAt: this.#session.expires_at,
      supabaseUser: this.#session.user,
    });
    if (!saved?.ok) {
      console.warn('[SupabaseAuth] saveAuthState failed:', saved?.message);
    }
  }

  async #loadFromStorage() {
    const store = globalThis.StorageHelper;
    if (!store) return;
    const state = await store.getAuthState();
    if (state?.supabaseAccessToken) {
      this.#session = {
        access_token: state.supabaseAccessToken,
        refresh_token: state.supabaseRefreshToken,
        expires_at: state.supabaseTokenExpiresAt || 0,
        user: state.supabaseUser || null,
      };
    } else {
      this.#session = null;
    }
  }

  // ─── Listener dispatch ────────────────────────────────────────────

  #notifyListeners(session) {
    for (const fn of this.#listeners) {
      try { fn(session); } catch { /* ignore */ }
    }
  }
}

// ─── Singleton export ──────────────────────────────────────────────
const _supabaseAuthInstance = SupabaseAuth.getInstance();

if (typeof self !== 'undefined') self.SupabaseAuth = _supabaseAuthInstance;
if (typeof globalThis !== 'undefined') {
  globalThis.SupabaseAuth = _supabaseAuthInstance;
  globalThis.SupabaseAuthClass = SupabaseAuth;
  globalThis.AuthUnavailableError = AuthUnavailableError;
}
