/**
 * YouTube AI Summarizer - Service Worker (Background Script)
 * Handles Groq API calls, onboarding, and cross-component messaging
 */

// Import utilities (only storage.js needed — API calls are handled locally in this file)
importScripts('utils/storage.js');

const GROQ_API_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const OLLAMA_API_BASE = 'https://ollama.com/api/chat';
const GEMINI_TTS_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';
const MAX_RETRIES = 3;

/**
 * Language-aware system prompts.
 * The language instruction is appended dynamically.
 */
const SYSTEM_PROMPTS = {
  summary: `You are an expert video analyst. Given a YouTube video transcript, provide a thorough and well-structured summary in 3-5 paragraphs.

RULES:
- Include specific evidence mentioned in the video: names, dates, locations, statistics, scientific terms, and study references.
- Preserve cause-effect relationships (e.g. "Discovery X at location Y proved Z").
- Bold key terms, proper nouns, and important concepts.
- Do NOT generalize — be precise about claims and the evidence that supports them.
- NEVER end multiple paragraphs with the same concluding phrase. Vary sentence structures and endings.
- Use correct natural spelling in the target language. Do NOT create hybrid words by mixing languages (e.g. do not attach Turkish suffixes to English roots like "worldsünün" — use the proper native word).
- Use markdown formatting.`,

  keypoints: `You are an expert video analyst. Given a YouTube video transcript, extract 5-10 key points as a numbered list.

RULES:
- Each point MUST include the specific evidence, example, or data that supports it (names, dates, locations, numbers, scientific terms).
- Never repeat the same core idea across multiple points. If two points share an overlapping concept, merge them into one stronger statement.
- Prioritize unique insights: technical details, discoveries, studies, methodologies, or data over vague generalizations.
- Each point should convey genuinely distinct information.
- Use correct natural spelling in the target language. Do NOT create non-existent words by mixing languages.
- Use markdown formatting with a numbered list.`,

  detailed: `You are an expert video analyst. Given a YouTube video transcript, provide a comprehensive section-by-section analysis.

RULES:
- For each major topic or argument shift, provide a **bold section title** followed by a detailed paragraph.
- Include ALL technical details: specific names, dates, locations, scientific terms, methodologies, and experimental evidence.
- Do NOT skip evidence-based claims — if the video mentions a study, archaeological site, experiment, or statistic, it must appear in your analysis.
- Maintain the logical argument flow as presented in the video.
- NEVER use the same concluding phrase at the end of multiple paragraphs. Each paragraph must end with a unique, varied sentence.
- Use correct natural spelling in the target language. Do NOT invent hybrid words or attach foreign suffixes to English roots.
- End with a brief overall conclusion that ties the sections together.
- Use markdown formatting.`
};

/**
 * Build language instruction based on user preference
 */
function buildLanguageInstruction(language) {
  if (!language || language === 'auto') {
    return '\n\nLANGUAGE RULE: Detect the language of the transcript below. You MUST write your ENTIRE response — including all headers, section titles, bold text, and body — in that same language. If the transcript is in Turkish, everything must be in Turkish. Never use English words for section headings or key terms when a native equivalent exists. Never mix languages. Never fall back to English unless the transcript itself is in English.';
  }

  const langMap = {
    'English': 'You MUST respond entirely in English.',
    'Turkish': 'You MUST respond entirely in Turkish (Türkçe).',
    'Spanish': 'You MUST respond entirely in Spanish (Español).',
    'French': 'You MUST respond entirely in French (Français).',
    'German': 'You MUST respond entirely in German (Deutsch).',
    'Portuguese': 'You MUST respond entirely in Portuguese (Português).',
    'Japanese': 'You MUST respond entirely in Japanese (日本語).',
    'Korean': 'You MUST respond entirely in Korean (한국어).',
    'Chinese': 'You MUST respond entirely in Chinese (中文).',
    'Arabic': 'You MUST respond entirely in Arabic (العربية).',
    'Russian': 'You MUST respond entirely in Russian (Русский).',
    'Hindi': 'You MUST respond entirely in Hindi (हिन्दी).',
    'Italian': 'You MUST respond entirely in Italian (Italiano).',
    'Dutch': 'You MUST respond entirely in Dutch (Nederlands).',
    'Polish': 'You MUST respond entirely in Polish (Polski).',
    'Swedish': 'You MUST respond entirely in Swedish (Svenska).',
    'Indonesian': 'You MUST respond entirely in Indonesian (Bahasa Indonesia).',
    'Vietnamese': 'You MUST respond entirely in Vietnamese (Tiếng Việt).',
    'Thai': 'You MUST respond entirely in Thai (ภาษาไทย).',
    'Ukrainian': 'You MUST respond entirely in Ukrainian (Українська).'
  };

  return '\n\nLANGUAGE RULE: ' + (langMap[language] || `You MUST respond entirely in ${language}.`);
}

