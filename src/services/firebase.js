// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDkxwX28GAQRi7Pe6Mbo-wZ1ZL3TuS0ww4",
  authDomain: "hamzapos.firebaseapp.com",
  projectId: "hamzapos",
  storageBucket: "hamzapos.firebasestorage.app",
  messagingSenderId: "933572991539",
  appId: "1:933572991539:web:99becf5324c9bcce8b2146"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);