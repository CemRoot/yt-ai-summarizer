/**
 * Regression tests for "signed out after closing Chrome".
 *
 * Root cause: every YouTube tab, the popup and the service worker refreshed the
 * Supabase session on their own. Refresh tokens rotate, so after a restart two
 * contexts spent the same token; Supabase revoked the session as a reuse attack,
 * and the failing context called the global /logout. A plain network error at
 * startup also signed the user out.
 *
 * These tests load the real storage.js, auth-state.js and supabase-auth.js in a
 * VM with an in-memory chrome.storage and a scripted fetch.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const SOURCES = [
  ['storage.js', read('storage.js')],
  ['auth-state.js', read('auth-state.js')],
  ['supabase-auth.js', read('supabase-auth.js')]
];

const HOUR = 3600 * 1000;

/**
 * @param {object} opts
 * @param {boolean} [opts.worker] run as the service worker
 * @param {Map} [opts.store] shared chrome.storage.local backing map
 * @param {Array<object|Function>} [opts.responses] token endpoint replies, in order
 * @param {Function} [opts.onMessage] chrome.runtime.sendMessage handler (pages only)
 */
function createContext({ worker = false, store = new Map(), responses = [], onMessage } = {}) {
  const calls = { token: 0, logout: [], user: 0, messages: [] };
  const queue = [...responses];

  const local = {
    get(keys, cb) {
      const out = {};
      if (keys === null || keys === undefined) {
        for (const [k, v] of store) out[k] = v;
      } else if (typeof keys === 'string') {
        if (store.has(keys)) out[keys] = store.get(keys);
      } else if (Array.isArray(keys)) {
        for (const k of keys) if (store.has(k)) out[k] = store.get(k);
      } else {
        for (const [k, d] of Object.entries(keys)) out[k] = store.has(k) ? store.get(k) : d;
      }
      const p = Promise.resolve(structuredClone(out));
      if (cb) { p.then(cb); return undefined; }
      return p;
    },
    set(data, cb) {
      for (const [k, v] of Object.entries(data)) store.set(k, structuredClone(v));
      const p = Promise.resolve();
      if (cb) { p.then(cb); return undefined; }
      return p;
    },
    remove(keys, cb) {
      for (const k of [].concat(keys)) store.delete(k);
      const p = Promise.resolve();
      if (cb) { p.then(cb); return undefined; }
      return p;
    }
  };

  class ServiceWorkerGlobalScope {}
  const context = worker ? new ServiceWorkerGlobalScope() : {};
  Object.assign(context, {
    console: { ...console, warn() {}, log() {} },
    setTimeout,
    clearTimeout,
    structuredClone,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    TextEncoder,
    URL,
    URLSearchParams,
    crypto: globalThis.crypto,
    chrome: {
      runtime: {
        lastError: null,
        id: 'test',
        sendMessage: worker
          ? undefined
          : async (msg) => {
            calls.messages.push(msg);
            if (!onMessage) throw new Error('Receiving end does not exist.');
            return onMessage(msg);
          }
      },
      storage: { local, session: local },
      i18n: { getMessage: () => '' }
    },
    fetch: async (url, init = {}) => {
      if (String(url).includes('/auth/v1/logout')) {
        calls.logout.push(String(url));
        return { ok: true, status: 204, json: async () => ({}) };
      }
      if (String(url).includes('/auth/v1/user')) {
        calls.user += 1;
        return { ok: true, status: 200, json: async () => ({ id: 'u1', email: 'user@gmail.com' }) };
      }
      if (String(url).includes('grant_type=refresh_token')) {
        calls.token += 1;
        const body = JSON.parse(init.body || '{}');
        let next = queue.shift();
        if (typeof next === 'function') next = await next(body);
        if (!next) throw new Error('unexpected refresh');
        if (next.throw) throw new TypeError('Failed to fetch');
        return { ok: next.status >= 200 && next.status < 300, status: next.status, json: async () => next.body };
      }
      throw new Error(`unexpected fetch ${url}`);
    }
  });
  if (worker) context.ServiceWorkerGlobalScope = ServiceWorkerGlobalScope;
  context.globalThis = context;
  context.self = context;

  vm.createContext(context);
  for (const [filename, src] of SOURCES) vm.runInContext(src, context, { filename });
  return { ctx: context, auth: context.SupabaseAuth, store, calls };
}