/**
 * Combined prompt — produces all three analyses in a single API call,
 * avoiding rate-limit issues caused by 3 rapid sequential requests.
 */
const COMBINED_PROMPT = `You are an expert video analyst. Analyze the given YouTube video transcript and produce THREE separate sections. You MUST use the EXACT delimiters shown below — they are required for parsing.

[SECTION:SUMMARY]
Write a thorough summary in 3-5 paragraphs.
- Include specific evidence: names, dates, locations, statistics, scientific terms.
- Preserve cause-effect relationships.
- Bold key terms and proper nouns.
- Do NOT generalize — be precise.

[SECTION:KEYPOINTS]
Extract 5-10 key points as a numbered list.
- Each point MUST include specific evidence or data that supports it.
- Never repeat the same core idea across points — merge overlapping items.
- Prioritize technical details, discoveries, and methodologies over vague generalizations.

[SECTION:DETAILED]
Provide a comprehensive section-by-section analysis.
- For each topic shift, give a **bold section title** and a detailed paragraph.
- Include ALL technical details: names, dates, scientific terms, methodologies, experimental evidence.
- Do NOT skip evidence-based claims.
- End with a brief conclusion.

QUALITY RULES (apply to ALL sections):
- Use markdown formatting throughout.
- NEVER end multiple paragraphs with the same phrase or conclusion. Vary your sentence endings.
- Use correct, natural spelling in the target language. Do NOT create hybrid words by mixing languages (e.g. do not attach Turkish suffixes to English roots).
- ALL text — including section titles, bold headers, and body — must be in the SAME language. No English headers if the content is in another language.`;

/**
 * Enable session storage access for content scripts
 */
try {
  chrome.storage.session?.setAccessLevel?.({
    accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
  });
} catch {
  // Ignore if not supported
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'summarizeAll') {
    handleSummarizeAll(message.data, sender.tab?.id)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err?.message || 'Unknown error' }));
    return true;
  }

  if (message.action === 'summarize') {
    handleSummarize(message.data, sender.tab?.id)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err?.message || 'Unknown error' }));
    return true;
  }

  if (message.action === 'validateApiKey') {
    validateKey(message.apiKey, message.provider || 'groq')
      .then(sendResponse)
      .catch((err) => sendResponse({ valid: false, error: err?.message || 'Unknown error' }));
    return true;
  }

  if (message.action === 'generatePodcast') {
    handleGeneratePodcast(message.data, sender.tab?.id)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err?.message || 'Unknown error' }));
    return true;
  }

  if (message.action === 'openSettings') {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
    sendResponse({ ok: true });
    return false;
  }

  if (message.action === 'fetchTranscript') {
    proxyFetchTranscript(message.url)
      .then(sendResponse)
      .catch(() => sendResponse({ entries: null }));
    return true;
  }

  if (message.action === 'fetchCaptionTracks') {
    proxyFetchCaptionTracks(message.videoId)
      .then(sendResponse)
      .catch(() => sendResponse({ tracks: null }));
    return true;
  }

  return false;
});

/**
 * Handle summarize request
 */
