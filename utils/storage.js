/**
 * StorageHelper — Chrome Storage Manager
 * @architecture Singleton class pattern
 * @version 2.0.0 — OOP refactor
 */
class StorageHelper {

  static #instance = null;

  #DEFAULTS = {
    provider: 'ollama',
    groqApiKey: '',
    ollamaApiKey: '',
    geminiApiKey: '',
    model: 'llama-3.3-70b-versatile',
    ollamaModel: 'gemini-3-flash-preview',
    defaultMode: 'summary',
    language: 'auto',
    autoRun: false,
    cacheSummaries: true,
    cacheTranscripts: false,
    theme: 'auto',
    onboardingComplete: false,
    /** Podcast player output 0–1 (Web Audio gain) */
    podcastVolume: 1,
    // Auth state (Supabase session)
    supabaseAccessToken: '',
    supabaseRefreshToken: '',
    supabaseTokenExpiresAt: 0,
    supabaseUser: null,
    userPlan: 'anonymous',
    credits: -1
  };

  #MAX_CACHED_VIDEOS = 20;
  #CACHE_INDEX_KEY = '_cacheIndex';
  #OBFUSCATION_KEY = 'ytai_2026';
  #KEY_FIELDS = ['groqApiKey', 'ollamaApiKey', 'geminiApiKey', 'supabaseAccessToken', 'supabaseRefreshToken'];
  #sessionAccessible = null;
  /** Bumped after popup/welcome auth; content scripts refresh panel credits via `chrome.storage.onChanged`. */
  #PANEL_AUTH_SYNC_KEY = 'ytai_panel_auth_sync_nonce';

  constructor() {
    if (StorageHelper.#instance) return StorageHelper.#instance;
    StorageHelper.#instance = this;
  }

  static getInstance() {
    if (!StorageHelper.#instance) {
      StorageHelper.#instance = new StorageHelper();
    }
    return StorageHelper.#instance;
  }

  get DEFAULTS() {
    return { ...this.#DEFAULTS };
  }

  /**
   * Popup `#language` labels → YouTube caption `languageCode` (ISO 639-1).
   * Keeps transcript track selection aligned with user-facing output language names.
   */
  outputLanguageToCaptionCode(label) {
    if (!label || label === 'auto') return null;
    const map = {
      English: 'en', Turkish: 'tr', Spanish: 'es', French: 'fr', German: 'de',
      Portuguese: 'pt', Italian: 'it', Dutch: 'nl', Polish: 'pl', Swedish: 'sv',
      Japanese: 'ja', Korean: 'ko', Chinese: 'zh', Arabic: 'ar', Russian: 'ru',
      Hindi: 'hi', Indonesian: 'id', Vietnamese: 'vi', Thai: 'th', Ukrainian: 'uk'
    };
    return map[label] || (typeof label === 'string' && label.length <= 5 ? label : null);
  }

  // ─── Obfuscation ───────────────────────────────────────────────────

  /**
   * Latin-1 / `btoa` pipeline cannot store Unicode (e.g. Turkish ı). Callers should use
   * `tryObfuscate` and show `message` in UI instead of throwing.
   */
  #latin1ObfuscationIssue(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') return null;
    for (let i = 0; i < plaintext.length; i += 1) {
      if (plaintext.charCodeAt(i) > 0xff) {
        return (
          'Use only standard letters, numbers, and symbols in the API key — '
          + 'not Turkish letters, emoji, or other special characters.'
        );
      }
    }
    return null;
  }

  /**
   * @returns {{ ok: true, value: string } | { ok: false, message: string }}
   */
  #tryObfuscate(plaintext) {
    if (!plaintext) return { ok: true, value: '' };
    const issue = this.#latin1ObfuscationIssue(plaintext);
    if (issue) return { ok: false, message: issue };
    const key = this.#OBFUSCATION_KEY;
    let result = '';
    for (let i = 0; i < plaintext.length; i++) {
      result += String.fromCharCode(plaintext.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    try {
      return { ok: true, value: btoa(result) };
    } catch {
      return {
        ok: false,
        message: 'This key could not be saved. Remove unusual characters and try again.'
      };
    }
  }

  /**
   * @returns {{ ok: true, value: string } | { ok: false, message: string }}
   */
  tryObfuscate(plaintext) {
    return this.#tryObfuscate(plaintext);
  }

  #deobfuscate(encoded) {
    if (!encoded) return '';
    try {
      const decoded = atob(encoded);
      const key = this.#OBFUSCATION_KEY;
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return result;
    } catch {
      return encoded;
    }
  }

  #isObfuscated(value) {
    if (!value || typeof value !== 'string') return false;
    try {
      const decoded = atob(value);
      return decoded.length > 0 && !/^(gsk_|AIza)/.test(value);
    } catch {
      return false;
    }
  }

  // Static helper so popup.js (separate context) can call without re-implementing
  static deobfuscate(enc) { return StorageHelper.getInstance().#deobfuscate(enc); }

  // Instance methods — needed because the global export overwrites the class with the instance
  deobfuscate(enc) { return this.#deobfuscate(enc); }

  // ─── Session storage detection ─────────────────────────────────────

  async #checkSession() {
    if (this.#sessionAccessible !== null) return this.#sessionAccessible;
    if (!chrome.storage?.session) {
      this.#sessionAccessible = false;
      return false;
    }
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.session.get('__test__', () => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve();
        });
      });
      this.#sessionAccessible = true;
    } catch {
      this.#sessionAccessible = false;
    }
    return this.#sessionAccessible;
  }

  // Public alias for compatibility
  async isSessionAccessible() {
    return this.#checkSession();
  }

  // ─── Core storage primitives ───────────────────────────────────────

  async get(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(typeof key === 'string'
          ? (result[key] !== undefined ? result[key] : this.#DEFAULTS[key])
          : result);
      });
    });
  }

  async set(key, value) {
    return new Promise((resolve, reject) => {
      const data = typeof key === 'object' ? key : { [key]: value };
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  async getSettings() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(this.#DEFAULTS, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        const merged = { ...this.#DEFAULTS, ...result };
        for (const field of this.#KEY_FIELDS) {
          if (merged[field] && this.#isObfuscated(merged[field])) {
            merged[field] = this.#deobfuscate(merged[field]);
          }
        }
        resolve(merged);
      });
    });
  }

  /**
   * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
   */
  async saveSettings(settings) {
    const toSave = { ...settings };
    for (const field of this.#KEY_FIELDS) {
      if (toSave[field] && !this.#isObfuscated(toSave[field])) {
        const r = this.#tryObfuscate(toSave[field]);
        if (!r.ok) return { ok: false, message: r.message };
        toSave[field] = r.value;
      }
    }
    try {
      await this.set(toSave);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e?.message || 'Could not save settings.' };
    }
  }

  // ─── API Key management ────────────────────────────────────────────

  async getApiKey(providerOverride) {
    const provider = providerOverride || await this.get('provider') || 'ollama';
    const field = provider === 'ollama' ? 'ollamaApiKey' : 'groqApiKey';
    const raw = await this.get(field);
    if (raw && this.#isObfuscated(raw)) return this.#deobfuscate(raw);
    return raw;
  }

  /**
   * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
   */
  async saveApiKey(key, provider = 'groq') {
    const storageKey = provider === 'ollama' ? 'ollamaApiKey' : 'groqApiKey';
    const r = this.#tryObfuscate(key);
    if (!r.ok) return { ok: false, message: r.message };
    try {
      await this.set(storageKey, r.value);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e?.message || 'Could not save API key.' };
    }
  }

  async hasApiKey() {
    try {
      const key = await this.getApiKey();
      return !!(key && key.trim().length > 0);
    } catch {
      return false;
    }
  }

  /**
   * True if any BYOK credential exists (Groq, Ollama, or Gemini for podcast).
   * Used for managed credit gates and `hasAccess()` — avoids false negatives when
   * `provider` is "groq" but only Ollama key is filled (or vice versa).
   */
  async hasAnyByokApiKey() {
    try {
      const s = await this.getSettings();
      const g = String(s.groqApiKey || '').trim();
      const o = String(s.ollamaApiKey || '').trim();
      const z = String(s.geminiApiKey || '').trim();
      return !!(g || o || z);
    } catch {
      return false;
    }
  }

  /**
   * Stable id for auth-callback abuse detection (same profile = same id; survives VPN).
   * Session-only `ytai_device_fp` is cleared on extension reload / browser restart (Chrome docs:
   * chrome.storage.session), which caused `sw-*` random fallbacks from the service worker and
   * reset per-device account limits. Stored in chrome.storage.local.
   */
  async getPersistentAuthDeviceId() {
    const KEY = 'ytaiPersistentAuthDeviceId';
    let id = await this.get(KEY);
    if (id && typeof id === 'string' && id.length >= 16) return id;

    try {
      const sess = await chrome.storage.session.get('ytai_device_fp');
      const fromSession = sess?.ytai_device_fp;
      if (
        typeof fromSession === 'string'
        && fromSession.length >= 16
        && !fromSession.startsWith('sw-')
      ) {
        await this.set(KEY, fromSession);
        return fromSession;
      }
    } catch { /* ignore */ }

    const created = globalThis.crypto?.randomUUID?.()
      || `pd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    await this.set(KEY, created);
    return created;
  }

  // ─── Auth state ───────────────────────────────────────────────────

  #AUTH_FIELDS = ['supabaseAccessToken', 'supabaseRefreshToken', 'supabaseTokenExpiresAt', 'supabaseUser', 'userPlan', 'credits'];

  async getAuthState() {
    const keys = {};
    for (const f of this.#AUTH_FIELDS) keys[f] = this.#DEFAULTS[f];
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
        const state = { ...keys, ...result };
        if (state.supabaseAccessToken && this.#isObfuscated(state.supabaseAccessToken)) {
          state.supabaseAccessToken = this.#deobfuscate(state.supabaseAccessToken);
        }
        if (state.supabaseRefreshToken && this.#isObfuscated(state.supabaseRefreshToken)) {
          state.supabaseRefreshToken = this.#deobfuscate(state.supabaseRefreshToken);
        }
        resolve(state);
      });
    });
  }

  /**
   * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
   */
  async saveAuthState(state) {
    const toSave = {};
    for (const [k, v] of Object.entries(state)) {
      if (!this.#AUTH_FIELDS.includes(k)) continue;
      if ((k === 'supabaseAccessToken' || k === 'supabaseRefreshToken') && v) {
        const r = this.#tryObfuscate(v);
        if (!r.ok) return { ok: false, message: r.message };
        toSave[k] = r.value;
      } else {
        toSave[k] = v;
      }
    }
    try {
      await this.set(toSave);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e?.message || 'Could not save sign-in state.' };
    }
  }

  async clearAuthState() {
    const cleared = {};
    for (const f of this.#AUTH_FIELDS) cleared[f] = this.#DEFAULTS[f];
    return this.set(cleared);
  }

  getPanelAuthSyncStorageKey() {
    return this.#PANEL_AUTH_SYNC_KEY;
  }

  /**
   * Strip sensitive tokens from a Supabase session before writing it to
   * `chrome.storage.session`. The session storage is reachable from content
   * scripts (TRUSTED_AND_UNTRUSTED_CONTEXTS is enabled so the panel can
   * observe auth sync), so `access_token` / `refresh_token` must never be
   * cached there. The popup/welcome UI only needs identity + profile fields
   * to render; credits and gating are refreshed from the service worker.
   * @param {object|null} session
   * @returns {object|null}
   */
  sanitizeSessionForCache(session) {
    if (!session || typeof session !== 'object') return null;
    const user = session.user || {};
    const meta = (user && user.user_metadata) || {};
    return {
      user: {
        id: user.id || null,
        email: user.email || '',
        user_metadata: {
          full_name: meta.full_name || '',
          name: meta.name || '',
          avatar_url: meta.avatar_url || '',
          picture: meta.picture || ''
        }
      },
      expires_at: session.expires_at || 0
    };
  }

  bumpPanelAuthSyncNonce() {
    const k = this.#PANEL_AUTH_SYNC_KEY;
    return new Promise((resolve) => {
      chrome.storage.local.set({ [k]: Date.now() }, () => resolve());
    });
  }

  // ─── LRU Cache Index ───────────────────────────────────────────────

  async #getCacheIndex() {
    try {
      return await new Promise((resolve) => {
        chrome.storage.local.get(this.#CACHE_INDEX_KEY, (r) => {
          if (chrome.runtime.lastError) { resolve({}); return; }
          resolve(r[this.#CACHE_INDEX_KEY] || {});
        });
      });
    } catch {
      return {};
    }
  }

  async #saveCacheIndex(index) {
    try {
      await new Promise((resolve) => {
        chrome.storage.local.set({ [this.#CACHE_INDEX_KEY]: index }, () => resolve());
      });
    } catch {}
  }

  async #touchCacheEntry(videoId) {
    const index = await this.#getCacheIndex();
    index[videoId] = Date.now();
    await this.#saveCacheIndex(index);
  }

  async #evictIfNeeded() {
    try {
      const index = await this.#getCacheIndex();
      const videoIds = Object.keys(index);
      if (videoIds.length <= this.#MAX_CACHED_VIDEOS) return;

      const toEvict = videoIds
        .map(id => ({ id, ts: index[id] }))
        .sort((a, b) => a.ts - b.ts)
        .slice(0, videoIds.length - this.#MAX_CACHED_VIDEOS);

      const keysToRemove = toEvict.flatMap(({ id }) => [
        `cache_${id}_summary`,
        `cache_${id}_keypoints`,
        `cache_${id}_detailed`,
        `transcript_${id}`
      ]);

      toEvict.forEach(({ id }) => delete index[id]);

      await new Promise((resolve) => {
        chrome.storage.local.remove(keysToRemove, () => resolve());
      });

      const useSession = await this.#checkSession();
      if (useSession) {
        await new Promise((resolve) => {
          chrome.storage.session.remove(keysToRemove, () => resolve());
        });
      }

      await this.#saveCacheIndex(index);
    } catch {}
  }

  // ─── Summary cache (LRU) ──────────────────────────────────────────

  async getCachedSummary(videoId, mode) {
    const cacheKey = `cache_${videoId}_${mode}`;
    try {
      const useSession = await this.#checkSession();
      if (useSession) {
        const cached = await new Promise((resolve) => {
          chrome.storage.session.get(cacheKey, (result) => {
            if (chrome.runtime.lastError) { resolve(null); return; }
            resolve(result[cacheKey] || null);
          });
        });
        if (cached) {
          this.#touchCacheEntry(videoId);
          return cached;
        }
      }
      return await new Promise((resolve) => {
        chrome.storage.local.get(cacheKey, (result) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          const cached = result[cacheKey] || null;
          if (cached) this.#touchCacheEntry(videoId);
          resolve(cached);
        });
      });
    } catch {
      return null;
    }
  }

  async cacheSummary(videoId, mode, data) {
    const enabled = (await this.get('cacheSummaries')) !== false;
    if (!enabled) return;
    const cacheKey = `cache_${videoId}_${mode}`;
    const cacheData = { ...data, timestamp: Date.now() };
    try {
      const useSession = await this.#checkSession();
      const storage = useSession ? chrome.storage.session : chrome.storage.local;
      await new Promise((resolve) => {
        storage.set({ [cacheKey]: cacheData }, () => resolve());
      });
      await this.#touchCacheEntry(videoId);
      await this.#evictIfNeeded();
    } catch {}
  }

  // ─── Transcript cache ─────────────────────────────────────────────

  async getCachedTranscript(videoId) {
    const cacheKey = `transcript_${videoId}`;
    try {
      const useSession = await this.#checkSession();
      const storage = useSession ? chrome.storage.session : chrome.storage.local;
      return await new Promise((resolve) => {
        storage.get(cacheKey, (result) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          const cached = result[cacheKey] || null;
          if (cached) this.#touchCacheEntry(videoId);
          resolve(cached);
        });
      });
    } catch {
      return null;
    }
  }

  async cacheTranscript(videoId, transcript) {
    const enabled = (await this.get('cacheTranscripts')) === true;
    if (!enabled) return;
    const cacheKey = `transcript_${videoId}`;
    try {
      const useSession = await this.#checkSession();
      const storage = useSession ? chrome.storage.session : chrome.storage.local;
      await new Promise((resolve) => {
        storage.set({ [cacheKey]: transcript }, () => resolve());
      });
      await this.#touchCacheEntry(videoId);
      await this.#evictIfNeeded();
    } catch {}
  }

  // ─── Clear all cache ───────────────────────────────────────────────

  async clearCache() {
    try {
      const items = await new Promise((resolve) => {
        chrome.storage.local.get(null, (result) => {
          if (chrome.runtime.lastError) { resolve({}); return; }
          resolve(result);
        });
      });
      const cacheKeys = Object.keys(items).filter(
        k => k.startsWith('cache_') || k.startsWith('transcript_') || k === this.#CACHE_INDEX_KEY
      );
      if (cacheKeys.length > 0) {
        await new Promise((resolve) => {
          chrome.storage.local.remove(cacheKeys, () => resolve());
        });
      }
      const useSession = await this.#checkSession();
      if (useSession) {
        await new Promise((resolve) => {
          chrome.storage.session.clear(() => resolve());
        });
      }
    } catch {}
  }
}

// ─── Singleton export — backward compatible with all call sites ────────
// Reassign the lexical binding so bare `StorageHelper` references in every
// script (popup, welcome, content, service-worker) resolve to the instance,
// not the class.  `class` declarations are `let`-like (mutable).
const _storageInstance = StorageHelper.getInstance();
StorageHelper = _storageInstance;

if (typeof self !== 'undefined') {
  self.StorageHelper = _storageInstance;
}
if (typeof globalThis !== 'undefined') {
  globalThis.StorageHelper = _storageInstance;
}
