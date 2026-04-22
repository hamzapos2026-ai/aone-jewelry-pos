// src/services/deletedBillsService.js - FIXED IMPORTS
import { localDB, ensureDBOpen }                from "./offlineDb";  // ✅ correct filename
import { addDoc, collection, serverTimestamp }  from "firebase/firestore";
import { db }                                   from "./firebase";

// ─── Normalize input ────────────────────────────────────────────────────────
const normalizeBillData = (billDataOrSerial, storeId) => {
  if (typeof billDataOrSerial === "string") {
    return {
      serialNo:      billDataOrSerial,
      storeId:       storeId || null,
      items:         [],
      totalAmount:   0,
      totalDiscount: 0,
      totalQty:      0,
      reason:        "manual_clear",
      customer:      null,
      billerId:      null,
      billerName:    null,
      billStartTime: null,
      billEndTime:   null,
    };
  }
  return {
    serialNo:      billDataOrSerial.serialNo      || "UNKNOWN",
    storeId:       billDataOrSerial.storeId       || storeId || null,
    items:         billDataOrSerial.items         || [],
    totalAmount:   billDataOrSerial.totalAmount   || 0,
    totalDiscount: billDataOrSerial.totalDiscount || 0,
    totalQty:      billDataOrSerial.totalQty      || 0,
    reason:        billDataOrSerial.reason        || "manual_clear",
    customer:      billDataOrSerial.customer      || null,
    billerId:      billDataOrSerial.billerId      || null,
    billerName:    billDataOrSerial.billerName    || null,
    billStartTime: billDataOrSerial.billStartTime || null,
    billEndTime:   billDataOrSerial.billEndTime   || null,
  };
};

// ─── Save locally (IndexedDB) ───────────────────────────────────────────────
export const recordDeletedBillLocally = async (billData) => {
  await ensureDBOpen();
  try {
    const record = {
      ...billData,
      timestamp:  new Date().toISOString(),
      deletedAt:  new Date().toISOString(),
      synced:     0,
      syncStatus: "pending",
    };
    const id = await localDB.deletedBills.add(record);
    console.log(`✅ Deleted bill saved locally: ${billData.serialNo} (id:${id})`);
    return id;
  } catch (err) {
    console.error("❌ recordDeletedBillLocally:", err);
    throw err;
  }
};

// ─── Save to Firestore ──────────────────────────────────────────────────────
export const saveDeletedBillToFirebase = async (billData) => {
  try {
    const docRef = await addDoc(collection(db, "deletedBills"), {
      ...billData,
      deletedAt: serverTimestamp(),
      status:    "deleted",
    });
    console.log(`✅ Deleted bill saved to Firestore: ${billData.serialNo}`);
    return docRef.id;
  } catch (err) {
    console.error("❌ saveDeletedBillToFirebase:", err);
    throw err;
  }
};

// ─── MAIN: recordBillDeletion ───────────────────────────────────────────────
export const recordBillDeletion = async (
  billDataOrSerial,
  storeId,
  isOnline = true
) => {
  try {
    const billData = normalizeBillData(billDataOrSerial, storeId);

    // ✅ Step 1: Always save locally first
    let localId = null;
    try {
      localId = await recordDeletedBillLocally(billData);
    } catch (localErr) {
      console.error("Local deletion record failed:", localErr.message);
    }

    // ✅ Step 2: Save to Firestore if online
    if (isOnline) {
      try {
        const firestoreId = await saveDeletedBillToFirebase(billData);
        // Mark local as synced
        if (localId) {
          await localDB.deletedBills.update(localId, {
            synced:      1,
            syncStatus:  "synced",
            firestoreId,
            syncedAt:    new Date().toISOString(),
          });
        }
      } catch (firebaseErr) {
        console.warn("Firebase save failed, will sync later:", firebaseErr.message);
      }
    }

    return { success: true, localId };
  } catch (err) {
    console.error("❌ recordBillDeletion:", err);
    return { success: false, error: err.message };
  }
};

// ─── Get unsynced ───────────────────────────────────────────────────────────
export const getUnsyncedDeletedBills = async () => {
  await ensureDBOpen();
  try {
    return await localDB.deletedBills.where("synced").equals(0).toArray();
  } catch (err) {
    console.error("getUnsyncedDeletedBills:", err);
    return [];
  }
};

// ─── Sync to Firestore ──────────────────────────────────────────────────────
export const syncDeletedBills = async () => {
  const result = { success: true, synced: 0, failed: 0, total: 0 };
  try {
    await ensureDBOpen();
    const unsynced = await getUnsyncedDeletedBills();
    result.total = unsynced.length;
    if (!unsynced.length) return result;

    console.log(`🔄 Syncing ${unsynced.length} deleted bills...`);

    for (const bill of unsynced) {
      try {
        const { id, synced, syncStatus, firestoreId, ...billData } = bill;
        const docRef = await addDoc(collection(db, "deletedBills"), {
          ...billData,
          deletedAt:         serverTimestamp(),
          syncedFromOffline: true,
          originalOfflineId: id,
        });
        await localDB.deletedBills.update(id, {
          synced:      1,
          syncStatus:  "synced",
          firestoreId: docRef.id,
          syncedAt:    new Date().toISOString(),
        });
        result.synced++;
      } catch (err) {
        console.error(`❌ Sync failed for ${bill.serialNo}:`, err);
        result.failed++;
        result.success = false;
      }
    }

    // ✅ Cleanup synced records
    if (result.synced > 0) {
      await localDB.deletedBills
        .where("synced").equals(1)
        .delete()
        .catch(() => {});
    }
  } catch (err) {
    console.error("syncDeletedBills error:", err);
    result.success = false;
  }
  return result;
};