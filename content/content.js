/**
 * YouTube AI Summarizer - Content Script Main Controller
 * Coordinates transcript extraction, UI, and API communication
 * Handles YouTube SPA navigation
 */

(function () {
  'use strict';

  let currentVideoId = null;
  let summaryCache = {}; // In-memory cache for current session
  let isProcessing = false;
  let initTimeout = null; // Debounce timer

  const MAX_CACHE_ENTRIES = 30;

  /**
   * Add to in-memory cache with LRU limit
   */
  function addToMemCache(key, value) {
    const keys = Object.keys(summaryCache);
    if (keys.length >= MAX_CACHE_ENTRIES) {
      delete summaryCache[keys[0]];
    }
    summaryCache[key] = value;
  }

  /**
   * Initialize the extension on the current page
   */
  async function initialize() {
    const videoId = TranscriptExtractor.getVideoId();
    if (!videoId) return;

    // Don't re-initialize for the same video
    if (videoId === currentVideoId) return;
    currentVideoId = videoId;

    // Reset state
    isProcessing = false;

    // Initialize UI
    SummarizerUI.init();

    // Check if API key is configured
    const hasKey = await StorageHelper.hasApiKey();
    if (!hasKey && SummarizerUI.isPanelOpen()) {
      SummarizerUI.showApiKeyPrompt();
    }

    // Check auto-run setting
    const settings = await StorageHelper.getSettings();
    if (settings.autoRun && hasKey) {
      SummarizerUI.autoOpen();
      requestSummary(settings.defaultMode || 'summary', false);
    }
  }

  /**
   * Debounced initialize - prevents triple calls from simultaneous navigation events
   */
  function debouncedInitialize() {
    clearTimeout(initTimeout);
    initTimeout = setTimeout(() => {
      initialize().catch((err) => {
        console.warn('[YT-AI-Summarizer] Init error:', err);
      });
    }, 500);
  }

  /**
   * Request a summary for the current video
   */
  async function requestSummary(mode = 'summary', forceRefresh = false) {
    if (isProcessing) return;

    const videoId = TranscriptExtractor.getVideoId();
    if (!videoId) return;

    // Check API key
    const hasKey = await StorageHelper.hasApiKey();
    if (!hasKey) {
      SummarizerUI.showApiKeyPrompt();
      return;
    }

    // Check cache (unless force refresh)
    if (!forceRefresh) {
      const cached = await StorageHelper.getCachedSummary(videoId, mode);
      if (cached && cached.content) {
        SummarizerUI.showResult(cached.content);
        return;
      }

      // Also check in-memory cache
      const memCacheKey = `${videoId}_${mode}`;
      if (summaryCache[memCacheKey]) {
        SummarizerUI.showResult(summaryCache[memCacheKey]);
        return;
      }
    }

    isProcessing = true;
    SummarizerUI.showLoading(null, 0);

    try {
      // Step 1: Extract transcript
      SummarizerUI.showLoading('Extracting transcript...', 0.1);
      const transcript = await TranscriptExtractor.getTranscript();

      if (!transcript || !transcript.fullText) {
        throw new Error('NO_TRANSCRIPT');
      }

      SummarizerUI.showLoading('Sending to AI...', 0.3);

      // Step 2: Get settings
      const settings = await StorageHelper.getSettings();

      // Step 3: Send to service worker for AI processing
      const response = await chrome.runtime.sendMessage({
        action: 'summarize',
        data: {
          transcript: transcript.fullText,
          mode: mode,
          model: settings.model || 'llama-3.3-70b-versatile',
          language: settings.language || 'auto',
          videoId: videoId
        }
      });

      // Guard against undefined response (service worker might be inactive)
      if (!response) {
        throw new Error('API_ERROR: No response from extension. Please reload the page.');
      }

      if (response.error) {
        throw new Error(response.error);
      }

      // Step 4: Show result
      SummarizerUI.showResult(response.content);

      // Cache the result
      const memCacheKey = `${videoId}_${mode}`;
      addToMemCache(memCacheKey, response.content);
      await StorageHelper.cacheSummary(videoId, mode, {
        content: response.content,
        model: response.model
      });

    } catch (error) {
      handleError(error);
    } finally {
      isProcessing = false;
    }
  }

  /**
   * Handle errors with user-friendly messages
   */
  function handleError(error) {
    const errorMsg = error?.message || error?.toString() || 'Unknown error';

    const errorMap = {
      'NO_VIDEO_ID': {
        title: 'No Video Found',
        message: 'Could not detect a YouTube video on this page.',
        retryable: false
      },
      'NO_TRANSCRIPT': {
        title: chrome.i18n?.getMessage('noTranscript') || 'No Transcript',
        message: 'This video doesn\'t have captions/subtitles available. AI summarization requires a transcript.',
        retryable: false
      },
      'EMPTY_TRANSCRIPT': {
        title: 'Empty Transcript',
        message: 'The transcript was found but appears to be empty.',
        retryable: true
      },
      'INVALID_API_KEY': {
        title: 'Invalid API Key',
        message: 'Your Groq API key is invalid. Please check your settings.',
        retryable: false
      },
      'RATE_LIMITED': {
        title: 'Rate Limited',
        message: 'Too many requests. Please wait a moment and try again.',
        retryable: true
      }
    };

    const mapped = errorMap[errorMsg] || {
      title: chrome.i18n?.getMessage('errorGeneric') || 'Error',
      message: errorMsg.startsWith?.('API_ERROR')
        ? errorMsg.replace('API_ERROR: ', '')
        : 'An unexpected error occurred. Please try again.',
      retryable: true
    };

    SummarizerUI.showError(mapped.title, mapped.message, mapped.retryable);
  }

  /**
   * Handle panel open event
   */
  function onPanelOpen() {
    const videoId = TranscriptExtractor.getVideoId();
    if (!videoId) return;

    // If we already have a result cached, show it
    const memCacheKey = `${videoId}_${SummarizerUI.getCurrentMode()}`;
    if (summaryCache[memCacheKey]) {
      SummarizerUI.showResult(summaryCache[memCacheKey]);
      return;
    }

    // Check if API key is set
    StorageHelper.hasApiKey().then((hasKey) => {
      if (!hasKey) {
        SummarizerUI.showApiKeyPrompt();
      } else {
        requestSummary(SummarizerUI.getCurrentMode(), false);
      }
    });
  }

  // Expose callbacks for UI module
  window._ytaiRequestSummary = requestSummary;
  window._ytaiOnPanelOpen = onPanelOpen;

  /**
   * Listen for YouTube SPA navigation events
   */
  function setupNavigationListener() {
    // Method 1: YouTube's custom navigation event (most reliable)
    document.addEventListener('yt-navigate-finish', () => {
      if (window.location.pathname === '/watch') {
        debouncedInitialize();
      } else {
        currentVideoId = null;
      }
    });

    // Method 2: Popstate for browser back/forward
    window.addEventListener('popstate', () => {
      if (window.location.pathname === '/watch') {
        debouncedInitialize();
      }
    });

    // Method 3: Lightweight URL polling instead of heavy MutationObserver
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        if (window.location.pathname === '/watch') {
          debouncedInitialize();
        }
      }
    }, 1000);
  }

  /**
   * Listen for messages from service worker / popup
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'settingsUpdated') {
      initialize().catch(console.warn);
      sendResponse({ ok: true });
    } else if (message.action === 'triggerSummary') {
      SummarizerUI.autoOpen();
      requestSummary(message.mode || 'summary', true);
      sendResponse({ ok: true });
    } else if (message.action === 'progress') {
      SummarizerUI.showLoading(message.text, message.progress);
      sendResponse({ ok: true });
    }

    return false;
  });

  // --- Initialization ---
  setupNavigationListener();
  initialize().catch((err) => {
    console.warn('[YT-AI-Summarizer] Init error:', err);
  });
})();
