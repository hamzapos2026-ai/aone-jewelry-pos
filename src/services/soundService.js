// src/services/soundService.js
// ✅ FIX-30: resume() properly awaited before playing
// ✅ FIX-31: "add" sound added
// ✅ FIX-32: initAudio — call on first user interaction
// ✅ FIX-33: Clean exports — named only, no default object confusion

const _AC = window.AudioContext || window.webkitAudioContext;
let _ctx  = null;
let _initDone = false;

// ✅ FIX-32: Auto-init on first user gesture
const _autoInit = () => {
  if (_initDone) return;
  _initDone = true;
  _getCtx().catch(() => {});
  document.removeEventListener("click",   _autoInit, true);
  document.removeEventListener("keydown", _autoInit, true);
  document.removeEventListener("touchstart", _autoInit, true);
};
document.addEventListener("click",      _autoInit, true);
document.addEventListener("keydown",    _autoInit, true);
document.addEventListener("touchstart", _autoInit, true);

// ✅ FIX-30: Async context getter — properly resumes
const _getCtx = async () => {
  if (!_AC) return null;
  try {
    if (!_ctx || _ctx.state === "closed") {
      _ctx = new _AC();
    }
    if (_ctx.state === "suspended") {
      await _ctx.resume(); // ✅ properly awaited
    }
    return _ctx;
  } catch {
    return null;
  }
};

const _tone = async (freq, dur, type = "sine", vol = 0.3) => {
  const ctx = await _getCtx();
  if (!ctx) return;
  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch {}
};

const _multi = async (notes, vol = 0.3) => {
  const ctx = await _getCtx();
  if (!ctx) return;
  try {
    const base = ctx.currentTime;
    for (const { freq, duration, type = "sine", delay = 0 } of notes) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, base + delay);
      gain.gain.setValueAtTime(vol, base + delay);
      gain.gain.exponentialRampToValueAtTime(
        0.001, base + delay + duration,
      );
      osc.start(base + delay);
      osc.stop(base + delay + duration);
    }
  } catch {}
};

// ✅ FIX-31: All sounds defined including "add"
const _sounds = {
  // ✅ NEW: item add sound
  add: () => _multi([
    { freq: 660, duration: 0.08, type: "sine",   delay: 0    },
    { freq: 880, duration: 0.12, type: "sine",   delay: 0.07 },
  ], 0.25),

  newBill: () => _multi([
    { freq: 523, duration: 0.15, type: "sine", delay: 0    },
    { freq: 659, duration: 0.15, type: "sine", delay: 0.12 },
    { freq: 784, duration: 0.25, type: "sine", delay: 0.24 },
  ], 0.3),

  billSaved: () => _multi([
    { freq: 880,  duration: 0.12, type: "sine", delay: 0   },
    { freq: 1109, duration: 0.12, type: "sine", delay: 0.1 },
    { freq: 1319, duration: 0.3,  type: "sine", delay: 0.2 },
  ], 0.35),

  barcodeSuccess: () => _multi([
    { freq: 1200, duration: 0.08, type: "square", delay: 0   },
    { freq: 1600, duration: 0.12, type: "square", delay: 0.1 },
  ], 0.2),

  error: () => _multi([
    { freq: 400, duration: 0.15, type: "sawtooth", delay: 0    },
    { freq: 300, duration: 0.25, type: "sawtooth", delay: 0.12 },
  ], 0.25),

  offline: () => _multi([
    { freq: 350, duration: 0.2,  type: "triangle", delay: 0    },
    { freq: 280, duration: 0.3,  type: "triangle", delay: 0.15 },
    { freq: 350, duration: 0.2,  type: "triangle", delay: 0.35 },
  ], 0.3),

  syncComplete: () => _multi([
    { freq: 600,  duration: 0.1, type: "sine", delay: 0    },
    { freq: 800,  duration: 0.1, type: "sine", delay: 0.08 },
    { freq: 1000, duration: 0.1, type: "sine", delay: 0.16 },
    { freq: 1200, duration: 0.2, type: "sine", delay: 0.24 },
  ], 0.25),

  keyPress: () => _tone(1000, 0.05, "sine", 0.1),

  delete: () => _tone(350, 0.15, "triangle", 0.2),

  lock: () => _multi([
    { freq: 800, duration: 0.1,  type: "square", delay: 0    },
    { freq: 600, duration: 0.15, type: "square", delay: 0.08 },
  ], 0.2),

  unlock: () => _multi([
    { freq: 600, duration: 0.1,  type: "square", delay: 0    },
    { freq: 800, duration: 0.15, type: "square", delay: 0.08 },
  ], 0.2),
};

// ✅ FIX-33: Named exports only — no default object confusion
export const initAudio = () => {
  _getCtx().catch(() => {});
};

export const playSound = (name) => {
  const fn = _sounds[name];
  if (!fn) return; // silent — unknown sound name
  fn().catch?.(() => {}); // async safe
};