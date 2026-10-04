/**
 * Host allowlist for caption URLs fetched by the service worker.
 *
 * A content script, or a YouTube page script spoofing the page bridge,
 * can supply the track URL. The worker fetches it with credentials, so
 * anything other than an https YouTube caption host is refused before
 * the request is sent.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

require('./transcript-url-allowlist.js');

const { TranscriptUrlAllowlist } = globalThis;

const allows = (url) => TranscriptUrlAllowlist.isAllowed(url);

test('rejects a non-YouTube host', () => {
  assert.equal(allows('https://evil.com/api/timedtext'), false);
  assert.equal(allows('https://evil.com'), false);
});

test('rejects http even on an allowed host', () => {
  assert.equal(allows('http://www.youtube.com/api/timedtext'), false);
});

test('rejects javascript URLs', () => {
  assert.equal(allows('javascript:alert(1)'), false);
  assert.equal(allows('javascript:https://www.youtube.com/api/timedtext'), false);
});

test('rejects data URLs', () => {
  assert.equal(allows('data:text/html,https://www.youtube.com'), false);
});

test('allows https://www.youtube.com/api/timedtext', () => {
  assert.equal(allows('https://www.youtube.com/api/timedtext'), true);
});

test('allows a googlevideo.com subdomain', () => {
  assert.equal(allows('https://something.googlevideo.com/'), true);
});

test('allows exact hosts and subdomains of every allowlisted domain', () => {
  assert.equal(allows('https://youtube.com/api/timedtext'), true);
  assert.equal(allows('https://m.youtube.com/api/timedtext'), true);
  assert.equal(allows('https://youtu.be/abc'), true);
  assert.equal(allows('https://www.youtu.be/abc'), true);
  assert.equal(allows('https://ytimg.com/'), true);
  assert.equal(allows('https://i.ytimg.com/vi/x/0.jpg'), true);
});

test('rejects a host that only prefixes an allowed domain', () => {
  assert.equal(allows('https://youtube.com.evil.com/api/timedtext'), false);
  assert.equal(allows('https://www.youtube.com.evil.com/'), false);
});

test('rejects a lookalike that merely ends with an allowed name', () => {
  assert.equal(allows('https://notyoutube.com/api/timedtext'), false);
  assert.equal(allows('https://evilgooglevideo.com/'), false);
});

test('rejects URLs with userinfo', () => {
  assert.equal(allows('https://user:pass@www.youtube.com/api/timedtext'), false);
  assert.equal(allows('https://user@www.youtube.com/api/timedtext'), false);
});

test('rejects empty values and non-strings', () => {
  assert.equal(allows(''), false);
  assert.equal(allows(null), false);
  assert.equal(allows(undefined), false);
  assert.equal(allows(1), false);
  assert.equal(allows({}), false);
  assert.equal(allows(['https://www.youtube.com/api/timedtext']), false);
});
