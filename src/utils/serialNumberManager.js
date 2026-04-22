// src/utils/serialNumberManager.js - COMPLETE REWRITE
import {
  collection, getDocs, query,
  where, orderBy, limit,
} from "firebase/firestore";
import { localDB, ensureDBOpen } from "../services/offlineDb";

// ─── Internal State ───────────────────────────────────────────────────────────
const _sessionSerials = new Set();
let   _itemSerialCounter = 0;

// Draft cache: same serial until bill saved/cancelled
const _draftSerials = new Map(); // storeId → { serial, num, generatedAt }

// ─── Constants ────────────────────────────────────────────────────────────────
const DRAFT_TTL_MS    = 2 * 60 * 60 * 1000; // 2 hour TTL
const LS_DRAFT_PREFIX = "draft_serial_";
const LS_COUNTER_PREFIX = "serial_counter_";

// ─── Draft Persistence (localStorage) ────────────────────────────────────────
const loadDraftFromStorage = (storeId) => {
  try {
    const data = localStorage.getItem(`${LS_DRAFT_PREFIX}${storeId}`);
    if (!data) return null;
    const draft = JSON.parse(data);
    const age   = Date.now() - new Date(draft.generatedAt).getTime();
    if (age > DRAFT_TTL_MS) {
      localStorage.removeItem(`${LS_DRAFT_PREFIX}${storeId}`);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
};

const saveDraftToStorage = (storeId, draft) => {
  try {
    localStorage.setItem(
      `${LS_DRAFT_PREFIX}${storeId}`,
      JSON.stringify(draft)
    );
  } catch {}
};

const removeDraftFromStorage = (storeId) => {
  try {
    localStorage.removeItem(`${LS_DRAFT_PREFIX}${storeId}`);
  } catch {}
};

// ─── Lock (race condition prevention) ────────────────────────────────────────
let   _isGenerating   = false;
const _generateQueue  = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const extractNumber = (serial = "") => {
  const match = serial.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
};

const formatSerial = (num) => String(num).padStart(3, "0");

// ─── Fetch Highest Serial From All Sources ────────────────────────────────────
const fetchLastNumberFromDB = async (storeId, firestoreDb) => {
  let lastNumber = 0;

  // 1. localStorage counter (fastest, most recent)
  try {
    const lsVal = parseInt(
      localStorage.getItem(`${LS_COUNTER_PREFIX}${storeId}`) || "0",
      10
    );
    if (lsVal > lastNumber) lastNumber = lsVal;
  } catch {}

  // 2. Firestore (only when online)
  if (firestoreDb && navigator.onLine) {
    try {
      const snap = await getDocs(
        query(
          collection(firestoreDb, "orders"),
          where("storeId", "==", storeId),
          orderBy("createdAt", "desc"),
          limit(10) // Check more docs for safety
        )
      );
      snap.docs.forEach((doc) => {
        const data   = doc.data();
        const serial = data.serialNo || data.billSerial || "";
        const n      = extractNumber(serial);
        if (n > lastNumber) lastNumber = n;
      });
    } catch (err) {
      console.warn("Firestore serial check failed:", err.message);
    }
  }

  // 3. IndexedDB pending orders
  try {
    await ensureDBOpen();
    const localPending = await localDB.pendingOrders
      .where("storeId").equals(storeId)
      .toArray();
    for (const o of localPending) {
      const serial = o.serialNo || o.billSerial || "";
      const n      = extractNumber(serial);
      if (n > lastNumber) lastNumber = n;
    }
  } catch (err) {
    console.warn("Local pending serial check failed:", err.message);
  }

  // 4. IndexedDB serialTracker
  try {
    await ensureDBOpen();
    const tracker = await localDB.serialTracker
      .where("storeId").equals(storeId)
      .first();
    if (tracker && tracker.lastNumber > lastNumber) {
      lastNumber = tracker.lastNumber;
    }
  } catch (err) {
    console.warn("Serial tracker read failed:", err.message);
  }

  return lastNumber;
};

// ─── Update Tracker ───────────────────────────────────────────────────────────
const updateTracker = async (storeId, nextNumber) => {
  // Update localStorage first (fast & reliable)
  try {
    const LS_KEY  = `${LS_COUNTER_PREFIX}${storeId}`;
    const current = parseInt(localStorage.getItem(LS_KEY) || "0", 10);
    if (nextNumber > current) {
      localStorage.setItem(LS_KEY, String(nextNumber));
    }
  } catch {}

  // Update IndexedDB tracker
  try {
    await ensureDBOpen();
    const tracker = await localDB.serialTracker
      .where("storeId").equals(storeId)
      .first();
    if (tracker) {
      if (nextNumber > tracker.lastNumber) {
        await localDB.serialTracker.update(tracker.id, {
          lastNumber: nextNumber,
          updatedAt:  new Date().toISOString(),
        });
      }
    } else {
      await localDB.serialTracker.add({
        storeId,
        lastNumber: nextNumber,
        prefix:     "",
        updatedAt:  new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn("Serial tracker update failed:", err.message);
  }
};

// ─── Queue Processor ──────────────────────────────────────────────────────────
const processQueue = async () => {
  if (_isGenerating || _generateQueue.length === 0) return;
  _isGenerating = true;

  const { storeId, firestoreDb, forceNew, resolve, reject } =
    _generateQueue.shift();

  try {
    const serial = await _generateSerial(storeId, firestoreDb, forceNew);
    resolve(serial);
  } catch (err) {
    console.error("Serial generation error:", err);
    reject(err);
  } finally {
    _isGenerating = false;
    if (_generateQueue.length > 0) processQueue();
  }
};

// ─── Core Generator ───────────────────────────────────────────────────────────
const _generateSerial = async (storeId, firestoreDb, forceNew) => {
  // Return existing draft if not forcing new
  if (!forceNew) {
    // Check memory first
    if (_draftSerials.has(storeId)) {
      const draft = _draftSerials.get(storeId);
      console.log(`📋 Draft serial (memory): ${draft.serial}`);
      return draft.serial;
    }
    // Check localStorage
    const storedDraft = loadDraftFromStorage(storeId);
    if (storedDraft) {
      _draftSerials.set(storeId, storedDraft);
      console.log(`📋 Draft serial (storage): ${storedDraft.serial}`);
      return storedDraft.serial;
    }
  }

  // Generate new serial
  const lastNumber = await fetchLastNumberFromDB(storeId, firestoreDb);

  // Also check session serials
  let maxNum = lastNumber;
  for (const s of _sessionSerials) {
    const n = extractNumber(s);
    if (n > maxNum) maxNum = n;
  }

  const nextNumber = maxNum + 1;
  const serial     = formatSerial(nextNumber);

  const draft = {
    serial,
    num:         nextNumber,
    generatedAt: new Date().toISOString(),
  };

  // Store draft in memory + localStorage
  _draftSerials.set(storeId, draft);
  saveDraftToStorage(storeId, draft);

  // Update tracker
  await updateTracker(storeId, nextNumber);

  // Track in session
  _sessionSerials.add(serial);

  // Broadcast to other tabs
  try {
    const bc = new BroadcastChannel(`billing_${storeId}`);
    bc.postMessage({ type: "SERIAL_DRAFT", serial, num: nextNumber });
    bc.close();
  } catch {}

  console.log(`🆕 New serial generated: ${serial}`);
  return serial;
};

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get next bill serial
 * forceNew=false → return same draft (page-reload safe)
 * forceNew=true  → generate new (after save/cancel)
 */
export const getNextBillSerial = (
  storeId     = "default",
  firestoreDb = null,
  forceNew    = false
) =>
  new Promise((resolve, reject) => {
    _generateQueue.push({ storeId, firestoreDb, forceNew, resolve, reject });
    processQueue();
  });

/**
 * Call after bill successfully saved
 * Clears draft → next call generates new serial
 */
export const confirmBillSerial = (serial, storeId = "default") => {
  _draftSerials.delete(storeId);
  removeDraftFromStorage(storeId);
  _sessionSerials.delete(serial);

  // Ensure localStorage counter is up to date
  try {
    const num     = extractNumber(serial);
    const LS_KEY  = `${LS_COUNTER_PREFIX}${storeId}`;
    const current = parseInt(localStorage.getItem(LS_KEY) || "0", 10);
    if (num > current) {
      localStorage.setItem(LS_KEY, String(num));
    }
  } catch {}

  // Broadcast confirmation
  try {
    const num = extractNumber(serial);
    const bc  = new BroadcastChannel(`billing_${storeId}`);
    bc.postMessage({ type: "SERIAL_CONFIRMED", serial, num });
    bc.close();
  } catch {}

  console.log(`✅ Serial confirmed: ${serial}`);
};

/**
 * Call when bill is cancelled
 * Clears draft → next call generates new serial
 * Note: Counter NOT decremented (gap is acceptable)
 */
export const cancelBillSerial = (serial, storeId = "default") => {
  _draftSerials.delete(storeId);
  removeDraftFromStorage(storeId);
  _sessionSerials.delete(serial);

  try {
    const bc = new BroadcastChannel(`billing_${storeId}`);
    bc.postMessage({ type: "SERIAL_CANCELLED", serial });
    bc.close();
  } catch {}

  console.log(`❌ Serial cancelled: ${serial}`);
};

/**
 * Setup BroadcastChannel listener (call on app startup)
 * Returns cleanup function
 */
export const setupSerialBroadcastListener = (storeId = "default") => {
  try {
    const bc = new BroadcastChannel(`billing_${storeId}`);
    bc.onmessage = ({ data = {} }) => {
      const { type, num } = data;
      if (type === "SERIAL_DRAFT" || type === "SERIAL_CONFIRMED") {
        const LS_KEY  = `${LS_COUNTER_PREFIX}${storeId}`;
        const current = parseInt(localStorage.getItem(LS_KEY) || "0", 10);
        if (num > current) {
          localStorage.setItem(LS_KEY, String(num));
          console.log(`📡 BC sync: ${type} → counter updated to ${num}`);
        }
        // Also invalidate draft so next generation fetches fresh
        if (type === "SERIAL_CONFIRMED") {
          _draftSerials.delete(storeId);
        }
      }
    };
    return () => bc.close();
  } catch {
    return () => {};
  }
};

export const getDraftSerial    = (storeId = "default") =>
  _draftSerials.get(storeId) || null;

export const clearDraftSerial  = (storeId = "default") => {
  _draftSerials.delete(storeId);
  removeDraftFromStorage(storeId);
};

export const getNextItemSerial = () => {
  _itemSerialCounter += 1;
  return `ITEM-${Date.now()}-${_itemSerialCounter}`;
};

// Backwards compatibility
export const markBillSerialUsed      = confirmBillSerial;
export const markBillSerialCancelled = cancelBillSerial;

/**
 * ⚠️ EMERGENCY ONLY - resets counter to 0
 * Do NOT call on normal app startup
 */
export const resetSerialCounter = async (storeId = "default") => {
  try {
    await ensureDBOpen();
    const tracker = await localDB.serialTracker
      .where("storeId").equals(storeId)
      .first();
    if (tracker) {
      await localDB.serialTracker.update(tracker.id, {
        lastNumber: 0,
        updatedAt:  new Date().toISOString(),
      });
    }
    localStorage.removeItem(`${LS_COUNTER_PREFIX}${storeId}`);
    localStorage.removeItem(`${LS_DRAFT_PREFIX}${storeId}`);
    _draftSerials.delete(storeId);
    _sessionSerials.clear();
    console.log(`🗑️ Serial counter RESET for store: ${storeId}`);
  } catch (err) {
    console.warn("Reset serial error:", err.message);
  }
};