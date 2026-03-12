import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { sendPasswordResetEmail } from "firebase/auth";
import { loginUser } from "../../services/authService";
import { auth } from "../../services/firebase";
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
          <span
            className={`text-sm font-medium ${
              isDark ? "text-white" : "text-gray-800"
            }`}
          >
            {t.roles[role]}
          </span>
        </div>

        <ChevronDown
          size={18}
          className={`text-yellow-600 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
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
                <RoleIcon
                  size={16}
                  className={
                    role === id ? "text-yellow-500" : "text-yellow-600/60"
                  }
                />
                <span className="font-medium">{t.roles[id]}</span>
                {role === id && (
                  <CheckCircle2 size={16} className="ml-auto text-green-500" />
                )}
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
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

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
        roleMismatch: s?.messages?.roleMismatch || "Role mismatch",
        resetSent: s?.messages?.resetSent || "Reset link sent",
        enterEmail: s?.messages?.enterEmail || "Enter valid email",
      },
    };
  }, [language]);

  const toastStyle = {
    borderRadius: "12px",
    background: "#111",
    color: "#fbbf24",
    border: "1px solid rgba(251,191,36,0.3)",
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userData = await loginUser(identifier, password);

      if (userData?.role !== role) {
        toast.error(t.messages.roleMismatch, { style: toastStyle });
        setLoading(false);
        return;
      }

      if (remember) {
        localStorage.setItem("session", JSON.stringify(userData));
      }

      setSuccess(true);
      toast.success(t.messages.success, { style: toastStyle });

      setTimeout(() => navigate(`/${userData.role}`), 1200);
    } catch {
      toast.error(t.messages.error, { style: toastStyle });
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!identifier?.includes("@")) {
      toast.error(t.messages.enterEmail, { style: toastStyle });
      return;
    }

    try {
      await sendPasswordResetEmail(auth, identifier);
      toast.success(t.messages.resetSent, { style: toastStyle });
    } catch {
      toast.error(t.messages.error, { style: toastStyle });
    }
  };

  return (
    <div
      className={`relative min-h-screen flex flex-col overflow-hidden ${
        isDark ? "bg-gray-950" : "bg-gray-900"
      }`}
    >
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-yellow-500/10 blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-500/5 blur-3xl" />

        <div className="absolute inset-0 bg-[linear-gradient(rgba(251,191,36,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(251,191,36,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between border-b border-yellow-500/20 bg-black/20 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-linear-to-br from-yellow-500 to-amber-600 p-2.5 shadow-lg shadow-yellow-500/25">
            <Gem size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              A ONE JEWELRY
            </h1>
            <p className="text-xs text-yellow-500/70">Point of Sale</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={toggleLanguage}
            className="rounded-xl border border-yellow-500/30 bg-white/5 p-2.5 text-yellow-500 transition-all hover:border-yellow-500/50 hover:bg-yellow-500/10"
          >
            <Languages size={18} />
          </button>

          <button
            onClick={toggleTheme}
            className="rounded-xl border border-yellow-500/30 bg-white/5 p-2.5 text-yellow-500 transition-all hover:border-yellow-500/50 hover:bg-yellow-500/10"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4 }}
          className={`relative w-full max-w-sm rounded-2xl p-7 shadow-2xl ${
            isDark
              ? "border-2 border-yellow-500/30 bg-white/5 text-white shadow-yellow-500/10 backdrop-blur-xl"
              : "border-2 border-yellow-400/50 bg-white text-gray-900 shadow-black/20"
          }`}
        >
          {isDark && (
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-b from-yellow-500/10 via-transparent to-transparent" />
          )}

          <div className="absolute top-0 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-linear-to-r from-yellow-400 via-amber-500 to-yellow-400" />

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
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/30"
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
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative mb-6 text-center">
            <motion.div
              className={`mb-4 inline-flex rounded-2xl p-3.5 ${
                isDark
                  ? "border border-yellow-500/30 bg-yellow-500/10"
                  : "border border-yellow-300 bg-linear-to-br from-yellow-50 to-amber-100"
              }`}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <ShieldCheck size={28} className="text-yellow-500" />
            </motion.div>

            <h2
              className={`text-xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Welcome Back
            </h2>

            <p
              className={`mt-1 text-sm ${
                isDark ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {t.login.subtitle}
            </p>
          </div>

          <form onSubmit={handleLogin} className="relative space-y-4">
            <div>
              <label
                className={`mb-2 block text-xs font-semibold ${
                  isDark ? "text-yellow-500/80" : "text-yellow-700"
                }`}
              >
                {t.login.loginAs}
              </label>

              <RoleDropdown
                role={role}
                setRole={setRole}
                isDark={isDark}
                t={t}
              />
            </div>

            <Input
              icon={User}
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={t.login.email}
              isDark={isDark}
              required
            />

            <Input
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.login.password}
              isDark={isDark}
              isPassword
              showPw={showPassword}
              togglePw={() => setShowPassword(!showPassword)}
              required
            />

            <div className="flex items-center justify-between pt-1 text-sm">
              <label className="group flex cursor-pointer items-center gap-2.5">
                <div
                  className={`relative flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
                    remember
                      ? "border-transparent bg-linear-to-br from-yellow-400 to-amber-500"
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

              <button
                type="button"
                onClick={handleForgot}
                className="font-medium text-yellow-500 transition-colors hover:text-yellow-400"
              >
                {t.login.forgot}
              </button>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-yellow-400 via-yellow-500 to-amber-500 py-3.5 font-bold text-black transition-all shadow-lg shadow-yellow-500/30 hover:from-yellow-500 hover:via-amber-500 hover:to-yellow-500 hover:shadow-yellow-500/50 disabled:cursor-not-allowed disabled:opacity-60"
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

          <div
            className={`mt-6 flex items-center justify-center gap-4 border-t pt-5 text-xs ${
              isDark
                ? "border-yellow-500/20 text-gray-500"
                : "border-yellow-200 text-gray-500"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Online
            </span>
            <span className="text-yellow-500/50">•</span>
            <span className="flex items-center gap-1.5">
              <Lock size={10} className="text-yellow-600" />
              SSL
            </span>
            <span className="text-yellow-500/50">•</span>
            <span>v2.0</span>
          </div>
        </motion.div>
      </main>

      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-40 bg-linear-to-t from-yellow-500/5 to-transparent" />
    </div>
  );
};

export default Login;