import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export const getSystemSettings = async () => {
  const ref = doc(db, "settings", "system");
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return null;
  }

  return snap.data();
};