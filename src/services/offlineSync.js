// src/services/offlineSync.js - FINAL FIXED
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db }                    from "./firebase";
import { localDB, ensureDBOpen } from "./offlineDb";

const makeDocId = (storeId, serialNo) =>
  `${storeId}_${serialNo}`.replace(/[^a-zA-Z0-9_-]/g, "_");

// ─── Count pending ────────────────────────────────────────────────────────────
export const getOfflineOrdersCount = async () => {
  try {
    const ok = await ensureDBOpen();
    if (!ok) {
      // Check localStorage fallback too
      const list = JSON.parse(
        localStorage.getItem("offline_pending_orders") || "[]"
      );
      return list.length;
    }
    const count = await localDB.pendingOrders
      .where("syncStatus").equals("pending")
      .count();
    return count;
  } catch {
    return 0;
  }
};

// ─── Sync all pending ─────────────────────────────────────────────────────────
export const syncOfflineOrders = async () => {
  const ok = await ensureDBOpen();
  if (!ok) {
    return await _syncFromLocalStorage();
  }

  let synced = 0;
  let failed = 0;

  try {
    // ✅ Only process "pending" — not already-synced records
    const pending = await localDB.pendingOrders
      .where("syncStatus").equals("pending")
      .toArray();

    console.log(`🔄 Syncing ${pending.length} offline orders...`);

    for (const order of pending) {
      try {
        // ✅ Use stored firestoreDocId or regenerate it
        const docId  = order.firestoreDocId ||
                       makeDocId(order.storeId || "default", order.serialNo || "");
        const docRef = doc(db, "orders", docId);

        // ✅ Check if already exists in Firestore (another tab may have synced)
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          // Already there — just mark local as synced
          await localDB.pendingOrders.update(order.id, {
            syncStatus:  "synced",
            firestoreId: docId,
            syncedAt:    new Date().toISOString(),
          });
          synced++;
          console.log(`✅ Already synced: ${order.serialNo}`);
          continue;
        }

        // ✅ setDoc with fixed ID — safe even if called twice
        await setDoc(docRef, {
          ...order,
          firestoreDocId: docId,
          source:         "offline_synced",
          syncedAt:       serverTimestamp(),
          createdAt:      serverTimestamp(),
        });

        await localDB.pendingOrders.update(order.id, {
          syncStatus:  "synced",
          firestoreId: docId,
          syncedAt:    new Date().toISOString(),
        });

        synced++;
        console.log(`✅ Synced: ${order.serialNo} → ${docId}`);

      } catch (err) {
        console.error(`❌ Sync failed for ${order.serialNo}:`, err.message);
        failed++;
      }
    }

    // Also sync localStorage fallback
    const lsResult = await _syncFromLocalStorage();
    synced += lsResult.synced;
    failed += lsResult.failed;

  } catch (err) {
    console.error("❌ syncOfflineOrders error:", err);
  }

  return { success: true, synced, failed };
};

// ─── Sync from localStorage fallback ─────────────────────────────────────────
const _syncFromLocalStorage = async () => {
  let synced = 0;
  let failed = 0;

  try {
    const pendingList = JSON.parse(
      localStorage.getItem("offline_pending_orders") || "[]"
    );
    if (!pendingList.length) return { synced, failed };

    const remaining = [];

    for (const lsKey of pendingList) {
      try {
        const raw = localStorage.getItem(lsKey);
        if (!raw) continue;

        const order  = JSON.parse(raw);
        const docId  = order.firestoreDocId ||
                       makeDocId(order.storeId || "default", order.serialNo || "");
        const docRef = doc(db, "orders", docId);

        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          await setDoc(docRef, {
            ...order,
            firestoreDocId: docId,
            source:         "offline_localstorage_synced",
            syncedAt:       serverTimestamp(),
            createdAt:      serverTimestamp(),
          });
        }

        // Remove from localStorage after sync
        localStorage.removeItem(lsKey);
        synced++;
        console.log(`✅ LS synced: ${order.serialNo}`);

      } catch (err) {
        console.error(`❌ LS sync failed for ${lsKey}:`, err.message);
        remaining.push(lsKey);
        failed++;
      }
    }

    localStorage.setItem("offline_pending_orders", JSON.stringify(remaining));

  } catch (err) {
    console.error("LS sync error:", err);
  }

  return { synced, failed };
};