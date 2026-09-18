/**
 * Regression tests for Edge Function error mapping.
 *
 * Background: every backend failure that was not 402/429/Gemini-quota used to
 * collapse into an opaque SERVER_ERROR, which the UI then rendered as the
 * generic "Something went wrong. Please try again." Retrying never helped and
 * the real cause was never logged. These tests pin the codes and the HTTP
 * status the UI needs to tell those cases apart.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'api-client.js'), 'utf8');

/**
 * @param responses  one entry per fetch call: { status, body }
 */
function createClient(responses, authOptions = {}) {
  const calls = { fetches: 0, signOut: 0, getSession: 0 };
  const queue = [...responses];

  const context = {
    globalThis: null,
    self: null,
    navigator: { userAgent: 'test' },
    console,
    fetch: async () => {
      calls.fetches += 1;
      const next = queue.shift() || { status: 500, body: {} };
      return {
        status: next.status,
        ok: next.status >= 200 && next.status < 300,
        json: async () => next.body
      };
    }
  };
  context.globalThis = context;
  context.self = context;

  context.SupabaseAuth = {
    getAuthHeaders: () => (authOptions.noHeaders ? null : { Authorization: 'Bearer t' }),
    getSession: async () => {
      calls.getSession += 1;
      if (authOptions.refreshFails) throw new Error('refresh failed');
      return authOptions.noSession ? null : { access_token: 't' };
    },
    signOut: async () => { calls.signOut += 1; }
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'api-client.js' });
  return { api: context.globalThis.ApiClient, calls };
}

const summarize = (api) => api.summarize({ videoId: 'v', transcript: 'x' });

test('502 PROVIDER_EMPTY_RESPONSE keeps its own code instead of SERVER_ERROR', async () => {
  const { api } = createClient([{ status: 502, body: { error: 'PROVIDER_EMPTY_RESPONSE' } }]);
  const err = await summarize(api).then(() => null, (e) => e);

  assert.equal(err.code, 'PROVIDER_EMPTY_RESPONSE');
  assert.equal(err.status, 502);
});

test('unclassified server failure carries the HTTP status and the server message', async () => {
  const { api } = createClient([{ status: 500, body: { error: 'Database error' } }]);
  const err = await summarize(api).then(() => null, (e) => e);

  assert.equal(err.code, 'SERVER_ERROR');
  assert.equal(err.status, 500);
  assert.equal(err.message, 'Database error', 'the real cause must survive to the UI');
});

test('400 bad request is reported as SERVER_ERROR with its status, not swallowed', async () => {
  const { api } = createClient([
    { status: 400, body: { error: 'video_id and transcript are required' } }
  ]);
  const err = await summarize(api).then(() => null, (e) => e);

  assert.equal(err.code, 'SERVER_ERROR');
  assert.equal(err.status, 400);
});

test('a 401 that survives a token refresh becomes SESSION_EXPIRED and signs out', async () => {
  const { api, calls } = createClient([
    { status: 401, body: { error: 'Missing authorization header' } },
    { status: 401, body: { error: 'Missing authorization header' } }
  ]);
  const err = await summarize(api).then(() => null, (e) => e);

  assert.equal(err.code, 'SESSION_EXPIRED');
  assert.equal(calls.fetches, 2, 'must retry exactly once after refreshing');
  assert.equal(calls.signOut, 1);
});

test('a 401 that a refresh fixes succeeds on the retry', async () => {
  const { api, calls } = createClient([
    { status: 401, body: {} },
    { status: 200, body: { summary: 'ok' } }
  ]);

  assert.deepEqual(await summarize(api), { summary: 'ok' });
  assert.equal(calls.signOut, 0);
});

test('402 still surfaces credit details for the upgrade prompt', async () => {
  const { api } = createClient([{
    status: 402,
    body: {
      error: 'INSUFFICIENT_CREDITS',
      estimated_credits: 12,
      available_credits: 3,
      upgrade_url: 'https://example.test/upgrade'
    }
  }]);
  const err = await summarize(api).then(() => null, (e) => e);

  assert.equal(err.code, 'INSUFFICIENT_CREDITS');
  assert.equal(err.estimatedCredits, 12);
  assert.equal(err.availableCredits, 3);
  assert.equal(err.upgradeUrl, 'https://example.test/upgrade');
});

test('429 maps to RATE_LIMITED', async () => {
  const { api } = createClient([{ status: 429, body: { message: 'slow down' } }]);
  const err = await summarize(api).then(() => null, (e) => e);

  assert.equal(err.code, 'RATE_LIMITED');
});

test('Gemini quota text is still classified ahead of the generic branch', async () => {
  const { api } = createClient([{
    status: 500,
    body: { error: 'GEMINI_QUOTA_EXCEEDED: exceeded your current quota' }
  }]);
  const err = await summarize(api).then(() => null, (e) => e);

  assert.equal(err.code, 'AI_QUOTA_EXCEEDED');
});
