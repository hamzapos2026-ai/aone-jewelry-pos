// src/services/firebase.js
// ✅ Modern Firestore — no deprecated enableIndexedDbPersistence
// ✅ Multi-tab safe — persistentMultipleTabManager
// ✅ Offline persistence — works without internet
// ✅ HMR safe — getApps() check prevents duplicate init
// ✅ Analytics — only loads if supported

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
} from "firebase/firestore";
import { getAuth }                   from "firebase/auth";
import { isSupported, getAnalytics } from "firebase/analytics";

// ── Config ────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAE6RdGG5S8eIgUoFafar2IYuXkj0Wp4so",
  authDomain:        "posnew-87a68.firebaseapp.com",
  projectId:         "posnew-87a68",
  storageBucket:     "posnew-87a68.appspot.com",
  messagingSenderId: "398537246776",
  appId:             "1:398537246776:web:c1a171225b9c0742fdfecd",
  measurementId:     "G-RGEVJ4W4LS",
};

// ── App init — HMR safe ───────────────────────────────────────
// getApps() prevents "Firebase App named '[DEFAULT]' already exists"
// during Vite hot-reload
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ── Auth ──────────────────────────────────────────────────────
export const auth = getAuth(app);

// ── Firestore — persistent multi-tab cache ────────────────────
// ✅ persistentLocalCache   = replaces enableIndexedDbPersistence (deprecated)
// ✅ persistentMultipleTabManager = multi-tab safe (no exclusive lock error)
// ✅ CACHE_SIZE_UNLIMITED   = no 40MB eviction limit
// ✅ getApps check          = prevents double-init on HMR

let db;

try {
  if (getApps().length > 1) {
    // Multiple instances — just get existing Firestore
    db = getFirestore(app);
  } else {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager:    persistentMultipleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      }),
    });
  }
} catch (err) {
  // initializeFirestore already called (HMR / re-import)
  // Safely get the existing instance
  db = getFirestore(app);
}

export { db };

// ── Analytics — only if browser supports it ───────────────────
// Some browsers (incognito, ad-blockers) block analytics
isSupported()
  .then((yes) => { if (yes) getAnalytics(app); })
  .catch(() => {}); // silently ignore

export default app;