import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetup } from "../../context/SetupContext";
import { useAuth } from "../../context/AuthContext";
import { createSuperAdminSetup } from "../../services/setupService";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import Header from "../../components/layout/header";
import toast from "react-hot-toast";
import en from "../../lang/en.json";
import ur from "../../lang/ur.json";
import {
  Store,
  User,
  Mail,
  Lock,
  Building2,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";

const SuperAdminSetup = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();
  const { markSetupComplete } = useSetup();
  const { signOut } = useAuth();
  const { isDark } = useTheme();
  const { language } = useLanguage();

  const t = language === "ur" ? ur : en;
  const isRTL = language === "ur";

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    storeName: "",
    storeLocation: "",
  });

  const [errors, setErrors] = useState({});

  const headerUser = {
    name: "Super Admin",
    email: "setup@aonejewelry.com",
    role: "setup",
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

    setErrors((prev) => ({
      ...prev,
      [e.target.name]: "",
    }));
  };

  const validateStep1 = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = t.validation?.required || "Name required";
    }

    if (!formData.email.trim() || !formData.email.includes("@")) {
      newErrors.email = t.validation?.email || "Valid email required";
    }

    if (formData.password.length < 6) {
      newErrors.password =
        t.validation?.minLength?.replace("{{min}}", "6") ||
        "Minimum 6 characters required";
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = t.validation?.required || "Confirm password required";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword =
        t.validation?.passwordMatch || "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};

    if (!formData.businessName.trim()) {
      newErrors.businessName = t.validation?.required || "Business name required";
    }

    if (!formData.storeName.trim()) {
      newErrors.storeName = t.validation?.required || "Store name required";
    }

    if (!formData.storeLocation.trim()) {
      newErrors.storeLocation = t.validation?.required || "Store location required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
      toast.success("Step 1 completed ✅");
    } else {
      toast.error("Please fix the errors");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateStep2()) {
      toast.error(t.validation?.required || "Please fill all required fields");
      return;
    }

    setLoading(true);

    try {
      await createSuperAdminSetup(formData);

      markSetupComplete();

      // Sign out immediately after setup
      if (signOut) {
        await signOut();
      }

      toast.success(
        t.setup?.success || "Super Admin setup completed successfully!"
      );

      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Setup Error:", error);
      toast.error(
        error?.userMessage ||
          error?.message ||
          t.setup?.error ||
          "Setup failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={`min-h-screen ${
        isDark
          ? "bg-gradient-to-br from-gray-950 via-black to-yellow-950 text-white"
          : "bg-gradient-to-br from-gray-50 via-white to-yellow-50 text-gray-900"
      }`}
    >
      <Header user={headerUser} onMenuClick={() => {}} isSidebarOpen={false} />

      <div className="flex items-center justify-center p-4 sm:p-6">
        <div
          className={`w-full max-w-md rounded-2xl border shadow-2xl p-8 mt-6 ${
            isDark
              ? "bg-black/50 border-yellow-600/30 backdrop-blur-lg"
              : "bg-white border-yellow-200"
          }`}
        >
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-yellow-500 to-amber-400 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="text-white" size={32} />
            </div>

            <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2 text-yellow-500">
              <Sparkles size={22} />
              {t.setup?.title || "Super Admin Setup"}
              <Sparkles size={22} />
            </h1>

            <p className={isDark ? "text-gray-400" : "text-gray-500"}>
              {t.setup?.subtitle || "Create your super admin account"}
            </p>

            <p className={`mt-2 text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Step {step} of 2 - {step === 1 ? "Personal Info" : "Business Info"}
            </p>
          </div>

          <div className="flex gap-2 mb-8">
            <div className={`h-2 flex-1 rounded-full ${step >= 1 ? "bg-yellow-500" : isDark ? "bg-gray-700" : "bg-gray-200"}`} />
            <div className={`h-2 flex-1 rounded-full ${step >= 2 ? "bg-yellow-500" : isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-4">
                <InputField icon={User} label={t.setup?.fullName || "Full Name"} name="fullName" value={formData.fullName} onChange={handleChange} error={errors.fullName} isDark={isDark} />
                <InputField icon={Mail} label={t.setup?.email || "Email"} name="email" value={formData.email} onChange={handleChange} error={errors.email} isDark={isDark} />

                <PasswordField
                  icon={Lock}
                  label={t.setup?.password || "Password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  error={errors.password}
                  isDark={isDark}
                  show={showPassword}
                  setShow={setShowPassword}
                />

                <PasswordField
                  icon={Lock}
                  label={t.setup?.confirmPassword || "Confirm Password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  error={errors.confirmPassword}
                  isDark={isDark}
                  show={showConfirmPassword}
                  setShow={setShowConfirmPassword}
                />

                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold py-3 rounded-lg hover:from-yellow-400 hover:to-amber-400 transition flex items-center justify-center gap-2 mt-6"
                >
                  {t.setup?.next || "Next"} <ArrowRight size={20} />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <InputField icon={Building2} label={t.setup?.businessName || "Business Name"} name="businessName" value={formData.businessName} onChange={handleChange} error={errors.businessName} isDark={isDark} />
                <InputField icon={Store} label={t.setup?.storeName || "Store Name"} name="storeName" value={formData.storeName} onChange={handleChange} error={errors.storeName} isDark={isDark} />

                <div>
                  <label className={`flex items-center gap-2 mb-2 text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    <MapPin size={16} />
                    {t.setup?.storeLocation || "Store Location"}
                  </label>
                  <textarea
                    name="storeLocation"
                    value={formData.storeLocation}
                    onChange={handleChange}
                    rows="3"
                    className={`w-full rounded-lg px-4 py-3 border outline-none resize-none ${
                      isDark
                        ? "bg-gray-800 border-gray-700 text-white focus:border-yellow-500"
                        : "bg-white border-gray-300 text-gray-900 focus:border-yellow-500"
                    }`}
                  />
                  {errors.storeLocation && (
                    <p className="text-red-500 text-xs mt-1">{errors.storeLocation}</p>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={`flex-1 font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 ${
                      isDark ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                  >
                    <ArrowLeft size={20} /> {t.setup?.previous || "Previous"}
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold py-3 rounded-lg hover:from-yellow-400 hover:to-amber-400 transition disabled:opacity-50"
                  >
                    {loading ? "Please wait..." : t.setup?.button || "Create Super Admin"}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

const InputField = ({ icon: Icon, label, name, value, onChange, error, isDark }) => (
  <div>
    <label className={`flex items-center gap-2 mb-2 text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
      <Icon size={16} />
      {label}
    </label>
    <input
      type="text"
      name={name}
      value={value}
      onChange={onChange}
      className={`w-full rounded-lg px-4 py-3 border outline-none ${
        isDark
          ? "bg-gray-800 border-gray-700 text-white focus:border-yellow-500"
          : "bg-white border-gray-300 text-gray-900 focus:border-yellow-500"
      }`}
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

const PasswordField = ({ icon: Icon, label, name, value, onChange, error, isDark, show, setShow }) => (
  <div>
    <label className={`flex items-center gap-2 mb-2 text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
      <Icon size={16} />
      {label}
    </label>
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full rounded-lg px-4 py-3 pr-12 border outline-none ${
          isDark
            ? "bg-gray-800 border-gray-700 text-white focus:border-yellow-500"
            : "bg-white border-gray-300 text-gray-900 focus:border-yellow-500"
        }`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className={`absolute top-1/2 -translate-y-1/2 right-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

export default SuperAdminSetup;