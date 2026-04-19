/**
 * DeviceFingerprint — Browser fingerprint generator + cache
 * @architecture Singleton — depends on FingerprintJS IIFE (loaded before this file)
 *
 * Generates a stable visitorId via FingerprintJS open-source v4 and caches it
 * in chrome.storage.session so the service worker can read it without DOM access.
 * The fingerprint is sent to the auth-callback Edge Function for multi-account
 * abuse detection.
 */
class DeviceFingerprint {

  static #instance = null;
  static #SESSION_KEY = 'ytai_device_fp';

  #visitorId = null;
  #ready = null;

  constructor() {
    if (DeviceFingerprint.#instance) return DeviceFingerprint.#instance;
    DeviceFingerprint.#instance = this;
    this.#ready = this.#generate();
  }

  static getInstance() {
    if (!DeviceFingerprint.#instance) {
      DeviceFingerprint.#instance = new DeviceFingerprint();
    }
    return DeviceFingerprint.#instance;
  }

  async #generate() {
    try {
      const cached = await this.#readSession();
      if (cached) {
        this.#visitorId = cached;
        return cached;
      }

      if (typeof FingerprintJS === 'undefined') {
        return this.#fallback();
      }

      const fp = await FingerprintJS.load();
      const result = await fp.get();
      this.#visitorId = result.visitorId;
      await this.#writeSession(this.#visitorId);
      return this.#visitorId;
    } catch {
      return this.#fallback();
    }
  }

  #fallback() {
    const parts = [
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      navigator.hardwareConcurrency || 0,
      navigator.deviceMemory || 0,
    ];
    let hash = 0;
    const str = parts.join('|');
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    this.#visitorId = 'fb-' + Math.abs(hash).toString(36);
    this.#writeSession(this.#visitorId).catch(() => {});
    return this.#visitorId;
  }

  async #readSession() {
    try {
      const r = await chrome.storage.session.get(DeviceFingerprint.#SESSION_KEY);
      return r?.[DeviceFingerprint.#SESSION_KEY] || null;
    } catch {
      return null;
    }
  }

  async #writeSession(value) {
    try {
      await chrome.storage.session.set({ [DeviceFingerprint.#SESSION_KEY]: value });
    } catch { /* ignore */ }
  }

  async get() {
    if (this.#visitorId) return this.#visitorId;
    await this.#ready;
    return this.#visitorId;
  }
}

const _fpInstance = DeviceFingerprint.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.DeviceFingerprint = _fpInstance;
}
if (typeof window !== 'undefined') {
  window.DeviceFingerprint = _fpInstance;
}
