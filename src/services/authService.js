// ==========================================
// Auth Service - Complete Authentication
// ==========================================
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  signOut,
  updateProfile,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit as firestoreLimit,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";

// ==========================================
// Default Permissions
// ==========================================
const PERMISSIONS = {
  superadmin: {
    users: ["create", "read", "update", "delete"],
    stores: ["create", "read", "update", "delete"],
    organizations: ["create", "read", "update", "delete"],
    inventory: ["create", "read", "update", "delete"],
    sales: ["create", "read", "update", "delete"],
    reports: ["create", "read", "update", "delete"],
    settings: ["create", "read", "update", "delete"],
  },
  admin: {
    users: ["create", "read", "update", "delete"],
    stores: ["create", "read", "update", "delete"],
    inventory: ["create", "read", "update", "delete"],
    sales: ["create", "read", "update", "delete"],
    reports: ["read"],
    settings: ["read", "update"],
  },
  manager: {
    users: ["read"],
    inventory: ["create", "read", "update"],
    sales: ["create", "read", "update"],
    reports: ["read"],
  },
  cashier: {
    sales: ["create", "read"],
    inventory: ["read"],
  },
  biller: {
    sales: ["create", "read"],
    inventory: ["read"],
    khata: ["create", "read", "update"],
  },
};

// ==========================================
// Check if Email Exists
// ==========================================
export const checkEmailExists = async (email) => {
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email.toLowerCase().trim());
    return methods.length > 0;
  } catch (error) {
    console.error("Check email error:", error);
    return false;
  }
};

// ==========================================
// Check if Super Admin Exists
// ==========================================
export const checkSuperAdminExists = async () => {
  try {
    const systemDoc = await getDoc(doc(db, "system", "setup"));
    
    if (systemDoc.exists()) {
      const data = systemDoc.data();
      console.log("System setup data:", data);
      return data.hasSuperAdmin === true;
    }
    
    console.log("No system/setup document found - first time setup");
    return false;
  } catch (error) {
    console.error("Check super admin error:", error);
    return false;
  }
};

// ==========================================
// Register User
// ==========================================
export const registerUser = async (userData) => {
  const { email, password, name, phone, role, storeId, storeName, organizationId } = userData;

  console.log("=== STARTING REGISTRATION ===");
  console.log("Email:", email);
  console.log("Role:", role);

  try {
    // Step 1: Create Firebase Auth user
    console.log("Step 1: Creating Auth user...");
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      email.toLowerCase().trim(), 
      password
    );
    const user = userCredential.user;
    console.log("Auth user created! UID:", user.uid);

    // Step 2: Update profile
    console.log("Step 2: Updating profile...");
    await updateProfile(user, { displayName: name.trim() });
    console.log("Profile updated!");

    // Step 3: Create user document
    console.log("Step 3: Creating Firestore document...");
    const userDocData = {
      uid: user.uid,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      phone: phone || "",
      role: role || "cashier",
      storeId: storeId || null,
      storeName: storeName || null,
      organizationId: organizationId || null,
      status: "active",
      emailVerified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      permissions: PERMISSIONS[role] || PERMISSIONS.cashier,
      createdBy: "self-registration",
    };

    await setDoc(doc(db, "users", user.uid), userDocData);
    console.log("User document created!");

    // Step 4: Update system setup if super admin
    if (role === "superadmin") {
      console.log("Step 4: Updating system setup...");
      await setDoc(doc(db, "system", "setup"), {
        hasSuperAdmin: true,
        superAdminUid: user.uid,
        superAdminEmail: email.toLowerCase().trim(),
        setupCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log("System setup updated!");
    }

    // Step 5: Send verification email (optional)
    try {
      await sendEmailVerification(user);
      console.log("Verification email sent!");
    } catch (emailErr) {
      console.warn("Could not send verification email:", emailErr.message);
    }

    console.log("=== REGISTRATION COMPLETE ===");
    return { 
      uid: user.uid, 
      email: user.email,
      emailVerified: user.emailVerified,
      ...userDocData 
    };

  } catch (error) {
    console.error("=== REGISTRATION ERROR ===");
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    throw error;
  }
};

// ==========================================
// Get User by UID
// ==========================================
export const getUserByUid = async (uid) => {
  if (!uid) return null;
  
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      return { uid: userDoc.id, ...userDoc.data() };
    }
    console.log("User document not found for UID:", uid);
    return null;
  } catch (error) {
    console.warn("Get user error:", error.code || error.message);
    return null;
  }
};

// ==========================================
// Login User
// ==========================================
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth, 
      email.toLowerCase().trim(), 
      password
    );
    const user = userCredential.user;

    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    let userData;
    if (userDoc.exists()) {
      userData = userDoc.data();
      
      // Check status
      if (userData.status === "inactive" || userData.status === "suspended") {
        await signOut(auth);
        throw new Error("Account is inactive or suspended");
      }
      
      // Update last login
      await setDoc(doc(db, "users", user.uid), {
        lastLogin: serverTimestamp(),
        emailVerified: user.emailVerified,
      }, { merge: true });
    } else {
      // Create basic user doc
      userData = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || email.split("@")[0],
        role: "cashier",
        status: "active",
        permissions: PERMISSIONS.cashier,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      };
      await setDoc(doc(db, "users", user.uid), userData);
    }

    return {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      ...userData,
    };
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

