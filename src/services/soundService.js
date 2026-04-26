// src/services/soundService.js
// All sounds generated with Web Audio API - NO MP3 FILES NEEDED

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

const getAudioContext = () => {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
};

const playTone = (frequency, duration, type = "sine", volume = 0.3) => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Silent fail if audio not supported
  }
};

const playMultiTone = (notes, volume = 0.3) => {
  try {
    const ctx = getAudioContext();
    let startTime = ctx.currentTime;

    notes.forEach(({ freq, duration, type = "sine", delay = 0 }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, startTime + delay);

      gainNode.gain.setValueAtTime(volume, startTime + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + delay + duration);

      oscillator.start(startTime + delay);
      oscillator.stop(startTime + delay + duration);
    });
  } catch (e) {
    // Silent fail
  }
};

// Sound definitions - each creates unique audio feedback
const soundEffects = {
  // New bill - ascending cheerful tone
  newBill: () => {
    playMultiTone([
      { freq: 523, duration: 0.15, type: "sine", delay: 0 },
      { freq: 659, duration: 0.15, type: "sine", delay: 0.12 },
      { freq: 784, duration: 0.25, type: "sine", delay: 0.24 },
    ], 0.3);
  },

  // Bill saved - success melody
  billSaved: () => {
    playMultiTone([
      { freq: 880, duration: 0.12, type: "sine", delay: 0 },
      { freq: 1109, duration: 0.12, type: "sine", delay: 0.1 },
      { freq: 1319, duration: 0.3, type: "sine", delay: 0.2 },
    ], 0.35);
  },

  // Barcode success - quick double beep
  barcodeSuccess: () => {
    playMultiTone([
      { freq: 1200, duration: 0.08, type: "square", delay: 0 },
      { freq: 1600, duration: 0.12, type: "square", delay: 0.1 },
    ], 0.2);
  },

  // Error - low descending tone
  error: () => {
    playMultiTone([
      { freq: 400, duration: 0.15, type: "sawtooth", delay: 0 },
      { freq: 300, duration: 0.25, type: "sawtooth", delay: 0.12 },
    ], 0.25);
  },

  // Offline alert - warning tone
  offline: () => {
    playMultiTone([
      { freq: 350, duration: 0.2, type: "triangle", delay: 0 },
      { freq: 280, duration: 0.3, type: "triangle", delay: 0.15 },
      { freq: 350, duration: 0.2, type: "triangle", delay: 0.35 },
    ], 0.3);
  },

  // Sync complete - happy ascending
  syncComplete: () => {
    playMultiTone([
      { freq: 600, duration: 0.1, type: "sine", delay: 0 },
      { freq: 800, duration: 0.1, type: "sine", delay: 0.08 },
      { freq: 1000, duration: 0.1, type: "sine", delay: 0.16 },
      { freq: 1200, duration: 0.2, type: "sine", delay: 0.24 },
    ], 0.25);
  },

  // Key press - subtle click
  keyPress: () => {
    playTone(1000, 0.05, "sine", 0.1);
  },

  // Delete - quick low beep
  delete: () => {
    playTone(350, 0.15, "triangle", 0.2);
  },

  // Lock - firm tone
  lock: () => {
    playMultiTone([
      { freq: 800, duration: 0.1, type: "square", delay: 0 },
      { freq: 600, duration: 0.15, type: "square", delay: 0.08 },
    ], 0.2);
  },

  // Unlock - ascending unlock tone
  unlock: () => {
    playMultiTone([
      { freq: 600, duration: 0.1, type: "square", delay: 0 },
      { freq: 800, duration: 0.15, type: "square", delay: 0.08 },
    ], 0.2);
  },
};

export const initAudio = () => {
  try {
    getAudioContext();
  } catch (e) {
    console.warn("Audio context initialization failed:", e);
  }
};

export const playSound = (soundName) => {
  try {
    if (soundEffects[soundName]) {
      soundEffects[soundName]();
    }
  } catch (e) {
    // Silent fail - never crash for audio
    console.warn("Sound play failed:", e);
  }
};

export default { playSound, initAudio };