async function handleSummarize(data, tabId) {
  const { transcript, mode, language, videoId } = data;

  if (!transcript || transcript.trim().length === 0) {
    throw new Error('EMPTY_TRANSCRIPT');
  }

  const { provider, apiKey, model } = await getProviderConfig();
  if (!apiKey) {
    throw new Error('INVALID_API_KEY');
  }

  function sendProgress(text, progress) {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { action: 'progress', text, progress }).catch(() => {});
    }
  }

  sendProgress('Preparing AI request...', 0.3);

  const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.summary;
  const languageInstruction = buildLanguageInstruction(language);
  const maxChars = 24000;
  const chunks = chunkText(transcript, maxChars);

  if (chunks.length === 1) {
    sendProgress('AI is analyzing...', 0.5);

    const result = await callAI(provider, apiKey, model, [
      { role: 'system', content: systemPrompt + languageInstruction },
      { role: 'user', content: `Here is the video transcript:\n\n${chunks[0]}\n\nPlease analyze this transcript as instructed.` }
    ]);

    sendProgress('Done!', 1);
    return { content: result.content, model: result.model, provider };
  }

  const chunkSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    sendProgress(`Processing section ${i + 1}/${chunks.length}...`, 0.3 + (i / chunks.length) * 0.5);

    const chunkResult = await callAI(provider, apiKey, model, [
      { role: 'system', content: `You are summarizing part ${i + 1} of ${chunks.length} of a video transcript. Provide a concise summary of this section.${languageInstruction}` },
      { role: 'user', content: `Transcript section ${i + 1}/${chunks.length}:\n\n${chunks[i]}` }
    ]);
    chunkSummaries.push(chunkResult.content);
  }

  sendProgress('Combining sections...', 0.9);

  const combinedResult = await callAI(provider, apiKey, model, [
    { role: 'system', content: systemPrompt + languageInstruction },
    { role: 'user', content: `Here are summaries of different sections of a video transcript. Please combine them into a cohesive final analysis:\n\n${chunkSummaries.map((s, i) => `--- Section ${i + 1} ---\n${s}`).join('\n\n')}` }
  ]);

  sendProgress('Done!', 1);
  return { content: combinedResult.content, model: combinedResult.model, provider };
}

/**
 * Make a Groq API call with retry logic
 */
async function callGroqAPI(apiKey, model, messages, retryCount = 0, maxTokens = 2048) {
  try {
    const response = await fetch(GROQ_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        messages: messages,
        temperature: 0.3,
        max_tokens: maxTokens,
        top_p: 0.9
      })
    });

    if (response.status === 429) {
      if (retryCount < MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, retryCount);
        await new Promise((r) => setTimeout(r, delay));
        return callGroqAPI(apiKey, model, messages, retryCount + 1, maxTokens);
      }
      throw new Error('RATE_LIMITED');
    }

    if (response.status === 401) {
      throw new Error('INVALID_API_KEY');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API_ERROR: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage || {},
      model: data.model
    };
  } catch (error) {
    if (
      !['RATE_LIMITED', 'INVALID_API_KEY'].includes(error?.message) &&
      !error?.message?.startsWith('API_ERROR') &&
      retryCount < MAX_RETRIES
    ) {
      const delay = 1000 * Math.pow(2, retryCount);
      await new Promise((r) => setTimeout(r, delay));
      return callGroqAPI(apiKey, model, messages, retryCount + 1, maxTokens);
    }
    throw error;
  }
}

/**
 * Make an Ollama Cloud API call with retry logic
 */
