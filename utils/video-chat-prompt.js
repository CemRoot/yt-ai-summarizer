/**
 * VideoChatPrompt — chat rules for the YouTube "Chat" tab.
 *
 * Used by the service worker for the BYOK path and to clean the history sent
 * to the managed backend. The managed prompt lives on the server; keep the
 * HOW TO ANSWER / SCOPE rules in step with it.
 */
(() => {
  class VideoChatPrompt {

    static MAX_OUTPUT_TOKENS = 1024;
    static HISTORY_MAX_TURNS = 6;
    static HISTORY_MAX_CHARS_PER_TURN = 1000;

    /**
     * Keeps only user / AI turns from the panel cache (drops error bubbles),
     * the last HISTORY_MAX_TURNS of them, each clipped.
     * @param {Array<{role: string, text: string}>} messages
     * @returns {Array<{role: 'user'|'assistant', content: string}>}
     */
    static normalizeHistory(messages) {
      if (!Array.isArray(messages)) return [];
      const turns = [];
      for (const m of messages) {
        const role = m?.role === 'ai' || m?.role === 'assistant' ? 'assistant' : m?.role === 'user' ? 'user' : null;
        const content = String(m?.text ?? m?.content ?? '').trim();
        if (!role || !content) continue;
        turns.push({
          role,
          content: content.length > VideoChatPrompt.HISTORY_MAX_CHARS_PER_TURN
            ? `${content.slice(0, VideoChatPrompt.HISTORY_MAX_CHARS_PER_TURN)}…`
            : content
        });
      }
      return turns.slice(-VideoChatPrompt.HISTORY_MAX_TURNS);
    }

    /**
     * @param {string} language  'auto' or a language name from settings
     * @returns {string}
     */
    static languageRule(language) {
      const lang = String(language || '').trim();
      if (!lang || lang.toLowerCase() === 'auto') {
        return "Reply in the same language as the user's latest question (not the transcript's language if they differ).";
      }
      return `Reply in ${lang}.`;
    }

    /**
     * @param {string} language
     * @param {string} transcript  already truncated by the caller
     * @returns {string}
     */
    static buildSystemPrompt(language, transcript) {
      return `You are Gleano's chat assistant for ONE YouTube video the user is watching. They ask about the video, its topic, or practical follow-ups ("can I do X instead?", "what does Y mean?", "is this worth it for me?").

HOW TO ANSWER
1. Answer the actual question in your FIRST sentence: a direct answer (yes / no / it depends, plus the main reason). No greeting, no "this video is about…" intro, no restating the question.
2. The transcript is your primary source. When it covers the question, ground the answer in what the speaker says, briefly.
3. When the transcript does not cover it but the question relates to the video's topic, answer from reliable general knowledge and flag it in one short clause (e.g. "The video doesn't cover this, but in general…"). Never claim the video says something it does not. Never call something impossible only because the video did not mention it.
4. Be concise: 2–5 sentences, or up to 5 short bullets — about 120 words at most. Go longer only when the user asks for detail, steps or a full list.
5. No closing pleasantries and no "anything else?" questions.
6. Formatting: plain sentences, **bold** only for a key term or two, "- " bullets with no blank lines between them. No headings.

SCOPE
- In scope: this video, its topic, and practical questions related to it.
- Out of scope: unrelated tasks (writing code or essays, homework, translating unrelated text, general chit-chat). Answer those with ONE short sentence that you can help with this video and its topic.
- Greeting only ("hi", "how can you help?"): one sentence on what the video covers, then one concrete example question.
- If a question needs current facts (prices, latest versions, news) you are not sure about, say so briefly instead of guessing.

LANGUAGE
- ${VideoChatPrompt.languageRule(language)}
- Use correct native spelling; never attach the language's suffixes to foreign roots.

--- VIDEO TRANSCRIPT ---
${transcript}
------------------------`;
    }
  }

  globalThis.VideoChatPrompt = VideoChatPrompt;
})();
