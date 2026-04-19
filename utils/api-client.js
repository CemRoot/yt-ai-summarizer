/**
 * ApiClient — Edge Function caller for Supabase backend
 * @architecture Singleton class — depends on SupabaseAuth (loaded before this file)
 */
class ApiClient {

  static #instance = null;

  #BASE_URL = 'https://smvnsfznxctkegjbckmt.supabase.co/functions/v1';

  constructor() {
    if (ApiClient.#instance) return ApiClient.#instance;
    ApiClient.#instance = this;
  }

  static getInstance() {
    if (!ApiClient.#instance) {
      ApiClient.#instance = new ApiClient();
    }
    return ApiClient.#instance;
  }

  // ─── Edge Function calls ───────────────────────────────────────────

  async callAuthCallback(fingerprint) {
    return this.#request('POST', '/auth-callback', {
      fingerprint,
      user_agent: navigator.userAgent,
    });
  }

  async checkCredits() {
    return this.#request('POST', '/check-credits');
  }

  async summarize({ videoId, transcript, action = 'summary', language = 'English', chatMessage, chatHistory, podcastDialogue, voiceA, voiceB }) {
    const body = {
      video_id: videoId,
      transcript,
      action,
      language,
    };
    if (chatMessage !== undefined) body.chat_message = chatMessage;
    if (chatHistory !== undefined) body.chat_history = chatHistory;
    if (podcastDialogue !== undefined) body.podcast_dialogue = podcastDialogue;
    if (voiceA !== undefined) body.voice_a = voiceA;
    if (voiceB !== undefined) body.voice_b = voiceB;
    return this.#request('POST', '/summarize', body);
  }

  async createPortalSession() {
    return this.#request('POST', '/create-portal-session');
  }

  // ─── Core request with auto-retry on 401 ──────────────────────────

  async #request(method, path, body) {
    const auth = globalThis.SupabaseAuth;
    if (!auth) throw new ApiError('AUTH_MISSING', 'SupabaseAuth not available');

    let headers = auth.getAuthHeaders();
    if (!headers) {
      const session = await auth.getSession();
      if (!session) throw new ApiError('NOT_AUTHENTICATED', 'Sign in required');
      headers = auth.getAuthHeaders();
    }

    let res = await this.#fetch(method, path, headers, body);

    if (res.status === 401) {
      try {
        const session = await auth.getSession(); // triggers refresh
        if (!session) throw new Error('Session expired');
        headers = auth.getAuthHeaders();
        res = await this.#fetch(method, path, headers, body);
      } catch {
        await auth.signOut();
        throw new ApiError('SESSION_EXPIRED', 'Session expired. Please sign in again.');
      }
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 402) {
        const errCode = data.error === 'INSUFFICIENT_CREDITS' ? 'INSUFFICIENT_CREDITS' : 'NO_CREDITS';
        const err = new ApiError(
          errCode,
          data.message || (errCode === 'INSUFFICIENT_CREDITS'
            ? 'Bu işlem için yeterli krediniz yok.'
            : 'Free credits exhausted.'),
          data.upgrade_url,
        );
        if (typeof data.estimated_credits === 'number') err.estimatedCredits = data.estimated_credits;
        if (typeof data.available_credits === 'number') err.availableCredits = data.available_credits;
        throw err;
      }
      if (res.status === 429) {
        throw new ApiError('RATE_LIMITED', data.message || 'Too many requests.');
      }
      const errStr = String(data.error || data.message || '');
      if (/GEMINI_QUOTA_EXCEEDED|exceeded your current quota/i.test(errStr)) {
        throw new ApiError('AI_QUOTA_EXCEEDED', errStr.slice(0, 500));
      }
      if (/^GEMINI_API_KEY_INVALID/i.test(errStr)) {
        throw new ApiError('GEMINI_KEY_INVALID', errStr.slice(0, 500));
      }
      throw new ApiError('SERVER_ERROR', data.error || `Server error (${res.status})`);
    }

    return data;
  }

  async #fetch(method, path, headers, body) {
    const opts = { method, headers };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    return fetch(`${this.#BASE_URL}${path}`, opts);
  }
}

/**
 * Typed error for Edge Function failures.
 * code: NO_CREDITS | INSUFFICIENT_CREDITS | RATE_LIMITED | AI_QUOTA_EXCEEDED | NOT_AUTHENTICATED | SESSION_EXPIRED | AUTH_MISSING | SERVER_ERROR
 *
 * INSUFFICIENT_CREDITS adds `estimatedCredits` + `availableCredits` so the UI
 * can show a pre-flight "this long video needs N credits, you have M" message.
 */
class ApiError extends Error {
  constructor(code, message, upgradeUrl) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.upgradeUrl = upgradeUrl || null;
    this.estimatedCredits = null;
    this.availableCredits = null;
  }
}

// ─── Singleton export ──────────────────────────────────────────────
const _apiClientInstance = ApiClient.getInstance();

if (typeof self !== 'undefined') {
  self.ApiClient = _apiClientInstance;
  self.ApiError = ApiError;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ApiClient = _apiClientInstance;
  globalThis.ApiError = ApiError;
}
