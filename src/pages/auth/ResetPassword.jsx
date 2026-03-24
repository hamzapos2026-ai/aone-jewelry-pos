// src/pages/auth/ResetPassword.jsx

import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  Lock,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Languages,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Gem,
  KeyRound,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { confirmReset } from "../../services/authService";
import { verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../../services/firebase";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import en from "../../lang/en.json";
import ur from "../../lang/ur.json";

// Password rules
const passwordRules = [
  { id: "length", test: (p) => p.length >= 8, label: "At least 8 characters" },
  { id: "uppercase", test: (p) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { id: "lowercase", test: (p) => /[a-z]/.test(p), label: "One lowercase letter" },
  { id: "number", test: (p) => /\d/.test(p), label: "One number" },
];

// Input Component
const Input = ({
  icon: Icon,
  value,
  onChange,
  placeholder,
  isDark,
  showPw,
  togglePw,
  required,
  error,
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all duration-300 ${
          error
            ? "border-red-500"
            : focused
            ? "border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.15)]"
            : isDark
            ? "border-yellow-500/30 bg-white/5 hover:border-yellow-500/50"
            : "border-yellow-400/50 bg-gray-50 hover:border-yellow-500"
        } ${isDark ? "bg-white/5" : "bg-white"}`}
      >
        <Icon
          size={18}
          className={`transition-colors ${
            error ? "text-red-500" : focused ? "text-yellow-500" : "text-yellow-600"
          }`}
        />
        <input
          type={showPw ? "text" : "password"}
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
        <button
          type="button"
          onClick={togglePw}
          className="text-yellow-600 transition-colors hover:text-yellow-500"
        >
          {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
};

// Password Strength
const PasswordStrength = ({ password, isDark }) => {
  const passedRules = passwordRules.filter((rule) => rule.test(password));
  const strength = (passedRules.length / passwordRules.length) * 100;

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className={`h-1.5 rounded-full ${isDark ? "bg-gray-700" : "bg-gray-200"}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${strength}%` }}
          className={`h-full rounded-full ${
            strength < 50 ? "bg-red-500" : strength < 75 ? "bg-yellow-500" : "bg-green-500"
          }`}
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {passwordRules.map((rule) => (
          <div
            key={rule.id}
            className={`flex items-center gap-1.5 text-xs ${
              rule.test(password) ? "text-green-500" : isDark ? "text-gray-500" : "text-gray-400"
            }`}
          >
            {rule.test(password) ? <Check size={12} /> : <X size={12} />}
            {rule.label}
          </div>
        ))}
      </div>
    </div>
  );
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();

  const oobCode = searchParams.get("oobCode");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [invalidCode, setInvalidCode] = useState(false);

  // Translations
  const t = useMemo(() => {
    const s = language === "ur" ? ur : en;
    return {
      reset: {
        title: s?.reset?.title || "Reset Password",
        subtitle: s?.reset?.subtitle || "Enter your new password",
        password: s?.reset?.password || "New Password",
        confirmPassword: s?.reset?.confirmPassword || "Confirm New Password",
        button: s?.reset?.button || "Reset Password",
        loading: s?.reset?.loading || "Resetting...",
        successTitle: s?.reset?.successTitle || "Password Reset!",
        successMessage: s?.reset?.successMessage || "You can now login with your new password",
        goToLogin: s?.reset?.goToLogin || "Go to Login",
        invalidTitle: s?.reset?.invalidTitle || "Invalid or Expired Link",
        invalidMessage: s?.reset?.invalidMessage || "This password reset link is invalid or has expired.",
        requestNew: s?.reset?.requestNew || "Request New Link",
      },
      messages: {
        success: s?.messages?.passwordChanged || "Password changed successfully!",
        mismatch: s?.messages?.passwordMismatch || "Passwords do not match",
        weak: s?.messages?.weakPassword || "Password is too weak",
        error: s?.messages?.error || "Something went wrong",
      },
    };
  }, [language]);

  const toastStyle = {
    borderRadius: "12px",
    background: "#111",
    color: "#fbbf24",
    border: "1px solid rgba(251,191,36,0.3)",
  };

  // Verify code on mount
  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode) {
        setInvalidCode(true);
        setVerifying(false);
        return;
      }

      try {
        const userEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(userEmail);
        setVerifying(false);
      } catch (err) {
        console.error("Code verification error:", err);
        setInvalidCode(true);
        setVerifying(false);
      }
    };

    verifyCode();
  }, [oobCode]);

  // Handle reset
  const handleReset = async (e) => {
    e.preventDefault();
    setError("");

    // Validate
    const passedRules = passwordRules.filter((rule) => rule.test(password));
    if (passedRules.length < 3) {
      setError(t.messages.weak);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.messages.mismatch);
      return;
    }

    setLoading(true);

    try {
      await confirmReset(oobCode, password);
      setSuccess(true);
      toast.success(t.messages.success, { style: toastStyle });
    } catch (err) {
      console.error("Reset error:", err);
      toast.error(t.messages.error, { style: toastStyle });
      setError(t.messages.error);
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-400">Verifying reset link...</p>
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
      </div>

      {/* Header */}
      <header
        className={`relative z-10 flex items-center justify-between px-6 py-4 border-b backdrop-blur-sm ${
          isDark ? "border-yellow-500/20 bg-black/20" : "border-yellow-200 bg-white/90 shadow-sm"
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
            className="rounded-xl border p-2.5 border-yellow-500/30 bg-white/5 text-yellow-500 hover:bg-yellow-500/10"
          >
            <Languages size={18} />
          </button>
          <button
            onClick={toggleTheme}
            className="rounded-xl border p-2.5 border-yellow-500/30 bg-white/5 text-yellow-500 hover:bg-yellow-500/10"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative w-full max-w-sm rounded-2xl p-7 shadow-2xl ${
            isDark
              ? "border-2 border-yellow-500/30 bg-white/5 backdrop-blur-xl"
              : "border-2 border-yellow-300 bg-white/95"
          }`}
        >
          <div className="absolute top-0 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />

          <AnimatePresence mode="wait">
            {invalidCode ? (
              // Invalid Code State
              <motion.div
                key="invalid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-6"
              >
                <div className="mb-6 inline-flex rounded-full p-4 bg-red-500/20">
                  <AlertTriangle size={40} className="text-red-500" />
                </div>
                <h2 className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                  {t.reset.invalidTitle}
                </h2>
                <p className={`text-sm mb-6 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  {t.reset.invalidMessage}
                </p>
                <Link
                  to="/forgot-password"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 py-3 font-bold text-black"
                >
                  {t.reset.requestNew}
                </Link>
              </motion.div>
            ) : success ? (
              // Success State
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="mb-6 inline-flex rounded-full p-4 bg-gradient-to-br from-green-400 to-green-600 shadow-lg"
                >
                  <CheckCircle2 size={40} className="text-white" />
                </motion.div>
                <h2 className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                  {t.reset.successTitle}
                </h2>
                <p className={`text-sm mb-6 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  {t.reset.successMessage}
                </p>
                <Link
                  to="/login"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 py-3 font-bold text-black"
                >
                  {t.reset.goToLogin}
                  <ArrowRight size={18} />
                </Link>
              </motion.div>
            ) : (
              // Form State
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="relative mb-6 text-center">
                  <motion.div
                    className="mb-4 inline-flex rounded-2xl p-3.5 border border-yellow-500/30 bg-yellow-500/10"
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  >
                    <KeyRound size={28} className="text-yellow-500" />
                  </motion.div>
                  <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {t.reset.title}
                  </h2>
                  <p className={`mt-1 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    {t.reset.subtitle}
                  </p>
                  {email && (
                    <p className={`mt-2 text-xs ${isDark ? "text-yellow-500/70" : "text-yellow-600"}`}>
                      {email}
                    </p>
                  )}
                </div>

                <form onSubmit={handleReset} className="space-y-4">
                  <Input
                    icon={Lock}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.reset.password}
                    isDark={isDark}
                    showPw={showPassword}
                    togglePw={() => setShowPassword(!showPassword)}
                    required
                  />

                  <PasswordStrength password={password} isDark={isDark} />

                  <Input
                    icon={Lock}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t.reset.confirmPassword}
                    isDark={isDark}
                    showPw={showConfirmPassword}
                    togglePw={() => setShowConfirmPassword(!showConfirmPassword)}
                    required
                    error={error}
                  />

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 py-3.5 font-bold text-black shadow-lg disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        {t.reset.loading}
                      </>
                    ) : (
                      <>
                        {t.reset.button}
                        <ArrowRight size={18} />
                      </>
                    )}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
};

export default ResetPassword;