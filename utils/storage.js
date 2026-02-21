/**
 * Chrome Storage Helper Utilities
 * Manages API keys, settings, and LRU cache for YouTube AI Summarizer
 */

const StorageHelper = (() => {
  const DEFAULTS = {
    provider: 'ollama',
    groqApiKey: '',
    ollamaApiKey: '',
    geminiApiKey: '',
    model: 'llama-3.3-70b-versatile',
    ollamaModel: 'gemini-3-flash-preview',
    defaultMode: 'summary',
    language: 'auto',
    autoRun: false,
    theme: 'auto',
    onboardingComplete: false
  };

  const MAX_CACHED_VIDEOS = 20;
  const CACHE_INDEX_KEY = '_cacheIndex';
  const _OBFK = 'ytai_2026';

  function obfuscate(plaintext) {
    if (!plaintext) return '';
    const key = _OBFK;
    let result = '';
    for (let i = 0; i < plaintext.length; i++) {
      result += String.fromCharCode(plaintext.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result);
  }

  function deobfuscate(encoded) {
    if (!encoded) return '';
    try {
      const decoded = atob(encoded);
      const key = _OBFK;
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return result;
    } catch {
      return encoded;
    }
  }

  function isObfuscated(value) {
    if (!value || typeof value !== 'string') return false;
    try {
      const decoded = atob(value);
      return decoded.length > 0 && !/^(gsk_|AIza)/.test(value);
    } catch {
      return false;
    }
  }

  let _sessionAccessible = null;

  async function isSessionAccessible() {
    if (_sessionAccessible !== null) return _sessionAccessible;
    if (!chrome.storage.session) {
      _sessionAccessible = false;
      return false;
    }
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.session.get('__test__', () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
      _sessionAccessible = true;
    } catch {
      _sessionAccessible = false;
    }
    return _sessionAccessible;
  }

  // ─── Core storage helpers ───

  async function get(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (typeof key === 'string') {
          resolve(result[key] !== undefined ? result[key] : DEFAULTS[key]);
        } else {
          resolve(result);
        }
      });
    });
  }

  async function set(key, value) {
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

  const KEY_FIELDS = ['groqApiKey', 'ollamaApiKey', 'geminiApiKey'];

  async function getSettings() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(DEFAULTS, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        const merged = { ...DEFAULTS, ...result };
        for (const field of KEY_FIELDS) {
          if (merged[field] && isObfuscated(merged[field])) {
            merged[field] = deobfuscate(merged[field]);
          }
        }
        resolve(merged);
      });
    });
  }

  async function saveSettings(settings) {
    const toSave = { ...settings };
    for (const field of KEY_FIELDS) {
      if (toSave[field] && !isObfuscated(toSave[field])) {
        toSave[field] = obfuscate(toSave[field]);
      }
    }
    return set(toSave);
  }

  // ─── API Key management ───

  async function getApiKey(providerOverride) {
    const provider = providerOverride || await get('provider') || 'ollama';
    const field = provider === 'ollama' ? 'ollamaApiKey' : 'groqApiKey';
    const raw = await get(field);
    if (raw && isObfuscated(raw)) return deobfuscate(raw);
    return raw;
  }

  async function saveApiKey(key, provider = 'groq') {
    const storageKey = provider === 'ollama' ? 'ollamaApiKey' : 'groqApiKey';
    return set(storageKey, obfuscate(key));
  }

  async function hasApiKey() {
    try {
      const key = await getApiKey();
      return key && key.trim().length > 0;
    } catch {
      return false;
    }
  }

  // ─── LRU Cache Index ───
  // Tracks { videoId: lastAccessed } — used to evict oldest entries when limit is reached.

  async function getCacheIndex() {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(CACHE_INDEX_KEY, (r) => {
          if (chrome.runtime.lastError) { resolve({}); return; }
          resolve(r[CACHE_INDEX_KEY] || {});
        });
      });
      return result;
    } catch {
      return {};
    }
  }

  async function saveCacheIndex(index) {
    try {
      await new Promise((resolve) => {
        chrome.storage.local.set({ [CACHE_INDEX_KEY]: index }, () => {
          if (chrome.runtime.lastError) { /* ignore */ }
          resolve();
        });
      });
    } catch { /* ignore */ }
  }

  async function touchCacheEntry(videoId) {
    const index = await getCacheIndex();
    index[videoId] = Date.now();
    await saveCacheIndex(index);
  }

  /**
   * Evict oldest videos if cache exceeds MAX_CACHED_VIDEOS.
   * Removes all storage keys (summary × 3 + transcript) for evicted videos.
   */
  async function evictIfNeeded() {
    try {
      const index = await getCacheIndex();
      const videoIds = Object.keys(index);

      if (videoIds.length <= MAX_CACHED_VIDEOS) return;

      const sorted = videoIds
        .map((id) => ({ id, ts: index[id] }))
        .sort((a, b) => a.ts - b.ts);

      const evictCount = videoIds.length - MAX_CACHED_VIDEOS;
      const toEvict = sorted.slice(0, evictCount);

      const keysToRemove = [];
      for (const entry of toEvict) {
        keysToRemove.push(
          `cache_${entry.id}_summary`,
          `cache_${entry.id}_keypoints`,
          `cache_${entry.id}_detailed`,
          `transcript_${entry.id}`
        );
        delete index[entry.id];
      }

      await new Promise((resolve) => {
        chrome.storage.local.remove(keysToRemove, () => {
          if (chrome.runtime.lastError) { /* ignore */ }
          resolve();
        });
      });

      const useSession = await isSessionAccessible();
      if (useSession) {
        await new Promise((resolve) => {
          chrome.storage.session.remove(keysToRemove, () => {
            if (chrome.runtime.lastError) { /* ignore */ }
            resolve();
          });
        });
      }

      await saveCacheIndex(index);
    } catch { /* best effort */ }
  }

  // ─── Summary cache (with LRU) ───

  async function getCachedSummary(videoId, mode) {
    const cacheKey = `cache_${videoId}_${mode}`;
    try {
      const useSession = await isSessionAccessible();
      if (useSession) {
        const cached = await new Promise((resolve) => {
          chrome.storage.session.get(cacheKey, (result) => {
            if (chrome.runtime.lastError) { resolve(null); return; }
            resolve(result[cacheKey] || null);
          });
        });
        if (cached) {
          touchCacheEntry(videoId);
          return cached;
        }
      }
      return await new Promise((resolve) => {
        chrome.storage.local.get(cacheKey, (result) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          const cached = result[cacheKey];
          if (cached) {
            touchCacheEntry(videoId);
            resolve(cached);
          } else {
            resolve(null);
          }
        });
      });
    } catch {
      return null;
    }
  }

  async function cacheSummary(videoId, mode, data) {
    const cacheKey = `cache_${videoId}_${mode}`;
    const cacheData = { ...data, timestamp: Date.now() };
    try {
      const useSession = await isSessionAccessible();
      const storage = useSession ? chrome.storage.session : chrome.storage.local;
      await new Promise((resolve) => {
        storage.set({ [cacheKey]: cacheData }, () => {
          if (chrome.runtime.lastError) { /* ignore */ }
          resolve();
        });
      });
      await touchCacheEntry(videoId);
      await evictIfNeeded();
    } catch { /* ignore */ }
  }

  // ─── Transcript cache (with LRU) ───

  async function getCachedTranscript(videoId) {
    const cacheKey = `transcript_${videoId}`;
    try {
      const useSession = await isSessionAccessible();
      const storage = useSession ? chrome.storage.session : chrome.storage.local;
      return await new Promise((resolve) => {
        storage.get(cacheKey, (result) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          const cached = result[cacheKey] || null;
          if (cached) touchCacheEntry(videoId);
          resolve(cached);
        });
      });
    } catch {
      return null;
    }
  }

  async function cacheTranscript(videoId, transcript) {
    const cacheKey = `transcript_${videoId}`;
    try {
      const useSession = await isSessionAccessible();
      const storage = useSession ? chrome.storage.session : chrome.storage.local;
      await new Promise((resolve) => {
        storage.set({ [cacheKey]: transcript }, () => {
          if (chrome.runtime.lastError) { /* ignore */ }
          resolve();
        });
      });
      await touchCacheEntry(videoId);
      await evictIfNeeded();
    } catch { /* ignore */ }
  }

  // ─── Clear cache ───

  async function clearCache() {
    try {
      const items = await new Promise((resolve) => {
        chrome.storage.local.get(null, (result) => {
          if (chrome.runtime.lastError) { resolve({}); return; }
          resolve(result);
        });
      });
      const cacheKeys = Object.keys(items).filter(
        (k) => k.startsWith('cache_') || k.startsWith('transcript_') || k === CACHE_INDEX_KEY
      );
      if (cacheKeys.length > 0) {
        await new Promise((resolve) => {
          chrome.storage.local.remove(cacheKeys, () => {
            if (chrome.runtime.lastError) { /* ignore */ }
            resolve();
          });
        });
      }
      const useSession = await isSessionAccessible();
      if (useSession) {
        await new Promise((resolve) => {
          chrome.storage.session.clear(() => {
            if (chrome.runtime.lastError) { /* ignore */ }
            resolve();
          });
        });
      }
    } catch { /* best effort */ }
  }

  return {
    DEFAULTS,
    get,
    set,
    getSettings,
    saveSettings,
    getApiKey,
    saveApiKey,
    hasApiKey,
    getCachedSummary,
    cacheSummary,
    getCachedTranscript,
    cacheTranscript,
    clearCache,
    isSessionAccessible
  };
})();

if (typeof self !== 'undefined') {
  self.StorageHelper = StorageHelper;
}
