import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { checkSuperAdminExists } from '../utils/checkSuperAdmin'; // ⭐ ADD THIS

/**
 * Check if email already exists and handle incomplete setup
 */
const handleExistingUser = async (email, password) => {
  try {
    // First check if super admin already fully exists
    const superAdminExists = await checkSuperAdminExists();
    
    if (superAdminExists) {
      throw new Error("Setup already completed. Please login instead.");
    }

    // Try to sign in with provided credentials
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email.toLowerCase().trim(),
      password
    );
    
    // Check if user document exists
    const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
    
    if (userDoc.exists() && userDoc.data().role === "superadmin") {
      // Full setup already exists
      throw new Error("Setup already completed. Please login instead.");
    }
    
    // Incomplete setup - return user for recovery
    return { user: userCredential.user, isRecovery: true };
  } catch (error) {
    if (error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found") {
      // User doesn't exist or wrong password - proceed with new setup
      return { user: null, isRecovery: false };
    }
    throw error;
  }
};

/**
 * Create the first super admin and store
 * @param {Object} setupData - Setup form data
 * @returns {Promise<Object>} Created user and store data
 */
export const createSuperAdminSetup = async (setupData) => {
  const {
    fullName,
    email,
    password,
    businessName,
    storeName,
    storeLocation,
  } = setupData;

  console.log("=== STARTING SUPER ADMIN SETUP ===");

  let user = null;
  let isRecovery = false;

  try {
    // Step 0: Check for existing/incomplete setup
    console.log("Step 0: Checking for existing setup...");
    const existingCheck = await handleExistingUser(email, password);
    
    if (existingCheck.user) {
      user = existingCheck.user;
      isRecovery = true;
      console.log("Found existing auth user, recovering setup...");
    } else {
      // Step 1: Create new Firebase Auth user
      console.log("Step 1: Creating Auth user...");
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.toLowerCase().trim(),
        password
      );
      user = userCredential.user;
      console.log("Auth user created! UID:", user.uid);
    }

    // Step 2: Update profile
    console.log("Step 2: Updating profile...");
    await updateProfile(user, { displayName: fullName.trim() });
    console.log("Profile updated!");

    // Step 3: Force token refresh (IMPORTANT!)
    console.log("Step 3: Refreshing auth token...");
    await user.reload();
    await user.getIdToken(true);
    
    // Wait for auth state to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("Auth token refreshed!");

    // Step 4: Create all Firestore documents
    console.log("Step 4: Creating Firestore documents...");
    
    // Generate store ID first
    const storeId = doc(db, "stores", "temp").id.replace("temp", "") + Date.now().toString(36);
    const storeRef = doc(db, "stores", storeId);
    
    const storeData = {
      storeName: storeName.trim(),
      location: storeLocation.trim(),
      businessName: businessName.trim(),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: "active",
    };

    const userDocData = {
      uid: user.uid,
      name: fullName.trim(),
      email: email.toLowerCase().trim(),
      role: "superadmin",
      storeId: storeId,
      storeName: storeName.trim(),
      businessName: businessName.trim(),
      status: "active",
      emailVerified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      permissions: {
        users: ["create", "read", "update", "delete"],
        stores: ["create", "read", "update", "delete"],
        organizations: ["create", "read", "update", "delete"],
        inventory: ["create", "read", "update", "delete"],
        sales: ["create", "read", "update", "delete"],
        reports: ["create", "read", "update", "delete"],
        settings: ["create", "read", "update", "delete"],
      },
      createdBy: "setup",
    };

    const systemData = {
      hasSuperAdmin: true,
      superAdminUid: user.uid,
      superAdminEmail: email.toLowerCase().trim(),
      setupCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      version: "1.0",
    };

    // Create documents one by one
    console.log("Creating user document...");
    await setDoc(doc(db, "users", user.uid), userDocData);
    console.log("User document created!");

    console.log("Creating store document...");
    await setDoc(storeRef, storeData);
    console.log("Store document created!");

    console.log("Creating system document...");
    await setDoc(doc(db, "system", "setup"), systemData);
    console.log("System document created!");

    // Step 5: Send verification email (optional)
    console.log("Step 5: Sending verification email...");
    try {
      await sendEmailVerification(user);
      console.log("Verification email sent!");
    } catch (emailErr) {
      console.warn("Could not send verification email:", emailErr.message);
    }

    console.log("=== SETUP COMPLETE ===");
    
    return {
      user: {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        ...userDocData,
      },
      store: {
        id: storeId,
        ...storeData,
      },
      isRecovery,
    };

  } catch (error) {
    console.error("=== SETUP ERROR ===");
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    
    // Provide better error messages
    if (error.code === "auth/email-already-in-use") {
      error.userMessage = "This email is already registered. Please use the same password you used before, or contact support.";
    } else if (error.code === "permission-denied") {
      error.userMessage = "Permission denied. Please make sure Firebase rules are updated and try again.";
    }
    
    throw error;
  }
};

/**
 * Check if setup is complete (uses checkSuperAdmin utility)
 */
export const checkSetupStatus = async () => {
  return await checkSuperAdminExists();
};