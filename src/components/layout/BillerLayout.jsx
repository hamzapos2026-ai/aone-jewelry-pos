import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { WifiOff } from "lucide-react";

import Header from "./header";
import Footer from "./Footer";
import { useTheme } from "../../hooks/useTheme";
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
    // ✅ Load cached user immediately (for offline)
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
          // ✅ Offline: keep cached user
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

        // ✅ Try to fetch from Firestore (only if online)
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
            // ✅ Cache for offline
            localStorage.setItem("billerUser", JSON.stringify(userData));
          } catch (error) {
            console.error("Biller user fetch error:", error);
            // ✅ Fallback to cached
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
          // ✅ Offline: use cached or basic info
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
      // ✅ Auth completely fails offline - use cached
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
      {/* ✅ Offline Banner */}
      {!isOnline && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
          <WifiOff size={16} />
          <span>Offline Mode — Bills save locally & sync when online</span>
        </div>
      )}

      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-30">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-yellow-500/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(251,191,36,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(251,191,36,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative flex min-h-screen flex-col">
        <Header user={user} />

        <main className="flex-1 p-4 lg:p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default BillerLayout;