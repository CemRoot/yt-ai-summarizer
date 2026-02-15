/**
 * YouTube AI Summarizer - Popup Settings Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const apiKeyInput = document.getElementById('apiKey');
  const toggleKeyBtn = document.getElementById('toggleKey');
  const apiKeyStatus = document.getElementById('apiKeyStatus');
  const modelSelect = document.getElementById('model');
  const defaultModeSelect = document.getElementById('defaultMode');
  const languageSelect = document.getElementById('language');
  const autoRunToggle = document.getElementById('autoRun');
  const saveBtn = document.getElementById('saveBtn');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const privacyLink = document.getElementById('privacyLink');

  // Load existing settings
  await loadSettings();

  // ---- Event Listeners ----

  // Toggle API key visibility
  toggleKeyBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleKeyBtn.title = isPassword ? 'Hide' : 'Show';
  });

  // Save settings
  saveBtn.addEventListener('click', saveSettings);

  // Clear cache (fixed: use promise-based API instead of mixing await + callback)
  clearCacheBtn.addEventListener('click', async () => {
    try {
      const items = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(items).filter(
        (k) => k.startsWith('cache_') || k.startsWith('transcript_')
      );
      if (cacheKeys.length > 0) {
        await chrome.storage.local.remove(cacheKeys);
      }
      if (chrome.storage.session) {
        try { await chrome.storage.session.clear(); } catch { /* ignore */ }
      }
    } catch {
      // Best effort
    }
    clearCacheBtn.textContent = 'Cleared!';
    setTimeout(() => {
      clearCacheBtn.textContent = 'Clear Cache';
    }, 2000);
  });

  // Privacy policy link
  privacyLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('privacy-policy.html') });
  });

  // Validate API key on blur (with proper error handling)
  apiKeyInput.addEventListener('blur', async () => {
    const key = apiKeyInput.value.trim();
    if (key && key.startsWith('gsk_')) {
      showStatus('Validating...', 'info');
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'validateApiKey',
          apiKey: key
        });
        if (response?.valid) {
          showStatus('API key is valid ✓', 'success');
        } else {
          showStatus(response?.error || 'Invalid API key. Please check and try again.', 'error');
        }
      } catch {
        showStatus('Could not validate. Please save and try again.', 'error');
      }
    } else if (key && !key.startsWith('gsk_')) {
      showStatus('Groq API keys start with "gsk_"', 'error');
    }
  });

  // ---- Functions ----

  async function loadSettings() {
    try {
      const settings = await chrome.storage.local.get({
        groqApiKey: '',
        model: 'llama-3.3-70b-versatile',
        defaultMode: 'summary',
        language: 'auto',
        autoRun: false
      });

      apiKeyInput.value = settings.groqApiKey || '';
      modelSelect.value = settings.model;
      defaultModeSelect.value = settings.defaultMode;
      languageSelect.value = settings.language;
      autoRunToggle.checked = settings.autoRun;

      if (settings.groqApiKey) {
        showStatus('API key configured ✓', 'success');
      }
    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
  }

  async function saveSettings() {
    const apiKey = apiKeyInput.value.trim();

    // Basic validation
    if (apiKey && !apiKey.startsWith('gsk_')) {
      showStatus('Groq API keys start with "gsk_"', 'error');
      return;
    }

    const settings = {
      groqApiKey: apiKey,
      model: modelSelect.value,
      defaultMode: defaultModeSelect.value,
      language: languageSelect.value,
      autoRun: autoRunToggle.checked
    };

    saveBtn.classList.add('saving');
    saveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="spin-icon">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
      </svg>
      Saving...
    `;

    try {
      await chrome.storage.local.set(settings);

      // Notify content scripts about settings update
      const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' }).catch(() => {});
      }

      setTimeout(() => {
        saveBtn.classList.remove('saving');
        saveBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          Saved!
        `;

        setTimeout(() => {
          saveBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            Save Settings
          `;
        }, 1500);
      }, 500);
    } catch (err) {
      saveBtn.classList.remove('saving');
      showStatus('Failed to save: ' + (err?.message || 'Unknown error'), 'error');
    }
  }

  function showStatus(message, type) {
    apiKeyStatus.textContent = message;
    apiKeyStatus.className = `status-msg ${type}`;
    // Auto-hide success/info after 5 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        if (apiKeyStatus.textContent === message) {
          apiKeyStatus.className = 'status-msg hidden';
        }
      }, 5000);
    }
  }
});
