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
    return true; // Keep channel open for async response
  }

  if (message.action === 'validateApiKey') {
    validateKey(message.apiKey)
      .then(sendResponse)
      .catch((err) => sendResponse({ valid: false, error: err?.message || 'Unknown error' }));
    return true;
  }

  if (message.action === 'openSettings') {
    // Open popup page in a new tab (reliable method, works without user gesture)
    chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
    sendResponse({ ok: true });
    return false;
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
