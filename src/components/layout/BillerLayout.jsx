// src/layouts/biller/BillerLayout.jsx
// ✅ FIXED — Correct imports, clean layout

import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { WifiOff } from "lucide-react";

import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../hooks/useLanguage";
import useNetworkStatus from "../../hooks/useNetworkStatus";
import { auth, db } from "../../services/firebase";

const BillerLayout = () => {
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const location = useLocation();
  const isOnline = useNetworkStatus();
  const isRTL = language === "ur";

  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem("billerUser");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let unsubscribe = () => {};

    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
          if (!isOnline) {
            const cached = localStorage.getItem("billerUser");
            if (cached) {
              try { setUser(JSON.parse(cached)); } catch (e) {}
            }
            return;
          }
          setUser(null);
          return;
        }

        if (isOnline) {
          try {
            const userRef = doc(db, "users", firebaseUser.uid);
            const userSnap = await getDoc(userRef);

            const userData = userSnap.exists()
              ? { uid: firebaseUser.uid, ...userSnap.data() }
              : {
                  uid: firebaseUser.uid,
                  name: firebaseUser.displayName || "User",
                  email: firebaseUser.email || "",
                  role: "biller",
                };

            setUser(userData);
            localStorage.setItem("billerUser", JSON.stringify(userData));
          } catch (error) {
            console.error("Biller user fetch error:", error);
            const cached = localStorage.getItem("billerUser");
            if (cached) {
              try { setUser(JSON.parse(cached)); } catch (e) {}
            } else {
              setUser({
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || "User",
                email: firebaseUser.email || "",
                role: "biller",
              });
            }
          }
        } else {
          const cached = localStorage.getItem("billerUser");
          if (cached) {
            try { setUser(JSON.parse(cached)); } catch (e) {}
          } else {
            setUser({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || "User",
              email: firebaseUser.email || "",
              role: "biller",
            });
          }
        }
      });
    } catch (error) {
      console.error("Auth listener error:", error);
      const cached = localStorage.getItem("billerUser");
      if (cached) {
        try { setUser(JSON.parse(cached)); } catch (e) {}
      }
    }

    return () => unsubscribe();
  }, [isOnline]);

  return (
    <div
      className={`min-h-screen ${isDark ? "bg-[#050505] text-white" : "bg-gray-50 text-gray-900"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-30">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-yellow-500/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(251,191,36,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(251,191,36,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      {/* NO Header here — BillerHeader is inside Dashboard */}
      <div className="relative flex min-h-screen flex-col">
        <main className="flex-1">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-screen"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default BillerLayout;