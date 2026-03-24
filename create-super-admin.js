// ==========================================
// Script to Create First Super Admin Account
// Run this once to set up the initial super admin
// ==========================================

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDkxwX28GAQRi7Pe6Mbo-wZ1ZL3TuS0ww4",
  authDomain: "ansariapk-ff0d8.firebaseapp.com",
  projectId: "ansariapk-ff0d8",
  storageBucket: "ansariapk-ff0d8.firebasestorage.app",
  messagingSenderId: "933572991539",
  appId: "1:933572991539:web:99becf5324c9bcce8b2146",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Super Admin Data
const SUPER_ADMIN_DATA = {
  email: "hamzapos2026@gmail.com",
  name: "Hamza",
  role: "superadmin",
  status: "active",
  emailVerified: true,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  lastLogin: null,
  permissions: {
    users: ["create", "read", "update", "delete"],
    stores: ["create", "read", "update", "delete"],
    organizations: ["create", "read", "update", "delete"],
    inventory: ["create", "read", "update", "delete"],
    sales: ["create", "read", "update", "delete"],
    reports: ["create", "read", "update", "delete"],
    settings: ["create", "read", "update", "delete"],
  },
};

// Function to create first super admin
async function createFirstSuperAdmin() {
  try {
    console.log("🚀 Creating first Super Admin account...");

    // Generate a unique UID for the super admin
    const superAdminUID = `superadmin_${Date.now()}`;

    // Create user document
    await setDoc(doc(db, "users", superAdminUID), {
      uid: superAdminUID,
      ...SUPER_ADMIN_DATA,
    });

    console.log("✅ Super Admin user created successfully!");
    console.log(`📧 Email: ${SUPER_ADMIN_DATA.email}`);
    console.log(`👤 Name: ${SUPER_ADMIN_DATA.name}`);
    console.log(`🔑 Role: ${SUPER_ADMIN_DATA.role}`);
    console.log(`🆔 UID: ${superAdminUID}`);

    // Update system status
    await setDoc(doc(db, "system", "setup"), {
      hasSuperAdmin: true,
      updatedAt: serverTimestamp(),
      firstSuperAdminUID: superAdminUID,
      firstSuperAdminCreatedAt: serverTimestamp(),
    });

    console.log("✅ System status updated!");
    console.log("🎉 First Super Admin setup complete!");
    console.log("");
    console.log("📝 IMPORTANT: Now you need to create the Firebase Auth user manually:");
    console.log("1. Go to Firebase Console > Authentication > Users");
    console.log(`2. Add user with email: ${SUPER_ADMIN_DATA.email}`);
    console.log("3. Set a password for the account");
    console.log("4. Then you can login with this account");

  } catch (error) {
    console.error("❌ Error creating Super Admin:", error);
    process.exit(1);
  }
}

// Run the script
createFirstSuperAdmin().then(() => {
  console.log("✅ Script completed successfully!");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});