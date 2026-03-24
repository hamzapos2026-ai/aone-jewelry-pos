// src/pages/auth/Register.jsx

import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Languages,
  UserPlus,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Gem,
  Shield,
  BarChart3,
  Wallet,
  FileText,
  Mail,
  ArrowLeft,
  AlertCircle,
  Check,
  X,
  Crown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { registerUser, checkEmailExists } from "../../services/authService";
import { checkSuperAdminExists } from "../../utils/checkSuperAdmin";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { useAuth } from "../../context/AuthContext";
import en from "../../lang/en.json";
import ur from "../../lang/ur.json";

// Roles - conditionally include superadmin
const getRoles = (hasSuperAdmin) => {
  const baseRoles = [
    { id: "admin", icon: Shield },
    { id: "manager", icon: BarChart3 },
    { id: "cashier", icon: Wallet },
    { id: "biller", icon: FileText },
  ];

  if (!hasSuperAdmin) {
    return [{ id: "superadmin", icon: Crown }, ...baseRoles];
  }

  return baseRoles;
};

// Password validation rules
const passwordRules = [
  { id: "length", test: (p) => p.length >= 8, label: "At least 8 characters" },
  { id: "uppercase", test: (p) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { id: "lowercase", test: (p) => /[a-z]/.test(p), label: "One lowercase letter" },
  { id: "number", test: (p) => /\d/.test(p), label: "One number" },
  { id: "special", test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p), label: "One special character" },
];

