// src/services/orderService.js
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { saveOrderOffline } from "./offlineSync";

export const saveOrder = async (orderData, isOnline = true) => {
  if (isOnline) {
    try {
      const docRef = await addDoc(collection(db, "orders"), {
        ...orderData,
        createdAt: serverTimestamp(),
      });
      return { id: docRef.id, offline: false };
    } catch (error) {
      console.error("Online save failed, trying offline:", error);
      // Fallback to offline if online save fails
      const offlineId = await saveOrderOffline(orderData);
      return { id: `offline-${offlineId}`, offline: true };
    }
  } else {
    // Save offline directly
    const offlineId = await saveOrderOffline(orderData);
    return { id: `offline-${offlineId}`, offline: true };
  }
};