// ==========================================
// Logout User
// ==========================================
export const logoutUser = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem("user");
    localStorage.removeItem("session");
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    throw error;
  }
};

// ==========================================
// Send Password Reset Email
// ==========================================
export const sendPasswordReset = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email.toLowerCase().trim(), {
      url: `${window.location.origin}/login`,
    });
    console.log("Password reset email sent to:", email);
    return true;
  } catch (error) {
    console.error("Password reset error:", error);
    throw error;
  }
};

// ==========================================
// Confirm Password Reset
// ==========================================
export const confirmReset = async (oobCode, newPassword) => {
  try {
    await confirmPasswordReset(auth, oobCode, newPassword);
    console.log("Password reset confirmed");
    return true;
  } catch (error) {
    console.error("Confirm reset error:", error);
    throw error;
  }
};

// ==========================================
// Update User Profile
// ==========================================
export const updateUserProfile = async (uid, updates) => {
  try {
    await setDoc(doc(db, "users", uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log("Profile updated for:", uid);
    return true;
  } catch (error) {
    console.error("Update profile error:", error);
    throw error;
  }
};

// ==========================================
// Get All Users
// ==========================================
export const getAllUsers = async () => {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    const users = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
    console.log("Users fetched:", users.length);
    return users;
  } catch (error) {
    console.error("Get all users error:", error);
    return [];
  }
};

// ==========================================
// Get Users by Role
// ==========================================
export const getUsersByRole = async (role) => {
  try {
    const q = query(collection(db, "users"), where("role", "==", role));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Get users by role error:", error);
    return [];
  }
};

// ==========================================
// Get Login Logs
// ==========================================
export const getLoginLogs = async (limitCount = 100) => {
  try {
    const logsRef = collection(db, "loginLogs");
    const q = query(logsRef, orderBy("loginTime", "desc"), firestoreLimit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Get login logs error:", error);
    return [];
  }
};

// ==========================================
// Update User Role
// ==========================================
export const updateUserRole = async (uid, newRole) => {
  try {
    await setDoc(doc(db, "users", uid), {
      role: newRole,
      permissions: PERMISSIONS[newRole] || PERMISSIONS.cashier,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log("Role updated for:", uid);
    return true;
  } catch (error) {
    console.error("Update role error:", error);
    throw error;
  }
};

// ==========================================
// Update User Status
// ==========================================
export const updateUserStatus = async (uid, status) => {
  try {
    await setDoc(doc(db, "users", uid), {
      status,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log("Status updated for:", uid);
    return true;
  } catch (error) {
    console.error("Update status error:", error);
    throw error;
  }
};

// ==========================================
// Delete User Document
// ==========================================
export const deleteUserDoc = async (uid) => {
  try {
    await deleteDoc(doc(db, "users", uid));
    console.log("User deleted:", uid);
    return true;
  } catch (error) {
    console.error("Delete user error:", error);
    throw error;
  }
};

// ==========================================
// Create User (By Admin)
// ==========================================
export const createUser = async (userData, createdBy) => {
  const { email, password, name, phone, role, storeId, storeName } = userData;

  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email.toLowerCase().trim(),
      password
    );
    const user = userCredential.user;

    // Update profile
    await updateProfile(user, { displayName: name.trim() });

    // Create user document
    const userDocData = {
      uid: user.uid,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      phone: phone || "",
      role: role || "cashier",
      storeId: storeId || null,
      storeName: storeName || null,
      status: "active",
      emailVerified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      permissions: PERMISSIONS[role] || PERMISSIONS.cashier,
      createdBy: createdBy || "admin",
    };

    await setDoc(doc(db, "users", user.uid), userDocData);

    return { uid: user.uid, ...userDocData };
  } catch (error) {
    console.error("Create user error:", error);
    throw error;
  }
};

// ==========================================
// Log User Login
// ==========================================
export const logUserLogin = async (uid, email, role) => {
  try {
    const logData = {
      uid,
      email,
      role,
      loginTime: serverTimestamp(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    };

    await setDoc(doc(collection(db, "loginLogs")), logData);
    return true;
  } catch (error) {
    console.error("Log login error:", error);
    return false;
  }
};

// ==========================================
// Verify Email
// ==========================================
export const resendVerificationEmail = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      await sendEmailVerification(user);
      return true;
    }
    throw new Error("No user logged in");
  } catch (error) {
    console.error("Resend verification error:", error);
    throw error;
  }
};

// ==========================================
// Get Current User
// ==========================================
export const getCurrentUser = () => {
  return auth.currentUser;
};

// ==========================================
// Check User Permission
// ==========================================
export const hasPermission = (userRole, resource, action) => {
  const rolePermissions = PERMISSIONS[userRole];
  if (!rolePermissions) return false;
  
  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) return false;
  
  return resourcePermissions.includes(action);
};