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

  const popupUpgradeProGroup = $('#popupUpgradeProGroup');
  if (popupUpgradeProGroup) {
    popupUpgradeProGroup.querySelectorAll('.popup-pro-plan[data-plan]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const plan = btn.dataset.plan === 'monthly' ? 'monthly' : 'yearly';
        chrome.runtime.sendMessage({ action: 'openCheckout', plan }).catch(() => {});
      });
    });
  }

  const providerBtns      = $$('.provider-btn');
  const providerCard      = $('#providerCard');
  const managedAiCard     = $('#managedAiCard');
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
  let isGoogleUser = false;
  let _byokForced = false;
  /** Last known subscription + credits for layout policy (async `checkCredits` / save race). */
  let _lastPlanNorm = 'free';
  let _lastCreditsCount = 0;

  /**
   * Google-signed-in: Cloud AI (managed) vs BYOK chrome. Pro always uses managed UI regardless of saved keys.
   * @param {{ plan: string, creditsCount: number, hasGroq: boolean, hasOllama: boolean, hasGemini: boolean, byokForced: boolean }} ctx
   * @returns {{ managedUi: boolean, showByokSwitch: boolean, resetByokForced: boolean }}
   */
  function resolveGoogleSignedInLayout(ctx) {
    const plan = String(ctx.plan || '').toLowerCase();
    const isPro = plan === 'pro';
    const isCancelled = plan === 'cancelled';
    const hasAnyKey = !!(ctx.hasGroq || ctx.hasOllama || ctx.hasGemini);
    const byokForced = !!ctx.byokForced;
    const creditsCount = Number(ctx.creditsCount ?? 0);

    if (isPro) {
      return { managedUi: true, showByokSwitch: false, resetByokForced: true };
    }
    if (hasAnyKey) {
      return { managedUi: false, showByokSwitch: false, resetByokForced: false };
    }
    if (byokForced) {
      return { managedUi: false, showByokSwitch: false, resetByokForced: false };
    }
    const managedUi = true;
    const showByokSwitch = !isCancelled && creditsCount <= 0;
    return { managedUi, showByokSwitch, resetByokForced: false };
  }

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

  // ─── Account UI ──────────────────────────────────────────────────
  const accountSignedOut = $('#accountSignedOut');
  const accountSignedIn  = $('#accountSignedIn');
  const googleSignInBtn  = $('#googleSignInBtn');
  const signOutBtn       = $('#signOutBtn');
  const manageSubBtn     = $('#manageSubBtn');
  const accountAvatar    = $('#accountAvatar');
  const accountEmail     = $('#accountEmail');
  const accountPlan      = $('#accountPlan');
  const accountCredits   = $('#accountCredits');

  function setProviderVisibility(managed) {
    isGoogleUser = managed;
    managedAiCard.classList.toggle('hidden', !managed);
    providerCard.classList.toggle('hidden', managed);
    groqSection.classList.toggle('hidden', managed || activeProvider !== 'groq');
    ollamaSection.classList.toggle('hidden', managed || activeProvider !== 'ollama');
    const podcastKeyCard = document.getElementById('podcastKeyCard');
    if (podcastKeyCard) podcastKeyCard.classList.toggle('hidden', managed);
  }

  const byokSwitchBtn = $('#byokSwitchBtn');

  /** Bumps on sign-out / sign-in so late `supabaseGetSession` or `checkCredits` callbacks cannot overwrite UI (race with background `_freshCheck`). */
  let accountRenderEpoch = 0;

  /** Applies `resolveGoogleSignedInLayout` to DOM (managed card vs provider keys + Use own key visibility). */
  async function applyGoogleManagedVsByokLayout() {
    try {
      if (accountSignedIn.classList.contains('hidden')) return;
      const s = await chrome.storage.local.get({
        groqApiKey: '',
        ollamaApiKey: '',
        geminiApiKey: '',
      });
      const g = StorageHelper.deobfuscate(s.groqApiKey || '').trim();
      const o = StorageHelper.deobfuscate(s.ollamaApiKey || '').trim();
      const z = StorageHelper.deobfuscate(s.geminiApiKey || '').trim();
      const decision = resolveGoogleSignedInLayout({
        plan: _lastPlanNorm,
        creditsCount: _lastCreditsCount,
        hasGroq: !!g,
        hasOllama: !!o,
        hasGemini: !!z,
        byokForced: _byokForced,
      });
      if (decision.resetByokForced) {
        _byokForced = false;
      }
      setProviderVisibility(decision.managedUi);
      if (byokSwitchBtn) {
        byokSwitchBtn.classList.toggle('hidden', !decision.showByokSwitch);
      }
      groqSection.classList.toggle('hidden', isGoogleUser || activeProvider !== 'groq');
      ollamaSection.classList.toggle('hidden', isGoogleUser || activeProvider !== 'ollama');
      const podcastKeyCard = document.getElementById('podcastKeyCard');
      if (podcastKeyCard) podcastKeyCard.classList.toggle('hidden', isGoogleUser);
    } catch { /* ignore */ }
  }

  function renderAccountUI(session, credits) {
    const finishSignedInLayout = () => {
      void applyGoogleManagedVsByokLayout();
    };

    if (!session) {
      accountSignedOut.classList.remove('hidden');
      accountSignedIn.classList.add('hidden');
      setProviderVisibility(false);
      _byokForced = false;
      _lastPlanNorm = 'free';
      _lastCreditsCount = 0;
      if (byokSwitchBtn) byokSwitchBtn.classList.add('hidden');
      if (popupUpgradeProGroup) popupUpgradeProGroup.classList.add('hidden');
      return;
    }
    accountSignedOut.classList.add('hidden');
    accountSignedIn.classList.remove('hidden');

    const user = session.user || {};
    const meta = user.user_metadata || {};
    const email = user.email || meta.email || '';
    const name = meta.full_name || meta.name || email;
    const avatar = meta.avatar_url || meta.picture || '';

    accountEmail.textContent = name;
    accountEmail.title = email;

    if (avatar) {
      accountAvatar.replaceChildren();
      const img = document.createElement('img');
      img.src = avatar;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      accountAvatar.appendChild(img);
    } else {
      accountAvatar.textContent = (name || 'U')[0].toUpperCase();
    }

    const _updateCreditsUI = (plan, creditsCount, monthlyUsage, monthlyLimit) => {
      const planNorm = String(plan || '').toLowerCase();
      const isPro = planNorm === 'pro';
      const isCancelled = planNorm === 'cancelled';
      _lastPlanNorm = planNorm;
      _lastCreditsCount = creditsCount ?? 0;
      if (isPro) {
        _byokForced = false;
        accountPlan.innerHTML = '<span class="badge-pro">Pro</span>';
      } else if (isCancelled) {
        accountPlan.innerHTML = '<span class="badge-cancelled">Cancelled</span>';
      } else {
        accountPlan.innerHTML = '<span class="badge-free">Free</span>';
      }
      if (isPro && monthlyLimit) {
        const used = monthlyUsage ?? 0;
        const remaining = Math.max(monthlyLimit - used, 0);
        accountCredits.textContent = `${remaining.toLocaleString()} / ${monthlyLimit.toLocaleString()} credits this month`;
      } else if (isPro) {
        accountCredits.textContent = `${Math.max(creditsCount ?? 0, 0)} credits remaining`;
      } else if (isCancelled) {
        accountCredits.textContent = 'Subscription ended — upgrade to continue';
      } else {
        accountCredits.textContent = `${Math.max(creditsCount ?? 0, 0)} free credits remaining`;
      }
      // Upgrade CTAs live inside #accountSignedIn; only Pro subscribers hide them. Cancelled users keep Monthly/Yearly to resubscribe.
      if (popupUpgradeProGroup) {
        popupUpgradeProGroup.classList.toggle('hidden', isPro);
      }
      if (manageSubBtn) {
        manageSubBtn.classList.toggle('hidden', !isPro && !isCancelled);
      }
    };

    if (credits && credits.plan) {
      _updateCreditsUI(credits.plan, credits.credits, credits.monthly_usage, credits.monthly_limit);
      finishSignedInLayout();
    } else {
      accountPlan.innerHTML = '<span class="badge-free">Free</span>';
      accountCredits.textContent = 'Checking credits…';
      _lastPlanNorm = 'free';
      _lastCreditsCount = 0;
      if (popupUpgradeProGroup) popupUpgradeProGroup.classList.add('hidden');
      const credEpoch = accountRenderEpoch;
      chrome.runtime.sendMessage({ action: 'checkCredits' }).then((c) => {
        if (credEpoch !== accountRenderEpoch) return;
        if (accountSignedIn.classList.contains('hidden')) return;
        if (c && c.plan) _updateCreditsUI(c.plan, c.credits, c.monthly_usage, c.monthly_limit);
        else accountCredits.textContent = '';
        finishSignedInLayout();
      }).catch(() => {
        accountCredits.textContent = '';
        finishSignedInLayout();
      });
    }
  }

  if (byokSwitchBtn) {
    byokSwitchBtn.addEventListener('click', () => {
      _byokForced = true;
      setProviderVisibility(false);
      byokSwitchBtn.classList.add('hidden');
      setPopupTab('setup');
    });
  }

  googleSignInBtn.addEventListener('click', async () => {
    googleSignInBtn.disabled = true;
    googleSignInBtn.textContent = 'Signing in…';
    try {
      const res = await chrome.runtime.sendMessage({ action: 'supabaseSignIn' });
      if (res?.error) {
        if (res.authDebugTail) console.error('[YTAI-AUTH] sign-in trace:\n' + res.authDebugTail);
        throw new Error(res.error);
      }
      accountRenderEpoch++;
      renderAccountUI(res.session, res.credits);
    } catch (err) {
      googleSignInBtn.textContent = 'Sign in with Google';
      if (!/cancelled|user.*cancel/i.test(err.message)) {
        alert('Sign-in failed: ' + err.message);
      }
    } finally {
      googleSignInBtn.disabled = false;
      if (googleSignInBtn.textContent === 'Signing in…') {
        googleSignInBtn.textContent = 'Sign in with Google';
      }
    }
  });

  signOutBtn.addEventListener('click', async () => {
    accountRenderEpoch++;
    try {
      await chrome.runtime.sendMessage({ action: 'supabaseSignOut' });
    } finally {
      renderAccountUI(null, null);
      chrome.storage.session.remove('ytai_popup_cache').catch(() => {});
    }
  });

  if (manageSubBtn) {
    manageSubBtn.addEventListener('click', async () => {
      manageSubBtn.disabled = true;
      manageSubBtn.textContent = 'Opening…';
      try {
        const res = await chrome.runtime.sendMessage({ action: 'openPortal' });
        if (res?.error) throw new Error(res.error);
      } catch (err) {
        alert('Could not open subscription portal: ' + (err?.message || 'Unknown error'));
      } finally {
        manageSubBtn.disabled = false;
        manageSubBtn.textContent = 'Manage Subscription';
      }
    });
  }

  // Instant render from session cache, then refresh in background
  let _cacheHit = false;
  try {
    const cached = await chrome.storage.session.get('ytai_popup_cache');
    if (cached?.ytai_popup_cache?.session) {
      _cacheHit = true;
      renderAccountUI(cached.ytai_popup_cache.session, cached.ytai_popup_cache.credits);
    }
  } catch { /* no cache yet */ }
  const _freshCheck = async () => {
    const epochAtStart = accountRenderEpoch;
    try {
      const res = await chrome.runtime.sendMessage({ action: 'supabaseGetSession' });
      if (epochAtStart !== accountRenderEpoch) return;
      renderAccountUI(res?.session, res?.credits);
      const cachedSession = StorageHelper.sanitizeSessionForCache(res?.session || null);
      chrome.storage.session.set({ ytai_popup_cache: { session: cachedSession, credits: res?.credits || null } }).catch(() => {});
    } catch {
      if (epochAtStart !== accountRenderEpoch) return;
      if (!_cacheHit) renderAccountUI(null, null);
    }
  };
  if (_cacheHit) {
    _freshCheck();
  } else {
    await _freshCheck();
  }

  await loadSettings();

  // Check if user came from "Use My Own Key" button — force show BYOK sections
  try {
    const byokFlag = await chrome.storage.session.get('ytai_show_byok');
    if (byokFlag?.ytai_show_byok) {
      chrome.storage.session.remove('ytai_show_byok').catch(() => {});
      _byokForced = true;
      setProviderVisibility(false);
      if (byokSwitchBtn) byokSwitchBtn.classList.add('hidden');
      setPopupTab('setup');
    }
  } catch { /* ignore */ }

  await applyGoogleManagedVsByokLayout();

  // ── Provider Toggle ──
  providerBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeProvider = btn.dataset.provider;
      providerBtns.forEach((b) => b.classList.toggle('active', b === btn));
      groqSection.classList.toggle('hidden', isGoogleUser || activeProvider !== 'groq');
      ollamaSection.classList.toggle('hidden', isGoogleUser || activeProvider !== 'ollama');
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
      groqSection.classList.toggle('hidden', isGoogleUser || activeProvider !== 'groq');
      ollamaSection.classList.toggle('hidden', isGoogleUser || activeProvider !== 'ollama');

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

    const resetSaveBtn = () => {
      saveBtn.classList.remove('saving');
      saveBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        Save Settings
      `;
    };

    saveBtn.classList.add('saving');
    saveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" class="spin-icon">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
      </svg>
      Saving...
    `;

    try {
      const groqEnc = StorageHelper.tryObfuscate(groqKey);
      if (!groqEnc.ok) {
        resetSaveBtn();
        showStatus(groqKeyStatus, groqEnc.message, 'error');
        return;
      }
      const ollamaEnc = StorageHelper.tryObfuscate(ollamaKey);
      if (!ollamaEnc.ok) {
        resetSaveBtn();
        showStatus(ollamaKeyStatus, ollamaEnc.message, 'error');
        return;
      }
      const geminiEnc = StorageHelper.tryObfuscate(geminiKey);
      if (!geminiEnc.ok) {
        resetSaveBtn();
        showStatus(geminiKeyStatus, geminiEnc.message, 'error');
        return;
      }

      const settings = {
        provider: activeProvider,
        groqApiKey: groqEnc.value,
        ollamaApiKey: ollamaEnc.value,
        geminiApiKey: geminiEnc.value,
        model: groqModelSelect.value,
        ollamaModel: ollamaModelSelect.value,
        defaultMode: defaultModeSelect.value,
        language: languageSelect.value,
        autoRun: autoRunToggle.checked,
        cacheSummaries: cacheSummariesToggle.checked,
        cacheTranscripts: cacheTranscriptsToggle.checked
      };

      await chrome.storage.local.set(settings);

      if (!groqKey && !ollamaKey && !geminiKey) {
        _byokForced = false;
      }

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
        void applyGoogleManagedVsByokLayout();
        setTimeout(() => {
          saveBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            Save Settings
          `;
        }, 1500);
      }, 400);
    } catch (err) {
      resetSaveBtn();
      const statusEl = activeProvider === 'gemini' ? geminiKeyStatus
        : activeProvider === 'ollama' ? ollamaKeyStatus : groqKeyStatus;
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
