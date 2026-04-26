// src/services/offlineSync.js
// ✅ Background sync — never blocks UI
// ✅ Processes pending orders in batches

import {
  doc, setDoc, serverTimestamp, getDoc,
} from "firebase/firestore";
import { db }                from "./firebase";
import { localDB, ensureDBOpen } from "./offlineDb";
import { generateBillSerial }    from "./serialService";

// ─── Get count of unsynced orders ────────────────────────────────────────────
export const getOfflineOrdersCount = async () => {
  try {
    const ok = await ensureDBOpen();
    if (!ok) return _getLocalStorageCount();

    const count = await localDB.pendingOrders
      .where("syncStatus")
      .equals("pending")
      .count()
      .catch(() => 0);

    return count + _getLocalStorageCount();
  } catch {
    return _getLocalStorageCount();
  }
};

const _getLocalStorageCount = () => {
  try {
    const list = JSON.parse(
      localStorage.getItem("offline_pending_orders") || "[]"
    );
    return list.length;
  } catch {
    return 0;
  }
};

// ─── Sync all pending orders to Firestore ────────────────────────────────────
export const syncOfflineOrders = async () => {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  // ── Sync IndexedDB orders ──────────────────────────────────────────────
  try {
    const ok = await ensureDBOpen();
    if (ok) {
      const pending = await localDB.pendingOrders
        .where("syncStatus")
        .equals("pending")
        .limit(20)   // Batch of 20 — don't overwhelm
        .toArray()
        .catch(() => []);

      for (const order of pending) {
        try {
          await _syncSingleOrder(order);

          // Mark as synced
          await localDB.pendingOrders
            .update(order.id, { syncStatus: "synced", syncedAt: new Date().toISOString() })
            .catch(() => {});

          synced++;
        } catch (err) {
          console.warn("[sync] Failed to sync order:", order.serialNo, err.message);

          // Mark as failed (retry next time)
          await localDB.pendingOrders
            .update(order.id, {
              syncStatus:   "failed",
              failReason:   err.message,
              lastAttempt:  new Date().toISOString(),
            })
            .catch(() => {});

          failed++;
        }
      }
    }
  } catch (err) {
    console.warn("[sync] IndexedDB sync error:", err.message);
  }

  // ── Sync localStorage orders ───────────────────────────────────────────
  try {
    const list = JSON.parse(
      localStorage.getItem("offline_pending_orders") || "[]"
    );

    const remaining = [];

    for (const lsKey of list) {
      try {
        const raw = localStorage.getItem(lsKey);
        if (!raw) continue;

        const order = JSON.parse(raw);
        await _syncSingleOrder(order);

        localStorage.removeItem(lsKey);
        synced++;
      } catch {
        remaining.push(lsKey); // Keep for next retry
        failed++;
      }
    }

    localStorage.setItem(
      "offline_pending_orders",
      JSON.stringify(remaining)
    );
  } catch { /* ignore */ }

  return { synced, failed };
};

// ── Sync a single order to Firestore ─────────────────────────────────────────
const _syncSingleOrder = async (order) => {
  const storeId  = order.storeId  || "default";
  const serialNo = order.serialNo;
  const docId    = order.firestoreDocId ||
    `${storeId}_${serialNo}`.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Check if already synced (prevents duplicate on retry)
  const existing = await getDoc(doc(db, "orders", docId)).catch(() => null);
  if (existing?.exists()) return; // Already in Firestore

  const { syncStatus, savedAt, source, id, ...cleanOrder } = order;

  await setDoc(doc(db, "orders", docId), {
    ...cleanOrder,
    serialNo,
    syncedFromOffline: true,
    originalSource:    source || "offline",
    syncedAt:          serverTimestamp(),
    savedAt:           serverTimestamp(),
  });
};