async function callOllamaAPI(apiKey, model, messages, retryCount = 0, maxTokens = 2048) {
  try {
    const response = await fetch(OLLAMA_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gemini-3-flash-preview',
        messages,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          num_predict: maxTokens
        }
      })
    });

    if (response.status === 429) {
      if (retryCount < MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, retryCount);
        await new Promise((r) => setTimeout(r, delay));
        return callOllamaAPI(apiKey, model, messages, retryCount + 1, maxTokens);
      }
      throw new Error('RATE_LIMITED');
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error('INVALID_API_KEY');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API_ERROR: ${response.status} - ${errorData.error || 'Unknown error'}`
      );
    }

    const data = await response.json();
    return {
      content: data.message?.content || '',
      usage: {},
      model: data.model || model
    };
  } catch (error) {
    if (
      !['RATE_LIMITED', 'INVALID_API_KEY'].includes(error?.message) &&
      !error?.message?.startsWith('API_ERROR') &&
      retryCount < MAX_RETRIES
    ) {
      const delay = 1000 * Math.pow(2, retryCount);
      await new Promise((r) => setTimeout(r, delay));
      return callOllamaAPI(apiKey, model, messages, retryCount + 1, maxTokens);
    }
    throw error;
  }
}

/**
 * Unified AI call — routes to the correct provider
 */
async function callAI(provider, apiKey, model, messages, retryCount = 0, maxTokens = 2048) {
  if (provider === 'ollama') {
    return callOllamaAPI(apiKey, model, messages, retryCount, maxTokens);
  }
  return callGroqAPI(apiKey, model, messages, retryCount, maxTokens);
}

/**
 * Get active provider settings (provider, apiKey, model)
 */
async function getProviderConfig() {
  const settings = await StorageHelper.getSettings();
  const provider = settings.provider || 'groq';
  const apiKey = provider === 'ollama' ? settings.ollamaApiKey : settings.groqApiKey;
  const model = provider === 'ollama'
    ? (settings.ollamaModel || 'gemini-3-flash-preview')
    : (settings.model || 'llama-3.3-70b-versatile');
  return { provider, apiKey, model };
}

/**
 * Handle combined summarize request — generates Summary, Key Points, and
 * Detailed Analysis in a SINGLE API call to avoid rate-limiting.
 */
async function handleSummarizeAll(data, tabId) {
  const { transcript, language, videoId } = data;

  if (!transcript || transcript.trim().length === 0) {
    throw new Error('EMPTY_TRANSCRIPT');
  }

  const { provider, apiKey, model } = await getProviderConfig();
  if (!apiKey) {
    throw new Error('INVALID_API_KEY');
  }

  function sendProgress(text, progress) {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { action: 'progress', text, progress }).catch(() => {});
    }
  }

  sendProgress('Preparing AI request...', 0.2);

  const languageInstruction = buildLanguageInstruction(language);
  const maxChars = 80000;
  const chunks = chunkText(transcript, maxChars);

  let transcriptForAnalysis = transcript;

  if (chunks.length > 1) {
    sendProgress(`Processing ${chunks.length} sections in parallel...`, 0.25);

    const MAX_PARALLEL = 3;
    const chunkSummaries = new Array(chunks.length);

    for (let batch = 0; batch < chunks.length; batch += MAX_PARALLEL) {
      const batchSlice = chunks.slice(batch, batch + MAX_PARALLEL);
      const promises = batchSlice.map((chunk, j) => {
        const idx = batch + j;
        return callAI(provider, apiKey, model, [
          { role: 'system', content: `Summarize this part of a video transcript concisely, preserving all specific details (names, dates, locations, data, scientific terms).${languageInstruction}` },
          { role: 'user', content: `Part ${idx + 1}/${chunks.length}:\n\n${chunk}` }
        ]).then((r) => { chunkSummaries[idx] = r.content; });
      });

      await Promise.all(promises);
      const done = Math.min(batch + MAX_PARALLEL, chunks.length);
      sendProgress(`Processed ${done}/${chunks.length} sections...`, 0.2 + (done / chunks.length) * 0.3);
    }

    transcriptForAnalysis = chunkSummaries.map((s, i) => `--- Section ${i + 1} ---\n${s}`).join('\n\n');
  }

  sendProgress('AI is analyzing all modes...', 0.6);

  const result = await callAI(provider, apiKey, model, [
    { role: 'system', content: COMBINED_PROMPT + languageInstruction },
    { role: 'user', content: `Here is the video transcript:\n\n${transcriptForAnalysis}\n\nProduce all three analyses using the exact delimiters.` }
  ], 0, 6144);

  sendProgress('Done!', 1);

  const sections = parseCombinedResponse(result.content);

  return {
    summary: sections.summary,
    keypoints: sections.keypoints,
    detailed: sections.detailed,
    model: result.model,
    provider
  };
}

/**
 * Generate a NotebookLM-style two-host podcast script from summary text.
 * Returns a JSON array of dialogue lines: [{ speaker: "A"|"B", text: "..." }, ...]
 */
async function handleGeneratePodcast(data, tabId) {
  const { summaryText, language } = data;

  if (!summaryText || summaryText.trim().length === 0) {
    throw new Error('No summary available to generate podcast.');
  }

  const settings = await StorageHelper.getSettings();
  const geminiKey = settings.geminiApiKey;
  if (!geminiKey) throw new Error('GEMINI_KEY_MISSING');

  const { provider, apiKey, model } = await getProviderConfig();
  if (!apiKey) throw new Error('INVALID_API_KEY');

  function sendProgress(text, progress) {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { action: 'podcastProgress', text, progress }).catch(() => {});
    }
  }

  // Step 1: Generate podcast script via LLM
  sendProgress('Writing podcast script...', 0.2);

  const languageInstruction = buildLanguageInstruction(language);

  const podcastPrompt = `You are a podcast script writer. Convert the following video summary into a natural, engaging conversation between TWO podcast hosts.

