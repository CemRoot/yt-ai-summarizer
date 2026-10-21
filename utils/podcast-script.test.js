/**
 * Podcast notes, voices and dialogue repair (BYOK path; the managed server applies the same rules).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

require('./podcast-script.js');

const { PodcastScript } = globalThis;

test('every voice pair is one female and one male voice', () => {
  for (const pair of PodcastScript.VOICE_PAIRS) {
    assert.notEqual(pair.a.gender, pair.b.gender, `${pair.a.name}/${pair.b.name}`);
    assert.notEqual(pair.a.name, pair.b.name);
    assert.match(pair.a.name, /^[A-Za-z]{2,30}$/);
  }
  assert.equal(PodcastScript.pickVoicePair(() => 0), PodcastScript.VOICE_PAIRS[0]);
  assert.equal(PodcastScript.pickVoicePair(() => 0.9999), PodcastScript.VOICE_PAIRS.at(-1));
});

test('notes include summary, key points and detailed analysis', () => {
  const notes = PodcastScript.buildNotes({ summary: 'S', keypoints: '1. K', detailed: '**D**' });
  assert.equal(notes, 'SUMMARY:\nS\n\nKEY POINTS:\n1. K\n\nDETAILED ANALYSIS:\n**D**');
  assert.equal(PodcastScript.buildNotes({ summary: 'only' }), 'SUMMARY:\nonly');
  assert.equal(PodcastScript.buildNotes({}), '');
  assert.equal(PodcastScript.buildNotes({ summary: 'x'.repeat(20000) }).length, PodcastScript.NOTES_MAX_CHARS);
});

test('spoken text loses prefixes, cues, markdown and line breaks, keeps content parentheses', () => {
  assert.deepEqual(PodcastScript.cleanSpokenText('**Sam**: Wait (laughs), really?\n[music] *chuckles* Yes.'), {
    text: 'Wait, really? Yes.',
    prefixSpeaker: 'Sam'
  });
  assert.equal(PodcastScript.cleanSpokenText('VPS (Virtual Private Server) *matter*').text, 'VPS (Virtual Private Server) matter');
  assert.equal(PodcastScript.cleanSpokenText('Harika (gülüyor) fikir').text, 'Harika fikir');
});

test('dialogue repair: aliases, alternation, merged back-to-back turns', () => {
  const d = PodcastScript.normalizeDialogue([
    { speaker: 'alex', text: 'Alex: a1' },
    { speaker: 'Alex', text: 'a2' },
    { speaker: 'Host B', text: 'b1' },
    { text: 'b2' },
    { speaker: 'Speaker 1', text: 'a3' },
    { speaker: 'B', text: 'b3' }
  ]);
  // An unlabeled line takes the other host (b2 → Alex), then merges with Alex's a3.
  assert.deepEqual(d, [
    { speaker: 'Alex', text: 'a1 a2' },
    { speaker: 'Sam', text: 'b1' },
    { speaker: 'Alex', text: 'b2 a3' },
    { speaker: 'Sam', text: 'b3' }
  ]);
});

test('one-host scripts alternate; unusable input is null', () => {
  const d = PodcastScript.normalizeDialogue(Array.from({ length: 6 }, (_, i) => ({ speaker: 'Alex', text: `t${i}` })));
  assert.deepEqual(d.map((l) => l.speaker), ['Alex', 'Sam', 'Alex', 'Sam', 'Alex', 'Sam']);
  assert.equal(PodcastScript.normalizeDialogue(null), null);
  assert.equal(PodcastScript.normalizeDialogue([{ speaker: 'Alex', text: 'x' }]), null);
});

test('JSON parsing tolerates fences and prose', () => {
  assert.deepEqual(PodcastScript.parseJson('```json\n[{"a":1}]\n```'), [{ a: 1 }]);
  assert.deepEqual(PodcastScript.parseJson('Sure: [{"a":1}]'), [{ a: 1 }]);
  assert.equal(PodcastScript.parseJson('nope'), null);
});

test('TTS text is labeled lines behind the documented preface', () => {
  const script = PodcastScript.formatTtsScript([{ speaker: 'Alex', text: 'Hi' }, { speaker: 'Sam', text: 'Yo' }]);
  assert.equal(script, 'Alex: Hi\nSam: Yo');
  assert.match(PodcastScript.buildTtsPrompt(script), /^TTS the following podcast conversation between Alex and Sam\. [\s\S]*:\n\nAlex: Hi\nSam: Yo$/);
});

test('BYOK prompt: coverage, no verbatim reading, language and voice genders', () => {
  const p = PodcastScript.buildSystemPrompt('auto', { a: { gender: 'M' }, b: { gender: 'F' } });
  assert.match(p, /Cover EVERY key point/);
  assert.match(p, /Never copy a sentence from the notes word for word/);
  assert.match(p, /same language as the notes/);
  assert.match(p, /Alex is a man and Sam is a woman/);
  assert.doesNotMatch(p, /Output language: auto/);
  assert.match(PodcastScript.buildSystemPrompt('Turkish'), /Write the dialogue in Turkish\./);
  assert.ok(PodcastScript.buildUserPrompt('n').startsWith('Notes about the video:\n\n'));
});
