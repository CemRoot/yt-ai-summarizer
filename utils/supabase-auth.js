/**
 * SupabaseAuth — Supabase Google OAuth (PKCE) for Chrome Extension
 * @architecture Singleton class — depends on StorageHelper (loaded before this file)
 *
 * Uses raw fetch against Supabase Auth REST API.
 * No Supabase JS client needed (CSP script-src 'self' blocks CDN).
 */
class SupabaseAuth {

  static #instance = null;

  #SUPABASE_URL = 'https://smvnsfznxctkegjbckmt.supabase.co';
  #SUPABASE_ANON_KEY = 'sb_publishable_lMBLuB0JDmoIDGRT6j6e4A_GTSDHU0g';

  #session = null; // { access_token, refresh_token, expires_at, user }
  #refreshTimer = null;
  #listeners = [];

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
    return this.#session;
  }

  async signOut() {
    if (this.#session?.access_token) {
      try {
        await fetch(`${this.#SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.#session.access_token}`,
            apikey: this.#SUPABASE_ANON_KEY,
          },
        });
      } catch { /* best-effort */ }
    }
    this.#session = null;
    this.#clearRefreshTimer();
    const store = globalThis.StorageHelper;
    if (store) await store.clearAuthState();
    this.#notifyListeners(null);
  }

  /**
   * Content/popup contexts keep their own `#session` RAM. After SW updates `chrome.storage.local`
   * (sign-in/out from popup), call this so the next `getSession()` reloads from storage — otherwise
   * the old JWT is returned until expiry (panel badge/credits stay wrong until e.g. Summarize).
   */
  invalidateSessionCache() {
    this.#session = null;
    this.#clearRefreshTimer();
  }

  async getSession() {
    if (this.#session && Date.now() < this.#session.expires_at - 60_000) {
      return this.#session;
    }

    if (!this.#session) {
      await this.#loadFromStorage();
    }

    if (this.#session && Date.now() >= this.#session.expires_at - 60_000) {
      try {
        await this.#refreshToken();
      } catch {
        await this.signOut();
        return null;
      }
    }

    return this.#session;
  }

  isAuthenticated() {
    return !!(this.#session && Date.now() < this.#session.expires_at);
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

  async #setSession(tokens) {
    const expiresIn = tokens.expires_in || 3600;
    this.#session = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + expiresIn * 1000,
      user: tokens.user || null,
    };

    if (!this.#session.user && tokens.access_token) {
      try {
        this.#session.user = await this.#fetchUser(tokens.access_token);
      } catch { /* will retry on next getUser() */ }
    }

    await this.#saveToStorage();
    this.#scheduleRefresh(expiresIn);
    this.#notifyListeners(this.#session);
  }

  async #refreshToken() {
    if (!this.#session?.refresh_token) throw new Error('No refresh token');

    const res = await fetch(`${this.#SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.#SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: this.#session.refresh_token }),
    });

    if (!res.ok) throw new Error(`Refresh failed (${res.status})`);

    const tokens = await res.json();
    await this.#setSession(tokens);
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

  #scheduleRefresh(expiresIn) {
    this.#clearRefreshTimer();
    const refreshMs = Math.max((expiresIn - 120) * 1000, 30_000);
    this.#refreshTimer = setTimeout(() => {
      this.#refreshToken().catch(() => this.signOut());
    }, refreshMs);
  }

  #clearRefreshTimer() {
    if (this.#refreshTimer) {
      clearTimeout(this.#refreshTimer);
      this.#refreshTimer = null;
    }
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
if (typeof globalThis !== 'undefined') globalThis.SupabaseAuth = _supabaseAuthInstance;
