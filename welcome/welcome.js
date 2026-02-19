/**
 * YouTube AI Summarizer — Welcome / Onboarding Controller (v1.1)
 * User-controlled step progression with dual-provider support.
 */

document.addEventListener('DOMContentLoaded', () => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const steps       = [1, 2, 3];
  let currentStep   = 1;
  let chosenProvider = 'ollama';

  const step1         = $('#step1');
  const step2         = $('#step2');
  const step3         = $('#step3');
  const progressFill  = $('#progressFill');
  const step1Next     = $('#step1Next');
  const providerCards = $$('.provider-card');
  const step2Title    = $('#step2Title');
  const step2Desc     = $('#step2Desc');
  const providerLink  = $('#providerLink');
  const apiKeyInput   = $('#apiKeyInput');
  const toggleKeyVis  = $('#toggleKeyVis');
  const validateBtn   = $('#validateBtn');
  const valStatus     = $('#validationStatus');
  const privacyLink   = $('#privacyLink');

  // ── Provider selection ──
  providerCards.forEach((card) => {
    card.addEventListener('click', () => {
      providerCards.forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      chosenProvider = card.dataset.provider;
    });
  });

  // ── Step 1 → Step 2 ──
  step1Next.addEventListener('click', () => {
    goToStep(2);
    updateStep2ForProvider();
  });

  function updateStep2ForProvider() {
    if (chosenProvider === 'ollama') {
      step2Title.textContent = 'Enter Your Ollama API Key';
      step2Desc.textContent = 'Create an account on ollama.com and generate an API key.';
      providerLink.href = 'https://ollama.com/settings/keys';
      providerLink.textContent = 'ollama.com/settings/keys';
      apiKeyInput.placeholder = 'Paste your Ollama API key here';
    } else {
      step2Title.textContent = 'Enter Your Groq API Key';
      step2Desc.textContent = 'It takes 30 seconds. Create a free account and generate a key.';
      providerLink.href = 'https://console.groq.com/keys';
      providerLink.textContent = 'console.groq.com/keys';
      apiKeyInput.placeholder = 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx';
    }
  }

  // ── Toggle key visibility ──
  toggleKeyVis.addEventListener('click', () => {
    const isHidden = apiKeyInput.type === 'password';
    apiKeyInput.type = isHidden ? 'text' : 'password';
  });

  // ── Validate & Save ──
  validateBtn.addEventListener('click', handleValidate);
  apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleValidate();
  });

  async function handleValidate() {
    const key = apiKeyInput.value.trim();

    if (!key) {
      showValidation('Please enter your API key.', 'error');
      return;
    }

    if (chosenProvider === 'groq' && !key.startsWith('gsk_')) {
      showValidation('Groq API keys start with "gsk_". Please check your key.', 'error');
      return;
    }

    validateBtn.disabled = true;
    validateBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="animation:spin .8s linear infinite"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg> Validating...';
    showValidation('Checking your API key...', 'loading');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'validateApiKey',
        apiKey: key,
        provider: chosenProvider
      });

      if (response?.valid) {
        const storageData = {
          provider: chosenProvider,
          onboardingComplete: true
        };
        if (chosenProvider === 'ollama') {
          storageData.ollamaApiKey = key;
        } else {
          storageData.groqApiKey = key;
        }
        await chrome.storage.local.set(storageData);

        showValidation('API key is valid! Moving to the next step...', 'success');

        setTimeout(() => goToStep(3), 1200);
      } else {
        showValidation(response?.error || 'Invalid API key. Please check and try again.', 'error');
        resetValidateBtn();
      }
    } catch {
      showValidation('Connection error. Please try again.', 'error');
      resetValidateBtn();
    }
  }

  function resetValidateBtn() {
    validateBtn.disabled = false;
    validateBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Validate &amp; Save';
  }

  // ── Step Navigation ──
  function goToStep(num) {
    const allSteps = [step1, step2, step3];

    allSteps.forEach((s, i) => {
      const stepNum = i + 1;
      s.classList.remove('active', 'completed');

      if (stepNum < num) {
        s.classList.add('completed');
      } else if (stepNum === num) {
        s.classList.add('active');
      }
    });

    currentStep = num;
    progressFill.style.width = `${(num / steps.length) * 100}%`;

    allSteps[num - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Privacy ──
  privacyLink?.addEventListener('click', (e) => {
    e.preventDefault();
    const url = chrome.runtime.getURL('privacy-policy.html');
    chrome.tabs.create({ url }).catch(() => window.open(url, '_blank'));
  });

  // ── Already configured? ──
  chrome.storage.local.get(['groqApiKey', 'ollamaApiKey', 'provider', 'onboardingComplete'], (data) => {
    const hasKey = (data.provider === 'ollama' && data.ollamaApiKey) ||
                   (data.provider !== 'ollama' && data.groqApiKey);

    if (hasKey && data.onboardingComplete) {
      goToStep(3);
    }
  });

  function showValidation(msg, type) {
    valStatus.textContent = msg;
    valStatus.className = `validation-status ${type}`;
  }
});
