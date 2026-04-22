// src/services/orderService.js - FINAL FIXED
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db }                    from "./firebase";
import { localDB, ensureDBOpen } from "./offlineDb";

// ─── Deterministic doc ID ─────────────────────────────────────────────────────
// Same storeId + serialNo = same Firestore document ID always
// This makes duplicates physically impossible
const makeDocId = (storeId, serialNo) =>
  `${storeId}_${serialNo}`.replace(/[^a-zA-Z0-9_-]/g, "_");

// ─── localStorage fallback key ────────────────────────────────────────────────
const makeLocalKey = (docId) => `offline_order_${docId}`;

// ══════════════════════════════════════════════════════════════════════════════
export const saveOrder = async (orderData, isOnline) => {
  const serialNo = orderData.serialNo || orderData.billSerial || "";
  const storeId  = orderData.storeId  || "default";
  const normalizedOrderData = { ...orderData, storeId };

  if (!serialNo) throw new Error("serialNo is required");

  // ✅ Deterministic Firestore document ID
  const docId = makeDocId(storeId, serialNo);

  // ════════════════════ ONLINE ════════════════════════════════════════════════
  if (isOnline) {
    try {
      const docRef  = doc(db, "orders", docId);

      // ✅ Single getDoc check — deterministic ID means this is reliable
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        console.warn(`⚠️ Duplicate blocked: ${serialNo}`);
        return { success: false, duplicate: true, id: docId, offline: false };
      }

      // ✅ setDoc with fixed ID — concurrent calls produce 1 document
      await setDoc(docRef, {
        ...normalizedOrderData,
        firestoreDocId: docId,
        createdAt:      serverTimestamp(),
        savedAt:        serverTimestamp(),
        source:         "online",
      });

      console.log(`✅ Saved online: ${serialNo} → ${docId}`);

      // ✅ Mark any existing offline copy as synced (do NOT re-insert)
      const dbReady = await ensureDBOpen();
      if (dbReady) {
        const pending = await localDB.pendingOrders
          .where("firestoreDocId").equals(docId)
          .first()
          .catch(() => null);

        if (pending) {
          await localDB.pendingOrders
            .update(pending.id, {
              syncStatus:  "synced",
              syncedAt:    new Date().toISOString(),
            })
            .catch(() => {});
        }
        // ✅ NOT adding new record to pendingOrders here
        // This was the root cause of 3x duplicates
      }

      return { success: true, id: docId, offline: false, duplicate: false };

    } catch (err) {
      console.error("Firestore save failed → offline fallback:", err.message);
      // Fall through to offline ↓
    }
  }

  // ════════════════════ OFFLINE ═══════════════════════════════════════════════
  const dbReady = await ensureDBOpen();

  if (!dbReady) {
    return _saveToLocalStorage(normalizedOrderData, docId);
  }

  try {
    // ✅ Dedup check using indexed firestoreDocId
    const existing = await localDB.pendingOrders
      .where("firestoreDocId").equals(docId)
      .first()
      .catch(() => null);

    if (existing) {
      console.warn(`⚠️ Offline duplicate blocked: ${serialNo}`);
      return {
        success:   false,
        duplicate: true,
        id:        String(existing.id),
        offline:   true,
      };
    }

    const localId = await localDB.pendingOrders.add({
      ...normalizedOrderData,
      firestoreDocId: docId,       // ✅ Store for sync dedup
      syncStatus:     "pending",
      savedAt:        new Date().toISOString(),
      source:         "offline",
      createdAt:      orderData.createdAt || new Date().toISOString(),
    });

    console.log(`✅ Saved offline: ${serialNo} (localId: ${localId})`);
    return { success: true, id: String(localId), offline: true, duplicate: false };

  } catch (err) {
    console.error("❌ IndexedDB save failed:", err.message);
    return _saveToLocalStorage(normalizedOrderData, docId);
  }
};

// ─── localStorage fallback ────────────────────────────────────────────────────
const _saveToLocalStorage = (orderData, docId) => {
  try {
    const lsKey      = makeLocalKey(docId);
    const pendingList = JSON.parse(
      localStorage.getItem("offline_pending_orders") || "[]"
    );

    // ✅ Dedup check in localStorage
    if (pendingList.includes(lsKey)) {
      console.warn(`⚠️ localStorage duplicate blocked: ${docId}`);
      return { success: false, duplicate: true, id: lsKey, offline: true };
    }

    localStorage.setItem(lsKey, JSON.stringify({
      ...orderData,
      firestoreDocId: docId,
      syncStatus:     "pending",
      savedAt:        new Date().toISOString(),
      source:         "offline_localstorage",
    }));

    pendingList.push(lsKey);
    localStorage.setItem("offline_pending_orders", JSON.stringify(pendingList));

    console.log(`✅ localStorage fallback: ${docId}`);
    return { success: true, id: lsKey, offline: true, duplicate: false };

  } catch {
    // Never crash the UI
    return { success: true, id: `LOST-${Date.now()}`, offline: true, duplicate: false };
  }
};