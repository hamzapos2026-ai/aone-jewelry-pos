// src/pages/auth/Login.jsx

import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Languages,
  ShieldCheck,
  Crown,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Gem,
  Shield,
  BarChart3,
  Wallet,
  FileText,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { checkSuperAdminExists } from "../../utils/checkSuperAdmin";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import en from "../../lang/en.json";
import ur from "../../lang/ur.json";

const roles = [
  { id: "superadmin", icon: Crown },
  { id: "admin", icon: Shield },
  { id: "manager", icon: BarChart3 },
  { id: "cashier", icon: Wallet },
  { id: "biller", icon: FileText },
];

// ==========================================
// Role Dashboard Paths
// ==========================================
const ROLE_DASHBOARD_PATHS = {
  superadmin: "/superadmin/dashboard",
  admin: "/admin/dashboard",
  manager: "/manager/dashboard",
  cashier: "/cashier/dashboard",
  biller: "/biller/dashboard",
};

const Input = ({
  icon: Icon,
  type,
  value,
  onChange,
  placeholder,
  isDark,
  isPassword,
  showPw,
  togglePw,
  required,
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all duration-300 ${
        focused
          ? "border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.15)]"
          : isDark
          ? "border-yellow-500/30 bg-white/5 hover:border-yellow-500/50"
          : "border-yellow-400/50 bg-gray-50 hover:border-yellow-500"
      } ${isDark ? "bg-white/5" : "bg-white"}`}
    >
      <Icon
        size={18}
        className={`transition-colors ${
          focused ? "text-yellow-500" : "text-yellow-600"
        }`}
      />
      <input
        type={isPassword ? (showPw ? "text" : "password") : type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        required={required}
        className={`flex-1 bg-transparent text-sm font-medium outline-none ${
          isDark
            ? "text-white placeholder:text-gray-400"
            : "text-gray-800 placeholder:text-gray-500"
        }`}
      />
      {isPassword && (
        <button
          type="button"
          onClick={togglePw}
          className="text-yellow-600 transition-colors hover:text-yellow-500"
        >
          {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
  );
};

const RoleDropdown = ({ role, setRole, isDark, t }) => {
  const [open, setOpen] = useState(false);
  const current = roles.find((r) => r.id === role);
  const CurrentIcon = current?.icon || Shield;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-all duration-300 ${
          open
            ? "border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.15)]"
            : isDark
            ? "border-yellow-500/30 hover:border-yellow-500/50"
            : "border-yellow-400/50 hover:border-yellow-500"
        } ${isDark ? "bg-white/5" : "bg-white"}`}
      >
        <div className="flex items-center gap-3">
          <CurrentIcon size={18} className="text-yellow-500" />
          <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-800"}`}>
            {t.roles[role]}
          </span>
        </div>
        <ChevronDown
          size={18}
          className={`text-yellow-600 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`absolute z-50 mt-2 w-full overflow-hidden rounded-xl border-2 shadow-2xl ${
              isDark
                ? "border-yellow-500/30 bg-gray-900/95 backdrop-blur-xl"
                : "border-yellow-400/50 bg-white"
            }`}
          >
            {roles.map(({ id, icon: RoleIcon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setRole(id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all ${
                  role === id
                    ? "bg-yellow-500/20 text-yellow-500"
                    : isDark
                    ? "text-gray-300 hover:bg-yellow-500/10 hover:text-yellow-400"
                    : "text-gray-700 hover:bg-yellow-50 hover:text-yellow-600"
                }`}
              >
                <RoleIcon size={16} className={role === id ? "text-yellow-500" : "text-yellow-600/60"} />
                <span className="font-medium">{t.roles[id]}</span>
                {role === id && <CheckCircle2 size={16} className="ml-auto text-green-500" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Login = () => {
  const navigate = useNavigate();
  
  // Context hooks
  const { user, userData, loading: authLoading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();

  // Translations
  const t = useMemo(() => {
    const s = language === "ur" ? ur : en;
    return {
      login: {
        title: s?.login?.title || "A ONE JEWELRY",
        subtitle: s?.login?.subtitle || "Premium Point of Sale System",
        loginAs: s?.login?.loginAs || "Login as",
        email: s?.login?.email || "Email or Username",
        password: s?.login?.password || "Password",
        remember: s?.login?.remember || "Remember Me",
        forgot: s?.login?.forgot || "Forgot Password?",
        button: s?.login?.button || "Sign In",
        loading: s?.login?.loading || "Please wait...",
        noAccount: s?.login?.noAccount || "Don't have an account?",
        register: s?.login?.register || "Create Account",
      },
      roles: {
        superadmin: s?.roles?.superadmin || "Super Admin",
        admin: s?.roles?.admin || "Admin",
        manager: s?.roles?.manager || "Manager",
        cashier: s?.roles?.cashier || "Cashier",
        biller: s?.roles?.biller || "Biller",
      },
      messages: {
        success: s?.messages?.success || "Login Successful",
        error: s?.messages?.error || "Invalid Credentials",
        roleMismatch: s?.messages?.roleMismatch || "Selected role does not match your account role",
      },
      extra: {
        online: s?.extra?.online || "Online",
        ssl: s?.extra?.ssl || "SSL",
        version: s?.extra?.version || "v2.0",
      },
    };
  }, [language]);

  // State
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [checkingSuperAdmin, setCheckingSuperAdmin] = useState(true);

  // Toast style
  const toastStyle = {
    borderRadius: "12px",
    background: "#111",
    color: "#fbbf24",
    border: "1px solid rgba(251,191,36,0.3)",
  };

  // Check setup on mount
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const exists = await checkSuperAdminExists();
        if (!exists) {
          console.log("No super admin found, redirecting to setup");
          navigate("/", { replace: true });
          return;
        }
      } catch (error) {
        console.error("Error checking super admin:", error);
      } finally {
        setCheckingSuperAdmin(false);
      }
    };

    checkSetup();
  }, [navigate]);

  // Redirect if already logged in
  useEffect(() => {
    if (user && userData?.role && !authLoading) {
      const redirectPath = ROLE_DASHBOARD_PATHS[userData.role] || "/login";
      console.log("User already logged in, redirecting to:", redirectPath);
      navigate(redirectPath, { replace: true });
    }
  }, [user, userData, authLoading, navigate]);

  // ==========================================
  // LOGIN HANDLER (Role-Based Validation)
  // ==========================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("🔄 Starting login process...");
      console.log("📧 Email:", identifier);
      console.log("🎭 Selected Role:", role);

      // Step 1: Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        identifier.toLowerCase().trim(),
        password
      );
      
      const firebaseUser = userCredential.user;
      console.log("✅ Firebase Auth successful:", firebaseUser.uid);

      // Step 2: Get user data from Firestore
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      
      if (!userDoc.exists()) {
        // User document not found - sign out and show error
        await signOut(auth);
        setError("User profile not found. Please contact admin.");
        toast.error("User profile not found!", { style: toastStyle });
        setLoading(false);
        return;
      }

      const userDataFromDB = userDoc.data();
      const actualRole = userDataFromDB.role;
      
      console.log("📋 User data from DB:", userDataFromDB);
      console.log("🎭 Actual Role:", actualRole);
      console.log("🎭 Selected Role:", role);

      // Step 3: ⭐ ROLE VALIDATION - Sign out if mismatch
      if (actualRole !== role) {
        console.log("❌ Role mismatch detected!");
        console.log(`   Expected: ${role}, Actual: ${actualRole}`);
        
        // Sign out immediately
        await signOut(auth);
        
        setError(`Role mismatch! Your account is "${actualRole.toUpperCase()}", but you selected "${role.toUpperCase()}". Please select the correct role.`);
        
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-bold">⚠️ Role Mismatch!</span>
            <span>Your role: <strong>{actualRole.toUpperCase()}</strong></span>
            <span>Selected: <strong>{role.toUpperCase()}</strong></span>
          </div>,
          { 
            style: toastStyle,
            duration: 5000,
            icon: "🚫"
          }
        );
        
        setLoading(false);
        return;
      }

      // Step 4: Check if user is active
      if (userDataFromDB.status === "inactive" || userDataFromDB.status === "suspended") {
        await signOut(auth);
        setError("Your account is suspended. Please contact admin.");
        toast.error("Account suspended!", { style: toastStyle });
        setLoading(false);
        return;
      }

      // Step 5: Update last login
      try {
        await updateDoc(doc(db, "users", firebaseUser.uid), {
          lastLogin: serverTimestamp(),
          emailVerified: firebaseUser.emailVerified,
        });
      } catch (updateError) {
        console.warn("Could not update last login:", updateError);
      }

      // Step 6: Remember me
      if (remember) {
        localStorage.setItem("rememberMe", "true");
        localStorage.setItem("userEmail", identifier);
      } else {
        localStorage.removeItem("rememberMe");
        localStorage.removeItem("userEmail");
      }

      // Step 7: Success!
      setSuccess(true);
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-bold">✅ Welcome back!</span>
          <span>Logged in as: <strong>{actualRole.toUpperCase()}</strong></span>
        </div>,
        { style: toastStyle }
      );

      // Step 8: Redirect based on role
      const redirectPath = ROLE_DASHBOARD_PATHS[actualRole] || "/login";
      console.log("🚀 Redirecting to:", redirectPath);

      setTimeout(() => {
        navigate(redirectPath, { replace: true });
      }, 1200);

    } catch (err) {
      console.error("❌ Login error:", err);
      
      const errorMessages = {
        "auth/user-not-found": "No account found with this email",
        "auth/wrong-password": "Incorrect password",
        "auth/invalid-email": "Invalid email address",
        "auth/too-many-requests": "Too many attempts. Please try again later",
        "auth/invalid-credential": "Invalid email or password",
        "auth/network-request-failed": "Network error. Please check your connection",
      };
      
      const errorMsg = errorMessages[err.code] || err.message || t.messages.error;
      setError(errorMsg);
      toast.error(errorMsg, { style: toastStyle, duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking
  if (checkingSuperAdmin || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-yellow-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-gray-900">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-yellow-500/10 blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-500/5 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(251,191,36,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(251,191,36,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      {/* Header */}
      <header
        className={`relative z-10 flex items-center justify-between px-6 py-4 border-b backdrop-blur-sm ${
          isDark
            ? "border-yellow-500/20 bg-black/20"
            : "border-yellow-200 bg-white/90 shadow-sm"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2.5 shadow-lg bg-gradient-to-br from-yellow-500 to-amber-600">
            <Gem size={22} className="text-white" />
          </div>
          <div>
            <h1 className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
              A ONE JEWELRY
            </h1>
            <p className={`text-xs ${isDark ? "text-yellow-500/70" : "text-amber-600"}`}>
              Point of Sale
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={toggleLanguage}
            className={`rounded-xl border p-2.5 transition-all ${
              isDark
                ? "border-yellow-500/30 bg-white/5 text-yellow-500 hover:border-yellow-500/50"
                : "border-yellow-200 bg-white text-amber-600 hover:bg-yellow-50"
            }`}
          >
            <Languages size={18} />
          </button>
          <button
            onClick={toggleTheme}
            className={`rounded-xl border p-2.5 transition-all ${
              isDark
                ? "border-yellow-500/30 bg-white/5 text-yellow-500 hover:border-yellow-500/50"
                : "border-yellow-200 bg-white text-amber-600 hover:bg-yellow-50"
            }`}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-1 items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4 }}
          className={`relative w-full max-w-sm rounded-2xl p-7 shadow-2xl ${
            isDark
              ? "border-2 border-yellow-500/30 bg-white/5 text-white backdrop-blur-xl"
              : "border-2 border-yellow-300 bg-white/95 text-gray-900"
          }`}
        >
          {/* Top accent */}
          <div className="absolute top-0 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />

          {/* Success Overlay */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-black/80 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="flex flex-col items-center gap-3"
                >
                  <motion.div
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 0.5 }}
                  >
                    <CheckCircle2 size={32} className="text-white" />
                  </motion.div>
                  <p className="text-lg font-semibold text-white">{t.messages.success}</p>
                  <p className="text-sm text-gray-400">Redirecting...</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Header */}
          <div className="relative mb-6 text-center">
            <motion.div
              className={`mb-4 inline-flex rounded-2xl p-3.5 ${
                isDark
                  ? "border border-yellow-500/30 bg-yellow-500/10"
                  : "border border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-100"
              }`}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <ShieldCheck size={28} className="text-yellow-500" />
            </motion.div>
            <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Welcome Back
            </h2>
            <p className={`mt-1 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              {t.login.subtitle}
            </p>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl overflow-hidden"
              >
                <p className="text-red-400 text-sm text-center flex items-center justify-center gap-2">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{error}</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleLogin} className="relative space-y-4">
            {/* Role Selection */}
            <div>
              <label className={`mb-2 block text-xs font-semibold ${isDark ? "text-yellow-500/80" : "text-yellow-700"}`}>
                {t.login.loginAs} <span className="text-red-400">*</span>
              </label>
              <RoleDropdown role={role} setRole={setRole} isDark={isDark} t={t} />
              <p className={`mt-1 text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                ⚠️ Select your actual account role
              </p>
            </div>

            {/* Email */}
            <Input
              icon={User}
              type="text"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setError("");
              }}
              placeholder={t.login.email}
              isDark={isDark}
              required
            />

            {/* Password */}
            <Input
              icon={Lock}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder={t.login.password}
              isDark={isDark}
              isPassword
              showPw={showPassword}
              togglePw={() => setShowPassword(!showPassword)}
              required
            />

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between pt-1 text-sm">
              <label className="group flex cursor-pointer items-center gap-2.5">
                <div
                  className={`relative flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
                    remember
                      ? "border-transparent bg-gradient-to-br from-yellow-400 to-amber-500"
                      : isDark
                      ? "border-yellow-500/40 group-hover:border-yellow-500/60"
                      : "border-yellow-400 group-hover:border-yellow-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={() => setRemember(!remember)}
                    className="absolute h-full w-full cursor-pointer opacity-0"
                  />
                  {remember && (
                    <motion.svg
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="h-3 w-3 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </motion.svg>
                  )}
                </div>
                <span className={isDark ? "text-gray-400" : "text-gray-600"}>
                  {t.login.remember}
                </span>
              </label>
              <Link
                to="/forgot-password"
                className="font-medium text-yellow-500 transition-colors hover:text-yellow-400"
              >
                {t.login.forgot}
              </Link>
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading || success}
              whileHover={!loading && !success ? { scale: 1.02, y: -1 } : {}}
              whileTap={!loading && !success ? { scale: 0.98 } : {}}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 py-3.5 font-bold text-black transition-all shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t.login.loading}
                </>
              ) : (
                <>
                  {t.login.button}
                  <ArrowRight size={18} />
                </>
              )}
            </motion.button>
          </form>

          {/* Register Link */}
          <div className={`mt-6 text-center text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            <span>{t.login.noAccount} </span>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 font-semibold text-yellow-500 hover:text-yellow-400"
            >
              <UserPlus size={16} />
              {t.login.register}
            </Link>
          </div>

          {/* Footer */}
          <div
            className={`mt-6 flex items-center justify-center gap-4 border-t pt-5 text-xs ${
              isDark ? "border-yellow-500/20 text-gray-500" : "border-yellow-200 text-gray-500"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              {t.extra.online}
            </span>
            <span className="text-yellow-500/50">•</span>
            <span className="flex items-center gap-1.5">
              <Lock size={10} className="text-yellow-600" />
              {t.extra.ssl}
            </span>
            <span className="text-yellow-500/50">•</span>
            <span>{t.extra.version}</span>
          </div>
        </motion.div>
      </main>

      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-40 bg-gradient-to-t from-yellow-500/5 to-transparent" />
    </div>
  );
};

export default Login;