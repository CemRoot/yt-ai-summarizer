/**
 * YouTube AI Summarizer - Content Script Main Controller
 * Coordinates transcript extraction, UI, and API communication
 * Handles YouTube SPA navigation
 */

(function () {
  'use strict';

  let currentVideoId = null;
  let combinedCache = null; // { videoId, summary, keypoints, detailed }
  let isProcessing = false;
  let initTimeout = null;

  /**
   * Initialize the extension on the current page
   */
  async function initialize() {
    const videoId = TranscriptExtractor.getVideoId();
    if (!videoId) return;

    if (videoId === currentVideoId) return;

    currentVideoId = videoId;
    isProcessing = false;
    combinedCache = null;

    SummarizerUI.init();

    const hasKey = await StorageHelper.hasApiKey();
    if (!hasKey && SummarizerUI.isPanelOpen()) {
      SummarizerUI.showApiKeyPrompt();
    }

    const settings = await StorageHelper.getSettings();
    if (settings.autoRun && hasKey) {
      SummarizerUI.autoOpen();
      requestSummary(settings.defaultMode || 'summary', false);
    }
  }

  /**
   * Debounced initialize – waits for YouTube's player to load fresh data after SPA nav
   */
  function debouncedInitialize() {
    clearTimeout(initTimeout);
    initTimeout = setTimeout(() => {
      currentVideoId = null; // force re-init even if URL polled same ID briefly
      initialize().catch((err) => {
        console.warn('[YT-AI-Summarizer] Init error:', err);
      });
    }, 800);
  }

  /**
   * Request a summary for the current video.
   * Uses a single API call to generate all three modes (summary, keypoints,
   * detailed) and caches them — switching tabs is then instant.
   */
  async function requestSummary(mode = 'summary', forceRefresh = false) {
    if (isProcessing) return;

    const videoId = TranscriptExtractor.getVideoId();
    if (!videoId) return;

    const hasKey = await StorageHelper.hasApiKey();
    if (!hasKey) {
      SummarizerUI.showApiKeyPrompt();
      return;
    }

    // Serve from in-memory combined cache (instant tab switch)
    if (!forceRefresh && combinedCache?.videoId === videoId && combinedCache[mode]) {
      SummarizerUI.showResult(combinedCache[mode]);
      return;
    }

    // Serve from persistent storage cache
    if (!forceRefresh) {
      const cached = await StorageHelper.getCachedSummary(videoId, mode);
      if (cached?.content) {
        SummarizerUI.showResult(cached.content);
        return;
      }
    }

    isProcessing = true;
    SummarizerUI.showLoading(null, 0);

    try {
      SummarizerUI.showLoading('Extracting transcript...', 0.1);
      const transcript = await TranscriptExtractor.getTranscript();

      if (!transcript?.fullText) {
        throw new Error('NO_TRANSCRIPT');
      }

      SummarizerUI.showLoading('Sending to AI...', 0.2);

      const settings = await StorageHelper.getSettings();

      // Single API call for all three modes
      const response = await chrome.runtime.sendMessage({
        action: 'summarizeAll',
        data: {
          transcript: transcript.fullText,
          language: settings.language || 'auto',
          videoId
        }
      });

      if (!response) {
        throw new Error('API_ERROR: No response from extension. Please reload the page.');
      }

      if (response.error) {
        throw new Error(response.error);
      }

      combinedCache = {
        videoId,
        summary: response.summary,
        keypoints: response.keypoints,
        detailed: response.detailed
      };

      if (response.provider) {
        SummarizerUI.updateProviderLabel(response.provider);
      }

      // Persist each mode to storage
      for (const m of ['summary', 'keypoints', 'detailed']) {
        if (response[m]) {
          StorageHelper.cacheSummary(videoId, m, {
            content: response[m],
            model: response.model
          }).catch(() => {});
        }
      }

      SummarizerUI.showResult(response[mode]);

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

    const mode = SummarizerUI.getCurrentMode();

    if (combinedCache?.videoId === videoId && combinedCache[mode]) {
      SummarizerUI.showResult(combinedCache[mode]);
      return;
    }

    StorageHelper.hasApiKey().then((hasKey) => {
      if (!hasKey) {
        SummarizerUI.showApiKeyPrompt();
      } else {
        requestSummary(mode, false);
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
