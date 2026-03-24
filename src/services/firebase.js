// ==========================================
// Firebase Configuration
// ==========================================
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);


// Initialize Analytics (optional - only works in production)
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn('Analytics not initialized:', error.message);
  }
}

export { analytics };

// Export app instance
export default app;

console.log('🔥 Firebase Initialized');
console.log('📊 Project ID:', firebaseConfig.projectId);