HOST A ("Alex"): The knowledgeable host who explains the topic. Enthusiastic, clear, uses analogies.
HOST B ("Sam"): The curious co-host who asks smart questions, reacts with surprise/excitement, and adds witty comments.

RULES:
- Write 12-20 dialogue turns total (6-10 per host).
- Start with a warm intro: "Hey everyone, welcome back!" style.
- End with a brief wrap-up and sign-off.
- Keep it conversational and fun — use "wow", "that's wild", "wait, really?" naturally.
- Each line should be 1-3 sentences (speakable in 5-15 seconds).
- DO NOT use any markdown formatting. Plain text only.
- Host B should occasionally summarize what Host A said in simpler terms.
${languageInstruction}

You MUST respond with ONLY a valid JSON array. No markdown, no code fences, no explanation.
Format: [{"speaker":"Alex","text":"..."},{"speaker":"Sam","text":"..."},...]`;

  const result = await callAI(provider, apiKey, model, [
    { role: 'system', content: podcastPrompt },
    { role: 'user', content: `Here is the video summary to convert into a podcast conversation:\n\n${summaryText}` }
  ], 0, 4096);

  let dialogue;
  try {
    let raw = result.content.trim();
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    dialogue = JSON.parse(raw);
  } catch {
    const match = result.content.match(/\[[\s\S]*\]/);
    if (match) {
      try { dialogue = JSON.parse(match[0]); } catch { /* ignore */ }
    }
  }

  if (!Array.isArray(dialogue) || dialogue.length < 4) {
    throw new Error('Failed to generate podcast script. Please try again.');
  }

  // Step 2: Convert script to audio via Gemini TTS
  sendProgress('Generating audio with Gemini TTS...', 0.5);

  const ttsTranscript = dialogue.map(line => {
    const name = line.speaker === 'A' ? 'Alex' : (line.speaker === 'B' ? 'Sam' : line.speaker);
    return `${name}: ${line.text}`;
  }).join('\n');

  const ttsResponse = await fetch(`${GEMINI_TTS_BASE}?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: ttsTranscript }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: 'Alex',
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } }
              },
              {
                speaker: 'Sam',
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
              }
            ]
          }
        }
      }
    })
  });

  if (ttsResponse.status === 403) {
    throw new Error('GEMINI_REGION_BLOCKED');
  }

  if (ttsResponse.status === 429) {
    throw new Error('GEMINI_RATE_LIMITED');
  }

  if (!ttsResponse.ok) {
    const errData = await ttsResponse.json().catch(() => ({}));
    throw new Error(`GEMINI_TTS_ERROR: ${errData.error?.message || ttsResponse.status}`);
  }

  const ttsData = await ttsResponse.json();
  const audioBase64 = ttsData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!audioBase64) {
    throw new Error('Gemini TTS returned no audio data.');
  }

  sendProgress('Podcast ready!', 1);
  return { dialogue, audioBase64, model: result.model, provider };
}

/**
 * Parse combined AI response into three separate sections.
 * Uses a multi-strategy approach: exact delimiters → regex variants → heuristic headings.
 */
function parseCombinedResponse(text) {
  const result = { summary: '', keypoints: '', detailed: '' };
  if (!text || typeof text !== 'string') return result;

  const cleanText = text.replace(/\r\n/g, '\n');

  // Strategy 1: Exact delimiters
  const found = tryExactDelimiters(cleanText);
  if (found) return found;

  // Strategy 2: Regex — handles **[SECTION:SUMMARY]**, extra spaces, markdown wrapping
  const regexFound = tryRegexDelimiters(cleanText);
  if (regexFound) return regexFound;

  // Strategy 3: Heuristic heading detection (## Summary, ## Özet, etc.)
  const heuristicFound = tryHeuristicHeadings(cleanText);
  if (heuristicFound) return heuristicFound;

  // Final fallback: try to split text into thirds rather than duplicating
  const lines = cleanText.split('\n').filter(l => l.trim());
  const third = Math.ceil(lines.length / 3);
  result.summary   = lines.slice(0, third).join('\n').trim();
  result.keypoints = lines.slice(third, third * 2).join('\n').trim();
  result.detailed  = lines.slice(third * 2).join('\n').trim();

  return result;
}

