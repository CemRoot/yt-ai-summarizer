/**
 * YouTube AI Summarizer - Page Bridge (MAIN World)
 * Runs in the page's main JavaScript context to access YouTube's internal APIs.
 * Communicates with the content script (isolated world) via DOM events.
 */
(function () {
  'use strict';

  function getCaptionTracks() {
    // Method A: YouTube player element API — returns current video's data even after SPA nav
    try {
      const player = document.querySelector('#movie_player');
      if (player && typeof player.getPlayerResponse === 'function') {
        const resp = player.getPlayerResponse();
        const tracks = resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (tracks && tracks.length > 0) return tracks;
      }
    } catch (e) { /* ignore */ }

    // Method B: ytInitialPlayerResponse global (works on initial page load)
    try {
      const tracks = window.ytInitialPlayerResponse?.captions
        ?.playerCaptionsTracklistRenderer?.captionTracks;
      if (tracks && tracks.length > 0) return tracks;
    } catch (e) { /* ignore */ }

    // Method C: ytplayer config
    try {
      if (window.ytplayer?.config?.args?.raw_player_response) {
        const resp = typeof window.ytplayer.config.args.raw_player_response === 'string'
          ? JSON.parse(window.ytplayer.config.args.raw_player_response)
          : window.ytplayer.config.args.raw_player_response;
        const tracks = resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (tracks && tracks.length > 0) return tracks;
      }
    } catch (e) { /* ignore */ }

    return null;
  }

  function getVideoId() {
    try {
      const player = document.querySelector('#movie_player');
      if (player && typeof player.getVideoData === 'function') {
        const data = player.getVideoData();
        if (data?.video_id) return data.video_id;
      }
    } catch (e) { /* ignore */ }
    try {
      return new URL(window.location.href).searchParams.get('v');
    } catch (e) { /* ignore */ }
    return null;
  }

  /**
   * Live player state: active CC track + audio→caption routing from the same response
   * the UI uses (multi-dub videos). Innertube alone does not know what the user selected.
   */
  function getPlayerCaptionPrefs() {
    const player = document.querySelector('#movie_player');
    const videoId = getVideoId();
    const out = {
      videoId,
      activeCaptionTrack: null,
      activeAudioTrackIndex: null,
      captionRouting: null
    };
    try {
      if (player && typeof player.getOption === 'function') {
        const ct = player.getOption('captions', 'track');
        if (ct && typeof ct === 'object' && ct.languageCode) {
          out.activeCaptionTrack = {
            languageCode: String(ct.languageCode),
            kind: ct.kind || null
          };
        }
        const audioKeys = [
          ['multilingual', 'activeAudioTrackIndex'],
          ['multilingual', 'selectedAudioTrackIndex'],
          ['multilingual', 'audioTrackIndex']
        ];
        for (let i = 0; i < audioKeys.length; i++) {
          try {
            const v = player.getOption(audioKeys[i][0], audioKeys[i][1]);
            if (typeof v === 'number' && v >= 0) {
              out.activeAudioTrackIndex = v;
              break;
            }
          } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* ignore */ }

    try {
      const r = player && typeof player.getPlayerResponse === 'function'
        ? player.getPlayerResponse()?.captions?.playerCaptionsTracklistRenderer
        : null;
      if (r && Array.isArray(r.captionTracks) && r.captionTracks.length) {
        out.captionRouting = {
          captionTrackSummaries: r.captionTracks.map(function (t) {
            return { languageCode: t.languageCode, kind: t.kind || null };
          }),
          audioTracks: Array.isArray(r.audioTracks) ? r.audioTracks : [],
          defaultAudioTrackIndex: typeof r.defaultAudioTrackIndex === 'number' ? r.defaultAudioTrackIndex : null
        };
      }
    } catch (e) { /* ignore */ }

    return out;
  }

  window.addEventListener('ytai-request-player-data', () => {
    const tracks = getCaptionTracks();
    const videoId = getVideoId();
    window.dispatchEvent(new CustomEvent('ytai-player-data-response', {
      detail: JSON.stringify({ tracks, videoId })
    }));
  });

  window.addEventListener('ytai-request-player-prefs', () => {
    const prefs = getPlayerCaptionPrefs();
    window.dispatchEvent(new CustomEvent('ytai-player-prefs-response', {
      detail: JSON.stringify(prefs)
    }));
  });
})();
