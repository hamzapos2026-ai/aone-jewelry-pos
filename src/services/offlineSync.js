// src/services/offlineSync.js
// ✅ FIXED: generateBillSerial import correct
// ✅ FIXED: MAX_ATTEMPTS per order (skip after 5 fails)
// ✅ FIXED: No circular import
// ✅ FIXED: Dedup check before every sync
// ✅ FIXED: Rate limiting between syncs
// ✅ FIXED: Clean field stripping

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  ensureDBOpen,
  getPendingOrders,
  markOrderSynced,
  markOrderFailed,
  getLsQueue,
  setLsQueue,
  getUnsyncedDeletedBills,
  markDeletedBillSynced,
} from "./offlineDb";
// ✅ FIXED: Correct import name
import { generateBillSerial, fmt4 } from "./serialService";

// ── Sync lock — prevent concurrent sync ──────────────────────
let _syncing   = false;
let _lastSync  = 0;
const SYNC_COOLDOWN = 5_000; // 5s minimum between syncs

// ── Fields to strip before Firestore save ─────────────────────
const OFFLINE_ONLY_FIELDS = new Set([
  "localId",
  "synced",
  "syncStatus",
  "syncAttempts",
  "savedAt",
  "_dedupKey",
  "_saveError",
  "isOffline",
  "firestoreDocId",
  "failReason",
  "lastAttempt",
]);

const MAX_SYNC_ATTEMPTS = 5;

// ════════════════════════════════════════════════════════════════
// SYNC OFFLINE ORDERS
// ════════════════════════════════════════════════════════════════
export const syncOfflineOrders = async () => {
  if (!navigator.onLine) {
    return { synced: 0, failed: 0, skipped: 0 };
  }

  // Prevent concurrent sync
  if (_syncing) {
    return { synced: 0, failed: 0, skipped: 0 };
  }

  // Cooldown — prevent rapid re-sync
  const now = Date.now();
  if (now - _lastSync < SYNC_COOLDOWN) {
    return { synced: 0, failed: 0, skipped: 0 };
  }

  _syncing  = true;
  _lastSync = now;

  const result = { synced: 0, failed: 0, skipped: 0 };

  try {
    // ── 1. IndexedDB orders ─────────────────────────────────
    const dbOk = await ensureDBOpen();

    if (dbOk) {
      let pending = [];
      try {
        pending = await getPendingOrders();
      } catch (err) {
        console.warn(
          "[offlineSync] getPendingOrders failed:",
          err.message
        );
      }

      for (const order of pending) {
        // Skip orders that failed too many times
        if ((order.syncAttempts || 0) >= MAX_SYNC_ATTEMPTS) {
          result.skipped++;
          continue;
        }

        try {
          // Check if already synced (by firestoreId)
          if (order.firestoreId) {
            const exists = await _docExists(
              "orders",
              order.firestoreId
            );
            if (exists) {
              await markOrderSynced(
                order.localId,
                order.firestoreId
              );
              result.skipped++;
              continue;
            }
          }

          const { serialNo, docId } = await _syncSingleOrder(order);
          await markOrderSynced(order.localId, docId);
          result.synced++;

          // Rate limit between syncs
          await _sleep(300);
        } catch (err) {
          console.warn(
            `[offlineSync] Order ${order.localId} failed:`,
            err.message
          );
          try {
            await markOrderFailed(order.localId, err.message);
          } catch {}
          result.failed++;
        }
      }
    }

    // ── 2. localStorage queue ───────────────────────────────
    const lsQueue  = getLsQueue();
    const lsFailed = [];

    for (const order of lsQueue) {
      try {
        // Dedup check for ls queue
        if (order._dedupKey) {
          const dedupDocId = `dedup_${order._dedupKey
            .replace(/[^a-zA-Z0-9]/g, "_")}`;
          const exists = await _docExists("orderDedup", dedupDocId);
          if (exists) {
            result.skipped++;
            continue;
          }
        }

        await _syncSingleOrder(order);
        result.synced++;
        await _sleep(300);
      } catch (err) {
        console.warn(
          "[offlineSync] ls order failed:",
          err.message
        );
        const attempts = (order._attempts || 0) + 1;
        if (attempts < MAX_SYNC_ATTEMPTS) {
          lsFailed.push({ ...order, _attempts: attempts });
        } else {
          console.warn(
            "[offlineSync] Dropping order after max attempts:",
            order._dedupKey
          );
        }
        result.failed++;
      }
    }

    setLsQueue(lsFailed);

    // ── 3. Deleted bills ────────────────────────────────────
    if (dbOk) {
      try {
        const deletedBills = await getUnsyncedDeletedBills();
        for (const bill of deletedBills) {
          try {
            await _syncDeletedBill(bill);
            await markDeletedBillSynced(bill.localId);
          } catch (err) {
            console.warn(
              "[offlineSync] deletedBill sync failed:",
              err.message
            );
          }
        }
      } catch {}
    }
  } catch (err) {
    console.error("[offlineSync] Fatal error:", err);
  } finally {
    _syncing = false;
  }

  if (result.synced > 0 || result.failed > 0) {
    console.log(
      `[offlineSync] ✅${result.synced} synced,` +
        ` ❌${result.failed} failed,` +
        ` ⏭️${result.skipped} skipped`
    );
  }

  return result;
};

