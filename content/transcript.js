/**
 * TranscriptExtractor — YouTube Caption Extraction Engine
 * @architecture Singleton class
 * @version 2.0.0 — OOP refactor
 *
 * Caption track sources, tried in order until one yields a real transcript
 * (see #getTrackSources):
 *  1. Innertube player API — ANDROID client
 *  2. Innertube player API — IOS client (independent of the ANDROID version)
 *  3. Innertube player API — WEB client
 *  4. Page bridge (MAIN world) — YouTube's live player object
 *  5. Script-tag parsing — embedded JSON in page HTML
 *  6. Service-worker proxy — re-fetches watch page server-side
 *
 * A source is only "done" once its track actually returns entries. YouTube
 * serves caption URLs that answer HTTP 200 with an empty body, so a source
 * can list tracks that are all unusable; the next source must still be tried.
 *
 * Transcript fetch priority:
 *  1. Direct content-script fetch (JSON3, then XML)
 *  2. Service-worker proxy (bypasses CORS/redirect issues)
 */
class TranscriptExtractor {

  static #instance = null;

  // Kept current by GitHub Actions (youtube-version-monitor.yml)
  #ANDROID_CFG = {
    clientName: 'ANDROID',
    clientVersion: '21.03.36',
    androidSdkVersion: 35,
    osVersion: '15',
    platform: 'MOBILE'
  };

  // Independent second client: a different clientName with its own version
  // string, so a block or version bump on ANDROID cannot take captions down
  // on its own. Verified to return identical caption tracks to ANDROID.
  #IOS_CFG = {
    clientName: 'IOS',
    clientVersion: '20.10.4',
    deviceModel: 'iPhone16,2',
    osVersion: '18.3.2.22D82',
    platform: 'MOBILE'
  };

  #cachedWebVersion = null;
  #requestGeneration = 0;
  #activeRequestVideoId = null;

  constructor() {
    if (TranscriptExtractor.#instance) return TranscriptExtractor.#instance;
    TranscriptExtractor.#instance = this;
  }

  static getInstance() {
    if (!TranscriptExtractor.#instance) {
      TranscriptExtractor.#instance = new TranscriptExtractor();
    }
    return TranscriptExtractor.#instance;
  }

  #debugLog(...args) {
    if (globalThis.__YTAI_DEBUG_TRANSCRIPT === true) {
      console.debug('[YTAI][Transcript]', ...args);
    }
  }

  #getRuntimeConfig() {
    const cfg = globalThis.__YTAI_TRANSCRIPT_RUNTIME_CONFIG || {};
    const effectiveDelays = Array.isArray(cfg.retryDelaysMs) && cfg.retryDelaysMs.length > 0
      ? cfg.retryDelaysMs
      : [600, 1500, 3000, 4000];
    return {
      retryDelaysMs: effectiveDelays,
      maxAttempts: Number.isInteger(cfg.maxAttempts) && cfg.maxAttempts > 0
        ? cfg.maxAttempts
        : 4,
      readinessTimeoutMs: Number.isInteger(cfg.readinessTimeoutMs) && cfg.readinessTimeoutMs > 0
        ? cfg.readinessTimeoutMs
        : 5000,
      readinessPollMs: Number.isInteger(cfg.readinessPollMs) && cfg.readinessPollMs > 0
        ? cfg.readinessPollMs
        : 250
    };
  }

  #sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  #getAvailabilityErrorForAttempt(attempt, attempts) {
    return new Error(attempt < attempts ? 'TRANSCRIPT_NOT_READY' : 'TRANSCRIPT_UNAVAILABLE');
  }

  #getEmptyTranscriptErrorForAttempt(attempt, attempts) {
    return new Error(attempt < attempts ? 'TRANSCRIPT_EMPTY_RETRYABLE' : 'TRANSCRIPT_EMPTY_FINAL');
  }

  #retryDelayForAttempt(attempt, delays) {
    // `attempt` is 1-based; delay arrays are 0-based.
    return delays[Math.min(attempt - 1, delays.length - 1)];
  }

  #beginRequestContext(videoId) {
    if (this.#activeRequestVideoId !== videoId) {
      this.#activeRequestVideoId = videoId;
      this.#requestGeneration += 1;
    }
    return { videoId, generation: this.#requestGeneration };
  }

  #assertRequestContext(ctx) {
    const currentVideoId = this.getVideoId();
    if (
      this.#requestGeneration !== ctx.generation
      || this.#activeRequestVideoId !== ctx.videoId
      || currentVideoId !== ctx.videoId
    ) {
      throw new Error('TRANSCRIPT_REQUEST_STALE');
    }
  }

  #isPlayerReadyForVideo(videoId) {
    try {
      const player = document.querySelector('#movie_player');
      if (!player) return false;
      if (typeof player.getVideoData === 'function') {
        const data = player.getVideoData();
        if (data?.video_id && data.video_id !== videoId) return false;
      }
      if (typeof player.getPlayerResponse === 'function') {
        const response = player.getPlayerResponse();
        const responseVideoId = response?.videoDetails?.videoId;
        if (responseVideoId && responseVideoId !== videoId) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  #getCaptionTracksQuick() {
    try {
      const player = document.querySelector('#movie_player');
      if (player && typeof player.getPlayerResponse === 'function') {
        const responseTracks = player.getPlayerResponse()?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (responseTracks?.length) return responseTracks.map(t => this.#mapRawTrack(t));
      }
    } catch {}

    try {
      const initTracks = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (initTracks?.length) return initTracks.map(t => this.#mapRawTrack(t));
    } catch {}

    return this.#extractTracksFromPageScripts();
  }

  async #waitForTranscriptReadiness(ctx, preferredLang) {
    // Resolves only when lightweight player/caption readiness signals are present.
    // Throws TRANSCRIPT_NOT_READY when readiness does not arrive within the bounded window.
    const { readinessTimeoutMs, readinessPollMs } = this.#getRuntimeConfig();
    const start = Date.now();

    while (Date.now() - start < readinessTimeoutMs) {
      this.#assertRequestContext(ctx);

      if (this.#isPlayerReadyForVideo(ctx.videoId)) {
        const tracks = this.#getCaptionTracksQuick();
        if (tracks?.length) {
          const { track } = this.#selectBestTrack(tracks, preferredLang, null);
          if (track?.baseUrl) {
            return;
          }
        }
      }

      await this.#sleep(readinessPollMs);
    }

    throw new Error('TRANSCRIPT_NOT_READY');
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  getVideoId() {
    try {
      const url = new URL(window.location.href);
      const v = url.searchParams.get('v');
      if (v) return v;
      const shorts = url.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shorts) return shorts[1];
      const embed = url.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embed) return embed[1];
    } catch { /* ignore */ }
    return null;
  }

  formatTimestamp(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  #mapRawTrack(track) {
    return {
      baseUrl: track.baseUrl,
      language: track.languageCode,
      name: track.name?.simpleText || track.name?.runs?.[0]?.text || track.languageCode,
      isAutoGenerated: track.kind === 'asr',
      vssId: track.vssId
    };
  }

  // ─── Balanced JSON/Array extraction (string-aware) ─────────────────

  #extractBalancedJSON(text, startIdx) {
    const jsonStart = text.indexOf('{', startIdx);
    if (jsonStart === -1) return null;
    let depth = 0, inString = false, escaped = false;
    for (let i = jsonStart; i < text.length; i++) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(text.substring(jsonStart, i + 1)); } catch { return null; }
        }
      }
    }
    return null;
  }

  #extractBalancedArray(text, startIdx) {
    const arrStart = text.indexOf('[', startIdx);
    if (arrStart === -1) return null;
    let depth = 0, inString = false, escaped = false;
    for (let i = arrStart; i < text.length; i++) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(text.substring(arrStart, i + 1)); } catch { return null; }
        }
      }
    }
    return null;
  }

  // ─── YouTube client version ────────────────────────────────────────

  #extractWebClientVersion() {
    if (this.#cachedWebVersion) return this.#cachedWebVersion;
    try {
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        const t = s.textContent;
        if (!t || !t.includes('INNERTUBE_CLIENT_VERSION')) continue;
        const m = t.match(/INNERTUBE_CLIENT_VERSION["']\s*:\s*["']([^"']+)/);
        if (m) { this.#cachedWebVersion = m[1]; return m[1]; }
      }
    } catch {}
    return null;
  }

  async #innertubePlayerRequest(videoId, clientConfig) {
    const resp = await fetch('/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { hl: 'en', gl: 'US', ...clientConfig } },
        videoId
      })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null;
  }

  // ─── Innertube player API (ANDROID / IOS / WEB clients) ───────────

  async #getCaptionTracksForClient(clientConfig) {
    try {
      const videoId = this.getVideoId();
      if (!videoId) return null;
      const tracks = await this.#innertubePlayerRequest(videoId, clientConfig);
      if (tracks?.length) return tracks.map(t => this.#mapRawTrack(t));
    } catch {}
    return null;
  }

  async #getCaptionTracksViaWebClient() {
    const webVer = this.#extractWebClientVersion();
    if (!webVer) return null;
    return this.#getCaptionTracksForClient({
      clientName: 'WEB', clientVersion: webVer, platform: 'DESKTOP'
    });
  }

  // ─── Method 1: Page bridge (MAIN world) ───────────────────────────

  async #getCaptionTracksFromPageBridge() {
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('ytai-player-data-response', handler);
          resolve(null);
        }, 2000);

        function handler(event) {
          clearTimeout(timeout);
          window.removeEventListener('ytai-player-data-response', handler);
          try {
            const payload = JSON.parse(event.detail);
            const currentVid = new URL(window.location.href).searchParams.get('v');
            if (payload?.videoId && payload.videoId !== currentVid) {
              resolve(null);
              return;
            }
            if (payload?.tracks?.length) {
              resolve(payload.tracks);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        }

        window.addEventListener('ytai-player-data-response', handler);
        window.dispatchEvent(new CustomEvent('ytai-request-player-data'));
      });

      if (result) return result.map(t => this.#mapRawTrack(t));
      if (attempt < 2) await new Promise(r => setTimeout(r, 800));
    }
    return null;
  }

  // ─── Method 2: Script-tag parsing ─────────────────────────────────

  #extractTracksFromPageScripts() {
    try {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const text = script.textContent;
        if (!text || !text.includes('"captionTracks"')) continue;
        const idx = text.indexOf('"captionTracks"');
        const colonIdx = text.indexOf(':', idx + 15);
        if (colonIdx === -1) continue;
        const tracks = this.#extractBalancedArray(text, colonIdx);
        if (tracks?.length) return tracks.map(t => this.#mapRawTrack(t));
      }
    } catch {}
    return null;
  }

  // ─── Method 3: Service-worker proxy ───────────────────────────────

  async #fetchCaptionTracksViaProxy() {
    try {
      const videoId = this.getVideoId();
      if (!videoId) return null;
      const response = await chrome.runtime.sendMessage({ action: 'fetchCaptionTracks', videoId });
      if (response?.tracks?.length) return response.tracks;
    } catch {}
    return null;
  }

  // ─── Orchestrator ─────────────────────────────────────────────────

  /**
   * Ordered caption-track sources, each loaded lazily.
   *
   * Sources are tried one after another until one yields a *usable* transcript
   * — not merely a non-empty track list. This matters because YouTube now
   * serves caption URLs that look fine (HTTP 200) but return an empty body:
   * a source can hand back 7 tracks whose every URL is dead. Stopping at the
   * first source that produced tracks, as the previous implementation did,
   * turned that into a hard failure with working sources left untried.
   */
  #getTrackSources() {
    return [
      { name: 'innertube-android', load: () => this.#getCaptionTracksForClient(this.#ANDROID_CFG) },
      { name: 'innertube-ios', load: () => this.#getCaptionTracksForClient(this.#IOS_CFG) },
      { name: 'innertube-web', load: () => this.#getCaptionTracksViaWebClient() },
      { name: 'page-bridge', load: () => this.#getCaptionTracksFromPageBridge() },
      { name: 'page-scripts', load: async () => this.#extractTracksFromPageScripts() },
      { name: 'sw-proxy', load: () => this.#fetchCaptionTracksViaProxy() }
    ];
  }

  async #getCaptionTracks() {
    for (const source of this.#getTrackSources()) {
      try {
        const tracks = await source.load();
        if (tracks?.length) return tracks;
      } catch {}
    }
    return null;
  }

  // ─── Transcript fetching ───────────────────────────────────────────

  #parseJSON3Events(data) {
    if (!data?.events) return null;
    const entries = data.events
      .filter(ev => ev.segs)
      .map(ev => {
        const startMs = ev.tStartMs || 0;
        const text = ev.segs.map(s => s.utf8).join('').replace(/\n/g, ' ').trim();
        return { start: startMs / 1000, startFormatted: this.formatTimestamp(startMs / 1000), text };
      })
      .filter(e => e.text.length > 0);
    return entries.length > 0 ? entries : null;
  }

  async #fetchTranscriptDirect(trackUrl) {
    if (!trackUrl || typeof trackUrl !== 'string') return null;
    const fetchOpts = { credentials: 'include' };

    // Try JSON3 format first
    try {
      const url = new URL(trackUrl);
      url.searchParams.set('fmt', 'json3');
      const resp = await fetch(url.toString(), fetchOpts);
      if (resp.ok) {
        const body = await resp.text();
        if (body?.length > 2) {
          const entries = this.#parseJSON3Events(JSON.parse(body));
          if (entries) return entries;
        } else {
          // HTTP 200 with an empty body: YouTube's way of rejecting a caption
          // URL that lacks the params its issuing client was expected to
          // carry. Not a network error — the URL is dead in every format, so
          // retrying it as XML only doubles the requests. Bail out and let the
          // caller move on to the next source.
          this.#debugLog('dead-caption-url (200/empty)', url.origin + url.pathname);
          return null;
        }
      } else {
        this.#debugLog(`caption fetch failed status=${resp.status}`);
      }
    } catch {}

    // Fallback to XML
    try {
      const resp = await fetch(trackUrl, fetchOpts);
      if (!resp.ok) return null;
      const xmlText = await resp.text();
      if (!xmlText || xmlText.length < 10) return null;

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const entries = Array.from(xmlDoc.querySelectorAll('text'))
        .map(node => ({
          start: parseFloat(node.getAttribute('start') || '0'),
          startFormatted: this.formatTimestamp(parseFloat(node.getAttribute('start') || '0')),
          text: node.textContent.replace(/\n/g, ' ').trim()
        }))
        .filter(e => e.text.length > 0);

      if (entries.length > 0) return entries;
    } catch {}

    return null;
  }

  async #fetchTranscriptViaProxy(trackUrl) {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'fetchTranscript', url: trackUrl });
      if (response?.entries?.length > 0) {
        return response.entries.map(e => ({
          ...e,
          startFormatted: this.formatTimestamp(e.start)
        }));
      }
    } catch {}
    return null;
  }

  // ─── Track selection (align with live YouTube CC + audio selection) ──

  #captionLangMatches(trackLang, prefCode) {
    if (!prefCode || !trackLang) return false;
    const p0 = String(prefCode).split('-')[0].toLowerCase();
    const t0 = String(trackLang).split('-')[0].toLowerCase();
    return t0 === p0;
  }

  /** Pick mapped caption track matching YouTube's languageCode + optional kind (asr). */
  #pickTrackByLangKind(tracks, languageCode, kind) {
    const matchLang = tracks.filter(t => this.#captionLangMatches(t.language, languageCode));
    if (!matchLang.length) return null;
    const wantAsr = kind === 'asr';
    const byKind = matchLang.find(t => wantAsr === !!t.isAutoGenerated);
    return byKind || matchLang[0];
  }

  /**
   * Use audioTracks[].captionTrackIndices → captionTrackSummaries[] so dub matches transcript language.
   */
  #pickTrackFromAudioRouting(tracks, playerPrefs) {
    const routing = playerPrefs?.captionRouting;
    if (!routing?.captionTrackSummaries?.length) return null;

    let audioIdx = playerPrefs.activeAudioTrackIndex;
    const ats = routing.audioTracks;
    if (!Array.isArray(ats) || !ats.length) return null;
    if (typeof audioIdx !== 'number' || audioIdx < 0 || audioIdx >= ats.length) {
      const d = routing.defaultAudioTrackIndex;
      if (typeof d !== 'number' || d < 0 || d >= ats.length) return null;
      audioIdx = d;
    }

    const at = ats[audioIdx];
    const cis = at.captionTrackIndices;
    if (!Array.isArray(cis) || cis.length === 0) return null;
    const capIdx = cis[0];
    const summary = routing.captionTrackSummaries[capIdx];
    if (!summary?.languageCode) return null;
    return this.#pickTrackByLangKind(tracks, summary.languageCode, summary.kind);
  }

  #selectBestTrack(tracks, preferredLang = 'auto', playerPrefs = null) {
    if (!tracks?.length) return { track: null, pickReason: 'none' };

    if (preferredLang !== 'auto') {
      const iso = StorageHelper.outputLanguageToCaptionCode(preferredLang) || preferredLang;
      const exact = tracks.find(t => this.#captionLangMatches(t.language, iso) && !t.isAutoGenerated);
      if (exact) return { track: exact, pickReason: 'explicit-manual' };
      const autoGen = tracks.find(t => this.#captionLangMatches(t.language, iso) && t.isAutoGenerated);
      if (autoGen) return { track: autoGen, pickReason: 'explicit-asr' };
    } else {
      // Prefer visible CC: getOption('captions','track') matches what the user is reading.
      // Audio routing uses defaultAudioTrackIndex when getOption(multilingual) is missing — on
      // multi-dub videos that often points at the wrong row (e.g. first list entry = Arabic)
      // before audio routing (defaultAudioTrackIndex can follow list order, not the visible CC row).
      const ac = playerPrefs?.activeCaptionTrack;
      if (ac?.languageCode) {
        const hit = this.#pickTrackByLangKind(tracks, ac.languageCode, ac.kind);
        if (hit) return { track: hit, pickReason: 'player-active-caption' };
      }

      const fromAudio = this.#pickTrackFromAudioRouting(tracks, playerPrefs);
      if (fromAudio) return { track: fromAudio, pickReason: 'player-audio-routing' };

      const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
      const asr = (code) => tracks.find(t => t.isAutoGenerated && t.language === code);
      const manual = (code) => tracks.find(t => !t.isAutoGenerated && t.language === code);

      const asrEn = asr('en');
      if (asrEn) return { track: asrEn, pickReason: 'fallback-asr-en' };
      const asrNav = asr(nav);
      if (asrNav) return { track: asrNav, pickReason: 'fallback-asr-nav' };
      const anyAsr = tracks.find(t => t.isAutoGenerated);
      if (anyAsr) return { track: anyAsr, pickReason: 'fallback-asr-any' };

      const manEn = manual('en');
      if (manEn) return { track: manEn, pickReason: 'fallback-manual-en' };
    }

    const t = tracks.find(x => !x.isAutoGenerated)
      || tracks.find(x => x.language === 'en')
      || tracks[0];
    return { track: t, pickReason: 'fallback-first' };
  }

  async #getPlayerPrefsFromBridge() {
    for (let attempt = 0; attempt < 3; attempt++) {
      const prefs = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('ytai-player-prefs-response', handler);
          resolve(null);
        }, 2000);

        function handler(event) {
          clearTimeout(timeout);
          window.removeEventListener('ytai-player-prefs-response', handler);
          try {
            const payload = JSON.parse(event.detail);
            const currentVid = new URL(window.location.href).searchParams.get('v');
            if (!payload?.videoId || payload.videoId !== currentVid) {
              resolve(null);
              return;
            }
            resolve(payload);
          } catch {
            resolve(null);
          }
        }

        window.addEventListener('ytai-player-prefs-response', handler);
        window.dispatchEvent(new CustomEvent('ytai-request-player-prefs'));
      });

      if (prefs) return prefs;
      if (attempt < 2) await new Promise(r => setTimeout(r, 400));
    }
    return null;
  }

  // ─── Public API ───────────────────────────────────────────────────

  async getTranscript(preferredLang = 'auto') {
    const videoId = this.getVideoId();
    if (!videoId) throw new Error('NO_VIDEO_ID');
    const requestCtx = this.#beginRequestContext(videoId);
    const retryCfg = this.#getRuntimeConfig();

    const cached = await StorageHelper.getCachedTranscript(videoId);

    try {
      await this.#waitForTranscriptReadiness(requestCtx, preferredLang);
    } catch (readinessErr) {
      this.#debugLog('readiness gate timed out, proceeding to retry loop:', readinessErr.message);
    }

    let lastError = null;
    let sawAnyTrack = false;
    const attempts = Math.max(1, retryCfg.maxAttempts);

    for (let attempt = 1; attempt <= attempts; attempt++) {
      this.#assertRequestContext(requestCtx);
      const playerPrefs = await this.#getPlayerPrefsFromBridge();

      // Walk every source until one yields real entries. A source whose tracks
      // all resolve to dead URLs must not block the sources behind it.
      const triedUrls = new Set();
      let attemptSawTrack = false;

      for (const source of this.#getTrackSources()) {
        this.#assertRequestContext(requestCtx);

        let tracks = null;
        try {
          tracks = await source.load();
        } catch {
          tracks = null;
        }
        if (!tracks?.length) continue;

        const { track: selectedTrack } = this.#selectBestTrack(tracks, preferredLang, playerPrefs);
        if (!selectedTrack?.baseUrl) continue;

        attemptSawTrack = true;
        sawAnyTrack = true;

        if (
          cached
          && cached.language === selectedTrack.language
          && !!cached.isAutoGenerated === !!selectedTrack.isAutoGenerated
        ) {
          this.#debugLog(`attempt=${attempt}`, `source=${source.name}`, 'cache-hit=true');
          return cached;
        }

        // Two sources often hand back the identical signed URL; refetching it
        // would just reproduce the same failure.
        if (triedUrls.has(selectedTrack.baseUrl)) {
          this.#debugLog(`attempt=${attempt}`, `source=${source.name}`, 'skip=duplicate-url');
          continue;
        }
        triedUrls.add(selectedTrack.baseUrl);

        let fetchMode = 'direct';
        let entries = await this.#fetchTranscriptDirect(selectedTrack.baseUrl);
        if (!entries) {
          fetchMode = 'proxy';
          entries = await this.#fetchTranscriptViaProxy(selectedTrack.baseUrl);
        }

        this.#debugLog(
          `attempt=${attempt}`,
          `source=${source.name}`,
          `track=${selectedTrack.vssId || 'n/a'}`,
          `lang=${selectedTrack.language}`,
          `fetch=${fetchMode}`,
          `entries=${entries?.length || 0}`
        );

        if (entries?.length) {
          this.#assertRequestContext(requestCtx);
          const result = {
            videoId,
            entries,
            fullText: entries.map(e => e.text).join(' '),
            language: selectedTrack.language,
            trackName: selectedTrack.name,
            isAutoGenerated: selectedTrack.isAutoGenerated,
            source: source.name,
            availableTracks: tracks.map(t => ({
              language: t.language,
              name: t.name,
              isAutoGenerated: t.isAutoGenerated
            }))
          };

          await StorageHelper.cacheTranscript(videoId, result);
          return result;
        }
      }

      // Classify against the whole call, not this attempt: if any source ever
      // produced a track, the video has captions and the fetch is what failed.
      lastError = (attemptSawTrack || sawAnyTrack)
        ? this.#getEmptyTranscriptErrorForAttempt(attempt, attempts)
        : this.#getAvailabilityErrorForAttempt(attempt, attempts);

      if (attempt < attempts) {
        const delayMs = this.#retryDelayForAttempt(attempt, retryCfg.retryDelaysMs);
        this.#debugLog(
          `attempt=${attempt}`,
          `retryDelayMs=${delayMs}`,
          `reason=${lastError?.message || 'unknown'}`
        );
        await this.#sleep(delayMs);
      }
    }

    this.#debugLog(`finalFailure=${lastError?.message || 'UNKNOWN'}`);
    throw lastError || new Error('TRANSCRIPT_EMPTY_FINAL');
  }

  async getAvailableLanguages() {
    const tracks = await this.#getCaptionTracks();
    if (!tracks) return [];
    return tracks.map(t => ({ code: t.language, name: t.name, isAutoGenerated: t.isAutoGenerated }));
  }
}

// Export singleton — reassign lexical binding so bare `TranscriptExtractor` resolves to the instance
const _transcriptInstance = TranscriptExtractor.getInstance();
TranscriptExtractor = _transcriptInstance;

if (typeof window !== 'undefined') {
  window.TranscriptExtractor = _transcriptInstance;
}
if (typeof globalThis !== 'undefined') {
  globalThis.TranscriptExtractor = _transcriptInstance;
}
