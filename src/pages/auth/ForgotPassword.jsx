// src/pages/auth/ForgotPassword.jsx

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  Sun,
  Moon,
  Languages,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Gem,
  KeyRound,
  Send,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { sendPasswordReset } from "../../services/authService";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import en from "../../lang/en.json";
import ur from "../../lang/ur.json";

// Input Component
const Input = ({
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  isDark,
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
          type={type}
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
      </div>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1 ml-1">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
};

const ForgotPassword = () => {
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Translations
  const t = useMemo(() => {
    const s = language === "ur" ? ur : en;
    return {
      forgot: {
        title: s?.forgot?.title || "Forgot Password?",
        subtitle: s?.forgot?.subtitle || "Enter your email to receive a reset link",
        email: s?.forgot?.email || "Email Address",
        button: s?.forgot?.button || "Send Reset Link",
        loading: s?.forgot?.loading || "Sending...",
        backToLogin: s?.forgot?.backToLogin || "Back to Login",
        successTitle: s?.forgot?.successTitle || "Email Sent!",
        successMessage: s?.forgot?.successMessage || "Check your inbox for the reset link",
        tryAgain: s?.forgot?.tryAgain || "Try Again",
      },
      messages: {
        success: s?.messages?.resetSent || "Password reset link sent!",
        invalidEmail: s?.messages?.invalidEmail || "Please enter a valid email",
        userNotFound: s?.messages?.userNotFound || "No account found with this email",
        error: s?.messages?.error || "Something went wrong",
        tooManyRequests: s?.messages?.tooManyRequests || "Too many requests. Please wait and try again.",
      },
    };
  }, [language]);

  const toastStyle = {
    borderRadius: "12px",
    background: "#111",
    color: "#fbbf24",
    border: "1px solid rgba(251,191,36,0.3)",
  };

  // Validate email
  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError(t.messages.invalidEmail);
      return;
    }

    if (!validateEmail(email)) {
      setError(t.messages.invalidEmail);
      return;
    }

    setLoading(true);

    try {
      await sendPasswordReset(email);
      setSuccess(true);
      toast.success(t.messages.success, { style: toastStyle });
    } catch (err) {
      console.error("Password reset error:", err);
      
      let errorMessage = t.messages.error;
      
      if (err.code === "auth/user-not-found") {
        errorMessage = t.messages.userNotFound;
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = t.messages.tooManyRequests;
      } else if (err.code === "auth/invalid-email") {
        errorMessage = t.messages.invalidEmail;
      }
      
      setError(errorMessage);
      toast.error(errorMessage, { style: toastStyle });
    } finally {
      setLoading(false);
    }
  };

  // Handle try again
  const handleTryAgain = () => {
    setSuccess(false);
    setEmail("");
    setError("");
  };

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
          <Link
            to="/login"
            className="flex items-center gap-2 text-yellow-500 hover:text-yellow-400 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
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
        </div>

        <div className="flex gap-2">
          <button
            onClick={toggleLanguage}
            className={`rounded-xl border p-2.5 transition-all ${
              isDark
                ? "border-yellow-500/30 bg-white/5 text-yellow-500 hover:border-yellow-500/50 hover:bg-yellow-500/10"
                : "border-yellow-200 bg-white text-amber-600 hover:bg-yellow-50"
            }`}
          >
            <Languages size={18} />
          </button>
          <button
            onClick={toggleTheme}
            className={`rounded-xl border p-2.5 transition-all ${
              isDark
                ? "border-yellow-500/30 bg-white/5 text-yellow-500 hover:border-yellow-500/50 hover:bg-yellow-500/10"
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
              ? "border-2 border-yellow-500/30 bg-white/5 text-white backdrop-blur-xl shadow-yellow-500/10"
              : "border-2 border-yellow-300 bg-white/95 text-gray-900 shadow-black/20"
          }`}
        >
          {/* Top accent */}
          <div className="absolute top-0 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />

          <AnimatePresence mode="wait">
            {success ? (
              // Success State
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center py-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  className="mb-6 inline-flex rounded-full p-4 bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/30"
                >
                  <CheckCircle2 size={40} className="text-white" />
                </motion.div>

                <h2 className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                  {t.forgot.successTitle}
                </h2>

                <p className={`text-sm mb-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  {t.forgot.successMessage}
                </p>

                <p className={`text-xs mb-6 ${isDark ? "text-yellow-500/70" : "text-yellow-600"}`}>
                  {email}
                </p>

                <div className="space-y-3">
                  <Link
                    to="/login"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 py-3 font-bold text-black transition-all shadow-lg hover:shadow-xl"
                  >
                    <ArrowLeft size={18} />
                    {t.forgot.backToLogin}
                  </Link>

                  <button
                    onClick={handleTryAgain}
                    className={`w-full py-3 rounded-xl font-medium transition-colors ${
                      isDark
                        ? "text-gray-400 hover:text-white hover:bg-white/10"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    {t.forgot.tryAgain}
                  </button>
                </div>
              </motion.div>
            ) : (
              // Form State
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
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
                    <KeyRound size={28} className="text-yellow-500" />
                  </motion.div>

                  <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {t.forgot.title}
                  </h2>

                  <p className={`mt-1 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    {t.forgot.subtitle}
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    icon={Mail}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder={t.forgot.email}
                    isDark={isDark}
                    required
                    error={error}
                  />

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 py-3.5 font-bold text-black transition-all shadow-lg shadow-yellow-500/30 hover:from-yellow-500 hover:via-amber-500 hover:to-yellow-500 hover:shadow-yellow-500/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        {t.forgot.loading}
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        {t.forgot.button}
                      </>
                    )}
                  </motion.button>
                </form>

                {/* Back to Login */}
                <div className={`mt-6 text-center text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 font-medium text-yellow-500 hover:text-yellow-400 transition-colors"
                  >
                    <ArrowLeft size={16} />
                    {t.forgot.backToLogin}
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div
            className={`mt-6 flex items-center justify-center gap-4 border-t pt-5 text-xs ${
              isDark ? "border-yellow-500/20 text-gray-500" : "border-yellow-200 text-gray-500"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Online
            </span>
            <span className="text-yellow-500/50">•</span>
            <span>Secured by Firebase</span>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ForgotPassword;