function tryExactDelimiters(text) {
  const delimiters = [
    { key: 'summary',   tag: '[SECTION:SUMMARY]' },
    { key: 'keypoints', tag: '[SECTION:KEYPOINTS]' },
    { key: 'detailed',  tag: '[SECTION:DETAILED]' }
  ];

  const positions = delimiters
    .map((d) => ({ ...d, pos: text.indexOf(d.tag) }))
    .filter((d) => d.pos !== -1)
    .sort((a, b) => a.pos - b.pos);

  if (positions.length < 3) return null;

  const result = { summary: '', keypoints: '', detailed: '' };
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos + positions[i].tag.length;
    const end = i + 1 < positions.length ? positions[i + 1].pos : text.length;
    result[positions[i].key] = text.substring(start, end).trim();
  }
  return result;
}

function tryRegexDelimiters(text) {
  const patterns = [
    { key: 'summary',   re: /\*{0,2}\[?\s*SECTION\s*:\s*SUMMARY\s*\]?\*{0,2}/i },
    { key: 'keypoints', re: /\*{0,2}\[?\s*SECTION\s*:\s*KEYPOINTS?\s*\]?\*{0,2}/i },
    { key: 'detailed',  re: /\*{0,2}\[?\s*SECTION\s*:\s*DETAILED?\s*(ANALYSIS)?\s*\]?\*{0,2}/i }
  ];

  const positions = [];
  for (const p of patterns) {
    const m = text.match(p.re);
    if (m) positions.push({ key: p.key, pos: m.index, len: m[0].length });
  }

  if (positions.length < 3) return null;

  positions.sort((a, b) => a.pos - b.pos);
  const result = { summary: '', keypoints: '', detailed: '' };
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos + positions[i].len;
    const end = i + 1 < positions.length ? positions[i + 1].pos : text.length;
    result[positions[i].key] = text.substring(start, end).trim();
  }
  return result;
}

