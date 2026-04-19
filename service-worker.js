/**
 * YouTube AI Summarizer - Service Worker (Background Script)
 * Handles Groq API calls, onboarding, and cross-component messaging
 */

importScripts('utils/storage.js', 'utils/auth-debug-log.js', 'utils/supabase-auth.js', 'utils/api-client.js');

// Production uninstall page: hosted on developer domain (Vercel). Source file in
// repo: docs/uninstall.html — copy to portfolio public/yt-ai-summarizer/ when it changes.
const UNINSTALL_FEEDBACK_URL = 'https://cemkoyluoglu.codes/yt-ai-summarizer/uninstall.html';
chrome.runtime.setUninstallURL(UNINSTALL_FEEDBACK_URL);

const GROQ_API_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const OLLAMA_API_BASE = 'https://ollama.com/api/chat';
/** @see https://ai.google.dev/gemini-api/docs/speech-generation — preview TTS model id for generateContent */
const GEMINI_TTS_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';
const MAX_RETRIES = 3;

/**
 * When Edge `check-credits` returns a new plan/credits snapshot, persist to
 * `chrome.storage.local` and bump `ytai_panel_auth_sync_nonce` so open YouTube
 * tabs run `#refreshPanelAuthAndCredits` without F5 (e.g. after Stripe Pro upgrade
 * while popup calls `checkCredits` but the panel still read stale `credits: 0`).
 * @param {object|undefined|null} data
 */
async function syncManagedCreditsToStorageIfChanged(data) {
  if (!data || data.error || typeof data.plan !== 'string') return;
  try {
    const prev = await StorageHelper.getSettings();
    const prevPlan = String(prev.userPlan || 'anonymous').toLowerCase();
    const nextPlan = String(data.plan || 'free').toLowerCase();
    const prevCred = typeof prev.credits === 'number' ? prev.credits : -999_000;
    const nextCred = typeof data.credits === 'number' ? data.credits : prevCred;
    if (prevPlan === nextPlan && prevCred === nextCred) return;
    const r = await StorageHelper.saveSettings({
      credits: data.credits,
      userPlan: data.plan,
    });
    if (r?.ok !== false) await StorageHelper.bumpPanelAuthSyncNonce();
  } catch (e) {
    console.warn('[YTAI] syncManagedCreditsToStorageIfChanged:', e?.message || e);
  }
}

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
 * Sample start/middle/end of transcript — avoids timestamp-heavy prefixes skewing counts.
 * Returns { arabic, latin, cjk } tallies over merged sample.
 */
function countScriptRuns(text) {
  const t = text || '';
  if (t.length < 20) return { arabic: 0, latin: 0, cjk: 0, total: 0 };
  const L = 4000;
  const chunks = [
    t.slice(0, L),
    t.slice(Math.max(0, Math.floor(t.length / 2) - L / 2), Math.floor(t.length / 2) + L / 2),
    t.slice(Math.max(0, t.length - L))
  ];
  const slice = chunks.join('\n');
  let arabic = 0;
  let latin = 0;
  let cjk = 0;
  for (let i = 0; i < slice.length; i++) {
    const c = slice.charCodeAt(i);
    if (c >= 0x0600 && c <= 0x06FF) arabic++;
    else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) latin++;
    else if (c >= 0x4E00 && c <= 0x9FFF) cjk++;
  }
  return { arabic, latin, cjk, total: arabic + latin + cjk };
}

/**
 * Auto mode: infer dominant script so we can lock output (fixes models defaulting to Arabic on English video).
 */
function inferAutoScript(transcriptSample) {
  const { arabic, latin, cjk, total } = countScriptRuns(transcriptSample);
  if (total < 12) return 'unknown';
  if (arabic >= latin && arabic >= cjk && arabic >= total * 0.04) return 'arabic';
  if (cjk >= latin * 0.9 && cjk >= total * 0.08) return 'cjk';
  if (latin >= arabic * 1.2 && latin >= 25) return 'latin';
  if (latin > arabic * 2 && latin > total * 0.06) return 'latin';
  return 'unknown';
}

/**
 * Build language instruction based on user preference
 * @param {string} language - setting from storage (e.g. 'auto', 'Turkish', 'English')
 * @param {string} [transcriptSample] - optional text for auto-mode script detection
 */
