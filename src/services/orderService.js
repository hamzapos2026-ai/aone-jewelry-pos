// src/services/orderService.js
// ✅ FIXED: No circular import (removed dynamic offlineSync import)
// ✅ FIXED: Session dedup auto-expires (10min TTL)
// ✅ FIXED: Consistent docId format
// ✅ FIXED: Proper error handling
// ✅ FIXED: getOfflineOrdersCount is self-contained

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { generateBillSerial } from "./serialService";
import {
  saveOfflineOrder,
  getLsQueue,
  setLsQueue,
  genLocalId,
  getPendingOrdersCount,
} from "./offlineDb";

// ════════════════════════════════════════════════════════
// SESSION DEDUP — with TTL (10 minutes)
// ✅ FIXED: Never blocks new bills after 10min
// ════════════════════════════════════════════════════════
const _dedup   = new Map(); // key → timestamp
const DEDUP_TTL = 10 * 60 * 1000; // 10 minutes

const _isDuplicate = (key) => {
  const ts = _dedup.get(key);
  if (!ts) return false;
  if (Date.now() - ts > DEDUP_TTL) {
    _dedup.delete(key);
    return false;
  }
  return true;
};

const _markSaved = (key) => {
  _dedup.set(key, Date.now());
};

export const clearSessionCache = () => {
  _dedup.clear();
};

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════
const _makeDocId = (storeId, serialNo) =>
  `${storeId || "default"}_${String(serialNo).replace(
    /[^a-zA-Z0-9]/g,
    "_"
  )}`;

const _makeTempSerial = () =>
  `Q${Date.now().toString().slice(-7)}`;

const _makeDedupKey = (orderData) => {
  const storeId  = orderData.storeId  || "default";
  const billerId = orderData.billerId || "anon";
  // Use billEndTime ms for unique key
  const endMs = orderData.billEndTime
    ? new Date(orderData.billEndTime).getTime()
    : 0;
  // Fallback to subtotal + items count
  const fallback = `${orderData.subtotal || 0}_${
    orderData.items?.length || 0
  }`;
  return `${storeId}_${billerId}_${endMs || fallback}`;
};

// Strip undefined from object
const _clean = (obj) => {
  const out = { ...obj };
  Object.keys(out).forEach(
    (k) => out[k] === undefined && delete out[k]
  );
  return out;
};

// ════════════════════════════════════════════════════════
// SAVE ORDER — main entry point
// ════════════════════════════════════════════════════════
export const saveOrder = async (orderData, isOnline = true) => {
  const storeId  = orderData.storeId || "default";
  const dedupKey = _makeDedupKey(orderData);

  // ── Dedup check ──────────────────────────────────────────
  if (_isDuplicate(dedupKey)) {
    console.warn("[orderService] Duplicate bill, skipping");
    return { success: false, duplicate: true };
  }

  // ════════════════════════════════════════════════════════
  // OFFLINE PATH
  // ════════════════════════════════════════════════════════
  if (!isOnline) {
    return _saveOffline(orderData, storeId, dedupKey);
  }

  // ════════════════════════════════════════════════════════
  // ONLINE PATH
  // ════════════════════════════════════════════════════════
  try {
    // ✅ Atomic serial from Firestore
    const serialNo = await generateBillSerial(storeId, true);
    const docId    = _makeDocId(storeId, serialNo);
    const ref      = doc(db, "orders", docId);

    // Race condition guard
    const existing = await getDoc(ref).catch(() => null);
    if (existing?.exists()) {
      console.warn("[orderService] Doc exists:", docId);
      _markSaved(dedupKey);
      return {
        success:   false,
        duplicate: true,
        serialNo,
        id:        docId,
      };
    }

    const finalData = _clean({
      ...orderData,
      serialNo,
      billSerial: serialNo,
      isOffline:  false,
      savedAt:    new Date().toISOString(),
      createdAt:  serverTimestamp(),
    });

    await setDoc(ref, finalData);
    _markSaved(dedupKey);

    return {
      success:   true,
      offline:   false,
      serialNo,
      id:        docId,
      duplicate: false,
    };
  } catch (err) {
    // ── Firestore error → fallback to offline ────────────
    console.warn(
      "[orderService] Firestore failed, queuing offline:",
      err.message
    );
    return _saveOffline(
      { ...orderData, _saveError: err.message },
      storeId,
      dedupKey
    );
  }
};

// ════════════════════════════════════════════════════════
// OFFLINE SAVE HELPER
// ════════════════════════════════════════════════════════
async function _saveOffline(orderData, storeId, dedupKey) {
  // Check ls queue dedup
  try {
    const lsQueue = getLsQueue();
    if (lsQueue.some((o) => o._dedupKey === dedupKey)) {
      return { success: false, duplicate: true };
    }
  } catch {}

  const tempSerial = _makeTempSerial();
  const localId    = genLocalId();

  const offlineRecord = _clean({
    ...orderData,
    serialNo:   tempSerial,
    billSerial: tempSerial,
    localId,
    savedAt:    new Date().toISOString(),
    isOffline:  true,
    syncStatus: "pending",
    synced:     false,
    _dedupKey:  dedupKey,
  });

  // Try IndexedDB first
  try {
    await saveOfflineOrder(offlineRecord);
    _markSaved(dedupKey);
    return {
      success:  true,
      offline:  true,
      serialNo: tempSerial,
      id:       null,
      duplicate: false,
    };
  } catch (dbErr) {
    console.warn(
      "[orderService] IndexedDB failed, using localStorage:",
      dbErr.message
    );
  }

  // Fallback: localStorage
  try {
    const lsQueue = getLsQueue();
    lsQueue.push(offlineRecord);
    setLsQueue(lsQueue);
    _markSaved(dedupKey);
    return {
      success:  true,
      offline:  true,
      serialNo: tempSerial,
      id:       null,
      duplicate: false,
    };
  } catch (lsErr) {
    console.error(
      "[orderService] All offline saves failed:",
      lsErr.message
    );
    throw new Error("Cannot save bill — all storage failed");
  }
}

// ════════════════════════════════════════════════════════
// GET OFFLINE COUNT — no circular import
// ✅ FIXED: Self-contained, no dynamic import
// ════════════════════════════════════════════════════════
export const getOfflineOrdersCount = async () => {
  let count = 0;

  // IndexedDB count
  try {
    count += await getPendingOrdersCount();
  } catch {}

  // localStorage count
  try {
    count += getLsQueue().length;
  } catch {}

  return count;
};