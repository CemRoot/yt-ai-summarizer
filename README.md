# YouTube AI Summarizer

> Summarize any YouTube video instantly with AI. Get key points, summaries, and detailed analysis without watching the full video.

## Features

- **AI-Powered Summaries** — Get concise summaries of any YouTube video with captions
- **Three Analysis Modes:**
  - **Summary** — 3-5 paragraph overview of the video content
  - **Key Points** — Numbered list of the most important takeaways
  - **Detailed Analysis** — Section-by-section breakdown
- **Multiple Languages** — Supports 12+ languages for AI responses
- **Dark/Light Theme** — Automatically matches YouTube's theme
- **Transcript Caching** — Avoids redundant API calls for the same video
- **SPA-Compatible** — Works seamlessly with YouTube's single-page navigation
- **Compact UI** — Collapsible side panel that doesn't interfere with video playback

## Getting Started

### 1. Install the Extension
- Download or clone this repository
- Open Chrome and navigate to `chrome://extensions/`
- Enable **Developer mode** (toggle in top-right)
- Click **Load unpacked** and select the extension folder

### 2. Get a Free Groq API Key
- Visit [console.groq.com/keys](https://console.groq.com/keys)
- Sign up for a free account
- Create a new API key and copy it

### 3. Configure the Extension
- Click the extension icon in your Chrome toolbar
- Paste your Groq API key
- Choose your preferred model and settings
- Save!

### 4. Start Summarizing
- Go to any YouTube video
- Click the floating brain icon (bottom-right of the page)
- Choose your analysis mode and get instant AI summaries!

## How It Works

```
YouTube Video Page → Extract Transcript → Send to Groq AI → Display Summary
```

1. **Transcript Extraction**: The extension extracts the video's caption/subtitle data directly from YouTube's page data (no external APIs needed for this step).
2. **AI Processing**: The transcript is sent to Groq's fast AI API (powered by Llama models) for summarization.
3. **Result Display**: The AI-generated summary is displayed in a compact side panel on the YouTube page.

## Tech Stack

- **Chrome Extension Manifest V3** — Latest extension platform
- **Groq API** — Ultra-fast AI inference (free tier available)
- **Llama 3.3 70B** — High-quality language model for summarization
- **Vanilla JavaScript** — No frameworks, minimal footprint

## AI Models

| Model | Speed | Quality | Rate Limit |
|-------|-------|---------|------------|
| Llama 3.1 8B (Fast) | ⚡⚡⚡ | ★★★ | 30 RPM, 500K TPD |
| Llama 3.3 70B (Balanced) | ⚡⚡ | ★★★★★ | 30 RPM, 100K TPD |

## Project Structure

```
Chrome-extention/
├── manifest.json            # Extension manifest (V3)
├── service-worker.js        # Background service worker
├── content/
│   ├── content.js           # Main content script controller
│   ├── content.css          # Injected panel styles
│   ├── transcript.js        # YouTube transcript extraction
│   └── ui.js                # Panel UI management
├── popup/
│   ├── popup.html           # Settings popup
│   ├── popup.js             # Settings logic
│   └── popup.css            # Popup styles
├── welcome/
│   ├── welcome.html         # Onboarding page
│   ├── welcome.js           # Onboarding logic
│   └── welcome.css          # Onboarding styles
├── utils/
│   └── storage.js           # Chrome storage helpers
├── icons/                   # Extension icons (16, 48, 128px)
├── _locales/
│   ├── en/messages.json     # English translations
│   └── tr/messages.json     # Turkish translations
├── privacy-policy.html      # Privacy policy page
└── README.md
```

## Privacy

- **No data collection** — We don't collect any personal information
- **Local storage only** — Your API key and settings stay in your browser
- **No tracking** — No analytics, ads, or tracking of any kind
- **Minimal permissions** — Only `storage` and `activeTab` required

See [Privacy Policy](privacy-policy.html) for full details.

## Chrome Web Store

This extension is designed to be published on the Chrome Web Store. It complies with:
- Manifest V3 requirements
- Chrome Web Store content policies
- Single purpose policy
- Permission justification requirements
- Privacy policy requirements

## Requirements

- Chrome 88 or later
- A free Groq API key ([get one here](https://console.groq.com/keys))

## License

MIT License — feel free to use, modify, and distribute.
