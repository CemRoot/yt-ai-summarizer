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
```

1. **Transcript Extraction** — Pulls caption data directly from YouTube using Android client context (no external APIs).
2. **Combined AI Call** — A single prompt generates Summary + Key Points + Detailed Analysis simultaneously.
3. **Robust Parsing** — 4-layer parser: exact delimiters → regex variants → heuristic headings → smart split.
4. **Instant Display** — Results shown in a native-feeling side panel. Switch tabs instantly from cache.

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
│   ├── content.js             # Main controller (cache, SPA nav)
│   ├── content.css            # Panel styles + dark/light theme
│   ├── transcript.js          # YouTube transcript extraction
│   ├── ui.js                  # Panel UI, tabs, onboarding tooltip
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
├── privacy-policy.html        # Privacy policy (Groq + Ollama)
├── .github/workflows/ci.yml   # CI/CD pipeline
└── README.md
```

---

## CI/CD Pipeline

Every push to `main` triggers 4 automated checks:

| Job | What It Does |
|-----|-------------|
| **Manifest Check** | Validates JSON, required fields, manifest_version 3, referenced file existence |
| **JS Lint** | Syntax checks on all `.js` files, JSON validation, HTML structure checks |
| **Security Audit** | Scans for hardcoded API keys, `eval()`, `document.write()`, CSP validation, host permission audit |
| **Build & Package** | Creates versioned `.zip` artifact for Chrome Web Store submission |

---

## Privacy

- **Zero data collection** — no analytics, no tracking, no telemetry
- **Local storage only** — API keys and settings never leave your browser
- **Direct API calls** — transcripts go straight to your chosen AI provider
- **Minimal permissions** — only `storage` and `activeTab`
- **Open source** — inspect every line of code

See the full [Privacy Policy](privacy-policy.html).

---

## Requirements

- Chrome 111 or later
- A free API key from [Groq](https://console.groq.com/keys) or [Ollama](https://ollama.com/settings/keys)

---

## Changelog

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
