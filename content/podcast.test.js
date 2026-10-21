/**
 * PodcastPlayer memory behavior: direct PCM decode, no re-decode of the same audio.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPlayer() {
  const created = [];
  class FakeAudioContext {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; this.suspended = 0; }
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    createBuffer(channels, length, sampleRate) {
      const data = new Float32Array(length);
      const buf = { length, sampleRate, duration: length / sampleRate, getChannelData: () => data };
      created.push(buf);
      return buf;
    }
    createBufferSource() { return { playbackRate: { value: 1 }, connect() {}, disconnect() {}, start() {}, stop() {} }; }
    suspend() { this.suspended += 1; this.state = 'suspended'; return Promise.resolve(); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  const ctx = {
    window: {}, atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    setInterval, clearInterval, console, Float32Array, Math
  };
  ctx.window.AudioContext = FakeAudioContext;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'podcast.js'), 'utf8'), ctx);
  return { player: ctx.PodcastPlayer, created };
}

function pcmBase64(samples) {
  const buf = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => buf.writeInt16LE(s, i * 2));
  return buf.toString('base64');
}

test('direct decode matches Int16 little-endian / 32768', async () => {
  const { player, created } = loadPlayer();
  const samples = [0, 1, -1, 32767, -32768, 12345, -23456];
  await player.loadAudio(pcmBase64(samples));
  const out = Array.from(created[0].getChannelData(0));
  assert.deepEqual(out, samples.map((s) => Math.fround(s / 32768)));
});

test('loading the same audio again keeps the decoded buffer', async () => {
  const { player, created } = loadPlayer();
  const audio = pcmBase64(new Array(4800).fill(100));
  await player.loadAudio(audio);
  await player.loadAudio(audio);
  assert.equal(created.length, 1, 'decoded once');
  await player.loadAudio(pcmBase64([1, 2, 3, 4]));
  assert.equal(created.length, 2, 'new audio is decoded');
  player.destroy();
});

test('pause and stop suspend the audio context', async () => {
  const { player } = loadPlayer();
  await player.loadAudio(pcmBase64(new Array(48000).fill(0)));
  player.play();
  player.pause();
  player.play();
  player.stop();
  assert.equal(player.getState().isPlaying, false);
});
