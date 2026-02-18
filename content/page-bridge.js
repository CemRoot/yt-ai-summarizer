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

  window.addEventListener('ytai-request-player-data', () => {
    const tracks = getCaptionTracks();
    const videoId = getVideoId();
    window.dispatchEvent(new CustomEvent('ytai-player-data-response', {
      detail: JSON.stringify({ tracks, videoId })
    }));
  });
})();
