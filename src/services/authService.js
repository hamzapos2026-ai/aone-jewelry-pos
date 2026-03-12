// ==========================================
// Authentication Service
// ==========================================
// Ye file login, register, logout handle karti hai
// Firebase Auth + Firestore user document dono manage karegi
// ==========================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// ==========================================
//  Register User (SuperAdmin / Admin use karega)
// ==========================================
export const registerUser = async (
  name,
  email,
  password,
  role,
  storeId
) => {
  // Firebase authentication create
  const res = await createUserWithEmailAndPassword(auth, email, password);
  const user = res.user;

  // Firestore me user ka document create
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    name,
    email,
    role,
    storeId, //  Multi-store ready
    active: true,
    createdAt: new Date(),
    lastLogin: null,
  });

  return user;
};

// ==========================================
// Login User
// ==========================================
export const loginUser = async (email, password) => {
  const res = await signInWithEmailAndPassword(auth, email, password);
  const user = res.user;

  // Firestore se user data fetch
  const userDoc = await getDoc(doc(db, "users", user.uid));

  if (!userDoc.exists()) {
    throw new Error("User data not found");
  }

  // Update Last Login Time
  await updateDoc(doc(db, "users", user.uid), {
    lastLogin: new Date(),
  });

  return userDoc.data();
};

// ==========================================
//  Logout User
// ==========================================
export const logoutUser = async () => {
  await signOut(auth);
  localStorage.removeItem("session");
};