function buildLanguageInstruction(language, transcriptSample) {
  if (!language || language === 'auto') {
    const script = inferAutoScript(transcriptSample || '');
    if (script === 'latin') {
      return '\n\nLANGUAGE RULE (MANDATORY): The transcript sample uses Latin letters, not Arabic. Write your COMPLETE response in the same spoken language as the transcript (e.g. English for English audio). Do NOT use Arabic script or RTL. Never default to Arabic for Latin-script content. Match headings and body to the transcript language.';
    }
    if (script === 'arabic') {
      return '\n\nLANGUAGE RULE (MANDATORY): The transcript is Arabic script. Write your ENTIRE response in Arabic. Match the register of the transcript.';
    }
    if (script === 'cjk') {
      return '\n\nLANGUAGE RULE (MANDATORY): The transcript is mostly Chinese characters. Write your ENTIRE response in Chinese unless the content is clearly Japanese.';
    }
    return '\n\nLANGUAGE RULE (MANDATORY): Detect the transcript\'s language from the text. Respond ENTIRELY in that language. Do not switch to Arabic unless the transcript is Arabic script.';
  }

  const langMap = {
    'English':    'Respond ENTIRELY in English. Every title, header, and sentence must be in English.',
    'Turkish':    'Yanıtın TAMAMEN Türkçe olmalı. Her başlık, her cümle Türkçe olmalıdır. Respond ENTIRELY in Turkish (Türkçe).',
    'Spanish':    'Responde COMPLETAMENTE en español. Respond ENTIRELY in Spanish (Español).',
    'French':     'Répondez ENTIÈREMENT en français. Respond ENTIRELY in French (Français).',
    'German':     'Antworten Sie VOLLSTÄNDIG auf Deutsch. Respond ENTIRELY in German (Deutsch).',
    'Portuguese': 'Responda INTEIRAMENTE em português. Respond ENTIRELY in Portuguese (Português).',
    'Japanese':   '回答は全て日本語で。Respond ENTIRELY in Japanese (日本語).',
    'Korean':     '모든 응답을 한국어로. Respond ENTIRELY in Korean (한국어).',
    'Chinese':    '请全部用中文回答。Respond ENTIRELY in Chinese (中文).',
    'Arabic':     'أجب بالكامل بالعربية. Respond ENTIRELY in Arabic (العربية).',
    'Russian':    'Отвечайте полностью на русском. Respond ENTIRELY in Russian (Русский).',
    'Hindi':      'पूरा उत्तर हिन्दी में दें। Respond ENTIRELY in Hindi (हिन्दी).',
    'Italian':    'Rispondi INTERAMENTE in italiano. Respond ENTIRELY in Italian (Italiano).',
    'Dutch':      'Antwoord VOLLEDIG in het Nederlands. Respond ENTIRELY in Dutch (Nederlands).',
    'Polish':     'Odpowiedz CAŁKOWICIE po polsku. Respond ENTIRELY in Polish (Polski).',
    'Swedish':    'Svara HELT på svenska. Respond ENTIRELY in Swedish (Svenska).',
    'Indonesian': 'Jawab SELURUHNYA dalam Bahasa Indonesia. Respond ENTIRELY in Indonesian.',
    'Vietnamese': 'Trả lời HOÀN TOÀN bằng tiếng Việt. Respond ENTIRELY in Vietnamese.',
    'Thai':       'ตอบทั้งหมดเป็นภาษาไทย Respond ENTIRELY in Thai (ภาษาไทย).',
    'Ukrainian':  'Відповідайте ПОВНІСТЮ українською. Respond ENTIRELY in Ukrainian (Українська).'
  };

  return '\n\nLANGUAGE RULE (MANDATORY): ' + (langMap[language] || `You MUST respond ENTIRELY in ${language}. Every title, header, and sentence must be in ${language}.`);
}

/**
 * Combined prompt — produces all three analyses in a single API call,
 * avoiding rate-limit issues caused by 3 rapid sequential requests.
 */
const COMBINED_PROMPT = `You are an expert video analyst. Analyze the given YouTube video transcript and produce THREE separate sections. You MUST use the EXACT delimiters shown below — they are required for parsing.

[SECTION:SUMMARY]
Write a CONCISE overview — the goal is to save the reader time.
- Maximum 2-3 short paragraphs (roughly 100-200 words total for a typical video).
- Focus on: what is the video about, what are the main conclusions/takeaways, and why it matters.
- Bold only the most important terms.
- Do NOT include every detail — that belongs in the Detailed section.
- Think of this as an executive summary: someone should understand the core message in under 30 seconds of reading.

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
- This section should be thorough and lengthy — it is where all the details belong.

QUALITY RULES (apply to ALL sections):
- Use markdown formatting throughout.
- NEVER end multiple paragraphs with the same phrase or conclusion. Vary your sentence endings.
- Use correct, natural spelling in the target language. Do NOT create hybrid words by mixing languages (e.g. do not attach Turkish suffixes to English roots).
- ALL text — including section titles, bold headers, and body — must be in the SAME language. No English headers if the content is in another language.
- IMPORTANT: The Summary section must be SIGNIFICANTLY shorter than the Detailed section. If the summary is longer than ~200 words, you are doing it wrong.`;

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
/**
 * Serialize an Error (including typed ApiError) into a plain object the
 * content script can consume. Propagates known structured fields
 * (errorCode, upgradeUrl, estimatedCredits/availableCredits for
 * INSUFFICIENT_CREDITS pre-flight) so the UI can show targeted messages.
 */
