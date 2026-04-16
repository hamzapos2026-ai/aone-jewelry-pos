// src/utils/serialNumberManager.js
import {
  collection, query, where, orderBy,
  limit, getDocs, serverTimestamp,
} from "firebase/firestore";

const LOCAL_KEY = (storeId) => `billSerial_${storeId}`;
const COMMITTED_KEY = (storeId) => `billSerial_committed_${storeId}`;
const ITEM_CTR_KEY = "itemSerialCounter";

// ── Item serial (local only) ─────────────────────────────────────
let _itemCounter = parseInt(localStorage.getItem(ITEM_CTR_KEY) || "0", 10);
export const getNextItemSerial = () => {
  _itemCounter += 1;
  localStorage.setItem(ITEM_CTR_KEY, String(_itemCounter));
  return `ITM-${String(_itemCounter).padStart(4, "0")}`;
};

// ── Bill serial ───────────────────────────────────────────────────
// The key insight: we store TWO values locally:
//   1. "committed" = the last serial number that was SUCCESSFULLY submitted
//   2. "current"   = the serial currently being displayed (may not be submitted yet)
//
// On page load: if current == committed+1, reuse current (don't increment)
// After submit: committed = current number, then current = committed+1

let _pendingSerial = null;
let _initialized = false;

/**
 * Called ONCE on mount and ONCE after each successful submit.
 * @param {string} storeId
 * @param {object|null} db - Firestore instance (null = offline)
 * @param {boolean} forceIncrement - true only after successful submit
 */
export const getNextBillSerial = async (storeId = "default", db = null, forceIncrement = false) => {
  if (_pendingSerial) return _pendingSerial;

  _pendingSerial = _compute(storeId, db, forceIncrement).finally(() => {
    _pendingSerial = null;
  });
  return _pendingSerial;
};

const _compute = async (storeId, db, forceIncrement) => {
  const committedKey = COMMITTED_KEY(storeId);
  const currentKey = LOCAL_KEY(storeId);

  // Read local values
  const committedNum = parseInt(localStorage.getItem(committedKey) || "0", 10);
  const currentNum = parseInt(localStorage.getItem(currentKey) || "0", 10);

  // CASE 1: After successful submit (forceIncrement=true)
  // committed was just updated by markBillSerialUsed, so next = committed + 1
  if (forceIncrement) {
    const freshCommitted = parseInt(localStorage.getItem(committedKey) || "0", 10);
    const next = freshCommitted + 1;
    localStorage.setItem(currentKey, String(next));
    return `BILL-${String(next).padStart(4, "0")}`;
  }

  // CASE 2: Page load / first mount
  // If we already have a "current" that is exactly committed+1,
  // that means we generated it but haven't submitted yet → REUSE it
  if (currentNum > 0 && currentNum === committedNum + 1) {
    _initialized = true;
    return `BILL-${String(currentNum).padStart(4, "0")}`;
  }

  // CASE 3: First time ever, or mismatch → figure out from Firestore
  if (db) {
    try {
      const snap = await getDocs(
        query(
          collection(db, "orders"),
          where("storeId", "==", storeId),
          orderBy("createdAt", "desc"),
          limit(1)
        )
      );

      let highestNum = 0;
      if (!snap.empty) {
        const last = snap.docs[0].data();
        const lastSerial = last.serialNo || last.billSerial || "";
        highestNum = _extractNumber(lastSerial);
      }

      // Also check clearedBills for cancelled serials
      try {
        const clearedSnap = await getDocs(
          query(
            collection(db, "clearedBills"),
            where("storeId", "==", storeId),
            orderBy("clearedAt", "desc"),
            limit(1)
          )
        );
        if (!clearedSnap.empty) {
          const clearedSerial = clearedSnap.docs[0].data().serialNo || "";
          const clearedNum = _extractNumber(clearedSerial);
          if (clearedNum > highestNum) highestNum = clearedNum;
        }
      } catch (_) {}

      // Sync committed with Firestore
      const firestoreCommitted = Math.max(highestNum, committedNum);
      localStorage.setItem(committedKey, String(firestoreCommitted));

      const next = firestoreCommitted + 1;
      localStorage.setItem(currentKey, String(next));
      _initialized = true;
      return `BILL-${String(next).padStart(4, "0")}`;
    } catch (e) {
      console.warn("Firestore serial fetch failed, using local:", e);
    }
  }

  // CASE 4: Offline fallback
  const localCommitted = parseInt(localStorage.getItem(committedKey) || "0", 10);
  const next = localCommitted + 1;

  // Don't increment if current already equals next (page refresh)
  if (currentNum === next) {
    return `BILL-${String(currentNum).padStart(4, "0")}`;
  }

  localStorage.setItem(currentKey, String(next));
  return `BILL-${String(next).padStart(4, "0")}`;
};

const _extractNumber = (serial) => {
  if (!serial) return 0;
  const match = serial.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
};

/**
 * Called ONLY after successful order submit.
 * Marks the serial as "committed" so next call to getNextBillSerial
 * will produce committed+1.
 */
export const markBillSerialUsed = async (serialNo, storeId = "default") => {
  const num = _extractNumber(serialNo);
  if (num > 0) {
    const committedKey = COMMITTED_KEY(storeId);
    const currentCommitted = parseInt(localStorage.getItem(committedKey) || "0", 10);
    // Only go forward, never backward
    if (num > currentCommitted) {
      localStorage.setItem(committedKey, String(num));
    }
  }
};

/**
 * Called when a bill is cancelled — does NOT increment committed.
 * The same serial will be reused for the next bill.
 */
export const markBillSerialCancelled = (serialNo, storeId = "default") => {
  // Don't update committed — serial was never submitted
  // Current stays the same, so on next unlock we get the same serial
  console.log(`Serial ${serialNo} cancelled (not committed)`);
};