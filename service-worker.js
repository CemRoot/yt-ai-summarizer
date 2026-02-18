/**
 * YouTube AI Summarizer - Service Worker (Background Script)
 * Handles Groq API calls, onboarding, and cross-component messaging
 */

// Import utilities (only storage.js needed — API calls are handled locally in this file)
importScripts('utils/storage.js');

const GROQ_API_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_RETRIES = 3;

/**
 * Language-aware system prompts.
 * The language instruction is appended dynamically.
 */
const SYSTEM_PROMPTS = {
  summary: `You are a helpful video summarizer. Given a YouTube video transcript, provide a clear and concise summary in 3-5 paragraphs. Focus on the main topics, arguments, and conclusions. Be informative and well-structured. Use markdown formatting.`,

  keypoints: `You are a helpful video analyzer. Given a YouTube video transcript, extract the most important key points as a numbered list (aim for 5-10 points). Each point should be a single, clear sentence. Focus on actionable insights, important facts, and key arguments. Use markdown formatting with numbered list.`,

  detailed: `You are a detailed video analyst. Given a YouTube video transcript, provide a comprehensive section-by-section analysis. For each major section or topic change, provide:
- A section title in bold
- A brief summary of what is discussed

End with a brief overall conclusion. Use markdown formatting.`
};

/**
 * Build language instruction based on user preference
 */
function buildLanguageInstruction(language) {
  if (!language || language === 'auto') return '';

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

  return '\n\nIMPORTANT: ' + (langMap[language] || `You MUST respond entirely in ${language}.`);
}

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
  if (message.action === 'summarize') {
    handleSummarize(message.data, sender.tab?.id)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err?.message || 'Unknown error' }));
    return true;
  }

  if (message.action === 'validateApiKey') {
    validateKey(message.apiKey)
      .then(sendResponse)
      .catch((err) => sendResponse({ valid: false, error: err?.message || 'Unknown error' }));
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
  const { transcript, mode, model, language, videoId } = data;

  if (!transcript || transcript.trim().length === 0) {
    throw new Error('EMPTY_TRANSCRIPT');
  }

  const apiKey = await StorageHelper.getApiKey();
  if (!apiKey) {
    throw new Error('INVALID_API_KEY');
  }

  // Send progress updates to content script
  function sendProgress(text, progress) {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: 'progress',
        text,
        progress
      }).catch(() => {});
    }
  }

  sendProgress('Preparing AI request...', 0.3);

  const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.summary;
  const languageInstruction = buildLanguageInstruction(language);

  // Check if transcript needs chunking
  const maxChars = 24000;
  const chunks = chunkText(transcript, maxChars);

  if (chunks.length === 1) {
    sendProgress('AI is analyzing...', 0.5);

    const result = await callGroqAPI(apiKey, model, [
      { role: 'system', content: systemPrompt + languageInstruction },
      {
        role: 'user',
        content: `Here is the video transcript:\n\n${chunks[0]}\n\nPlease analyze this transcript as instructed.`
      }
    ]);

    sendProgress('Done!', 1);
    return { content: result.content, model: result.model };
  }

  // Multi-chunk processing
  const chunkSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    sendProgress(
      `Processing section ${i + 1}/${chunks.length}...`,
      0.3 + (i / chunks.length) * 0.5
    );

    const chunkResult = await callGroqAPI(apiKey, model, [
      {
        role: 'system',
        content: `You are summarizing part ${i + 1} of ${chunks.length} of a video transcript. Provide a concise summary of this section.${languageInstruction}`
      },
      {
        role: 'user',
        content: `Transcript section ${i + 1}/${chunks.length}:\n\n${chunks[i]}`
      }
    ]);
    chunkSummaries.push(chunkResult.content);
  }

  sendProgress('Combining sections...', 0.9);

  const combinedResult = await callGroqAPI(apiKey, model, [
    { role: 'system', content: systemPrompt + languageInstruction },
    {
      role: 'user',
      content: `Here are summaries of different sections of a video transcript. Please combine them into a cohesive final analysis:\n\n${chunkSummaries.map((s, i) => `--- Section ${i + 1} ---\n${s}`).join('\n\n')}`
    }
  ]);

  sendProgress('Done!', 1);
  return { content: combinedResult.content, model: combinedResult.model };
}

/**
 * Make a Groq API call with retry logic
 */
async function callGroqAPI(apiKey, model, messages, retryCount = 0) {
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
        max_tokens: 2048,
        top_p: 0.9
      })
    });

    if (response.status === 429) {
      if (retryCount < MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, retryCount);
        await new Promise((r) => setTimeout(r, delay));
        return callGroqAPI(apiKey, model, messages, retryCount + 1);
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
      return callGroqAPI(apiKey, model, messages, retryCount + 1);
    }
    throw error;
  }
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
async function validateKey(apiKey) {
  try {
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
  // Try JSON3
  try {
    const url = new URL(trackUrl);
    url.searchParams.set('fmt', 'json3');
    const resp = await fetch(url.toString());
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
    const resp = await fetch(trackUrl);
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

  // Method A: YouTube innertube player API (most reliable)
  try {
    const resp = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: {
            hl: 'en',
            gl: 'US',
            clientName: 'WEB',
            clientVersion: '2.20240101.00.00'
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
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
