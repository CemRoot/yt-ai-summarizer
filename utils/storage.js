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
    onboardingComplete: false
  };

  #MAX_CACHED_VIDEOS = 20;
  #CACHE_INDEX_KEY = '_cacheIndex';
  #OBFUSCATION_KEY = 'ytai_2026';
  #KEY_FIELDS = ['groqApiKey', 'ollamaApiKey', 'geminiApiKey'];
  #sessionAccessible = null;

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

  // ─── Obfuscation ───────────────────────────────────────────────────

  #obfuscate(plaintext) {
    if (!plaintext) return '';
    const key = this.#OBFUSCATION_KEY;
    let result = '';
    for (let i = 0; i < plaintext.length; i++) {
      result += String.fromCharCode(plaintext.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result);
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

  // Static helpers so popup.js (separate context) can call without re-implementing
  static obfuscate(plain) { return StorageHelper.getInstance().#obfuscate(plain); }
  static deobfuscate(enc) { return StorageHelper.getInstance().#deobfuscate(enc); }

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

  async saveSettings(settings) {
    const toSave = { ...settings };
    for (const field of this.#KEY_FIELDS) {
      if (toSave[field] && !this.#isObfuscated(toSave[field])) {
        toSave[field] = this.#obfuscate(toSave[field]);
      }
    }
    return this.set(toSave);
  }

  // ─── API Key management ────────────────────────────────────────────

  async getApiKey(providerOverride) {
    const provider = providerOverride || await this.get('provider') || 'ollama';
    const field = provider === 'ollama' ? 'ollamaApiKey' : 'groqApiKey';
    const raw = await this.get(field);
    if (raw && this.#isObfuscated(raw)) return this.#deobfuscate(raw);
    return raw;
  }

  async saveApiKey(key, provider = 'groq') {
    const storageKey = provider === 'ollama' ? 'ollamaApiKey' : 'groqApiKey';
    return this.set(storageKey, this.#obfuscate(key));
  }

  async hasApiKey() {
    try {
      const key = await this.getApiKey();
      return !!(key && key.trim().length > 0);
    } catch {
      return false;
    }
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
const _storageInstance = StorageHelper.getInstance();

if (typeof self !== 'undefined') {
  self.StorageHelper = _storageInstance;
}
if (typeof globalThis !== 'undefined') {
  globalThis.StorageHelper = _storageInstance;
}

console.warn('[YTAI] loaded: utils/storage.js');
