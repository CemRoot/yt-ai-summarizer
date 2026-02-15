/**
 * Chrome Storage Helper Utilities
 * Manages API keys, settings, and cache for YouTube AI Summarizer
 */

const StorageHelper = (() => {
  // Default settings
  const DEFAULTS = {
    groqApiKey: '',
    model: 'llama-3.3-70b-versatile',
    defaultMode: 'summary',
    language: 'auto',
    autoRun: false,
    theme: 'auto',
    onboardingComplete: false
  };

  // Track whether session storage is accessible
  let _sessionAccessible = null;

  /**
   * Check if chrome.storage.session is accessible (content scripts need setAccessLevel)
   */
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

  /**
   * Get a value from chrome.storage.local
   */
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

  /**
   * Set a value in chrome.storage.local
   */
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

  /**
   * Get all settings with defaults applied
   */
  async function getSettings() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(DEFAULTS, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve({ ...DEFAULTS, ...result });
      });
    });
  }

  /**
   * Save multiple settings at once
   */
  async function saveSettings(settings) {
    return set(settings);
  }

  /**
   * Get Groq API key
   */
  async function getApiKey() {
    return get('groqApiKey');
  }

  /**
   * Save Groq API key
   */
  async function saveApiKey(key) {
    return set('groqApiKey', key);
  }

  /**
   * Check if API key is configured
   */
  async function hasApiKey() {
    try {
      const key = await getApiKey();
      return key && key.trim().length > 0;
    } catch {
      return false;
    }
  }

  // --- Session Cache (for transcript & summary caching) ---

  /**
   * Get cached summary for a video
   */
  async function getCachedSummary(videoId, mode) {
    const cacheKey = `cache_${videoId}_${mode}`;
    try {
      const useSession = await isSessionAccessible();
      if (useSession) {
        return await new Promise((resolve) => {
          chrome.storage.session.get(cacheKey, (result) => {
            if (chrome.runtime.lastError) { resolve(null); return; }
            resolve(result[cacheKey] || null);
          });
        });
      }
      // Fallback: local storage with TTL
      return await new Promise((resolve) => {
        chrome.storage.local.get(cacheKey, (result) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          const cached = result[cacheKey];
          if (cached && Date.now() - cached.timestamp < 3600000) {
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

  /**
   * Cache a summary for a video
   */
  async function cacheSummary(videoId, mode, data) {
    const cacheKey = `cache_${videoId}_${mode}`;
    const cacheData = { ...data, timestamp: Date.now() };
    try {
      const useSession = await isSessionAccessible();
      const storage = useSession ? chrome.storage.session : chrome.storage.local;
      return await new Promise((resolve) => {
        storage.set({ [cacheKey]: cacheData }, () => {
          if (chrome.runtime.lastError) { /* ignore cache write errors */ }
          resolve();
        });
      });
    } catch {
      // Silently fail cache writes
    }
  }

  /**
   * Get cached transcript for a video
   */
  async function getCachedTranscript(videoId) {
    const cacheKey = `transcript_${videoId}`;
    try {
      const useSession = await isSessionAccessible();
      const storage = useSession ? chrome.storage.session : chrome.storage.local;
      return await new Promise((resolve) => {
        storage.get(cacheKey, (result) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(result[cacheKey] || null);
        });
      });
    } catch {
      return null;
    }
  }

  /**
   * Cache a transcript
   */
  async function cacheTranscript(videoId, transcript) {
    const cacheKey = `transcript_${videoId}`;
    try {
      const useSession = await isSessionAccessible();
      const storage = useSession ? chrome.storage.session : chrome.storage.local;
      return await new Promise((resolve) => {
        storage.set({ [cacheKey]: transcript }, () => {
          if (chrome.runtime.lastError) { /* ignore cache write errors */ }
          resolve();
        });
      });
    } catch {
      // Silently fail cache writes
    }
  }

  /**
   * Clear all cached data
   */
  async function clearCache() {
    try {
      // Step 1: Clear local storage cache entries
      const items = await new Promise((resolve) => {
        chrome.storage.local.get(null, (result) => {
          if (chrome.runtime.lastError) { resolve({}); return; }
          resolve(result);
        });
      });
      const cacheKeys = Object.keys(items).filter(
        (k) => k.startsWith('cache_') || k.startsWith('transcript_')
      );
      if (cacheKeys.length > 0) {
        await new Promise((resolve) => {
          chrome.storage.local.remove(cacheKeys, () => {
            if (chrome.runtime.lastError) { /* ignore */ }
            resolve();
          });
        });
      }
      // Step 2: Clear session storage if accessible
      const useSession = await isSessionAccessible();
      if (useSession) {
        await new Promise((resolve) => {
          chrome.storage.session.clear(() => {
            if (chrome.runtime.lastError) { /* ignore */ }
            resolve();
          });
        });
      }
    } catch {
      // Best effort cache clearing
    }
  }

  // Expose public API
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

// Make available globally
if (typeof self !== 'undefined') {
  self.StorageHelper = StorageHelper;
}
