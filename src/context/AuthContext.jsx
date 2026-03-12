// ==========================================
// Auth Context
// ==========================================
// Ye global user state manage karta hai
// App me kahin bhi useAuth() se user mil sakta hai
// ==========================================

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);   //  Current logged user
  const [loading, setLoading] = useState(true);

  //  Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

//  Custom Hook
export const useAuth = () => useContext(AuthContext);