// ════════════════════════════════════════════════════════════════
// GET OFFLINE COUNT
// ════════════════════════════════════════════════════════════════
export const getOfflineOrdersCount = async () => {
  let count = 0;

  try {
    const dbOk = await ensureDBOpen();
    if (dbOk) {
      const pending = await getPendingOrders();
      count += pending.length;
    }
  } catch {}

  try {
    count += getLsQueue().length;
  } catch {}

  return count;
};

// ════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ════════════════════════════════════════════════════════════════

function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function _docExists(collectionName, docId) {
  try {
    const snap = await getDoc(doc(db, collectionName, docId));
    return snap.exists();
  } catch {
    return false;
  }
}

// ── Strip offline-only fields ─────────────────────────────────
function _cleanOrderData(order) {
  const clean = { ...order };
  OFFLINE_ONLY_FIELDS.forEach((f) => delete clean[f]);
  // Remove undefined values
  Object.keys(clean).forEach((k) => {
    if (clean[k] === undefined) delete clean[k];
  });
  return clean;
}

// ── Sync single order to Firestore ───────────────────────────
async function _syncSingleOrder(order) {
  const storeId = order.storeId || "default";

  // ✅ FIXED: Correct function name
  const serialNo = await generateBillSerial(storeId, true);

  const docId =
    `${storeId}_${serialNo}_${Date.now()}`;

  const cleanOrder = _cleanOrderData(order);

  const finalData = {
    ...cleanOrder,
    serialNo,
    billSerial:        serialNo,
    syncedFromOffline: true,
    originalSerial:
      order.serialNo || order.billSerial || null,
    isOffline:         false,
    createdAt:         serverTimestamp(),
    syncedAt:          serverTimestamp(),
  };

  await setDoc(doc(db, "orders", docId), finalData, {
    merge: true,
  });

  // Save dedup record to prevent re-sync
  if (order._dedupKey) {
    try {
      const dedupDocId = `dedup_${order._dedupKey
        .replace(/[^a-zA-Z0-9]/g, "_")}`;
      await setDoc(
        doc(db, "orderDedup", dedupDocId),
        {
          serialNo,
          docId,
          syncedAt: serverTimestamp(),
        }
      );
    } catch {}
  }

  return { serialNo, docId };
}

// ── Sync deleted bill ─────────────────────────────────────────
async function _syncDeletedBill(bill) {
  const { localId, synced, syncedAt, ...cleanBill } = bill;
  const storeId = bill.storeId || "default";
  const docId   = `deleted_${storeId}_${
    bill.localId || Date.now()
  }`;

  await setDoc(
    doc(db, "deletedBills", docId),
    {
      ...cleanBill,
      syncedFromOffline: true,
      syncedAt:          serverTimestamp(),
    },
    { merge: true }
  );
}