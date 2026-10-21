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
    // Streamed reply: headers arrive at once, so Chrome does not stop the service
    // worker while podcast audio or a long summary is still being generated.
    return this.#request('POST', '/summarize?stream=1', body);
  }

  /**
   * Credit quotes from character counts only: no AI call, no charge, and neither
   * the transcript nor the video id leaves the browser (privacy policy).
   */
  async estimateCredits({ stats }) {
    return this.#request('POST', '/summarize', {
      action: 'estimate',
      transcript_stats: stats,
    });
  }

  async createPortalSession() {
    return this.#request('POST', '/create-portal-session');
  }

  // ─── Core request with auto-retry on 401 ──────────────────────────

  async #request(method, path, body) {
    const auth = globalThis.SupabaseAuth;
    if (!auth) throw new ApiError('AUTH_MISSING', 'SupabaseAuth not available');

    // getSession() renews an expired token (through the service worker) and throws
    // AUTH_UNAVAILABLE when Supabase cannot be reached; the session is kept then.
    const session = await this.#sessionOrThrow(auth, {});
    if (!session) throw new ApiError('NOT_AUTHENTICATED', 'Sign in required');
    let headers = auth.getAuthHeaders();

    let res = await this.#fetch(method, path, headers, body);

    if (res.status === 401) {
      // The backend refused a token we thought was valid: renew it once and retry.
      const renewed = await this.#sessionOrThrow(auth, { forceRefresh: true });
      if (!renewed) {
        throw new ApiError('SESSION_EXPIRED', 'Session expired. Please sign in again.');
      }
      headers = auth.getAuthHeaders();
      res = await this.#fetch(method, path, headers, body);

      // A freshly renewed token is still refused: the session is dead. End it on
      // this device only (no global /logout) so the UI asks for a new sign-in.
      if (res.status === 401) {
        await auth.endSession?.('backend_rejected_token');
        throw new ApiError('SESSION_EXPIRED', 'Session expired. Please sign in again.');
      }
    }

    const { data } = res;

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
      // Pass the backend's own error code through so the UI can explain it
      // instead of collapsing everything into a generic "something went wrong".
      const knownCodes = [
        'PROVIDER_EMPTY_RESPONSE',
        'NO_CREDITS',
        'INSUFFICIENT_CREDITS',
        'RATE_LIMITED'
      ];
      const serverCode = knownCodes.includes(errStr) ? errStr : 'SERVER_ERROR';
      const serverErr = new ApiError(
        serverCode,
        data.error || data.message || `Server error (${res.status})`
      );
      serverErr.status = res.status;
      throw serverErr;
    }

    return data;
  }

  async #sessionOrThrow(auth, opts) {
    try {
      return await auth.getSession(opts);
    } catch (err) {
      if (err?.code === 'AUTH_UNAVAILABLE') {
        throw new ApiError('AUTH_UNAVAILABLE', err.message || 'Could not reach the sign-in service.');
      }
      throw err;
    }
  }

  /**
   * Fetch + JSON body as one step. A streamed reply carries its real status in
   * `_status` (the HTTP status is always 200 there). While waiting, the service
   * worker calls a cheap extension API every 20 s: extension API calls reset
   * Chrome's 30 s idle timer, which a long body download would otherwise hit.
   * @returns {Promise<{status: number, ok: boolean, data: any}>}
   */
  async #fetch(method, path, headers, body) {
    const opts = { method, headers };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    const ping = typeof chrome !== 'undefined' && typeof chrome.runtime?.getPlatformInfo === 'function'
      ? setInterval(() => { chrome.runtime.getPlatformInfo().catch(() => {}); }, 20000)
      : null;
    try {
      const res = await fetch(`${this.#BASE_URL}${path}`, opts);
      const data = await res.json().catch(() => ({}));
      let status = res.status;
      if (res.ok && data && typeof data === 'object' && Number.isInteger(data._status)) {
        status = data._status;
      }
      if (data && typeof data === 'object') delete data._status;
      return { status, ok: status >= 200 && status < 300, data };
    } finally {
      if (ping) clearInterval(ping);
    }
  }
}

/**
 * Typed error for Edge Function failures.
 * code: NO_CREDITS | INSUFFICIENT_CREDITS | RATE_LIMITED | AI_QUOTA_EXCEEDED | NOT_AUTHENTICATED | SESSION_EXPIRED | AUTH_UNAVAILABLE | AUTH_MISSING | SERVER_ERROR
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