// Input Component
const Input = ({
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  isDark,
  isPassword,
  showPw,
  togglePw,
  required,
  disabled,
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
        } ${isDark ? "bg-white/5" : "bg-white"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <Icon
          size={18}
          className={`transition-colors ${
            error ? "text-red-500" : focused ? "text-yellow-500" : "text-yellow-600"
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
          disabled={disabled}
          className={`flex-1 bg-transparent text-sm font-medium outline-none ${
            isDark
              ? "text-white placeholder:text-gray-400"
              : "text-gray-800 placeholder:text-gray-500"
          } ${disabled ? "cursor-not-allowed" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={togglePw}
            disabled={disabled}
            className="text-yellow-600 transition-colors hover:text-yellow-500 disabled:opacity-50"
          >
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
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

// Role Dropdown Component
const RoleDropdown = ({ role, setRole, isDark, t, roles, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const current = roles.find((r) => r.id === role);
  const CurrentIcon = current?.icon || Shield;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-all duration-300 ${
          disabled
            ? isDark 
              ? "bg-gray-800/50 cursor-not-allowed border-yellow-500/20"
              : "bg-gray-100 cursor-not-allowed border-yellow-300/50"
            : open
            ? "border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.15)]"
            : isDark
            ? "border-yellow-500/30 hover:border-yellow-500/50"
            : "border-yellow-400/50 hover:border-yellow-500"
        } ${isDark ? "bg-white/5" : "bg-white"}`}
      >
        <div className="flex items-center gap-3">
          <CurrentIcon size={18} className={disabled ? "text-yellow-500/60" : "text-yellow-500"} />
          <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-800"} ${disabled ? "opacity-70" : ""}`}>
            {t.roles[role] || role}
          </span>
          {disabled && role === "superadmin" && (
            <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full ml-1">
              Required
            </span>
          )}
        </div>
        {!disabled && (
          <ChevronDown
            size={18}
            className={`text-yellow-600 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      <AnimatePresence>
        {open && !disabled && (
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
                <span className="font-medium">{t.roles[id] || id}</span>
                {role === id && <CheckCircle2 size={16} className="ml-auto text-green-500" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Password Strength Indicator
const PasswordStrength = ({ password, isDark, t }) => {
  const passedRules = passwordRules.filter((rule) => rule.test(password));
  const strength = (passedRules.length / passwordRules.length) * 100;

  const getStrengthColor = () => {
    if (strength < 40) return "bg-red-500";
    if (strength < 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthText = () => {
    if (strength < 40) return t?.register?.weak || "Weak";
    if (strength < 70) return t?.register?.medium || "Medium";
    return t?.register?.strong || "Strong";
  };

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className={isDark ? "text-gray-400" : "text-gray-600"}>
          {t?.register?.passwordStrength || "Password Strength"}
        </span>
        <span
          className={`font-medium ${
            strength < 40 ? "text-red-500" : strength < 70 ? "text-yellow-500" : "text-green-500"
          }`}
        >
          {getStrengthText()}
        </span>
      </div>

      <div className={`h-1.5 rounded-full ${isDark ? "bg-gray-700" : "bg-gray-200"}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${strength}%` }}
          className={`h-full rounded-full ${getStrengthColor()}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-2">
        {passwordRules.map((rule) => (
          <div
            key={rule.id}
            className={`flex items-center gap-1.5 text-xs ${
              rule.test(password)
                ? "text-green-500"
                : isDark
                ? "text-gray-500"
                : "text-gray-400"
            }`}
          >
            {rule.test(password) ? <Check size={12} /> : <X size={12} />}
            {t?.register?.passwordRules?.[rule.id] || rule.label}
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Register Component
const Register = () => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const { user, refreshUser, updateUser, setRegistering } = useAuth();

  // ============================================
  // ALL HOOKS MUST BE DECLARED BEFORE ANY RETURNS
  // ============================================

  // Check for existing super admins
  const [hasSuperAdmin, setHasSuperAdmin] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("superadmin");

  // UI state
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Check super admin exists on mount
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const exists = await checkSuperAdminExists();
        console.log("Super admin exists:", exists);
        setHasSuperAdmin(exists);
        setRole(exists ? "biller" : "superadmin");
      } catch (error) {
        console.error("Error checking super admin:", error);
        setHasSuperAdmin(false);
        setRole("superadmin");
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
  }, []);

  // Get translations
  const t = useMemo(() => {
    const s = language === "ur" ? ur : en;
    return {
      register: {
        title: hasSuperAdmin ? s?.register?.title || "Create Account" : "Create Super Admin",
        subtitle: hasSuperAdmin 
          ? s?.register?.subtitle || "Join A ONE Jewelry POS System" 
          : "Create the first Super Admin account to get started",
        name: s?.register?.name || "Full Name",
        email: s?.register?.email || "Email Address",
        password: s?.register?.password || "Password",
        confirmPassword: s?.register?.confirmPassword || "Confirm Password",
        selectRole: hasSuperAdmin ? s?.register?.selectRole || "Select Role" : "Account Type",
        terms: s?.register?.terms || "I agree to the Terms of Service and Privacy Policy",
        button: s?.register?.button || "Create Account",
        loading: s?.register?.loading || "Creating account...",
        haveAccount: s?.register?.haveAccount || "Already have an account?",
        login: s?.register?.login || "Sign In",
        passwordStrength: s?.register?.passwordStrength || "Password Strength",
        weak: s?.register?.weak || "Weak",
        medium: s?.register?.medium || "Medium",
        strong: s?.register?.strong || "Strong",
        passwordRules: s?.register?.passwordRules || {},
      },
      roles: {
        superadmin: s?.roles?.superadmin || "Super Admin",
        admin: s?.roles?.admin || "Admin",
        manager: s?.roles?.manager || "Manager",
        cashier: s?.roles?.cashier || "Cashier",
        biller: s?.roles?.biller || "Biller",
      },
      messages: {
        success: s?.messages?.registerSuccess || "Account created successfully!",
        emailExists: s?.messages?.emailExists || "Email already exists",
        passwordMismatch: s?.messages?.passwordMismatch || "Passwords do not match",
        weakPassword: s?.messages?.weakPassword || "Password is too weak",
        error: s?.messages?.registerError || "Registration failed",
        verifyEmail: s?.messages?.verifyEmail || "Please verify your email",
      },
      extra: {
        online: s?.extra?.online || "Online",
        ssl: s?.extra?.ssl || "SSL",
        version: s?.extra?.version || "v2.0",
      },
    };
  }, [language, hasSuperAdmin]);

  // Toast style
  const toastStyle = useMemo(() => ({
    borderRadius: "12px",
    background: isDark ? "#111" : "#fff",
    color: isDark ? "#fbbf24" : "#92400e",
    border: `1px solid ${isDark ? "rgba(251,191,36,0.3)" : "rgba(251,191,36,0.5)"}`,
  }), [isDark]);

  // Validate form
  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    } else if (name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Invalid email format";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else {
      const passedRules = passwordRules.filter((rule) => rule.test(password));
      if (passedRules.length < 3) {
        newErrors.password = "Password is too weak";
      }
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!agreedToTerms) {
      newErrors.terms = "You must agree to the terms";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, email, password, confirmPassword, agreedToTerms]);

  // Handle registration
  const handleRegister = useCallback(async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors", { style: toastStyle });
      return;
    }

    setLoading(true);
    setErrors({});

    // Tell AuthContext we're registering
    if (setRegistering) {
      setRegistering(true);
    }

    try {
      // Check if email exists first
      console.log("Checking if email exists...");
      const emailExists = await checkEmailExists(email);
      if (emailExists) {
        setErrors({ email: t.messages.emailExists });
        toast.error(t.messages.emailExists, { style: toastStyle });
        setLoading(false);
        return;
      }

      // Register user
      console.log("Registering user with role:", role);
      const result = await registerUser({
        email: email.trim(),
        password,
        name: name.trim(),
        role,
      });

      console.log("Registration successful:", result);

      // Update AuthContext with new user data
      if (updateUser) {
        updateUser(result);
      }

      setSuccess(true);
      toast.success(t.messages.success, { style: toastStyle });

      // Navigate after delay
      setTimeout(() => {
        if (refreshUser) {
          refreshUser();
        }
        
        if (role === "superadmin") {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/login", { replace: true });
        }
      }, 2000);

    } catch (error) {
      console.error("Registration error:", error);

      let errorMessage = t.messages.error;
      
      if (error.code === "auth/email-already-in-use") {
        errorMessage = t.messages.emailExists;
        setErrors({ email: errorMessage });
      } else if (error.code === "auth/weak-password") {
        errorMessage = t.messages.weakPassword;
        setErrors({ password: errorMessage });
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
        setErrors({ email: errorMessage });
      } else if (error.message?.includes("permission")) {
        errorMessage = "Setup error. Please refresh and try again.";
      }

      toast.error(errorMessage, { style: toastStyle });
    } finally {
      setLoading(false);
      if (setRegistering) {
        setRegistering(false);
      }
    }
  }, [validateForm, email, password, name, role, t, toastStyle, navigate, refreshUser, updateUser, setRegistering]);

  // ============================================
  // CONDITIONAL RETURNS AFTER ALL HOOKS
  // ============================================

  // Loading state
  if (checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin h-10 w-10 text-yellow-500" />
          <p className="text-yellow-500/70 text-sm">Checking system status...</p>
        </div>
      </div>
    );
  }

  // If super admin exists and user is not logged in as super admin, redirect to login
  if (hasSuperAdmin && (!user || user.role !== 'superadmin')) {
    return <Navigate to="/login" replace />;
  }

  // ============================================
  // RENDER
  // ============================================

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
          {hasSuperAdmin && (
            <Link
              to="/login"
              className="flex items-center gap-2 text-yellow-500 hover:text-yellow-400 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
          )}
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-2.5 shadow-lg bg-gradient-to-br from-yellow-500 to-amber-600">
              <Gem size={22} className="text-white" />
            </div>
            <div>
              <h1
                className={`text-lg font-bold tracking-tight ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                A ONE JEWELRY
              </h1>
              <p
                className={`text-xs ${
                  isDark ? "text-yellow-500/70" : "text-amber-600"
                }`}
              >
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
      <main className="relative z-10 flex flex-1 items-center justify-center p-4 py-8">
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
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/30"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      repeatDelay: 0.5,
                    }}
                  >
                    <CheckCircle2 size={32} className="text-white" />
                  </motion.div>
                  <p className="text-lg font-semibold text-white">
                    {t.messages.success}
                  </p>
                  <p className="text-sm text-gray-400">
                    {role === "superadmin" ? "Redirecting to dashboard..." : t.messages.verifyEmail}
                  </p>
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
              {!hasSuperAdmin ? (
                <Crown size={28} className="text-yellow-500" />
              ) : (
                <UserPlus size={28} className="text-yellow-500" />
              )}
            </motion.div>
            <h2
              className={`text-xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {t.register.title}
            </h2>
            <p
              className={`mt-1 text-sm ${
                isDark ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {t.register.subtitle}
            </p>
            
            {/* First time setup badge */}
            {!hasSuperAdmin && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30">
                <Crown size={14} className="text-yellow-500" />
                <span className="text-xs font-medium text-yellow-500">First Time Setup</span>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Role Selection */}
            <div>
              <label
                className={`mb-2 block text-xs font-semibold ${
                  isDark ? "text-yellow-500/80" : "text-yellow-700"
                }`}
              >
                {t.register.selectRole}
              </label>
              <RoleDropdown
                role={role}
                setRole={setRole}
                isDark={isDark}
                t={t}
                roles={getRoles(hasSuperAdmin)}
                disabled={!hasSuperAdmin}
              />
            </div>

            {/* Name */}
            <Input
              icon={User}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.register.name}
              isDark={isDark}
              required
              disabled={loading}
              error={errors.name}
            />

            {/* Email */}
            <Input
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.register.email}
              isDark={isDark}
              required
              disabled={loading}
              error={errors.email}
            />

            {/* Password */}
            <Input
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.register.password}
              isDark={isDark}
              isPassword
              showPw={showPassword}
              togglePw={() => setShowPassword(!showPassword)}
              required
              disabled={loading}
              error={errors.password}
            />

            {/* Password Strength */}
            <PasswordStrength password={password} isDark={isDark} t={t} />

            {/* Confirm Password */}
            <Input
              icon={Lock}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t.register.confirmPassword}
              isDark={isDark}
              isPassword
              showPw={showConfirmPassword}
              togglePw={() => setShowConfirmPassword(!showConfirmPassword)}
              required
              disabled={loading}
              error={errors.confirmPassword}
            />

            {/* Terms Agreement */}
            <div className="pt-2">
              <label className="group flex cursor-pointer items-start gap-2.5">
                <div
                  className={`relative mt-0.5 flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
                    agreedToTerms
                      ? "border-transparent bg-gradient-to-br from-yellow-400 to-amber-500"
                      : errors.terms
                      ? "border-red-500"
                      : isDark
                      ? "border-yellow-500/40 group-hover:border-yellow-500/60"
                      : "border-yellow-400 group-hover:border-yellow-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={() => setAgreedToTerms(!agreedToTerms)}
                    disabled={loading}
                    className="absolute h-full w-full cursor-pointer opacity-0"
                  />
                  {agreedToTerms && (
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
                <span
                  className={`text-sm ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {t.register.terms}
                </span>
              </label>
              {errors.terms && (
                <p className="text-xs text-red-500 flex items-center gap-1 mt-1 ml-7">
                  <AlertCircle size={12} />
                  {errors.terms}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02, y: loading ? 0 : -1 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 py-3.5 font-bold text-black transition-all shadow-lg shadow-yellow-500/30 hover:from-yellow-500 hover:via-amber-500 hover:to-yellow-500 hover:shadow-yellow-500/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t.register.loading}
                </>
              ) : (
                <>
                  {!hasSuperAdmin ? "Create Super Admin" : t.register.button}
                  <ArrowRight size={18} />
                </>
              )}
            </motion.button>
          </form>

          {/* Login Link - Only show if super admin exists */}
          {hasSuperAdmin && (
            <div
              className={`mt-6 text-center text-sm ${
                isDark ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {t.register.haveAccount}{" "}
              <Link
                to="/login"
                className="font-semibold text-yellow-500 hover:text-yellow-400 transition-colors"
              >
                {t.register.login}
              </Link>
            </div>
          )}

          {/* Footer */}
          <div
            className={`mt-6 flex items-center justify-center gap-4 border-t pt-5 text-xs ${
              isDark
                ? "border-yellow-500/20 text-gray-500"
                : "border-yellow-200 text-gray-500"
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

      {/* Bottom gradient */}
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-40 bg-gradient-to-t from-yellow-500/5 to-transparent" />
    </div>
  );
};

export default Register;