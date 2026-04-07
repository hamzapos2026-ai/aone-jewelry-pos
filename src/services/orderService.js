import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { offlineDb } from "./offlineDb";

export const saveOrder = async (orderData, isOnline) => {
  if (isOnline) {
    return await addDoc(collection(db, "orders"), {
      ...orderData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return await offlineDb.offlineOrders.add({
    ...orderData,
    createdAt: new Date().toISOString(),
    offlineCreated: true,
  });
};