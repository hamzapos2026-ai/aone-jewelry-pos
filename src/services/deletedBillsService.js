// src/services/deletedBillsService.js
import offlineDB from "./offlineDb";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Record deleted bill locally
 */
export const recordDeletedBillLocally = async (billData) => {
  try {
    const deletedBillRecord = {
      serialNo: billData.serialNo || billData,
      items: billData.items || [],
      totalAmount: billData.totalAmount || 0,
      totalDiscount: billData.totalDiscount || 0,
      totalQty: billData.totalQty || 0,
      reason: billData.reason || "manual_clear",
      billStartTime: billData.billStartTime || null,
      billEndTime: billData.billEndTime || null,
      customer: billData.customer || null,
      billerId: billData.billerId || null,
      billerName: billData.billerName || null,
      storeId: billData.storeId || null,
      timestamp: new Date().toISOString(),
      synced: 0,
    };

    const id = await offlineDB.deletedBills.add(deletedBillRecord);
    console.log("Deleted bill recorded locally:", id);
    return id;
  } catch (error) {
    console.error("Error recording deleted bill locally:", error);
    throw error;
  }
};

/**
 * Save deleted bill to Firebase
 */
export const saveDeletedBillToFirebase = async (billData) => {
  try {
    const docRef = await addDoc(collection(db, "deletedBills"), {
      serialNo: billData.serialNo || billData,
      items: billData.items || [],
      totalAmount: billData.totalAmount || 0,
      totalDiscount: billData.totalDiscount || 0,
      totalQty: billData.totalQty || 0,
      reason: billData.reason || "manual_clear",
      billStartTime: billData.billStartTime || null,
      billEndTime: billData.billEndTime || null,
      customer: billData.customer || null,
      billerId: billData.billerId || null,
      billerName: billData.billerName || null,
      storeId: billData.storeId || null,
      deletedAt: serverTimestamp(),
      status: "deleted",
    });
    console.log("Deleted bill saved to Firebase:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error saving deleted bill to Firebase:", error);
    throw error;
  }
};

/**
 * Record bill deletion (online or offline)
 * Accepts either a string (serialNo) or an object with bill data
 */
export const recordBillDeletion = async (billDataOrSerial, storeId, isOnline = true) => {
  try {
    // Normalize input - could be a string serial or an object
    const billData = typeof billDataOrSerial === "string"
      ? { serialNo: billDataOrSerial, storeId }
      : { ...billDataOrSerial, storeId: billDataOrSerial.storeId || storeId };

    // Always save offline first
    const localId = await recordDeletedBillLocally(billData);

    // If online, also save to Firebase
    if (isOnline) {
      try {
        await saveDeletedBillToFirebase(billData);
      } catch (firebaseError) {
        console.error("Firebase save failed, will sync later:", firebaseError);
      }
    }

    return { success: true, localId };
  } catch (error) {
    console.error("Error recording bill deletion:", error);
    // Don't throw — this is non-critical
    return { success: false, error: error.message };
  }
};

/**
 * Get unsynced deleted bills
 */
export const getUnsyncedDeletedBills = async () => {
  try {
    return await offlineDB.deletedBills.where("synced").equals(0).toArray();
  } catch (error) {
    console.error("Error getting unsynced deleted bills:", error);
    return [];
  }
};

/**
 * Sync deleted bills from offline to Firebase
 */
export const syncDeletedBills = async () => {
  const result = { success: true, synced: 0, failed: 0, total: 0 };
  try {
    const unsyncedBills = await getUnsyncedDeletedBills();
    result.total = unsyncedBills.length;

    if (unsyncedBills.length === 0) return result;

    for (const bill of unsyncedBills) {
      try {
        const { id, synced, ...billData } = bill;
        await addDoc(collection(db, "deletedBills"), {
          ...billData,
          deletedAt: serverTimestamp(),
          syncedFromOffline: true,
          originalOfflineId: id,
        });
        await offlineDB.deletedBills.update(id, { synced: 1 });
        result.synced++;
      } catch (error) {
        console.error(`Sync failed for deleted bill ${bill.serialNo}:`, error);
        result.failed++;
        result.success = false;
      }
    }

    if (result.synced > 0) {
      await offlineDB.deletedBills.where("synced").equals(1).delete();
    }
  } catch (error) {
    console.error("Deleted bills sync error:", error);
    result.success = false;
  }

  return result;
};