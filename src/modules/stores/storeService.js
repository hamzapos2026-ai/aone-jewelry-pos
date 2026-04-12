import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";

const COLLECTION = "stores";

// Get store by ID
export const getStoreById = async (storeId) => {
  try {
    const storeRef = doc(db, COLLECTION, storeId);
    const storeSnap = await getDoc(storeRef);
    if (storeSnap.exists()) {
      return { id: storeSnap.id, ...storeSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Get store error:", error);
    return null;
  }
};

// Get all stores
export const getStores = async () => {
  try {
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Get stores error:", error);
    return [];
  }
};

// Create store
export const createStore = async (storeData) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...storeData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, ...storeData };
  } catch (error) {
    console.error("Create store error:", error);
    throw error;
  }
};

// Update store
export const updateStore = async (storeId, storeData) => {
  try {
    const storeRef = doc(db, COLLECTION, storeId);
    await updateDoc(storeRef, {
      ...storeData,
      updatedAt: serverTimestamp(),
    });
    return { id: storeId, ...storeData };
  } catch (error) {
    console.error("Update store error:", error);
    throw error;
  }
};

// Delete store
export const deleteStore = async (storeId) => {
  try {
    const storeRef = doc(db, COLLECTION, storeId);
    await deleteDoc(storeRef);
    return true;
  } catch (error) {
    console.error("Delete store error:", error);
    throw error;
  }
};