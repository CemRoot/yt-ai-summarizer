# YouTube AI Summarizer

> **Stop watching. Start reading.** Summarize any YouTube video for free with your own AI — no subscriptions, no hidden fees.

[![CI](https://github.com/CemRoot/yt-ai-summarizer/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/CemRoot/yt-ai-summarizer/actions/workflows/ci.yml)
![Manifest Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FCemRoot%2Fyt-ai-summarizer%2Fmain%2Fmanifest.json&query=%24.manifest_version&label=manifest&prefix=v&color=blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FCemRoot%2Fyt-ai-summarizer%2Fmain%2Fmanifest.json&query=%24.version&label=version&color=orange)

---

## What It Does

Turn any YouTube video into a concise, actionable summary in seconds. Bring your own AI key, choose your language, and get:

- **Summary** — Full picture in 3–5 clean paragraphs
- **Key Points** — 5–10 evidence-backed takeaways as a numbered list
- **Detailed Analysis** — Section-by-section breakdown with names, dates, data preserved
- **💬 Chat** — Ask follow-up questions about the video and get AI answers grounded in the transcript

All three are generated in a **single API call** — no rate limit issues.

---

## Features

| Feature | Details |
|---------|---------|
| **Dual AI Provider** | Choose between **Groq** (ultra-fast) or **Ollama Cloud** (flexible models). Switch anytime. |
| **20+ Languages** | Output in English, Türkçe, Español, Français, Deutsch, 日本語, 한국어, 中文 and more — regardless of video language. |
| **Modern UI/UX** | Seamless YouTube integration, underline-style tabs, smooth animations, Inter font. |
| **Dark & Light Mode** | Automatically matches YouTube's theme + system preference. |
| **Onboarding Flow** | Step-by-step welcome page with provider selection and guided API key setup. |
| **First-Visit Tooltip** | Animated "Hey! I'm here" bubble guides new users to the button. |
| **One-Click Copy** | Copy any analysis to clipboard instantly. |
| **Auto-Summarize** | Optional: generate summaries automatically when you open a video. |
| **Smart Caching (LRU)** | In-memory + persistent storage with LRU eviction (max 20 videos). Tab switching is instant. |
| **Fun Facts on Loading** | 50 rotating "Did you know?" facts keep you entertained while AI processes. |
| **🎙️ AI Podcast** | NotebookLM-style two-host podcast with randomly paired male & female voices. Powered by Gemini TTS — completely free. |
| **💬 Video Chat** | Ask follow-up questions about the video. AI answers strictly from the transcript with full conversation history. |
| **🖥️ Fullscreen-Aware** | Extension UI auto-hides in fullscreen mode for distraction-free viewing. |
| **🌍 Multi-Language Onboarding** | Welcome page auto-detects browser language with manual selector. 11 languages: EN, TR, ES, FR, DE, JA, KO, ZH, PT, AR, HI. |
| **SPA-Compatible** | Works seamlessly with YouTube's single-page navigation. |
| **CI/CD Pipeline** | GitHub Actions: manifest validation, JS syntax checks, security audit, automated packaging. |

---

## Getting Started

### 1. Install

```bash
# Clone the repo
git clone https://github.com/CemRoot/yt-ai-summarizer.git

# Or download the latest release ZIP
```

Then in Chrome:
1. Navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked** → select the extension folder

### 2. Get a Free API Key

Choose your provider:

| Provider | Get Key | Free Tier |
|----------|---------|-----------|
| **Ollama Cloud** (recommended) | [ollama.com/settings/keys](https://ollama.com/settings/keys) | Gemini 3 Flash, 10+ models, free tier |
| **Groq** | [console.groq.com/keys](https://console.groq.com/keys) | 30 RPM, up to 500K tokens/day |

### 3. Configure & Go

1. Click the extension icon → paste your API key
2. Pick your AI model and output language
3. Open any YouTube video → click the floating brain icon
4. Done. Summaries in seconds.

---

## How It Works

```
YouTube Video → Extract Transcript → Send to AI Provider → Parse 3 Sections → Display
                                   ↳ Chat Mode → Transcript + Question + History → AI Answer
```

1. **Transcript Extraction** — Pulls caption data directly from YouTube using Android client context (no external APIs).
2. **Combined AI Call** — A single prompt generates Summary + Key Points + Detailed Analysis simultaneously.
3. **Robust Parsing** — 4-layer parser: exact delimiters → regex variants → heuristic headings → smart split.
4. **Instant Display** — Results shown in a native-feeling side panel. Switch tabs instantly from cache.
5. **Conversational Chat** — Chat tab sends questions alongside the transcript and conversation history for context-aware answers.

---

## AI Models

### Groq

| Model | Speed | Quality | Best For |
|-------|-------|---------|----------|
| Llama 3.3 70B | ⚡⚡ | ★★★★★ | Highest quality summaries |
| Llama 3.1 8B | ⚡⚡⚡ | ★★★ | Fast results, higher rate limit |
| Llama 4 Scout 17B | ⚡⚡ | ★★★★ | New generation model |
| Qwen3 32B | ⚡⚡ | ★★★★ | Strong reasoning |

### Ollama Cloud

| Model | Size | Best For |
|-------|------|----------|
| **Gemini 3 Flash** ⭐ | — | **Recommended** — Fast & high quality |
| Qwen3-Next 80B | 80B | Reasoning & thinking |
| DeepSeek V3.2 | 671B | Most powerful |
| GPT-OSS 120B | 120B | General purpose |
| Kimi K2.5 | — | Multimodal |
| Devstral Small | 24B | Code-focused |

---

## Project Structure

```
yt-ai-summarizer/
├── manifest.json              # Extension manifest (V3)
├── service-worker.js          # Background: AI calls, routing, parsing
├── content/
│   ├── content.js             # Main controller (cache, SPA nav, chat)
│   ├── content.css            # Panel styles + dark/light theme + chat UI
│   ├── transcript.js          # YouTube transcript extraction
│   ├── ui.js                  # Panel UI, tabs, chat interface, onboarding tooltip
│   ├── podcast.js             # Podcast audio player
│   └── page-bridge.js         # MAIN world bridge for YT data
├── popup/
│   ├── popup.html             # Settings panel (dual provider)
│   ├── popup.js               # Settings logic
│   └── popup.css              # Modern card-based styles
├── welcome/
│   ├── welcome.html           # Step-by-step onboarding
│   ├── welcome.js             # Provider selection & validation
│   └── welcome.css            # Onboarding styles
├── utils/
│   └── storage.js             # Provider-aware storage helpers
├── icons/                     # Extension icons (16, 48, 128px)
├── _locales/
│   ├── en/messages.json       # English strings
│   └── tr/messages.json       # Turkish strings
├── privacy-policy.html        # Privacy policy (bundled with extension)
├── privacy-policy.js          # TOC highlight script for privacy page
├── docs/                      # GitHub Pages (uninstall feedback, etc.)
│   ├── index.html
│   └── uninstall.html
├── .github/workflows/
│   ├── ci.yml                 # CI/CD pipeline
│   └── github-pages.yml       # Deploy docs/ to GitHub Pages
└── README.md
```

---

## CI/CD Pipeline

Every push to `main` triggers 5 automated checks:

| Job | What It Does |
|-----|-------------|
| **Manifest Check** | Validates JSON, required fields, manifest_version 3, referenced file existence |
| **JS Lint** | Syntax checks on all `.js` files, JSON validation, HTML structure checks |
| **Security Audit** | Scans for hardcoded API keys, `eval()`, `document.write()`, CSP validation, host permission audit |
| **Version Consistency** | Ensures version numbers match across manifest.json, privacy-policy.html, and README.md |
| **Build & Package** | Creates versioned `.zip` artifact for Chrome Web Store submission |

### Automated Maintenance

| Workflow | Schedule | What It Does |
|----------|----------|-------------|
| **YouTube Version Monitor** | Mon & Thu 09:00 UTC | Compares ANDROID client version against NewPipeExtractor, auto-creates PR if outdated |
| **Transcript Health Check** | Daily 06:00 UTC | Tests InnerTube caption extraction against a known video, opens GitHub Issue on failure |

---

## Privacy

- **Zero data collection** — no analytics, no tracking, no telemetry
- **Local storage only** — API keys and settings stay in `chrome.storage.local` on your device
- **Direct API calls** — transcripts and chat prompts go only to the AI hosts you enabled (Groq, Ollama Cloud, Gemini TTS)
- **Permissions** — `storage`, `activeTab`, plus declared host access for YouTube and those providers (see `manifest.json`)
- **Open source** — inspect every line of code

See the full [Privacy Policy](privacy-policy.html).

### Uninstall feedback URL (custom domain)

After uninstall, Chrome opens a page you host over **HTTPS** (required by `chrome.runtime.setUninstallURL`). This project uses your portfolio domain:

**https://cemkoyluoglu.codes/yt-ai-summarizer/uninstall.html**

The constant `UNINSTALL_FEEDBACK_URL` in `service-worker.js` must match that URL exactly (including `www` vs apex if you standardize on one).

**Deploy on Vercel (portfolio site):**

1. In this repo, the canonical HTML is [`docs/uninstall.html`](docs/uninstall.html).
2. In your **portfolio** Vercel project, add the same file at **`public/yt-ai-summarizer/uninstall.html`** (Next.js, Vite, or any setup that serves `public/` at the site root).
3. Deploy. Confirm the URL loads in an incognito window.
4. Whenever you change `docs/uninstall.html` here, copy it to the portfolio repo again and redeploy — then ship a new extension version if the URL path ever changes.

**Why not `github.io`?** Users only see the domain above; `cemroot.github.io` is no longer used for uninstall.

**Optional — GitHub Pages backup:** [`.github/workflows/github-pages.yml`](.github/workflows/github-pages.yml) can still publish `docs/` for your own testing or redirects; the extension does not point there unless you change `UNINSTALL_FEEDBACK_URL` back.

---

## Requirements

- Chrome 111 or later
- A free API key from [Groq](https://console.groq.com/keys) or [Ollama](https://ollama.com/settings/keys)

---

## Pre-release checklist (maintainers)

- **Security:** CI runs secret-pattern grep, CSP check, and manifest file references — keep `host_permissions` minimal.
- **Debug noise:** No `console.log` / `console.warn` / `debugger` in shipping paths; `console.error` is only used for serious failures (e.g. missing content-script dependencies).
- **Architecture:** Prefer ES classes and shared helpers (`StorageHelper`, controllers, UI modules) — avoid duplicating secrets or API base URLs outside `utils/storage.js` / `service-worker.js`.
- **Versions:** `manifest.json`, `privacy-policy.html`, and the top README changelog entry must stay aligned (enforced by the **Version Consistency** CI job).
- **Uninstall page:** After editing `docs/uninstall.html`, copy it to the portfolio Vercel project at `public/yt-ai-summarizer/uninstall.html` and redeploy so it matches `UNINSTALL_FEEDBACK_URL`.

---

## Troubleshooting

### "This extension is not trusted by Enhanced Safe Browsing"

This warning appears for **all new extensions** on the Chrome Web Store. It is **not** a security issue — it simply means the developer account hasn't yet built a long enough compliance history with Google. The warning disappears automatically after a few months. You can safely click **"Continue to install"** to proceed.

### CRX_FILE_NOT_READABLE on reinstall

If you uninstall the extension and immediately try to reinstall from the Chrome Web Store, Chrome may show a `CRX_FILE_NOT_READABLE` error. This is caused by Chrome's internal download cache holding a stale reference.

**Fix:** Close Chrome completely, reopen it, then install the extension again from the Web Store. This clears Chrome's session cache and allows a fresh download.

### Extension not appearing on YouTube

- Make sure you're on `youtube.com` (not an embedded player)
- Check that the extension is enabled at `chrome://extensions/`
- Try refreshing the YouTube page (Ctrl+R / Cmd+R)
- If you just installed, wait a moment and navigate to a new video

---

## Changelog

### v1.7.2

- **🔗 Uninstall URL**: Post-uninstall page now opens on **https://cemkoyluoglu.codes/yt-ai-summarizer/uninstall.html** (portfolio / Vercel) instead of GitHub Pages — same markup as `docs/uninstall.html`; host that file under `public/yt-ai-summarizer/` on Vercel.

### v1.7.1

- **📄 Privacy policy**: Redesigned layout and copy (Chat, Gemini TTS, storage, permissions). Last updated date refreshed.
- **🌐 GitHub Pages**: `docs/index.html` landing polish; uninstall page uses an inline SVG favicon (no missing `favicon.png` on Pages).
- **📖 README**: Project structure, Pages/uninstall URL, optional custom-domain notes, maintainer pre-release checklist.
- **🔧 Version sync**: Patch bump so store/build artifacts match the updated bundled `privacy-policy.html`.

### v1.7.0

- **💬 Interactive Video Chat**: New "Chat" tab lets you ask follow-up questions about the video. AI answers strictly from the transcript with full conversation history (last 10 messages). Works with all providers (Groq, Ollama, Gemini).
- **🖥️ Fullscreen Auto-Hide**: Extension toggle button and panel automatically hide when YouTube enters fullscreen mode — no more UI clutter during cinema viewing.
- **🧹 Pre-Release Cleanup**: Removed routine `console.log` / `console.warn` debugging from production paths; `console.error` remains only for serious failures (e.g. missing dependencies).
- **🐛 Podcast Rate Bug Fix**: Fixed a race condition in `podcast.js` where changing playback speed caused a small seek jump. Position is now captured before the rate changes.
- **📏 Chat Context Alignment**: Chat transcript context window set to 80K characters, matching the summary pipeline.

### v1.6.4

- **Gemini TTS Stable Upgrade**: Migrated from `gemini-2.5-flash-preview-tts` (preview) to `gemini-2.5-flash-tts` (stable GA). Preview models can be removed by Google without notice; stable GA ensures long-term reliability.
- **Auto-Merge Pipeline**: Version Monitor PRs now auto-merge via squash after all CI checks pass — zero manual intervention needed.
- **Branch Protection**: All PRs require 5 CI checks before merging (Manifest, Lint, Security, Version Consistency, Build).
- **CODEOWNERS**: Critical files auto-assign @CemRoot as reviewer on PRs.

### v1.6.3

- **Fix Empty Transcript**: Updated YouTube InnerTube ANDROID client from v19.29.37 to v21.03.36 (SDK 35, Android 15). YouTube was rejecting the outdated client version and returning empty captions.
- **Dynamic Client Version**: Extension now auto-extracts YouTube's current WEB client version at runtime as a fallback when the ANDROID client fails. No more manual version updates for WEB client changes.
- **YouTube Version Monitor**: New GitHub Actions workflow checks NewPipeExtractor twice a week and auto-creates PRs when the ANDROID client version is outdated.
- **Transcript Health Check**: Daily automated probe tests InnerTube caption extraction and opens a GitHub Issue if transcript fetching is broken.
- **Version Consistency CI**: New CI job ensures version numbers stay in sync across manifest.json, privacy-policy.html, and README.md.
- **Uninstall URL**: Added `uninstall_url` to manifest for post-uninstall feedback and reinstall guidance.
- **Troubleshooting Guide**: Added FAQ section to README covering Enhanced Safe Browsing warning, CRX_FILE_NOT_READABLE reinstall issue, and common setup questions.

### v1.6.2

- **Version Bump**: Force Chrome Web Store CRX regeneration to resolve CDN caching issues.

### v1.6.1

- **🎛️ New Language Selector**: Searchable, two-column language menu with flags and modern "pill" trigger on the welcome page.
- **💾 Cache Controls**: Added "Cache summaries" and "Cache transcripts" toggles to settings; transcript caching disabled by default, reducing RAM/disk usage.
- **🔐 API Key Obfuscation**: Keys stored with XOR + Base64 encoding in chrome.storage instead of plaintext.
- **🔧 Aligned Defaults**: Provider and model defaults now match across all entry points — Ollama + Gemini 3 Flash.
- **🗑️ Quick Cache Clear**: One-click trash icon in the panel header to clear cached data.
- **🔒 CI Security Checks**: Obfuscation and sender.id validation checks added to the CI pipeline.
- **🌍 Welcome Page i18n Fix**: Fixed a bug where instruction steps, Validate button, and footer stayed in English when switching languages.

### v1.6.0

- **🎭 Random Voice Pairs**: Podcast voices are no longer always male-male. 10 voice pair combinations with male-female, female-male, and female-female options randomly selected per video. Uses Gemini TTS voices: Charon, Kore, Puck, Aoede, Fenrir, Leda, Orus, Zephyr.
- **🌍 Multi-Language Welcome Page**: Onboarding page now supports 11 languages (English, Türkçe, Español, Français, Deutsch, 日本語, 한국어, 中文, Português, العربية, हिन्दी). Auto-detects browser language with manual language selector. RTL support for Arabic.
- **📋 Inline Gemini API Key**: Removed "Open Settings" redirect. Users can now enter their Gemini API key directly inside the podcast panel without leaving the page.
- **🔒 Security Audit**: Comprehensive code review — no XSS vectors, API keys stored safely in chrome.storage.local, all user input sanitized with escapeHtml, CSP enforced, no eval/document.write usage.
- **📄 Privacy Policy**: Updated to include Google Gemini TTS data flow and host permission documentation.
- **Step 3 updated**: "How It Works" now mentions the Podcast mode alongside Summary, Key Points, and Detailed Analysis.

### v1.5.0

- **🎙️ Gemini TTS Podcast**: Replaced Web Speech API with Google Gemini 2.5 Flash TTS
  - Near-human quality voices (Charon for Alex, Puck for Sam)
  - Multi-speaker audio generated as a single audio file
  - Real audio player: play/pause, seek bar, 10s skip, speed control (0.75x–1.5x)
  - Audio duration displayed, progress bar click-to-seek
- **Gemini API Key**: New settings field for free Gemini API key (no credit card needed)
- **Guided setup**: Step-by-step instructions shown when Gemini key is missing
- **Region restrictions**: Friendly "not available" messages for unsupported regions (China, Iran, Russia, North Korea) in their native languages
- **Error handling**: Specific messages for GEMINI_REGION_BLOCKED, GEMINI_RATE_LIMITED, GEMINI_KEY_MISSING

### v1.4.0

- **🎙️ AI Podcast**: NotebookLM-style two-host podcast generated from video summaries
  - AI writes a natural conversation script between two hosts (Alex & Sam)
  - Web Speech API plays it with two distinct voices — completely free, no extra API needed
  - Full podcast player: play/pause, skip forward/back, speed control (0.75x–1.5x)
  - Live subtitles showing who's speaking and what they're saying
  - Scrollable transcript with click-to-jump navigation
  - Podcast tab added alongside Summary, Key Points, and Detailed Analysis
- New `podcast.js` engine: voice selection, state management, sequential speech playback

### v1.3.0

- **Fun Facts**: 50 rotating "Did you know?" facts displayed during AI processing to keep users entertained
- **Default provider changed**: Ollama Cloud is now the recommended provider (was Groq)
- **Recommended model**: Gemini 3 Flash set as default for Ollama Cloud
- Welcome page, popup, and storage defaults all updated to reflect Ollama Cloud + Gemini 3 Flash
- Facts rotate every 5 seconds with smooth fade animation

### v1.2.3

- Performance: ~3x faster for long videos (chunk size 24K → 80K, parallel processing)
- Most 1-hour videos now fit in a single chunk — no pre-summarization needed
- Remaining chunks processed in parallel batches of 3 via `Promise.all()`

### v1.2.2

- LRU cache algorithm: max 20 videos cached, oldest auto-evicted when limit is reached
- Each video stores up to 4 keys (3 summaries + 1 transcript), max ~800 KB total
- Cache reads update `lastAccessed` timestamp — frequently watched videos stay cached longer
- `clearCache()` now also wipes the LRU index

### v1.2.1

- Fixed: Toggle button not appearing on SPA navigation (broadened content script matching)
- Added: "Summarize this video?" start prompt — no API call until user clicks Start (saves credits)
- Localized start prompt in 8 languages (EN, TR, ES, FR, DE, JA, KO, ZH)
- Fixed: CI false positive on placeholder API keys

### v1.2.0

- Dual AI provider support (Groq + Ollama Cloud)
- Complete UI/UX redesign (Inter font, card-based settings, underline tabs)
- 20+ language support with flag emojis in selector
- First-visit onboarding tooltip ("Hey! I'm here")
- Robust 4-layer response parser (fixes all-tabs-same-content bug)
- GitHub Actions CI/CD pipeline
- Updated privacy policy for both providers
- Marketing-focused Chrome Web Store descriptions

### v1.0.2

- Fix: credentials added to all YouTube fetch calls

### v1.0.1

- Fix: empty transcript bug in transcript extraction

### v1.0.0

- Initial release

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes
4. Push and open a Pull Request

---

## License

MIT License — free to use, modify, and distribute.

---

<p align="center">
  Built for people who learn faster by reading.<br>
  Built by people who got tired of 45-minute videos with 3 minutes of useful content.
</p>
