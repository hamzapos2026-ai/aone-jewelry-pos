// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { isSupported, getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAE6RdGG5S8eIgUoFafar2IYuXkj0Wp4so",
  authDomain: "posnew-87a68.firebaseapp.com",
  projectId: "posnew-87a68",
  storageBucket: "posnew-87a68.appspot.com",
  messagingSenderId: "398537246776",
  appId: "1:398537246776:web:c1a171225b9c0742fdfecd",
  measurementId: "G-RGEVJ4W4LS",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

enableIndexedDbPersistence(db, { forceOwnership: false }).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("Multiple tabs - persistence limited to one tab");
  } else if (err.code === "unimplemented") {
    console.warn("Browser does not support offline persistence");
  }
});

isSupported()
  .then((yes) => yes && getAnalytics(app))
  .catch(() => {});

export default app;