/**
 * Chat rules for the YouTube Chat tab (BYOK prompt + history sent to the backend).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

require('./video-chat-prompt.js');

const { VideoChatPrompt } = globalThis;

test('answers the question first and may use general knowledge', () => {
  const p = VideoChatPrompt.buildSystemPrompt('Turkish', 'TRANSCRIPT BODY');
  assert.match(p, /FIRST sentence/);
  assert.match(p, /general knowledge/);
  assert.match(p, /Never call something impossible only because the video did not mention it/);
  assert.match(p, /120 words/);
  assert.match(p, /Reply in Turkish\./);
  assert.match(p, /--- VIDEO TRANSCRIPT ---\nTRANSCRIPT BODY\n/);
  assert.doesNotMatch(p, /Answer strictly from the transcript/);
});

test('auto language follows the question', () => {
  for (const lang of ['auto', '', undefined]) {
    const p = VideoChatPrompt.buildSystemPrompt(lang, 'T');
    assert.match(p, /same language as the user's latest question/);
    assert.doesNotMatch(p, /Reply in auto/i);
  }
});

test('history drops error bubbles and maps ai to assistant', () => {
  const turns = VideoChatPrompt.normalizeHistory([
    { role: 'user', text: 'q1' },
    { role: 'error', text: 'Something went wrong' },
    { role: 'loading', text: '' },
    { role: 'ai', text: 'a1' },
    { role: 'user', text: '   ' }
  ]);
  assert.deepEqual(turns, [
    { role: 'user', content: 'q1' },
    { role: 'assistant', content: 'a1' }
  ]);
});

test('history keeps the last turns and clips long answers', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'ai' : 'user', text: `m${i}` }));
  const turns = VideoChatPrompt.normalizeHistory(many);
  assert.equal(turns.length, VideoChatPrompt.HISTORY_MAX_TURNS);
  assert.equal(turns.at(-1).content, 'm11');

  const long = 'x'.repeat(VideoChatPrompt.HISTORY_MAX_CHARS_PER_TURN + 300);
  const [clipped] = VideoChatPrompt.normalizeHistory([{ role: 'ai', text: long }]);
  assert.equal(clipped.content.length, VideoChatPrompt.HISTORY_MAX_CHARS_PER_TURN + 1);
  assert.deepEqual(VideoChatPrompt.normalizeHistory(null), []);
});

test('chat output ceiling is 1024 tokens', () => {
  assert.equal(VideoChatPrompt.MAX_OUTPUT_TOKENS, 1024);
});
