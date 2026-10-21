/**
 * PodcastScript — podcast notes, voices, dialogue repair and TTS formatting.
 *
 * Used by the service worker for both paths. The managed server repairs the
 * script again (same rules); the BYOK path relies on this file alone, so keep
 * it in step with the server's podcast module.
 *
 * Why these rules: users heard Alex and Sam "as the same person" (same-gender
 * voice pairs that sound alike, mislabeled or back-to-back lines), the hosts
 * "just read the text" (script written from the short summary, name prefixes
 * and stage directions spoken aloud), and key points went missing (only the
 * summary section was sent).
 */
(() => {
  /*
   * Gemini TTS voices (cloud.google.com/text-to-speech/docs/gemini-tts).
   * Every pair is one female + one male voice so the two hosts never blend.
   */
  const VOICE_PAIRS = Object.freeze([
    { a: { name: 'Charon', gender: 'M' }, b: { name: 'Kore', gender: 'F' } },
    { a: { name: 'Kore', gender: 'F' }, b: { name: 'Puck', gender: 'M' } },
    { a: { name: 'Charon', gender: 'M' }, b: { name: 'Aoede', gender: 'F' } },
    { a: { name: 'Fenrir', gender: 'M' }, b: { name: 'Leda', gender: 'F' } },
    { a: { name: 'Leda', gender: 'F' }, b: { name: 'Orus', gender: 'M' } },
    { a: { name: 'Orus', gender: 'M' }, b: { name: 'Zephyr', gender: 'F' } },
    { a: { name: 'Zephyr', gender: 'F' }, b: { name: 'Charon', gender: 'M' } },
    { a: { name: 'Aoede', gender: 'F' }, b: { name: 'Fenrir', gender: 'M' } }
  ]);

  const SPEAKER_ALIASES = [
    [/^(alex|a|host\s*a|host\s*1|speaker\s*1|speaker\s*a|1)$/i, 'Alex'],
    [/^(sam|b|host\s*b|host\s*2|speaker\s*2|speaker\s*b|2)$/i, 'Sam']
  ];
  const NAME_PREFIX_RE = /^\s*\**\s*(alex|sam|host\s*[ab12]|speaker\s*[ab12])\s*\**\s*[:：\-–—]\s*/i;
  const BRACKET_CUE_RE = /\s*\[[^[\]]{1,40}\]\s*/g;
  const STAGE_WORDS = 'laughs?|laughing|chuckles?|chuckling|giggles?|sighs?|pause[sd]?|music|intro|outro|applause|smiles?|gülüyor|güler|gülerek|kahkaha|gülümser|gülümseyerek|müzik|duraklar|duraklama|alkış';
  const STAGE_DIRECTION_RE = new RegExp(
    `\\s*(?:\\((?:${STAGE_WORDS})[^()]{0,25}\\)|\\*(?:${STAGE_WORDS})[^*]{0,25}\\*)\\s*`,
    'gi'
  );
  const TURN_MAX_CHARS = 600;

  class PodcastScript {

    static NOTES_MAX_CHARS = 12000;
    static MAX_TURNS = 18;
    static VOICE_PAIRS = VOICE_PAIRS;

    /** @returns {{a: {name: string, gender: string}, b: {name: string, gender: string}}} */
    static pickVoicePair(random = Math.random) {
      return VOICE_PAIRS[Math.floor(random() * VOICE_PAIRS.length) % VOICE_PAIRS.length];
    }

    /**
     * Script input: summary + key points + detailed analysis (whatever exists),
     * so the hosts can reach every important point, not just the short summary.
     * @param {{summary?: string, keypoints?: string, detailed?: string}} parts
     * @returns {string}
     */
    static buildNotes(parts) {
      const sections = [
        ['SUMMARY', parts?.summary],
        ['KEY POINTS', parts?.keypoints],
        ['DETAILED ANALYSIS', parts?.detailed]
      ]
        .map(([title, body]) => [title, String(body || '').trim()])
        .filter(([, body]) => body);
      return sections.map(([title, body]) => `${title}:\n${body}`).join('\n\n').slice(0, PodcastScript.NOTES_MAX_CHARS);
    }

    static #mapSpeaker(raw) {
      const s = String(raw ?? '').replace(/[*_"']/g, '').trim();
      for (const [re, name] of SPEAKER_ALIASES) if (re.test(s)) return name;
      return null;
    }

    /** @returns {{text: string, prefixSpeaker: 'Alex'|'Sam'|null}} */
    static cleanSpokenText(raw) {
      let text = String(raw ?? '');
      let prefixSpeaker = null;
      const m = NAME_PREFIX_RE.exec(text);
      if (m) {
        prefixSpeaker = PodcastScript.#mapSpeaker(m[1]);
        text = text.slice(m[0].length);
      }
      text = text
        .replace(BRACKET_CUE_RE, ' ')
        .replace(STAGE_DIRECTION_RE, ' ')
        .replace(/[*_#`>~]+/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.!?;:…])/g, '$1')
        .trim();
      if (text.length > TURN_MAX_CHARS) text = `${text.slice(0, TURN_MAX_CHARS).replace(/\s+\S*$/, '')}…`;
      return { text, prefixSpeaker };
    }

    /**
     * Alex/Sam only, missing speakers alternated, text cleaned, back-to-back
     * turns of one host merged; a one-host script is alternated. Null if unusable.
     * @param {unknown} input
     * @returns {Array<{speaker: 'Alex'|'Sam', text: string}>|null}
     */
    static normalizeDialogue(input) {
      if (!Array.isArray(input)) return null;
      const lines = [];
      for (const item of input) {
        if (!item || typeof item !== 'object') continue;
        const { text, prefixSpeaker } = PodcastScript.cleanSpokenText(item.text);
        if (!text) continue;
        lines.push({ speaker: PodcastScript.#mapSpeaker(item.speaker) ?? prefixSpeaker, text });
      }
      if (lines.length < 2) return null;

      let prev = null;
      const labeled = lines.map((l) => {
        const speaker = l.speaker ?? (prev ? (prev === 'Alex' ? 'Sam' : 'Alex') : 'Alex');
        prev = speaker;
        return { speaker, text: l.text };
      });

      const merged = [];
      for (const l of labeled) {
        const last = merged[merged.length - 1];
        if (last && last.speaker === l.speaker) last.text = `${last.text} ${l.text}`;
        else merged.push({ ...l });
      }

      const result = merged.length >= 4
        ? merged
        : labeled.map((l, i) => ({ speaker: i % 2 === 0 ? 'Alex' : 'Sam', text: l.text }));
      if (result.length < 4) return null;
      return result.slice(0, PodcastScript.MAX_TURNS).map((l) => ({
        speaker: l.speaker,
        text: l.text.length > TURN_MAX_CHARS * 2 ? `${l.text.slice(0, TURN_MAX_CHARS * 2)}…` : l.text
      }));
    }

    /** Parses the model's JSON (tolerates code fences and leading prose). */
    static parseJson(raw) {
      const stripped = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      try {
        return JSON.parse(stripped);
      } catch {
        const m = stripped.match(/\[[\s\S]*\]/);
        if (!m) return null;
        try { return JSON.parse(m[0]); } catch { return null; }
      }
    }

    /** One "Name: text" line per turn — the shape Gemini multi-speaker TTS expects. */
    static formatTtsScript(dialogue) {
      return dialogue.map((l) => `${l.speaker}: ${l.text}`).join('\n');
    }

    /** @see https://ai.google.dev/gemini-api/docs/speech-generation */
    static buildTtsPrompt(script) {
      return `TTS the following podcast conversation between Alex and Sam. Alex sounds warm, clear and confident; Sam sounds curious and upbeat. Natural pace, like two friends talking:\n\n${String(script).trim()}`;
    }

    static #languageRule(language) {
      const lang = String(language || '').trim();
      if (!lang || lang.toLowerCase() === 'auto') return 'Write the dialogue in the same language as the notes.';
      return `Write the dialogue in ${lang}.`;
    }

    /**
     * BYOK script prompt (the managed server builds the same one).
     * @param {string} language
     * @param {{a: {gender: string}, b: {gender: string}}} [voices]
     */
    static buildSystemPrompt(language, voices) {
      const who = (v) => (v?.gender === 'F' ? 'a woman' : v?.gender === 'M' ? 'a man' : null);
      const voiceNote = voices && who(voices.a) && who(voices.b)
        ? `\n- Alex is ${who(voices.a)} and Sam is ${who(voices.b)}; keep any gendered words consistent with that.`
        : '';
      return `You write a two-host podcast episode about ONE YouTube video, using the notes you are given (summary, key points and detailed analysis of the video).

HOSTS
- Alex explains: clear, warm, concrete.
- Sam is the listener's voice: asks the questions a smart listener would ask, asks for an example, sometimes pushes back, reacts briefly.${voiceNote}

CONTENT (most important)
- Cover EVERY key point in the notes, in a logical order. Keep the specific names, numbers, dates, tools, places and examples — they are what make the episode worth hearing.
- Discuss the ideas; do not read the notes out. Never copy a sentence from the notes word for word. For each main point, say why it matters and give one concrete example or consequence.
- Do not add facts that are not in the notes.
- First turn: what the video is about and why it is worth hearing. Last two turns: the two or three most important takeaways and a short sign-off.

FORMAT (breaking these breaks the audio)
- 10–14 turns, strictly alternating Alex, Sam, Alex, Sam… starting with Alex. One host per turn.
- Each turn is 1–3 spoken sentences (about 15–45 words).
- "speaker" is exactly "Alex" or "Sam".
- "text" is only what that host says out loud: no name prefix like "Alex:", no stage directions like (laughs) or [music], no markdown, no emoji, no line breaks.
- Words like "wow" or "that's wild" at most twice in the whole episode.

LANGUAGE
- ${PodcastScript.#languageRule(language)}
- Use correct native spelling; never attach the language's suffixes to foreign roots.

Respond with ONLY the JSON array, no code fences:
[{"speaker":"Alex","text":"..."},{"speaker":"Sam","text":"..."}]`;
    }

    /** Delivery per host — sent as metadata to the GA TTS model, never spoken. */
    static TTS_SPEAKER_STYLES = Object.freeze({
      Alex: 'warm, clear and confident podcast host, natural pace',
      Sam: 'curious and upbeat podcast co-host, natural pace'
    });

    /**
     * Interactions API body for Gemini 3.8 TTS (the server builds the same):
     * one text item per turn with speaker + style metadata, raw 24 kHz PCM.
     * @see https://ai.google.dev/gemini-api/docs/speech-generation
     */
    static buildInteractionsTtsRequest(dialogue, voices, model) {
      return {
        model,
        input: [{
          type: 'user_input',
          content: dialogue.map((l) => ({
            type: 'text',
            text: l.text,
            annotations: [{ type: 'speech_metadata', speaker: l.speaker, style: PodcastScript.TTS_SPEAKER_STYLES[l.speaker] }]
          }))
        }],
        response_format: { type: 'audio', mime_type: 'audio/l16', sample_rate: 24000 },
        generation_config: {
          speech_config: {
            mode: 'conversational',
            speakers: [
              { speaker: 'Alex', voice: voices.a },
              { speaker: 'Sam', voice: voices.b }
            ]
          }
        }
      };
    }

    /** Last model_output audio item and usage tokens from an Interactions response. */
    static extractInteractionsAudio(data) {
      let audio = null;
      for (const step of data?.steps ?? []) {
        if (step?.type !== 'model_output') continue;
        for (const c of step.content ?? []) if (c?.type === 'audio' && typeof c.data === 'string' && c.data) audio = c.data;
      }
      audio ??= typeof data?.output_audio?.data === 'string' && data.output_audio.data ? data.output_audio.data : null;
      if (!audio) return null;
      const n = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
      return { audioBase64: audio, tokensIn: n(data?.usage?.total_input_tokens), tokensOut: n(data?.usage?.total_output_tokens) };
    }

    static buildUserPrompt(notes) {
      return `Notes about the video:\n\n${String(notes || '').slice(0, PodcastScript.NOTES_MAX_CHARS)}`;
    }
  }

  globalThis.PodcastScript = PodcastScript;
})();
