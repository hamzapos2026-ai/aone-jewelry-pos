// ======================================================
// storeService.js
// ======================================================
// Ye service store create, fetch aur manage karegi
// ======================================================

import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../../services/firebase";

//  Create New Store
export const createStore = async (storeData) => {
  return await addDoc(collection(db, "stores"), {
    ...storeData,
    active: true,
    createdAt: new Date(),
  });
};

//  Get All Stores (SuperAdmin)
export const getAllStores = async () => {
  const snapshot = await getDocs(collection(db, "stores"));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};