function tryHeuristicHeadings(text) {
  const headingGroups = [
    { key: 'summary',   words: ['summary', 'özet', 'resumen', 'résumé', 'zusammenfassung', 'resumo', '要約', '摘要'] },
    { key: 'keypoints', words: ['key points', 'keypoints', 'önemli noktalar', 'puntos clave', 'points clés', 'kernpunkte', 'pontos-chave', 'ポイント', '要点'] },
    { key: 'detailed',  words: ['detailed analysis', 'detaylı analiz', 'análisis detallado', 'analyse détaillée', 'detailanalyse', 'análise detalhada', '詳細分析', '详细分析'] }
  ];

  const positions = [];
  for (const g of headingGroups) {
    let bestPos = -1;
    let bestLen = 0;
    for (const word of g.words) {
      const re = new RegExp(`^#{1,3}\\s*${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'im');
      const m = text.match(re);
      if (m && (bestPos === -1 || m.index < bestPos)) {
        bestPos = m.index;
        bestLen = m[0].length;
      }
    }
    if (bestPos !== -1) positions.push({ key: g.key, pos: bestPos, len: bestLen });
  }

  if (positions.length < 2) return null;

  positions.sort((a, b) => a.pos - b.pos);
  const result = { summary: '', keypoints: '', detailed: '' };

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos + positions[i].len;
    const end = i + 1 < positions.length ? positions[i + 1].pos : text.length;
    result[positions[i].key] = text.substring(start, end).trim();
  }

  // Fill any missing section with the text before the first found heading
  const firstPos = positions[0].pos;
  if (firstPos > 0) {
    const preamble = text.substring(0, firstPos).trim();
    if (preamble && !result.summary) {
      result.summary = preamble;
    }
  }

  return result;
}

/**
 * Split text into chunks respecting sentence boundaries
 */
function chunkText(text, maxChars = 24000) {
  if (text.length <= maxChars) return [text];

  const chunks = [];
  // Split on sentence-like boundaries (period/exclamation/question followed by space)
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [];

  // Fallback: if no sentences found (e.g., no punctuation), split by newlines or fixed size
  if (sentences.length === 0) {
    for (let i = 0; i < text.length; i += maxChars) {
      chunks.push(text.substring(i, i + maxChars));
    }
    return chunks;
  }

  let currentChunk = '';
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Validate an API key
 */
async function validateKey(apiKey, provider = 'groq') {
  try {
    if (provider === 'ollama') {
      const result = await callOllamaAPI(apiKey, 'gemma3:4b', [
        { role: 'user', content: 'Say "ok"' }
      ]);
      return { valid: true, model: result.model };
    }
    const result = await callGroqAPI(apiKey, 'llama-3.1-8b-instant', [
      { role: 'user', content: 'Say "ok"' }
    ]);
    return { valid: true, model: result.model };
  } catch (error) {
    return { valid: false, error: error?.message || 'Unknown error' };
  }
}

// ─── Transcript proxy (runs in service worker — full host_permissions) ───

/**
 * Fetch transcript content from a caption track URL.
 * Service worker fetch avoids CORS / redirect issues that content scripts hit.
 */
async function proxyFetchTranscript(trackUrl) {
  const fetchOpts = { credentials: 'include' };

  // Try JSON3
  try {
    const url = new URL(trackUrl);
    url.searchParams.set('fmt', 'json3');
    const resp = await fetch(url.toString(), fetchOpts);
    if (resp.ok) {
      const data = await resp.json();
      if (data?.events) {
        const entries = data.events
          .filter((ev) => ev.segs)
          .map((ev) => {
            const startMs = ev.tStartMs || 0;
            const text = ev.segs.map((s) => s.utf8).join('').replace(/\n/g, ' ').trim();
            return { start: startMs / 1000, text };
          })
          .filter((e) => e.text.length > 0);
        if (entries.length > 0) return { entries };
      }
    }
  } catch { /* fall through to XML */ }

  // Try XML (DOMParser not available in SW, use regex)
  try {
    const resp = await fetch(trackUrl, fetchOpts);
    if (!resp.ok) return { entries: null };
    const text = await resp.text();
    const entries = [];
    const re = /<text[^>]+start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = parseFloat(m[1]);
      const content = m[2]
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n/g, ' ').trim();
      if (content.length > 0) entries.push({ start, text: content });
    }
    if (entries.length > 0) return { entries };
  } catch { /* ignore */ }

  return { entries: null };
}

/**
 * Fetch caption tracks for a video by loading the YouTube watch page
 * and extracting ytInitialPlayerResponse.
 */
async function proxyFetchCaptionTracks(videoId) {
  if (!videoId) return { tracks: null };

  // Method A: Innertube player API with ANDROID client
  // The ANDROID client returns timedtext URLs that actually work.
  // The WEB client now returns URLs with xowf=1 that yield empty responses.
  try {
    const resp = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '19.29.37',
            androidSdkVersion: 30,
            hl: 'en',
            gl: 'US'
          }
        },
        videoId
      })
    });
    if (resp.ok) {
      const data = await resp.json();
      const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (captionTracks?.length) {
        return {
          tracks: captionTracks.map((t) => ({
            baseUrl: t.baseUrl,
            language: t.languageCode,
            name: t.name?.simpleText || t.name?.runs?.[0]?.text || t.languageCode,
            isAutoGenerated: t.kind === 'asr',
            vssId: t.vssId
          }))
        };
      }
    }
  } catch { /* fall through */ }

  // Method B: Fetch the watch page HTML and extract player response
  try {
    const resp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      credentials: 'include',
      headers: {
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!resp.ok) return { tracks: null };
    const html = await resp.text();

    const marker = 'ytInitialPlayerResponse';
    const idx = html.indexOf(marker);
    if (idx !== -1) {
      const eqIdx = html.indexOf('=', idx + marker.length);
      if (eqIdx !== -1) {
        const playerResponse = extractBalancedJSONSW(html, eqIdx);
        if (playerResponse) {
          const captionTracks = playerResponse?.captions
            ?.playerCaptionsTracklistRenderer?.captionTracks;
          if (captionTracks?.length) {
            return {
              tracks: captionTracks.map((t) => ({
                baseUrl: t.baseUrl,
                language: t.languageCode,
                name: t.name?.simpleText || t.name?.runs?.[0]?.text || t.languageCode,
                isAutoGenerated: t.kind === 'asr',
                vssId: t.vssId
              }))
            };
          }
        }
      }
    }
  } catch { /* ignore */ }

  return { tracks: null };
}

/**
 * String-aware balanced JSON extraction (used in service worker context).
 */
function extractBalancedJSONSW(text, startIdx) {
  const jsonStart = text.indexOf('{', startIdx);
  if (jsonStart === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = jsonStart; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.substring(jsonStart, i + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
}

/**
 * Handle extension install/update - show onboarding
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome/welcome.html')
    });
  }

  // Enable session storage for content scripts
  try {
    chrome.storage.session?.setAccessLevel?.({
      accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
    });
  } catch {
    // Ignore
  }
});
