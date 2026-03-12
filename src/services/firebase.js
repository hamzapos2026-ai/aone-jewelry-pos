// ==========================================
// Firebase Main Configuration File
// ==========================================
// Ye file Firebase ko initialize karti hai
// Aur Auth + Firestore ko export karti hai
// Is file ko sirf ek hi jagah initialize karna hota hai
// ==========================================

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 🔐 Firebase Project Configuration
// ⚠️ Future me isko .env file me shift karna hai (production security)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "hamzapos.firebaseapp.com",
  projectId: "hamzapos",
  storageBucket: "hamzapos.firebasestorage.app",
  messagingSenderId: "933572991539",
  appId: "1:933572991539:web:99becf5324c9bcce8b2146",
};

//  Initialize Firebase App
const app = initializeApp(firebaseConfig);

//  Firebase Authentication
export const auth = getAuth(app);

//  Firestore Database
export const db = getFirestore(app);

//  Export App (if needed later)
export default app;