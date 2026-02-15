/**
 * YouTube AI Summarizer - Welcome/Onboarding Page Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKeyInput');
  const validateBtn = document.getElementById('validateBtn');
  const validationStatus = document.getElementById('validationStatus');
  const privacyLink = document.getElementById('privacyLink');

  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');

  // Privacy policy link
  privacyLink?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('privacy-policy.html') });
  });

  // Validate API key
  validateBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showValidation('Please enter your API key.', 'error');
      return;
    }

    if (!apiKey.startsWith('gsk_')) {
      showValidation('Groq API keys start with "gsk_". Please check your key.', 'error');
      return;
    }

    // Show loading
    validateBtn.disabled = true;
    validateBtn.textContent = 'Validating...';
    showValidation('Checking your API key...', 'loading');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'validateApiKey',
        apiKey: apiKey
      });

      if (response?.valid) {
        // Save the API key
        await chrome.storage.local.set({
          groqApiKey: apiKey,
          onboardingComplete: true
        });

        showValidation('API key is valid! You\'re all set.', 'success');

        // Animate to next steps
        setTimeout(() => {
          step1.classList.remove('active');
          step1.classList.add('completed');
          step2.classList.add('active');

          setTimeout(() => {
            step2.classList.remove('active');
            step2.classList.add('completed');
            step3.classList.add('active');
          }, 800);
        }, 500);
      } else {
        showValidation(
          `Invalid API key: ${response.error || 'Please check and try again.'}`,
          'error'
        );
        validateBtn.disabled = false;
        validateBtn.textContent = 'Validate & Save';
      }
    } catch (error) {
      showValidation('Connection error. Please try again.', 'error');
      validateBtn.disabled = false;
      validateBtn.textContent = 'Validate & Save';
    }
  });

  // Allow Enter key to submit
  apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      validateBtn.click();
    }
  });

  // Check if API key already exists
  chrome.storage.local.get(['groqApiKey', 'onboardingComplete'], (data) => {
    if (data.groqApiKey && data.onboardingComplete) {
      // Already set up, show all steps as completed
      step1.classList.remove('active');
      step1.classList.add('completed');
      step2.classList.add('completed');
      step3.classList.add('active');
      // Do NOT populate API key in input for security -- just show indicator
      apiKeyInput.placeholder = 'API key already configured';
      apiKeyInput.disabled = true;
    }
  });

  function showValidation(message, type) {
    validationStatus.textContent = message;
    validationStatus.className = `validation-status ${type}`;
  }
});
