import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export const ActivityTypes = {
  ORDER_CREATED: "ORDER_CREATED",
  ORDER_SUBMITTED: "ORDER_SUBMITTED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  ITEM_ADDED: "ITEM_ADDED",
  ITEM_DELETED: "ITEM_DELETED",
  BILL_LOCKED: "BILL_LOCKED",
  BILL_UNLOCKED: "BILL_UNLOCKED",
  BILL_RESET: "BILL_RESET",
  BILL_PRINTED: "BILL_PRINTED",
  SEARCH_PERFORMED: "SEARCH_PERFORMED",
  BARCODE_SCANNED: "BARCODE_SCANNED",
  OFFLINE_SAVE: "OFFLINE_SAVE",
  SYNC_COMPLETED: "SYNC_COMPLETED",
};

export const logActivity = async (activityData) => {
  try {
    await addDoc(collection(db, "activityLogs"), {
      ...activityData,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Activity log error:", error);
  }
};

export const createAuditLog = async (orderData, action, userId) => {
  try {
    await addDoc(collection(db, "auditLogs"), {
      action,
      orderId: orderData.id,
      serialNo: orderData.serialNo,
      userId: userId || "unknown",
      orderSnapshot: orderData,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
};