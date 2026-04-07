import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAE6RdGG5S8eIgUoFafar2IYuXkj0Wp4so",
  authDomain: "posnew-87a68.firebaseapp.com",
  projectId: "posnew-87a68",
  storageBucket: "posnew-87a68.firebasestorage.app",
  messagingSenderId: "398537246776",
  appId: "1:398537246776:web:c1a171225b9c0742fdfecd",
  measurementId: "G-RGEVJ4W4LS",
};

const app = initializeApp(firebaseConfig);

// ✅ Named exports
const auth = getAuth(app);
const db = getFirestore(app);

let analytics = null;

if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch((error) => {
      console.warn("Analytics not initialized:", error?.message);
    });
}

export { app, auth, db, analytics };
export default app;