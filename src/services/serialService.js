// src/services/serialService.js
// ✅ GLOBAL SERIAL — Never resets. Works across all PCs, logins, tabs.
// ✅ Firebase counter is single source of truth
// ✅ localStorage = fallback only, never overrides Firebase

import {
  doc, runTransaction, getDoc, setDoc,
  collection, query, where, orderBy, limit, getDocs,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Device ID (for offline serials only) ────────────────────────────────────
const getDeviceId = () => {
  let id = localStorage.getItem("pos_device_id");
  if (!id) {
    id = "PC" + Math.random().toString(36).slice(2, 5).toUpperCase();
    localStorage.setItem("pos_device_id", id);
  }
  return id;
};

// ─── Counters ─────────────────────────────────────────────────────────────────
let _itemCounter           = 0;
let _offlineSessionCounter = 0;

// ─── Format helpers ───────────────────────────────────────────────────────────
const fmt4       = (n)           => String(n).padStart(4, "0");
const fmtOff     = (n, deviceId) =>
  `OFF-${deviceId}-${String(n).padStart(3, "0")}`;

const extractNum = (serial = "") => {
  if (!serial) return 0;
  // Handle: "0045", "OFF-PC1-012", "0045"
  const m = serial.match(/^(\d+)$/);
  if (m) return parseInt(m[1], 10);
  // Numeric-only tail
  const m2 = serial.match(/(\d+)$/);
  return m2 ? parseInt(m2[1], 10) : 0;
};

// ─── Firestore counter document reference ────────────────────────────────────
const counterRef = (storeId) =>
  doc(db, "counters", `serial_${storeId}`);

// ─── In-memory placeholder cache ─────────────────────────────────────────────
// Cleared after each bill save so next bill shows correct next number
const _placeholderCache = {};   // storeId → "0046"

export const clearPlaceholderCache = (storeId = "default") => {
  delete _placeholderCache[storeId];
};

// ════════════════════════════════════════════════════════════════════════════
// ✅ INITIALIZE — Called ONCE on app start / login
//    RULE: If Firebase counter exists → TRUST IT, never touch it
//          If missing → scan orders to find highest → create counter
//    NEVER resets an existing counter
// ════════════════════════════════════════════════════════════════════════════
export const initializeCounter = async (storeId = "default") => {
  if (!navigator.onLine) {
    // Offline: read localStorage fallback
    const cached = localStorage.getItem(`pos_lastSerial_${storeId}`);
    const val    = cached ? Number(cached) : 0;
    _offlineSessionCounter = val;
    return val;
  }

  try {
    const ref  = counterRef(storeId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      // ✅ Counter exists in Firebase — TRUST IT 100%
      // Do NOT reset, do NOT modify
      const current = snap.data().lastSerial ?? 0;
      // Sync to localStorage as fallback
      localStorage.setItem(`pos_lastSerial_${storeId}`, String(current));
      _offlineSessionCounter = current;
      return current;
    }

    // ── Counter doc missing (first ever use) ──────────────────────────────
    // Scan existing orders to find the highest serial used
    let maxNum = 0;

    try {
      // Try with orderBy first (needs index)
      const q1 = query(
        collection(db, "orders"),
        where("storeId", "==", storeId),
        orderBy("createdAt", "desc"),
        limit(500),
      );
      const snap1 = await getDocs(q1);
      snap1.docs.forEach((d) => {
        const n = extractNum(
          d.data().serialNo || d.data().billSerial || ""
        );
        if (n > maxNum) maxNum = n;
      });
    } catch {
      // Fallback: no orderBy (no index required)
      try {
        const q2 = query(
          collection(db, "orders"),
          where("storeId", "==", storeId),
          limit(500),
        );
        const snap2 = await getDocs(q2);
        snap2.docs.forEach((d) => {
          const n = extractNum(
            d.data().serialNo || d.data().billSerial || ""
          );
          if (n > maxNum) maxNum = n;
        });
      } catch { /* no orders yet — maxNum stays 0 */ }
    }

    // Create the counter starting from highest found
    await setDoc(ref, {
      lastSerial:    maxNum,
      storeId,
      initializedAt: new Date().toISOString(),
      createdBy:     "pos_system",
    });

    localStorage.setItem(`pos_lastSerial_${storeId}`, String(maxNum));
    _offlineSessionCounter = maxNum;
    return maxNum;

  } catch (err) {
    console.warn("[serialService] initializeCounter error:", err.message);
    // Use localStorage fallback
    const cached = localStorage.getItem(`pos_lastSerial_${storeId}`);
    return cached ? Number(cached) : 0;
  }
};

// Alias for backward compatibility
export const initializeCounterFromOrders = initializeCounter;

// ════════════════════════════════════════════════════════════════════════════
// ✅ GET PLACEHOLDER SERIAL
//    Shown in UI before bill is saved
//    Uses cache → Firebase → localStorage (in priority order)
//    NEVER causes re-render lag (returns instantly from cache)
// ════════════════════════════════════════════════════════════════════════════
export const getPlaceholderSerial = async (
  storeId  = "default",
  isOnline = true,
) => {
  // ✅ Return from cache instantly (no network, no lag)
  if (_placeholderCache[storeId]) {
    return _placeholderCache[storeId];
  }

  if (!isOnline) {
    const cached = localStorage.getItem(`pos_lastSerial_${storeId}`);
    const n      = cached ? Number(cached) + 1 : 1;
    const ph     = fmtOff(n, getDeviceId());
    _placeholderCache[storeId] = ph;
    return ph;
  }

  try {
    const snap = await getDoc(counterRef(storeId));

    if (snap.exists()) {
      const last = snap.data().lastSerial ?? 0;
      const ph   = fmt4(last + 1);
      _placeholderCache[storeId] = ph;
      // Keep localStorage in sync
      localStorage.setItem(`pos_lastSerial_${storeId}`, String(last));
      return ph;
    }

    // Counter not yet created — initialize first
    const base = await initializeCounter(storeId);
    const ph   = fmt4(base + 1);
    _placeholderCache[storeId] = ph;
    return ph;

  } catch {
    // Fallback to localStorage
    const cached = localStorage.getItem(`pos_lastSerial_${storeId}`);
    const n      = cached ? Number(cached) + 1 : 1;
    const ph     = fmt4(n);
    _placeholderCache[storeId] = ph;
    return ph;
  }
};

// ════════════════════════════════════════════════════════════════════════════
// ✅ GENERATE REAL SERIAL — Called ONLY at save time (atomic)
//    Uses Firestore runTransaction for race-condition safety
//    Multiple tabs / multiple PCs = each gets unique serial
// ════════════════════════════════════════════════════════════════════════════
const _generateOnlineSerial = async (storeId) => {
  const ref = counterRef(storeId);

  const nextNum = await runTransaction(db, async (tx) => {
    const snap    = await tx.get(ref);
    const current = snap.exists() ? (snap.data().lastSerial ?? 0) : 0;
    const next    = current + 1;

    tx.set(ref, {
      lastSerial: next,
      storeId,
      updatedAt:  new Date().toISOString(),
    }, { merge: true });

    return next;
  });

  const serial = fmt4(nextNum);

  // ✅ Keep localStorage in sync for offline fallback
  localStorage.setItem(`pos_lastSerial_${storeId}`, String(nextNum));

  // ✅ Clear placeholder so next bill shows updated number
  clearPlaceholderCache(storeId);

  return serial;
};

const _generateOfflineSerial = async (storeId) => {
  const deviceId = getDeviceId();

  // Find highest offline serial already used
  try {
    const { localDB, ensureDBOpen } = await import("./offlineDb");
    const ok = await ensureDBOpen();
    if (ok) {
      const pending = await localDB.pendingOrders
        .where("storeId")
        .equals(storeId)
        .toArray()
        .catch(() => []);

      for (const o of pending) {
        const n = extractNum(o.serialNo || "");
        if (n > _offlineSessionCounter) _offlineSessionCounter = n;
      }
    }
  } catch { /* silent — use in-memory counter */ }

  _offlineSessionCounter += 1;
  clearPlaceholderCache(storeId);
  return fmtOff(_offlineSessionCounter, deviceId);
};

// ── PUBLIC: called at SAVE TIME only ─────────────────────────────────────────
export const generateBillSerial = async (
  storeId  = "default",
  isOnline = true,
) => {
  if (isOnline) {
    try {
      return await _generateOnlineSerial(storeId);
    } catch (err) {
      console.warn("[serial] Online failed → offline fallback:", err.message);
    }
  }
  return _generateOfflineSerial(storeId);
};

// ─── Reset (SuperAdmin only) ──────────────────────────────────────────────────
export const resetSerialCounter = async (
  storeId = "default",
  resetTo = 0,
) => {
  try {
    await setDoc(counterRef(storeId), {
      lastSerial: resetTo,
      storeId,
      resetAt:    new Date().toISOString(),
      resetBy:    "superadmin",
    });
    _offlineSessionCounter = resetTo;
    clearPlaceholderCache(storeId);
    localStorage.setItem(`pos_lastSerial_${storeId}`, String(resetTo));
    return { success: true, resetTo };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const getNextItemSerial = () => {
  _itemCounter += 1;
  return `ITEM-${Date.now()}-${_itemCounter}`;
};

export const getNextCustomerNumber = async (storeId = "default") => {
  try {
    const ref     = doc(db, "counters", `customer_${storeId}`);
    const nextNum = await runTransaction(db, async (tx) => {
      const snap    = await tx.get(ref);
      const current = snap.exists() ? (snap.data().lastNumber ?? 0) : 0;
      const next    = current + 1;
      tx.set(ref, {
        lastNumber: next,
        storeId,
        updatedAt:  new Date().toISOString(),
      }, { merge: true });
      return next;
    });
    return `Customer ${String(nextNum).padStart(3, "0")}`;
  } catch {
    return `Customer ${Date.now().toString().slice(-4)}`;
  }
};

export const previewNextSerial = (
  storeId  = "default",
  isOnline = true,
) => getPlaceholderSerial(storeId, isOnline);

// ─── Backward compatibility ───────────────────────────────────────────────────
export const getNextBillSerial  = generateBillSerial;
export const confirmBillSerial  = () => {};
export const cancelBillSerial   = () => {};
export const getDraftSerial     = () => null;