/** Store a signed-in session the way StorageHelper writes it (tokens obfuscated). */
async function seedSession(ctx, { access = 'access-old', refresh = 'refresh-1', expiresAt = Date.now() - 1000 } = {}) {
  const saved = await ctx.StorageHelper.saveAuthState({
    supabaseAccessToken: access,
    supabaseRefreshToken: refresh,
    supabaseTokenExpiresAt: expiresAt,
    supabaseUser: { id: 'u1', email: 'user@gmail.com' },
    userPlan: 'pro',
    credits: 500
  });
  assert.equal(saved.ok, true);
}

const tokens = (n) => ({
  status: 200,
  body: {
    access_token: `access-${n}`,
    refresh_token: `refresh-${n}`,
    expires_in: 3600,
    user: { id: 'u1', email: 'user@gmail.com' }
  }
});

test('the service worker runs one refresh for many concurrent callers', async () => {
  const { ctx, auth, calls } = createContext({ worker: true, responses: [tokens(2)] });
  await seedSession(ctx);

  const sessions = await Promise.all([auth.getSession(), auth.getSession(), auth.getSession()]);

  assert.equal(calls.token, 1, 'a second refresh would spend a rotated token');
  for (const s of sessions) assert.equal(s.access_token, 'access-2');
  const state = await ctx.StorageHelper.getAuthState();
  assert.equal(state.supabaseRefreshToken, 'refresh-2');
});

test('a network error at startup keeps the session and reports AUTH_UNAVAILABLE', async () => {
  const { ctx, auth, calls } = createContext({ worker: true, responses: [{ throw: true }] });
  await seedSession(ctx);

  const err = await auth.getSession().then(() => null, (e) => e);

  assert.equal(err?.code, 'AUTH_UNAVAILABLE');
  assert.equal(calls.logout.length, 0, 'must not call /logout');
  const state = await ctx.StorageHelper.getAuthState();
  assert.equal(state.supabaseRefreshToken, 'refresh-1', 'refresh token must survive a network error');
  assert.equal((await ctx.GleanoAuthState.describe()).status, 'signed_in');
});

test('5xx and 429 from the token endpoint keep the session', async () => {
  for (const status of [500, 502, 503, 429]) {
    const { ctx, auth } = createContext({ worker: true, responses: [{ status, body: {} }] });
    await seedSession(ctx);
    const err = await auth.getSession().then(() => null, (e) => e);
    assert.equal(err?.code, 'AUTH_UNAVAILABLE', `status ${status}`);
    assert.equal((await ctx.StorageHelper.getAuthState()).supabaseRefreshToken, 'refresh-1', `status ${status}`);
  }
});

test('a rejected refresh token ends the session locally and records it', async () => {
  const { ctx, auth, calls } = createContext({
    worker: true,
    responses: [{ status: 400, body: { error_code: 'refresh_token_already_used', msg: 'Invalid Refresh Token: Already Used' } }]
  });
  await seedSession(ctx);

  const session = await auth.getSession();

  assert.equal(session, null);
  assert.equal(calls.logout.length, 0, 'global /logout would revoke the user on every device');
  const state = await ctx.StorageHelper.getAuthState();
  assert.equal(state.supabaseAccessToken, '');
  assert.equal(state.supabaseRefreshToken, '');
  const info = await ctx.GleanoAuthState.describe();
  assert.equal(info.status, 'session_ended');
  assert.equal(info.email, 'user@gmail.com');
  assert.equal(await ctx.GleanoAuthState.missingAccessCode(), 'SESSION_ENDED');
});

test('a page asks the service worker to refresh instead of spending the token itself', async () => {
  const store = new Map();
  const sw = createContext({ worker: true, store, responses: [tokens(2)] });
  await seedSession(sw.ctx);

  const page = createContext({
    store,
    onMessage: async (msg) => {
      assert.equal(msg.action, 'supabaseRefreshSession');
      return sw.auth.refreshForContext(msg.staleAccessToken);
    }
  });

  const session = await page.auth.getSession();

  assert.equal(page.calls.token, 0, 'pages must never call the token endpoint');
  assert.equal(sw.calls.token, 1);
  assert.equal(session.access_token, 'access-2');
  assert.equal(page.calls.messages.length, 1);
});

test('many tabs waking up together cause a single refresh', async () => {
  const store = new Map();
  const sw = createContext({ worker: true, store, responses: [tokens(2)] });
  await seedSession(sw.ctx);
  const relay = async (msg) => sw.auth.refreshForContext(msg.staleAccessToken);
  const tabs = Array.from({ length: 5 }, () => createContext({ store, onMessage: relay }));

  const sessions = await Promise.all(tabs.map((t) => t.auth.getSession()));

  assert.equal(sw.calls.token, 1);
  for (const s of sessions) assert.equal(s.access_token, 'access-2');
});

