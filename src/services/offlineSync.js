// src/services/offlineSync.js

// ❌ WRONG - case mismatch
// import offlineDB from "../services/offlineDb";

// ✅ CORRECT
import offlineDB from "../services/offlineDb";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export const saveOrderOffline = async (orderData) => {
  try {
    const id = await offlineDB.pendingOrders.add({
      ...orderData,
      synced: 0,
      createdAt: new Date().toISOString(),
      savedOfflineAt: new Date().toISOString(),
    });
    console.log("Order saved offline:", id);
    return id;
  } catch (error) {
    console.error("Offline save error:", error);
    throw error;
  }
};

export const getOfflineOrdersCount = async () => {
  try {
    return await offlineDB.pendingOrders.where("synced").equals(0).count();
  } catch (error) {
    return 0;
  }
};

export const getUnsyncedOrders = async () => {
  try {
    return await offlineDB.pendingOrders.where("synced").equals(0).toArray();
  } catch (error) {
    return [];
  }
};

export const syncOfflineOrders = async () => {
  const result = { success: true, synced: 0, failed: 0, total: 0 };
  try {
    const unsyncedOrders = await getUnsyncedOrders();
    result.total = unsyncedOrders.length;
    if (unsyncedOrders.length === 0) return result;

    for (const order of unsyncedOrders) {
      try {
        const { id, synced, savedOfflineAt, ...orderData } = order;
        await addDoc(collection(db, "orders"), {
          ...orderData,
          createdAt: serverTimestamp(),
          syncedFromOffline: true,
          originalOfflineId: id,
          offlineSavedAt: savedOfflineAt,
        });
        await offlineDB.pendingOrders.update(id, { synced: 1 });
        result.synced++;
      } catch (error) {
        console.error(`Sync failed for ${order.id}:`, error);
        result.failed++;
        result.success = false;
      }
    }
    if (result.synced > 0) await clearSyncedOrders();
  } catch (error) {
    console.error("Sync error:", error);
    result.success = false;
  }
  return result;
};

export const clearSyncedOrders = async () => {
  try {
    await offlineDB.pendingOrders.where("synced").equals(1).delete();
  } catch (error) {
    console.error("Clear synced error:", error);
  }
};