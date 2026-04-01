// ==========================================
// Firebase Configuration
// ==========================================

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAE6RdGG5S8eIgUoFafar2IYuXkj0Wp4so",
  authDomain: "posnew-87a68.firebaseapp.com",
  projectId: "posnew-87a68",
  storageBucket: "posnew-87a68.firebasestorage.app",
  messagingSenderId: "398537246776",
  appId: "1:398537246776:web:c1a171225b9c0742fdfecd",
  measurementId: "G-RGEVJ4W4LS"
};

// ✅ Initialize Firebase safely (important for Vite/React hot reload)
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// ✅ Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// ✅ Secondary Auth (User create karne ke liye)
// Isse superadmin session logout nahi hoga
export const getSecondaryAuth = () => {
  const secondaryApp =
    getApps().find(app => app.name === "Secondary") ||
    initializeApp(firebaseConfig, "Secondary");

  return getAuth(secondaryApp);
};

// ✅ Analytics (optional)
let analytics = null;
if (typeof window !== "undefined") {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn("Analytics not initialized:", error.message);
  }
}

export { analytics };

// ✅ Export app instance
export default app;

console.log("🔥 Firebase Initialized");
console.log("📊 Project ID:", firebaseConfig.projectId);