test('a tab with a stale token in memory adopts tokens another context already rotated', async () => {
  const store = new Map();
  const sw = createContext({ worker: true, store, responses: [tokens(2), tokens(3)] });
  await seedSession(sw.ctx);
  const relay = async (msg) => sw.auth.refreshForContext(msg.staleAccessToken);
  const tabA = createContext({ store, onMessage: relay });
  const tabB = createContext({ store, onMessage: relay });

  await tabA.auth.getSession(); // rotation 1 → 2, tabA holds access-2
  // Later, tabB still holds nothing in RAM; it reads storage and finds a fresh token.
  const s = await tabB.auth.getSession();

  assert.equal(s.access_token, 'access-2');
  assert.equal(sw.calls.token, 1, 'a fresh stored token needs no refresh');
});

test('the service worker skips a refresh when the stale token was already replaced', async () => {
  const { ctx, auth, calls } = createContext({ worker: true, responses: [] });
  await seedSession(ctx, { access: 'access-new', refresh: 'refresh-9', expiresAt: Date.now() + HOUR });

  const result = await auth.refreshForContext('access-old');

  assert.equal(result.status, 'ok');
  assert.equal(calls.token, 0);
});

test('a page whose worker is unreachable gets AUTH_UNAVAILABLE, not a sign-out', async () => {
  const page = createContext({}); // sendMessage throws "Receiving end does not exist."
  await seedSession(page.ctx);

  const err = await page.auth.getSession().then(() => null, (e) => e);

  assert.equal(err?.code, 'AUTH_UNAVAILABLE');
  assert.equal((await page.ctx.StorageHelper.getAuthState()).supabaseRefreshToken, 'refresh-1');
});

test('a fresh session is returned without any network call', async () => {
  const { ctx, auth, calls } = createContext({ worker: true });
  await seedSession(ctx, { expiresAt: Date.now() + HOUR });

  const s = await auth.getSession();

  assert.equal(s.access_token, 'access-old');
  assert.equal(calls.token, 0);
});

test('forceRefresh renews a token the backend rejected even if it looks fresh', async () => {
  const { ctx, auth, calls } = createContext({ worker: true, responses: [tokens(2)] });
  await seedSession(ctx, { expiresAt: Date.now() + HOUR });
  await auth.getSession();

  const s = await auth.getSession({ forceRefresh: true });

  assert.equal(calls.token, 1);
  assert.equal(s.access_token, 'access-2');
});

test('user sign-out is local-scoped and is not reported as an ended session', async () => {
  const { ctx, auth, calls } = createContext({ worker: true });
  await seedSession(ctx, { expiresAt: Date.now() + HOUR });
  await ctx.GleanoAuthState.markEnded({ email: 'old@gmail.com', reason: 'test' });
  await auth.getSession();

  await auth.signOut();

  assert.equal(calls.logout.length, 1);
  assert.match(calls.logout[0], /scope=local/);
  assert.equal((await ctx.GleanoAuthState.describe()).status, 'signed_out');
  assert.equal(await ctx.GleanoAuthState.missingAccessCode(), 'NEEDS_AUTH_OR_KEY');
});

test('only definitive refresh failures count as a dead session', () => {
  const { ctx } = createContext({ worker: true });
  const dead = ctx.SupabaseAuthClass.isDeadRefreshResponse;

  assert.equal(dead(400, { error_code: 'refresh_token_not_found' }), true);
  assert.equal(dead(400, {}), true);
  assert.equal(dead(401, { error_code: 'session_not_found' }), true);
  assert.equal(dead(403, { msg: 'Invalid Refresh Token: Refresh Token Not Found' }), true);
  assert.equal(dead(401, { message: 'Invalid API key' }), false, 'a bad anon key is a config problem, not a dead session');
  assert.equal(dead(429, {}), false);
  assert.equal(dead(500, {}), false);
  assert.equal(dead(503, { error_code: 'refresh_token_not_found' }), false);
});

test('a user with only a BYOK key is never asked to sign in', async () => {
  const { ctx } = createContext({ worker: true });
  await ctx.StorageHelper.set({ groqApiKey: 'obfuscated-value' });

  const info = await ctx.GleanoAuthState.describe();

  assert.equal(info.status, 'signed_out');
  assert.equal(info.hasByokKey, true);
});
