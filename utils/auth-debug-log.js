/**
 * AuthDebugLogger — ring buffer + chrome.storage.local for Supabase OAuth debugging.
 * Loaded in the service worker before supabase-auth.js.
 */
class AuthDebugLogger {
  static #STORAGE_KEY = 'ytai_auth_debug_log';
  static #MAX_ENTRIES = 120;

  /**
   * @param {'info'|'warn'|'error'} level
   * @param {string} tag
   * @param {string} message
   * @param {string | object | undefined} detail
   */
  static async log(level, tag, message, detail) {
    let detailStr;
    if (detail != null) {
      if (typeof detail === 'string') detailStr = detail.slice(0, 2000);
      else {
        try {
          detailStr = JSON.stringify(detail).slice(0, 2000);
        } catch {
          detailStr = String(detail).slice(0, 2000);
        }
      }
    }
    const entry = {
      ts: Date.now(),
      level,
      tag: String(tag),
      message: String(message),
      detail: detailStr,
    };
    const line = `[${new Date(entry.ts).toISOString()}] ${level.toUpperCase()} ${entry.tag}: ${entry.message}${entry.detail ? ` | ${entry.detail}` : ''}`;
    // Use warn (not error): console.error is surfaced as extension "Errors" in chrome://extensions.
    if (level === 'error') console.warn('[YTAI-AUTH]', line);
    else if (level === 'warn') console.warn('[YTAI-AUTH]', line);
    else console.log('[YTAI-AUTH]', line);

    try {
      const data = await chrome.storage.local.get(AuthDebugLogger.#STORAGE_KEY);
      const arr = Array.isArray(data[AuthDebugLogger.#STORAGE_KEY])
        ? data[AuthDebugLogger.#STORAGE_KEY]
        : [];
      arr.push(entry);
      while (arr.length > AuthDebugLogger.#MAX_ENTRIES) arr.shift();
      await chrome.storage.local.set({ [AuthDebugLogger.#STORAGE_KEY]: arr });
    } catch (e) {
      console.warn('[YTAI-AUTH] persist failed:', e?.message || e);
    }
  }

  static async getTail(n = 20) {
    try {
      const data = await chrome.storage.local.get(AuthDebugLogger.#STORAGE_KEY);
      const arr = Array.isArray(data[AuthDebugLogger.#STORAGE_KEY])
        ? data[AuthDebugLogger.#STORAGE_KEY]
        : [];
      return arr.slice(-Math.max(1, n));
    } catch {
      return [];
    }
  }

  static formatTail(entries) {
    return entries
      .map((e) => {
        const base = `[${new Date(e.ts).toISOString()}] ${e.level} ${e.tag}: ${e.message}`;
        return e.detail ? `${base}\n  ${e.detail}` : base;
      })
      .join('\n');
  }
}
