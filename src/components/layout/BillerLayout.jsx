import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import Header from "./header";
import Footer from "./Footer";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { auth, db } from "../../services/firebase";

const BillerLayout = () => {
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const location = useLocation();
  const isRTL = language === "ur";

  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }

      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setUser({
            uid: firebaseUser.uid,
            ...userSnap.data(),
          });
        } else {
          setUser({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || "User",
            email: firebaseUser.email || "",
            role: "biller",
          });
        }
      } catch (error) {
        console.error("Error fetching biller user data:", error);
        setUser({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || "User",
          email: firebaseUser.email || "",
          role: "biller",
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div
      className={`min-h-screen ${isDark ? "bg-[#050505]" : "bg-gray-50"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-30">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-yellow-500/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl" />
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