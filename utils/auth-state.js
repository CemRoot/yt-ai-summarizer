/**
 * GleanoAuthState — what the user's sign-in looks like right now, and the
 * words we show for it.
 *
 * Single source for:
 * - the "session ended" marker, written when Supabase rejects the refresh
 *   token (so the UI can say "your Google session ended, sign in again"
 *   instead of a generic or "invalid API key" error);
 * - the user-facing copy for NEEDS_AUTH_OR_KEY, SESSION_ENDED and
 *   AUTH_UNAVAILABLE, shared by the YouTube panel, the article panel and the
 *   service worker.
 *
 * Reads chrome.storage.local directly: the article reader is injected without
 * StorageHelper. Never deobfuscates keys — presence is enough.
 */
(function initGleanoAuthState() {
  if (globalThis.GleanoAuthState) return;

  class GleanoAuthState {
    static #ENDED_KEY = 'gleanoAuthSessionEnded';

    static AUTH_CODES = Object.freeze(['NEEDS_AUTH_OR_KEY', 'SESSION_ENDED', 'AUTH_UNAVAILABLE']);

    /** Google "G" for sign-in buttons (same mark as the popup). */
    static GOOGLE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09A6.97 6.97 0 0 1 5.48 12c0-.72.13-1.43.36-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>';

    static #msg(key, fallback, subs) {
      try {
        return chrome.i18n?.getMessage(key, subs) || fallback;
      } catch {
        return fallback;
      }
    }

    static #storageGet(keys) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.get(keys, (r) => resolve(r || {}));
        } catch {
          resolve({});
        }
      });
    }

    static #storageSet(data) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.set(data, () => resolve());
        } catch {
          resolve();
        }
      });
    }

    /**
     * Supabase refused the refresh token: the session is gone for good.
     * @param {{ email?: string, reason?: string }} info
     */
    static async markEnded({ email = '', reason = '' } = {}) {
      await GleanoAuthState.#storageSet({
        [GleanoAuthState.#ENDED_KEY]: { at: Date.now(), email: String(email || ''), reason: String(reason || '') }
      });
    }

    /** The user signed in again, or signed out on purpose. */
    static async clearEnded() {
      await new Promise((resolve) => {
        try {
          chrome.storage.local.remove(GleanoAuthState.#ENDED_KEY, () => resolve());
        } catch {
          resolve();
        }
      });
    }

    /**
     * @returns {Promise<{ status: 'signed_in'|'session_ended'|'signed_out', email: string, hasByokKey: boolean }>}
     */
    static async describe() {
      const s = await GleanoAuthState.#storageGet([
        'supabaseRefreshToken',
        'supabaseUser',
        'groqApiKey',
        'ollamaApiKey',
        'geminiApiKey',
        GleanoAuthState.#ENDED_KEY
      ]);
      const hasByokKey = !!(
        String(s.groqApiKey || '').trim()
        || String(s.ollamaApiKey || '').trim()
        || String(s.geminiApiKey || '').trim()
      );
      // A refresh token means the session can be renewed even if the access token expired.
      if (String(s.supabaseRefreshToken || '').trim()) {
        return { status: 'signed_in', email: String(s.supabaseUser?.email || ''), hasByokKey };
      }
      const ended = s[GleanoAuthState.#ENDED_KEY];
      if (ended && typeof ended === 'object') {
        return { status: 'session_ended', email: String(ended.email || ''), hasByokKey };
      }
      return { status: 'signed_out', email: '', hasByokKey };
    }

    /**
     * Error code for "no session and no usable key".
     * @returns {Promise<'SESSION_ENDED'|'NEEDS_AUTH_OR_KEY'>}
     */
    static async missingAccessCode() {
      const { status } = await GleanoAuthState.describe();
      return status === 'session_ended' ? 'SESSION_ENDED' : 'NEEDS_AUTH_OR_KEY';
    }

    /**
     * User-facing copy for the auth codes. Other codes return null.
     * @param {string} code
     * @param {{ email?: string }} [info]
     * @returns {{ title: string, message: string, signIn: boolean, retryable: boolean } | null}
     */
    static presentation(code, info = {}) {
      const m = GleanoAuthState.#msg;
      if (code === 'NEEDS_AUTH_OR_KEY') {
        return {
          title: m('authSignedOutTitle', 'You are not signed in'),
          message: m(
            'authSignedOutMessage',
            'You are not signed in with your Google (Gmail) account. Sign in with Google to use Gleano, or add your own API key in Settings.'
          ),
          signIn: true,
          retryable: false
        };
      }
      if (code === 'SESSION_ENDED') {
        const email = String(info.email || '').trim();
        return {
          title: m('authSessionEndedTitle', 'Your Google session has ended'),
          message: email
            ? m(
              'authSessionEndedMessage',
              `The Google session for ${email} has ended. Sign in again to continue. Your plan and credits are safe.`,
              [email]
            )
            : m(
              'authSessionEndedMessageNoEmail',
              'Your Google session has ended. Sign in again to continue. Your plan and credits are safe.'
            ),
          signIn: true,
          retryable: false
        };
      }
      if (code === 'AUTH_UNAVAILABLE') {
        return {
          title: m('authUnavailableTitle', 'Could not reach your account'),
          message: m(
            'authUnavailableMessage',
            'You are still signed in, but your session could not be verified because of a connection problem. Check your internet connection and try again.'
          ),
          signIn: false,
          retryable: true
        };
      }
      return null;
    }

    /** Button labels shared by both panels. */
    static labels() {
      const m = GleanoAuthState.#msg;
      return {
        signIn: m('authSignInButton', 'Sign in with Google'),
        signingIn: m('authSigningIn', 'Signing in…'),
        signInFailed: m('authSignInFailed', 'Sign-in did not complete. Please try again.'),
        useOwnKey: m('authUseOwnKeyButton', 'Use my own API key'),
        retry: m('retryButton', 'Try again')
      };
    }

    /**
     * Runs the Google sign-in in the service worker (chrome.identity).
     * @returns {Promise<{ ok: boolean, error?: string }>}
     */
    static async startGoogleSignIn() {
      try {
        const res = await chrome.runtime.sendMessage({ action: 'supabaseSignIn' });
        if (res?.session) return { ok: true };
        return { ok: false, error: res?.error || 'Sign in failed' };
      } catch (err) {
        return { ok: false, error: err?.message || 'Sign in failed' };
      }
    }
  }

  globalThis.GleanoAuthState = GleanoAuthState;
})();