function serializeError(err) {
  const resp = { error: err?.message || 'Unknown error' };
  if (err?.code) resp.errorCode = err.code;
  if (err?.upgradeUrl) resp.upgradeUrl = err.upgradeUrl;
  if (typeof err?.estimatedCredits === 'number') resp.estimated_credits = err.estimatedCredits;
  if (typeof err?.availableCredits === 'number') resp.available_credits = err.availableCredits;
  return resp;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  if (message.action === 'summarizeAll') {
    handleSummarizeAll(message.data, sender.tab?.id)
      .then(sendResponse)
      .catch((err) => sendResponse(serializeError(err)));
    return true;
  }

  if (message.action === 'summarize') {
    handleSummarize(message.data, sender.tab?.id)
      .then(sendResponse)
      .catch((err) => sendResponse(serializeError(err)));
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
      .catch((err) => sendResponse(serializeError(err)));
    return true;
  }

  if (message.action === 'chatWithVideo') {
    handleChatWithVideo(message.data)
      .then(sendResponse)
      .catch((err) => sendResponse(serializeError(err)));
    return true;
  }

  if (message.action === 'openSettings') {
    chrome.action.openPopup()
      .then(() => sendResponse({ ok: true }))
      .catch(() => {
        chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') })
          .then(() => sendResponse({ ok: true }))
          .catch(() => sendResponse({ ok: false }));
      });
    return true;
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

  // ─── Supabase Auth actions ──────────────────────────────────────

  if (message.action === 'supabaseSignIn') {
    SupabaseAuth.getInstance().signIn()
      .then(async (session) => {
        try {
          const fingerprint = await StorageHelper.getPersistentAuthDeviceId();
          await ApiClient.getInstance().callAuthCallback(fingerprint);
        } catch (e) {
          console.warn('[YTAI] auth-callback failed after sign-in:', e?.message || e);
          AuthDebugLogger.log('warn', 'postSignIn', 'auth-callback failed', e?.message || String(e)).catch(() => {});
        }
        const credits = await ApiClient.getInstance().checkCredits().catch((e) => {
          console.warn('[YTAI] checkCredits failed after sign-in:', e?.message || e);
          AuthDebugLogger.log('warn', 'postSignIn', 'checkCredits failed', e?.message || String(e)).catch(() => {});
          return null;
        });
        const cachedSession = StorageHelper.sanitizeSessionForCache(session);
        chrome.storage.session.set({ ytai_popup_cache: { session: cachedSession, credits } }).catch(() => {});
        await StorageHelper.bumpPanelAuthSyncNonce().catch(() => {});
        sendResponse({ session, credits });
      })
      .catch(async (err) => {
        const msg = err?.message || 'Sign in failed';
        // Do not AuthDebugLogger.log here: signIn() already recorded the failure (avoids duplicate tail + Errors UI noise).
        const tail = await AuthDebugLogger.getTail(25);
        sendResponse({
          error: msg,
          authDebugTail: AuthDebugLogger.formatTail(tail),
        });
      });
    return true;
  }

  if (message.action === 'getAuthDebugLog') {
    AuthDebugLogger.getTail(message.limit || 40)
      .then((entries) => sendResponse({ tail: AuthDebugLogger.formatTail(entries), entries }))
      .catch(() => sendResponse({ tail: '', entries: [] }));
    return true;
  }

  if (message.action === 'supabaseSignOut') {
    SupabaseAuth.getInstance().signOut()
      .then(async () => {
        chrome.storage.session.remove('ytai_popup_cache').catch(() => {});
        await StorageHelper.bumpPanelAuthSyncNonce().catch(() => {});
        sendResponse({ ok: true });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.action === 'supabaseGetSession') {
    SupabaseAuth.getInstance().getSession()
      .then(async (session) => {
        if (!session) {
          chrome.storage.session.remove('ytai_popup_cache').catch(() => {});
          sendResponse({ session: null, credits: null });
          return;
        }
        try {
          const fingerprint = await StorageHelper.getPersistentAuthDeviceId();
          await ApiClient.getInstance().callAuthCallback(fingerprint);
        } catch (e) {
          console.warn('[YTAI] auth-callback failed on getSession:', e?.message || e);
        }
        const credits = await ApiClient.getInstance().checkCredits().catch((e) => {
          console.warn('[YTAI] checkCredits failed on getSession:', e?.message || e);
          return null;
        });
        const cachedSession = StorageHelper.sanitizeSessionForCache(session);
        chrome.storage.session.set({ ytai_popup_cache: { session: cachedSession, credits } }).catch(() => {});
        void syncManagedCreditsToStorageIfChanged(credits);
        sendResponse({ session, credits });
      })
      .catch(() => sendResponse({ session: null, credits: null }));
    return true;
  }

  if (message.action === 'checkCredits') {
    ApiClient.getInstance().checkCredits()
      .then((data) => {
        sendResponse(data);
        void syncManagedCreditsToStorageIfChanged(data);
      })
      .catch((err) => sendResponse({ error: err?.message || 'Failed' }));
    return true;
  }

  if (message.action === 'openCheckout') {
    (async () => {
      try {
        const session = await SupabaseAuth.getInstance().getSession();
        const userId = session?.user?.id || '';
        const email = session?.user?.email || '';
        const plan = message.plan || 'yearly';

        let links = {};
        try {
          const cred = await ApiClient.getInstance().checkCredits();
          if (cred?.checkout_monthly) links.monthly = cred.checkout_monthly;
          if (cred?.checkout_yearly) links.yearly = cred.checkout_yearly;
        } catch { /* use fallback */ }

        let url = links[plan] || links.yearly;
        if (!url) {
          sendResponse({ error: 'Checkout link unavailable. Please try again.' });
          return;
        }
        const params = new URLSearchParams();
        if (userId) params.set('client_reference_id', userId);
        if (email) params.set('prefilled_email', email);
        const qs = params.toString();
        if (qs) url += `?${qs}`;
        await chrome.tabs.create({ url });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ error: err?.message || 'Failed to open checkout' });
      }
    })();
    return true;
  }

  if (message.action === 'openPortal') {
    (async () => {
      try {
        const session = await SupabaseAuth.getInstance().getSession();
        if (!session) {
          sendResponse({ error: 'Not signed in' });
          return;
        }
        const data = await ApiClient.getInstance().createPortalSession();
        if (data?.url) {
          await chrome.tabs.create({ url: data.url });
          sendResponse({ ok: true });
        } else {
          sendResponse({ error: data?.error || 'No portal URL returned' });
        }
      } catch (err) {
        sendResponse({ error: err?.message || 'Failed to open portal' });
      }
    })();
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

  function sendProgress(text, progress) {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { action: 'progress', text, progress }).catch(() => {});
    }
  }

  // ── Try managed mode first ───────────────────────────────────────
  const managed = await getManagedMode();

  if (managed.managed) {
    sendProgress('Preparing managed AI...', 0.3);
    try {
      sendProgress('AI is analyzing...', 0.5);
      const edgeResult = await ApiClient.getInstance().summarize({
        videoId,
        transcript,
        action: mode || 'summary',
        language: language || 'auto',
      });
      sendProgress('Done!', 1);
      return {
        content: edgeResult.result || edgeResult.content || '',
        model: edgeResult.provider || 'managed',
        provider: 'managed',
        credits_remaining: edgeResult.credits_remaining,
        credits_used: edgeResult.credits_used,
        plan: managed.credits?.plan || 'pro',
      };
    } catch (err) {
      if (err?.code === 'NO_CREDITS' || err?.code === 'INSUFFICIENT_CREDITS' || err?.code === 'RATE_LIMITED' || err?.code === 'AI_QUOTA_EXCEEDED') {
        const { apiKey } = await getProviderConfig();
        if (apiKey) {
          sendProgress('Switching to your API key...', 0.25);
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }
  }

  // ── BYOK fallback ───────────────────────────────────────────────
  const { provider, apiKey, model } = await getProviderConfig();
  await requireByokApiKeyForProvider(managed, provider, apiKey);

  sendProgress('Preparing AI request...', 0.3);

  const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.summary;
  const languageInstruction = buildLanguageInstruction(language, transcript);
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
 * Bearer tokens in `fetch` headers must be ISO-8859-1; Unicode (e.g. Turkish ı, emoji) throws an opaque DOMException.
 * @param {string} apiKey
 * @param {'groq'|'ollama'} provider
 */
function assertBearerKeyLatin1(apiKey, provider) {
  if (typeof apiKey !== 'string' || apiKey.length === 0) return;
  const label = provider === 'ollama' ? 'Ollama' : 'Groq';
  for (let i = 0; i < apiKey.length; i += 1) {
    if (apiKey.charCodeAt(i) > 0xff) {
      throw new Error(
        `API_KEY_HEADER: ${label} API key contains a character that cannot be used in HTTP headers (non-Latin). `
        + 'Remove letters like Turkish ı/ş, emoji, or other Unicode; use only the plain characters from your provider.'
      );
    }
  }
}

/** Turn fetch / header errors into a short user-facing string for validate-key UI. */
function friendlyApiKeyOrRequestError(err, provider = 'groq') {
  const raw = String(err?.message || err || '');
  if (raw.startsWith('API_KEY_HEADER:')) {
    return raw.slice('API_KEY_HEADER:'.length).trim();
  }
  if (
    /non ISO-8859-1|ISO-8859-1 code point|headers.*RequestInit|WorkerGlobalScope.*fetch|Invalid value.*Headers?/i.test(raw)
  ) {
    const who = provider === 'ollama' ? 'Ollama' : 'Groq';
    return (
      `${who} key contains characters that cannot be sent in a secure request (Unicode letters, emoji, or odd symbols). `
      + 'Use only Latin letters, digits, and punctuation as shown in the key from your provider.'
    );
  }
  return raw || 'Unknown error';
}

/**
 * Make a Groq API call with retry logic
 */
async function callGroqAPI(apiKey, model, messages, retryCount = 0, maxTokens = 2048) {
  try {
    assertBearerKeyLatin1(apiKey, 'groq');
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
    if (String(error?.message || '').startsWith('API_KEY_HEADER:')) throw error;
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
    assertBearerKeyLatin1(apiKey, 'ollama');
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
    if (String(error?.message || '').startsWith('API_KEY_HEADER:')) throw error;
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
 * Determine if the current session supports managed AI (Edge Function).
 * Returns { managed: true, session } or { managed: false }.
 */
async function getManagedMode() {
  try {
    const session = await SupabaseAuth.getInstance().getSession();
    if (!session) return { managed: false };
    let credits = null;
    try {
      credits = await ApiClient.getInstance().checkCredits();
    } catch (e) { /* credits check failed */ }
    if (credits && credits.can_use) {
      return { managed: true, session, credits };
    }
    return { managed: false, credits };
  } catch (outerErr) {
    return { managed: false };
  }
}

/**
 * When managed AI is off and the user has no BYOK key, pick NO_CREDITS / RATE_LIMITED / INVALID_API_KEY.
 * Mirrors summarize paths — chat previously skipped this and misreported exhausted credits as invalid key.
 * @param {{ credits?: { rate_limited?: boolean, can_use?: boolean, credits?: number } }} mode
 */
function buildNoByokKeyError(mode) {
  if (mode.credits?.rate_limited) {
    const e = new Error('Too many requests. Please wait before trying again.');
    e.code = 'RATE_LIMITED';
    return e;
  }
  if (mode.credits && mode.credits.can_use === false && mode.credits.credits <= 0) {
    const e = new Error('Free credits exhausted.');
    e.code = 'NO_CREDITS';
    return e;
  }
  return new Error('INVALID_API_KEY');
}

/**
 * BYOK path: require a key for the *selected* text provider. If another provider’s key exists
 * but this one is empty, throw PROVIDER_KEY_MISSING (clear UX) instead of NO_CREDITS from
 * {@link buildNoByokKeyError}.
 * @param {{ credits?: object }} mode from {@link getManagedMode}
 * @param {'groq'|'ollama'} provider
 * @param {string|undefined} apiKey
 */
async function requireByokApiKeyForProvider(mode, provider, apiKey) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (key) {
    if (provider === 'groq' && !key.startsWith('gsk_')) {
      const e = new Error(
        'Groq API keys must start with gsk_. Paste a valid key in extension settings or switch provider.'
      );
      e.code = 'API_KEY_INVALID';
      throw e;
    }
    return;
  }
  let hasOther = false;
  try {
    hasOther = await StorageHelper.hasAnyByokApiKey();
  } catch { /* ignore */ }
  if (hasOther) {
    const e = new Error(
      provider === 'groq'
        ? 'Groq API key is missing. Add your Groq key in Settings, or switch to Ollama Cloud if you use that key.'
        : 'Ollama Cloud API key is missing. Add your key in Settings, or switch to Groq if you use that provider.'
    );
    e.code = 'PROVIDER_KEY_MISSING';
    throw e;
  }
  throw buildNoByokKeyError(mode);
}

/**
 * Parse Edge Function summarize response (uses === delimiters).
 */
function parseManagedResponse(text) {
  const result = { summary: '', keypoints: '', detailed: '' };
  if (!text) return result;

  const delimiters = [
    { key: 'summary',   tag: '===SUMMARY===' },
    { key: 'keypoints', tag: '===KEYPOINTS===' },
    { key: 'detailed',  tag: '===DETAILED===' }
  ];

  const positions = delimiters
    .map(d => ({ ...d, pos: text.indexOf(d.tag) }))
    .filter(d => d.pos !== -1)
    .sort((a, b) => a.pos - b.pos);

  if (positions.length >= 2) {
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].pos + positions[i].tag.length;
      const end = i + 1 < positions.length ? positions[i + 1].pos : text.length;
      result[positions[i].key] = text.substring(start, end).trim();
    }
    return result;
  }

  return parseCombinedResponse(text);
}

/**
 * Handle combined summarize request — generates Summary, Key Points, and
 * Detailed Analysis in a SINGLE API call to avoid rate-limiting.
 *
 * Routing: authenticated + credits → managed AI (Edge Function);
 * otherwise → BYOK (Groq/Ollama direct).
 */
async function handleSummarizeAll(data, tabId) {
  const { transcript, language, videoId } = data;

  if (!transcript || transcript.trim().length === 0) {
    throw new Error('EMPTY_TRANSCRIPT');
  }

  function sendProgress(text, progress) {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { action: 'progress', text, progress }).catch(() => {});
    }
  }

  // ── Try managed mode first ───────────────────────────────────────
  const mode = await getManagedMode();

  if (mode.managed) {
    sendProgress('Preparing managed AI...', 0.2);

    try {
      sendProgress('AI is analyzing...', 0.5);
      const edgeResult = await ApiClient.getInstance().summarize({
        videoId,
        transcript,
        action: 'summary',
        language: language || 'auto',
      });

      sendProgress('Done!', 1);
      const sections = parseManagedResponse(edgeResult.result);

      return {
        summary: sections.summary,
        keypoints: sections.keypoints,
        detailed: sections.detailed,
        model: edgeResult.provider,
        provider: 'managed',
        credits_remaining: edgeResult.credits_remaining,
        credits_used: edgeResult.credits_used,
        plan: mode?.credits?.plan || 'pro',
      };
    } catch (err) {
      if (err?.code === 'NO_CREDITS' || err?.code === 'INSUFFICIENT_CREDITS' || err?.code === 'RATE_LIMITED' || err?.code === 'AI_QUOTA_EXCEEDED') {
        const { apiKey } = await getProviderConfig();
        if (apiKey) {
          sendProgress('Switching to your API key...', 0.25);
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }
  }

  // ── BYOK fallback (original flow) ────────────────────────────────
  const { provider, apiKey, model } = await getProviderConfig();
  await requireByokApiKeyForProvider(mode, provider, apiKey);

  sendProgress('Preparing AI request...', 0.2);

  const languageInstruction = buildLanguageInstruction(language, transcript);
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
 * Returns a JSON array of dialogue lines: [{ speaker: "Alex"|"Sam", text: "..." }, ...].
 * Legacy models may emit "A"|"B"; the TTS step maps those to Alex/Sam for Gemini multi-speaker config.
 */
/*
 * Verified voice list from Google Cloud official docs:
 * https://cloud.google.com/text-to-speech/docs/gemini-tts
 * https://github.com/GoogleCloudPlatform/generative-ai/blob/main/audio/speech/getting-started/get_started_with_gemini_tts_voices.ipynb
 *
 * Female: Achernar, Aoede, Autonoe, Callirrhoe, Despina, Erinome, Gacrux, Kore, Laomedeia, Leda, Pulcherrima, Sulafat, Vindemiatrix, Zephyr
 * Male:   Achird, Algenib, Algieba, Alnilam, Charon, Enceladus, Fenrir, Iapetus, Orus, Puck, Rasalgethi, Sadachbia, Sadaltager, Schedar, Umbriel, Zubenelgenubi
 */
const VOICE_PAIRS = [
  { a: { name: 'Charon',  gender: 'M' }, b: { name: 'Puck',    gender: 'M' } },
  { a: { name: 'Kore',    gender: 'F' }, b: { name: 'Puck',    gender: 'M' } },
  { a: { name: 'Charon',  gender: 'M' }, b: { name: 'Aoede',   gender: 'F' } },
  { a: { name: 'Kore',    gender: 'F' }, b: { name: 'Aoede',   gender: 'F' } },
  { a: { name: 'Fenrir',  gender: 'M' }, b: { name: 'Leda',    gender: 'F' } },
  { a: { name: 'Leda',    gender: 'F' }, b: { name: 'Orus',    gender: 'M' } },
  { a: { name: 'Orus',    gender: 'M' }, b: { name: 'Kore',    gender: 'F' } },
  { a: { name: 'Zephyr',  gender: 'F' }, b: { name: 'Charon',  gender: 'M' } },
  { a: { name: 'Fenrir',  gender: 'M' }, b: { name: 'Zephyr',  gender: 'F' } },
  { a: { name: 'Aoede',   gender: 'F' }, b: { name: 'Fenrir',  gender: 'M' } },
];

function pickVoicePair() {
  return VOICE_PAIRS[Math.floor(Math.random() * VOICE_PAIRS.length)];
}

function hostLabel(voice) {
  return voice.gender === 'F' ? 'she' : 'he';
}

async function handleGeneratePodcast(data, tabId) {
  const { summaryText, language, videoId } = data;

  if (!summaryText || summaryText.trim().length === 0) {
    throw new Error('No summary available to generate podcast.');
  }

  const voices = pickVoicePair();

  function sendProgress(text, progress) {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { action: 'podcastProgress', text, progress }).catch(() => {});
    }
  }

  // ── Try managed mode first ───────────────────────────────────────
  const mode = await getManagedMode();

  if (mode.managed) {
    sendProgress('Writing podcast script (Cloud AI)...', 0.2);

    const api = ApiClient.getInstance();

    let scriptRes;
    try {
      scriptRes = await api.summarize({
        videoId: videoId || 'podcast',
        transcript: summaryText,
        language: language || 'auto',
        action: 'podcast',
      });
    } catch (apiErr) {
      throw apiErr;
    }

    if (scriptRes.error) {
      const err = new Error(scriptRes.error);
      if (scriptRes.errorCode) err.code = scriptRes.errorCode;
      if (scriptRes.upgrade_url) err.upgradeUrl = scriptRes.upgrade_url;
      throw err;
    }

    let dialogue;
    try {
      let raw = (scriptRes.result || '').trim();
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      dialogue = JSON.parse(raw);
    } catch {
      const match = (scriptRes.result || '').match(/\[[\s\S]*\]/);
      if (match) {
        try { dialogue = JSON.parse(match[0]); } catch { /* ignore */ }
      }
    }

    if (!Array.isArray(dialogue) || dialogue.length < 4) {
      throw new Error('Failed to generate podcast script. Please try again.');
    }

    // Step 2: TTS via managed backend
    sendProgress('Generating audio (Cloud TTS)...', 0.5);

    const ttsTranscript = dialogue.map(line => {
      const name = line.speaker === 'A' ? 'Alex' : (line.speaker === 'B' ? 'Sam' : line.speaker);
      return `${name}: ${line.text}`;
    }).join('\n');

    let ttsRes;
    try {
      ttsRes = await api.summarize({
        videoId: videoId || 'podcast-tts',
        transcript: 'tts',
        action: 'podcast-tts',
        podcastDialogue: ttsTranscript,
        voiceA: voices.a.name,
        voiceB: voices.b.name,
      });
    } catch (ttsErr) {
      throw ttsErr;
    }

    if (ttsRes.error) {
      throw new Error(ttsRes.error);
    }
    if (!ttsRes.audioBase64) throw new Error('Managed TTS returned no audio data.');

    sendProgress('Podcast ready!', 1);
    return {
      dialogue,
      audioBase64: ttsRes.audioBase64,
      model: scriptRes.provider || 'managed',
      provider: 'managed',
      voices,
      credits_remaining: ttsRes.credits_remaining,
      credits_used: ttsRes.credits_used,
    };
  }

  // ── BYOK fallback ───────────────────────────────────────────────
  if (mode.credits?.rate_limited) {
    const e = new Error('Too many requests. Please wait before trying again.');
    e.code = 'RATE_LIMITED';
    throw e;
  }
  if (mode.credits && mode.credits.can_use === false && mode.credits.credits <= 0) {
    const e = new Error('Free credits exhausted.');
    e.code = 'NO_CREDITS';
    throw e;
  }
  const settings = await StorageHelper.getSettings();
  const geminiKey = settings.geminiApiKey;
  if (!geminiKey) throw new Error('GEMINI_KEY_MISSING');
  if (typeof geminiKey !== 'string' || !/^AIza[A-Za-z0-9_-]{30,}$/.test(geminiKey)) {
    throw new Error('GEMINI_KEY_MISSING');
  }

  const { provider, apiKey, model } = await getProviderConfig();
  await requireByokApiKeyForProvider(mode, provider, apiKey);

  sendProgress('Writing podcast script...', 0.2);

  const languageInstruction = buildLanguageInstruction(language, summaryText);

  const hostADesc = voices.a.gender === 'F'
    ? 'HOST A ("Alex"): The knowledgeable female host who explains the topic. Enthusiastic, clear, uses analogies.'
    : 'HOST A ("Alex"): The knowledgeable male host who explains the topic. Enthusiastic, clear, uses analogies.';
  const hostBDesc = voices.b.gender === 'F'
    ? 'HOST B ("Sam"): The curious female co-host who asks smart questions, reacts with surprise/excitement, and adds witty comments.'
    : 'HOST B ("Sam"): The curious male co-host who asks smart questions, reacts with surprise/excitement, and adds witty comments.';

  const podcastPrompt = `You are a podcast script writer. Convert the following video summary into a natural, engaging conversation between TWO podcast hosts.

${hostADesc}
${hostBDesc}

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
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voices.a.name } }
              },
              {
                speaker: 'Sam',
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voices.b.name } }
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
  return { dialogue, audioBase64, model: result.model, provider, voices };
}

/**
 * Handle chat with video using the transcript as context.
 * Managed mode routes through Edge `summarize` with action=chat.
 */
async function handleChatWithVideo(data) {
  const { transcript, language, question, history, videoId } = data;

  if (!transcript || transcript.trim().length === 0) {
    throw new Error('EMPTY_TRANSCRIPT');
  }

  // ── Try managed mode ─────────────────────────────────────────────
  const mode = await getManagedMode();

  if (mode.managed) {
    try {
      const chatHistory = (history || []).slice(-10).map(m => ({
        role: m.role === 'ai' ? 'assistant' : m.role,
        content: m.text
      }));

      const edgeResult = await ApiClient.getInstance().summarize({
        videoId: videoId || '',
        transcript,
        action: 'chat',
        language: language || 'auto',
        chatMessage: question,
        chatHistory,
      });

      return {
        answer: edgeResult.result,
        model: edgeResult.provider,
        provider: 'managed',
        credits_remaining: edgeResult.credits_remaining,
        credits_used: edgeResult.credits_used,
        plan: mode?.credits?.plan || 'pro',
      };
    } catch (err) {
      if (err?.code === 'NO_CREDITS' || err?.code === 'INSUFFICIENT_CREDITS' || err?.code === 'RATE_LIMITED' || err?.code === 'AI_QUOTA_EXCEEDED') {
        const { apiKey } = await getProviderConfig();
        if (!apiKey) throw err;
      } else {
        throw err;
      }
    }
  }

  // ── BYOK fallback ────────────────────────────────────────────────
  const { provider, apiKey, model } = await getProviderConfig();
  await requireByokApiKeyForProvider(mode, provider, apiKey);

  const languageInstruction = buildLanguageInstruction(language, transcript);

  const maxChars = 80000;
  let contextTranscript = transcript;
  if (transcript.length > maxChars) {
    contextTranscript = transcript.substring(0, maxChars) + '\n... [Transcript truncated]';
  }

  const systemPrompt = `You are a transcript-only analyst for this ONE YouTube video — not a general chatbot.

Rules:
- Answer strictly from the transcript below. If it is not there, say the video does not mention it.
- Never reply with empty generic assistant lines as your whole answer (e.g. "How can I help?", "Size nasıl yardımcı olabilirim?", "Merhaba! Size nasıl yardımcı olabilirim?"). Every reply must be grounded in the transcript.
- If the user only greets or asks how you can help: briefly acknowledge if needed, then 1–3 sentences on what the video covers (from the transcript), then ask one concrete question about that content.
- Use markdown where appropriate (bold, lists).

${languageInstruction}

--- VIDEO TRANSCRIPT ---
${contextTranscript}
------------------------`;

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  if (history && history.length > 0) {
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'ai') {
        messages.push({ role: msg.role === 'ai' ? 'assistant' : 'user', content: msg.text });
      }
    }
  }

  messages.push({ role: 'user', content: question });

  const result = await callAI(provider, apiKey, model, messages, 0, 2048);
  return { answer: result.content, model: result.model, provider };
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
    return { valid: false, error: friendlyApiKeyOrRequestError(error, provider) };
  }
}

// ─── Transcript proxy (runs in service worker — full host_permissions) ───

/**
 * Fetch transcript content from a caption track URL.
 * Service worker fetch avoids CORS / redirect issues that content scripts hit.
 */
async function proxyFetchTranscript(trackUrl) {
  if (!trackUrl || typeof trackUrl !== 'string') return { entries: null };

  const fetchOpts = { credentials: 'include' };

  // Try JSON3
  try {
    const url = new URL(trackUrl);
    url.searchParams.set('fmt', 'json3');
    const resp = await fetch(url.toString(), fetchOpts);
    if (resp.ok) {
      const body = await resp.text();
      if (body && body.length > 2) {
        const data = JSON.parse(body);
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
    }
  } catch { /* fall through to XML */ }

  // Try XML (DOMParser not available in SW, use regex)
  try {
    const resp = await fetch(trackUrl, fetchOpts);
    if (!resp.ok) return { entries: null };
    const text = await resp.text();
    if (!text || text.length < 10) return { entries: null };
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

  // Method A: Innertube player API — ANDROID primary, WEB dynamic fallback.
  // ANDROID hardcoded version is kept current by GitHub Actions
  // (youtube-version-monitor.yml).  If it fails we try the WEB client
  // with a version extracted from YouTube's sw.js.
  const ANDROID_CFG = {
    clientName: 'ANDROID', clientVersion: '21.03.36',
    androidSdkVersion: 35, osVersion: '15', hl: 'en', gl: 'US', platform: 'MOBILE'
  };

  async function swInnertubeRequest(vid, cfg) {
    const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: { client: cfg }, videoId: vid })
    });
    if (!r.ok) return null;
    const d = await r.json();
    const ct = d?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!ct?.length) return null;
    return ct.map((t) => ({
      baseUrl: t.baseUrl, language: t.languageCode,
      name: t.name?.simpleText || t.name?.runs?.[0]?.text || t.languageCode,
      isAutoGenerated: t.kind === 'asr', vssId: t.vssId
    }));
  }

  async function extractWebVersionFromSW() {
    try {
      const r = await fetch('https://www.youtube.com/sw.js', { credentials: 'include' });
      const t = await r.text();
      const m = t.match(/clientVersion["']\s*[:=]\s*["']([^"']+)/);
      return m ? m[1] : null;
    } catch { return null; }
  }

  try {
    const tracks = await swInnertubeRequest(videoId, ANDROID_CFG);
    if (tracks) return { tracks };

    const webVer = await extractWebVersionFromSW();
    if (webVer) {
      const webTracks = await swInnertubeRequest(videoId, {
        clientName: 'WEB', clientVersion: webVer, hl: 'en', gl: 'US', platform: 'DESKTOP'
      });
      if (webTracks) return { tracks: webTracks };
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
 * Handle extension install/update — show onboarding or "What's New" page
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome/welcome.html')
    });
  }

  if (details.reason === 'update') {
    const currentVersion = chrome.runtime.getManifest().version;
    const previousVersion = details.previousVersion;

    if (currentVersion !== previousVersion) {
      chrome.storage.local.set({ lastUpdateVersion: currentVersion });
      chrome.tabs.create({
        url: chrome.runtime.getURL('update/update.html'),
        active: false
      });
    }
  }

  // Enable session storage for content scripts
  try {
    chrome.storage.session?.setAccessLevel?.({
      accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
    });
  } catch {
    // Ignore
  }

  // Proactively cache session for instant popup render
  _warmPopupCache();
});

async function _warmPopupCache() {
  try {
    const session = await SupabaseAuth.getInstance().getSession();
    if (!session) return;
    const credits = await ApiClient.getInstance().checkCredits().catch(() => null);
    const cachedSession = StorageHelper.sanitizeSessionForCache(session);
    chrome.storage.session.set({ ytai_popup_cache: { session: cachedSession, credits } }).catch(() => {});
  } catch { /* ignore */ }
}
