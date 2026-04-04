/**
 * YouTube AI Summarizer — Settings Controller (v1.1)
 * Supports Groq + Ollama Cloud dual-provider system
 */

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  try {
    const v = chrome.runtime?.getManifest?.()?.version;
    const verEl = $('#popupVersion');
    if (verEl && v) verEl.textContent = `v${v}`;
  } catch { /* ignore */ }

  const providerBtns      = $$('.provider-btn');
  const groqSection       = $('#groqSettings');
  const ollamaSection     = $('#ollamaSettings');
  const groqKeyInput      = $('#groqApiKey');
  const ollamaKeyInput    = $('#ollamaApiKey');
  const geminiKeyInput    = $('#geminiApiKey');
  const groqKeyStatus     = $('#groqApiKeyStatus');
  const ollamaKeyStatus   = $('#ollamaApiKeyStatus');
  const geminiKeyStatus   = $('#geminiApiKeyStatus');
  const toggleGroqKey     = $('#toggleGroqKey');
  const toggleOllamaKey   = $('#toggleOllamaKey');
  const toggleGeminiKey   = $('#toggleGeminiKey');
  const groqModelSelect   = $('#groqModel');
  const ollamaModelSelect = $('#ollamaModel');
  const defaultModeSelect = $('#defaultMode');
  const languageSelect    = $('#language');
  const autoRunToggle     = $('#autoRun');
  const cacheSummariesToggle  = $('#cacheSummaries');
  const cacheTranscriptsToggle = $('#cacheTranscripts');
  const saveBtn           = $('#saveBtn');
  const clearCacheBtn     = $('#clearCacheBtn');
  const privacyLink       = $('#privacyLink');
  const tabBtns           = $$('.popup-tab');
  const tabPanels         = $$('.popup-tab-panel');

  let activeProvider = 'ollama';

  function setPopupTab(name) {
    const allowed = ['setup', 'options', 'help'];
    if (!allowed.includes(name)) name = 'setup';
    tabBtns.forEach((btn) => {
      const on = btn.dataset.tab === name;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    tabPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.tabPanel === name);
    });
    try {
      sessionStorage.setItem('ytai-popup-tab', name);
    } catch { /* ignore */ }
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => setPopupTab(btn.dataset.tab));
  });

  try {
    const last = sessionStorage.getItem('ytai-popup-tab');
    if (last && ['setup', 'options', 'help'].includes(last)) {
      setPopupTab(last);
    }
  } catch { /* ignore */ }

  await loadSettings();

  // ── Provider Toggle ──
  providerBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeProvider = btn.dataset.provider;
      providerBtns.forEach((b) => b.classList.toggle('active', b === btn));
      groqSection.classList.toggle('hidden', activeProvider !== 'groq');
      ollamaSection.classList.toggle('hidden', activeProvider !== 'ollama');
    });
  });

  // ── Toggle Key Visibility ──
  toggleGroqKey.addEventListener('click', () => toggleKeyVis(groqKeyInput));
  toggleOllamaKey.addEventListener('click', () => toggleKeyVis(ollamaKeyInput));
  toggleGeminiKey.addEventListener('click', () => toggleKeyVis(geminiKeyInput));

  function toggleKeyVis(input) {
    const isPw = input.type === 'password';
    input.type = isPw ? 'text' : 'password';
  }

  // ── Save ──
  saveBtn.addEventListener('click', saveSettings);

  // ── Auto-save on any setting change ──
  let _autoSaveTimer = null;
  function scheduleAutoSave() {
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(saveSettings, 300);
  }
  [languageSelect, defaultModeSelect, groqModelSelect, ollamaModelSelect].forEach(
    (el) => el.addEventListener('change', scheduleAutoSave)
  );
  [autoRunToggle, cacheSummariesToggle, cacheTranscriptsToggle].forEach(
    (el) => el.addEventListener('change', scheduleAutoSave)
  );
  providerBtns.forEach((btn) => btn.addEventListener('click', scheduleAutoSave));
  [groqKeyInput, ollamaKeyInput, geminiKeyInput].forEach(
    (el) => el.addEventListener('blur', scheduleAutoSave)
  );

  // ── Clear Cache ──
  clearCacheBtn.addEventListener('click', async () => {
    try {
      const items = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(items).filter(
        (k) => k.startsWith('cache_') || k.startsWith('transcript_')
      );
      if (cacheKeys.length > 0) await chrome.storage.local.remove(cacheKeys);
      if (chrome.storage.session) {
        try { await chrome.storage.session.clear(); } catch { /* ignore */ }
      }
    } catch { /* best effort */ }
    clearCacheBtn.textContent = 'Cleared!';
    setTimeout(() => { clearCacheBtn.textContent = 'Clear Cache'; }, 2000);
  });

  // ── Privacy ──
  privacyLink.addEventListener('click', (e) => {
    e.preventDefault();
    const url = chrome.runtime.getURL('privacy-policy.html');
    chrome.tabs.create({ url }).catch(() => window.open(url, '_blank'));
  });

  // ── Validate on blur ──
  groqKeyInput.addEventListener('blur', () => validateProviderKey('groq'));
  ollamaKeyInput.addEventListener('blur', () => validateProviderKey('ollama'));

  // ── Functions ──

  async function loadSettings() {
    try {
      const s = await chrome.storage.local.get({
        provider: 'ollama',
        groqApiKey: '',
        ollamaApiKey: '',
        geminiApiKey: '',
      model: 'llama-3.3-70b-versatile',
      ollamaModel: 'gemini-3-flash-preview',
      defaultMode: 'summary',
      language: 'auto',
      autoRun: false,
      cacheSummaries: true,
      cacheTranscripts: false
    });

      activeProvider = s.provider || 'ollama';
      groqKeyInput.value = StorageHelper.deobfuscate(s.groqApiKey);
      ollamaKeyInput.value = StorageHelper.deobfuscate(s.ollamaApiKey);
      geminiKeyInput.value = StorageHelper.deobfuscate(s.geminiApiKey);
      groqModelSelect.value = s.model;
      ollamaModelSelect.value = s.ollamaModel;
      defaultModeSelect.value = s.defaultMode;
      languageSelect.value = s.language;
      autoRunToggle.checked = s.autoRun;
      cacheSummariesToggle.checked = s.cacheSummaries !== false;
      cacheTranscriptsToggle.checked = s.cacheTranscripts === true;

      providerBtns.forEach((b) => b.classList.toggle('active', b.dataset.provider === activeProvider));
      groqSection.classList.toggle('hidden', activeProvider !== 'groq');
      ollamaSection.classList.toggle('hidden', activeProvider !== 'ollama');

      if (s.groqApiKey) showStatus(groqKeyStatus, 'API key configured', 'success');
      if (s.ollamaApiKey) showStatus(ollamaKeyStatus, 'API key configured', 'success');
      if (s.geminiApiKey) showStatus(geminiKeyStatus, 'API key configured', 'success');
    } catch {
      // settings failed to load, continue with defaults
    }
  }

  async function saveSettings() {
    const groqKey = groqKeyInput.value.trim();
    const ollamaKey = ollamaKeyInput.value.trim();
    const geminiKey = geminiKeyInput.value.trim();

    if (activeProvider === 'groq' && groqKey && !groqKey.startsWith('gsk_')) {
      showStatus(groqKeyStatus, 'Groq API keys start with "gsk_"', 'error');
      return;
    }

    const settings = {
      provider: activeProvider,
      groqApiKey: StorageHelper.obfuscate(groqKey),
      ollamaApiKey: StorageHelper.obfuscate(ollamaKey),
      geminiApiKey: StorageHelper.obfuscate(geminiKey),
      model: groqModelSelect.value,
      ollamaModel: ollamaModelSelect.value,
      defaultMode: defaultModeSelect.value,
      language: languageSelect.value,
      autoRun: autoRunToggle.checked,
      cacheSummaries: cacheSummariesToggle.checked,
      cacheTranscripts: cacheTranscriptsToggle.checked
    };

    saveBtn.classList.add('saving');
    saveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" class="spin-icon">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
      </svg>
      Saving...
    `;

    try {
      await chrome.storage.local.set(settings);

      const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' }).catch(() => {});
      }

      setTimeout(() => {
        saveBtn.classList.remove('saving');
        saveBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          Saved!
        `;
        setTimeout(() => {
          saveBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            Save Settings
          `;
        }, 1500);
      }, 400);
    } catch (err) {
      saveBtn.classList.remove('saving');
      const statusEl = activeProvider === 'ollama' ? ollamaKeyStatus : groqKeyStatus;
      showStatus(statusEl, 'Failed to save: ' + (err?.message || 'Unknown'), 'error');
    }
  }

  async function validateProviderKey(provider) {
    const input = provider === 'ollama' ? ollamaKeyInput : groqKeyInput;
    const statusEl = provider === 'ollama' ? ollamaKeyStatus : groqKeyStatus;
    const key = input.value.trim();

    if (!key) return;
    if (provider === 'groq' && !key.startsWith('gsk_')) {
      showStatus(statusEl, 'Groq API keys start with "gsk_"', 'error');
      return;
    }

    showStatus(statusEl, 'Validating...', 'info');
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'validateApiKey',
        apiKey: key,
        provider
      });
      if (response?.valid) {
        showStatus(statusEl, 'API key is valid', 'success');
      } else {
        showStatus(statusEl, response?.error || 'Invalid API key', 'error');
      }
    } catch {
      showStatus(statusEl, 'Could not validate. Save and try again.', 'error');
    }
  }

  function showStatus(el, message, type) {
    el.textContent = message;
    el.className = `status-msg ${type}`;
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        if (el.textContent === message) el.className = 'status-msg hidden';
      }, 5000);
    }
  }

});
