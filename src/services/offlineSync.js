import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { offlineDb } from "./offlineDb";

export const syncOfflineOrders = async () => {
  const orders = await offlineDb.offlineOrders.toArray();

  for (const order of orders) {
    await addDoc(collection(db, "orders"), {
      ...order,
      isOfflineSynced: true,
      syncedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await offlineDb.offlineOrders.clear();
};