import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchUserData = async (uid) => {
    if (!uid) return null;

    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        return { uid: userDoc.id, ...userDoc.data() };
      }

      console.warn("⚠️ User document not found for UID:", uid);
      return null;
    } catch (error) {
      console.error("❌ Error fetching user document:", error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("🔄 Auth State Changed:", user?.email || "No user");

      setLoading(true);

      if (!user) {
        setCurrentUser(null);
        setUserData(null);
        setProfileLoading(false);
        setLoading(false);
        return;
      }

      setCurrentUser(user);
      setProfileLoading(true);

      try {
        const data = await fetchUserData(user.uid);
        setUserData(data);
        console.log("✅ User Data Loaded:", data?.role || "No role");
      } catch (error) {
        console.error("❌ Error fetching user data:", error);
        setUserData(null);
      } finally {
        setProfileLoading(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setCurrentUser(null);
      setUserData(null);
      setProfileLoading(false);

      localStorage.removeItem("user");
      localStorage.removeItem("userData");
      localStorage.removeItem("session");

      console.log("✅ User signed out");
    } catch (error) {
      console.error("❌ Sign out error:", error);
      throw error;
    }
  };

  const value = {
    currentUser,
    userData,
    loading,
    profileLoading,
    user: currentUser,
    signOut,
    isSuperAdmin: userData?.role === "superadmin",
    isAdmin: userData?.role === "admin",
    isManager: userData?.role === "manager",
    isCashier: userData?.role === "cashier",
    isBiller: userData?.role === "biller",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};