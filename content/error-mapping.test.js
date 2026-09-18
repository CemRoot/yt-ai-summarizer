/**
 * Regression tests for user-facing error classification.
 *
 * The bug these guard against: a backend failure produced an error code that
 * ytaiNormalizeErrorCode could return but ytaiErrorPresentation had no entry
 * for, so it silently fell back to UNKNOWN_ERROR — "Something went wrong.
 * Please try again." The user got no actionable information and retrying
 * reproduced it forever.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');

function load() {
  const context = {
    globalThis: null,
    window: { location: { href: 'https://www.youtube.com/watch?v=v' }, addEventListener() {} },
    document: { addEventListener() {}, querySelector: () => null, documentElement: { setAttribute() {} } },
    chrome: { i18n: { getMessage: () => '' }, runtime: { id: 'test', onMessage: { addListener() {} } } },
    navigator: { language: 'en-US' },
    console: { ...console, error: () => {} },
    setTimeout,
    clearTimeout,
    URL
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'content.js' });
  return context;
}

const { ytaiNormalizeErrorCode: normalize, ytaiErrorPresentation: present } = load();

test('every code the classifier can return has a presentation entry', () => {
  // Extract the literal codes returned by ytaiNormalizeErrorCode so a newly
  // added branch without a matching UI message fails here rather than
  // degrading to the generic message in front of a user.
  const fnStart = source.indexOf('function ytaiNormalizeErrorCode');
  const fnEnd = source.indexOf('function ytaiErrorPresentation');
  const body = source.slice(fnStart, fnEnd);
  const codes = [...body.matchAll(/return\s+'([A-Z_]+)'/g)].map((m) => m[1]);

  assert.ok(codes.length > 10, 'expected to find the classifier return codes');

  // present() rebuilds its map each call, so compare by value — a reference
  // comparison here would pass for every input and guard nothing.
  const generic = present('DEFINITELY_NOT_A_REAL_CODE');
  const missing = [...new Set(codes)]
    .filter((code) => code !== 'UNKNOWN_ERROR')
    .filter((code) => {
      try { assert.deepEqual(present(code), generic); return true; } catch { return false; }
    });

  assert.deepEqual(
    missing,
    [],
    `these codes have no presentation entry and would render as the generic error: ${missing.join(', ')}`
  );
});

test('an opaque backend failure no longer renders as the generic message', () => {
  const err = Object.assign(new Error('Database error'), { code: 'SERVER_ERROR', status: 500 });
  const code = normalize(err);

  assert.notEqual(code, 'UNKNOWN_ERROR');
  assert.equal(code, 'PROVIDER_UNAVAILABLE');
});

test('SERVER_ERROR with a 4xx status is reported as a server error, not unknown', () => {
  const err = Object.assign(new Error('bad request'), { code: 'SERVER_ERROR', status: 400 });

  assert.equal(normalize(err), 'SERVER_ERROR');
  assert.equal(present('SERVER_ERROR').retryable, true);
});

test('an auth failure from the backend is routed to the sign-in message', () => {
  for (const status of [401, 403]) {
    const err = Object.assign(new Error('nope'), { code: 'SERVER_ERROR', status });
    assert.equal(normalize(err), 'SESSION_EXPIRED', `status ${status}`);
  }
  assert.equal(normalize(Object.assign(new Error('x'), { code: 'AUTH_MISSING' })), 'SESSION_EXPIRED');
});

test('an empty AI response gets its own explanation', () => {
  const err = Object.assign(new Error('PROVIDER_EMPTY_RESPONSE'), { code: 'PROVIDER_EMPTY_RESPONSE' });

  assert.equal(normalize(err), 'PROVIDER_EMPTY_RESPONSE');
  assert.match(present('PROVIDER_EMPTY_RESPONSE').message, /safety filter|too long/);
});

test('transcript failures still map to the captions message', () => {
  for (const msg of [
    'TRANSCRIPT_UNAVAILABLE', 'TRANSCRIPT_NOT_READY', 'TRANSCRIPT_EMPTY_RETRYABLE',
    'TRANSCRIPT_EMPTY_FINAL', 'TRANSCRIPT_REQUEST_STALE', 'NO_TRANSCRIPT'
  ]) {
    assert.equal(normalize(new Error(msg)), 'TRANSCRIPT_UNAVAILABLE', msg);
  }
});

test('credit and rate-limit codes are unchanged', () => {
  assert.equal(normalize(Object.assign(new Error('x'), { code: 'NO_CREDITS' })), 'NO_CREDITS');
  assert.equal(normalize(Object.assign(new Error('x'), { code: 'RATE_LIMITED' })), 'MANAGED_RATE_LIMIT');
  assert.equal(normalize(Object.assign(new Error('x'), { code: 'INSUFFICIENT_CREDITS' })), 'INSUFFICIENT_CREDITS');
});

test('a truly unrecognised error still falls back to UNKNOWN_ERROR', () => {
  assert.equal(normalize(new Error('something bizarre')), 'UNKNOWN_ERROR');
});
