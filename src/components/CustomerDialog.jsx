// src/components/CustomerDialog.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { X, User, Phone, MapPin, Store, Plus, UserPlus, Loader2 } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";

const CITY_MARKETS = {
  Karachi: ["Saddar","Tariq Road","Hyderi","Clifton","Garden","Bahadurabad","Gulshan"],
  Lahore:  ["Anarkali","Liberty","Mall Road","Gulberg","Johar","Shalimar","DHA"],
};
const CITIES  = [
  "Lahore","Karachi","Islamabad","Rawalpindi",
  "Faisalabad","Multan","Peshawar","Quetta","Sialkot","Gujranwala",
];
const MARKETS = [
  "Anarkali","Liberty","Saddar","Tariq Road",
  "Hyderi","Mall Road","Raja Bazaar","G-9 Markaz","F-10 Markaz",
];

const CustomerDialog = ({
  isOpen, initialCustomer, onSubmit, onClose,
  runtimeCities = [], runtimeMarkets = [],
  onAddCity, onAddMarket, isSuperAdmin, storeId,
}) => {
  const { isDark }   = useTheme();
  const phoneRef     = useRef(null);
  const nameRef      = useRef(null);
  // ✅ Double submit guard
  const submittedRef = useRef(false);

  const [form, setForm] = useState({
    name: "Walking Customer", phone: "", city: "Karachi", market: "",
  });
  const [saving,    setSaving]    = useState(false);
  const [newCity,   setNewCity]   = useState("");
  const [newMarket, setNewMarket] = useState("");

  const allCities = useMemo(
    () => [...new Set([...CITIES, ...runtimeCities])].sort(),
    [runtimeCities]
  );

  const visibleMarkets = useMemo(() => {
    if (form.city && CITY_MARKETS[form.city]) return CITY_MARKETS[form.city];
    return [...new Set([...MARKETS, ...runtimeMarkets])].sort();
  }, [form.city, runtimeMarkets]);

  // Reset on open
  useEffect(() => {
    if (isOpen && initialCustomer) {
      submittedRef.current = false;
      setForm({
        name:   initialCustomer.name   || "Walking Customer",
        phone:  initialCustomer.phone  || "",
        city:   initialCustomer.city   || "Karachi",
        market: initialCustomer.market || "",
      });
      setTimeout(() => phoneRef.current?.focus(), 100);
    }
  }, [isOpen, initialCustomer]);

  // City change → market reset
  useEffect(() => {
    if (form.city && !visibleMarkets.includes(form.market || "")) {
      setForm((prev) => ({ ...prev, market: "" }));
    }
  }, [form.city, visibleMarkets]);

  const getNextCustomerPlaceholder = () => {
    try {
      const key     = "customerPlaceholderCounter";
      const current = parseInt(localStorage.getItem(key) || "0", 10) || 0;
      const next    = current + 1;
      localStorage.setItem(key, String(next));
      return `Customer ${String(next).padStart(3, "0")}`;
    } catch {
      return `Customer ${String(Date.now()).slice(-3)}`;
    }
  };

  // ✅ useCallback + double-fire guard
  const handleSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const resolvedName =
      form.name.trim() ||
      (form.phone.trim() ? getNextCustomerPlaceholder() : "Walking Customer");

    onSubmit({
      name:   resolvedName,
      phone:  form.phone.trim(),
      city:   form.city,
      market: form.market,
    });

    setTimeout(() => { submittedRef.current = false; }, 1000);
  }, [form, onSubmit]);

  const handleSaveNewCustomer = async () => {
    if (!form.name.trim() || form.name === "Walking Customer") return;
    setSaving(true);
    try {
      await addDoc(collection(db, "customers"), {
        name:      form.name.trim(),
        nameLower: form.name.trim().toLowerCase(),
        phone:     form.phone.trim(),
        city:      form.city,
        market:    form.market,
        storeId:   storeId || null,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Save customer error:", e);
    } finally {
      setSaving(false);
    }
  };

  // ✅ F8 = submit (stopPropagation → Dashboard tak nahi jayega)
  // ✅ ESC = close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "F8") {
        e.preventDefault();
        e.stopPropagation();
        handleSubmit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isOpen, handleSubmit, onClose]);

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const addCity = () => {
    if (!newCity.trim()) return;
    onAddCity?.(newCity.trim());
    setForm((p) => ({ ...p, city: newCity.trim() }));
    setNewCity("");
  };

  const addMarket = () => {
    if (!newMarket.trim()) return;
    onAddMarket?.(newMarket.trim());
    setForm((p) => ({ ...p, market: newMarket.trim() }));
    setNewMarket("");
  };

  if (!isOpen) return null;

  const inputClass = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition ${
    isDark
      ? "border-yellow-500/20 bg-[#0f0d09] text-white placeholder:text-gray-500 focus:border-yellow-500/50"
      : "border-yellow-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-yellow-500"
  }`;
  const labelClass = `mb-1.5 block text-[10px] font-semibold uppercase tracking-wide ${
    isDark ? "text-gray-400" : "text-gray-600"
  }`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1,   opacity: 1 }}
        exit={  { scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
          isDark
            ? "bg-[#15120d] border border-yellow-500/20"
            : "bg-white border border-yellow-200"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"
        }`}>
          <div className="flex items-center gap-2">
            <User size={16} className="text-yellow-500" />
            <h2 className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
              Customer Details
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] px-2 py-1 rounded ${
              isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"
            }`}>
              F8 = Submit
            </span>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/10">
              <X size={14} className={isDark ? "text-gray-400" : "text-gray-600"} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5 max-h-[70vh] overflow-y-auto">
          <div className={`h-px ${isDark ? "bg-yellow-500/10" : "bg-yellow-100"}`} />

          {/* Name */}
          <div>
            <label className={labelClass}>Customer Name</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                ref={nameRef}
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                onKeyDown={onKeyDown}
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className={labelClass}>Phone Number</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                ref={phoneRef}
                type="text"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                onKeyDown={onKeyDown}
                placeholder="03XX-XXXXXXX"
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          {/* City + Market */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                <MapPin size={10} className="inline mr-1" />City
              </label>
              <select
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                className={inputClass}
              >
                <option value="">Select City</option>
                {allCities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="mt-1 flex gap-1">
                <input
                  type="text" value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="Add city"
                  onKeyDown={(e) => e.key === "Enter" && addCity()}
                  className={`flex-1 rounded-lg border px-2 py-1 text-[10px] outline-none ${
                    isDark
                      ? "border-yellow-500/20 bg-[#0f0d09] text-white"
                      : "border-yellow-200 bg-white text-gray-900"
                  }`}
                />
                <button onClick={addCity} className="rounded-lg bg-yellow-500/20 px-2 text-yellow-500">
                  <Plus size={10} />
                </button>
              </div>
            </div>

            <div>
              <label className={labelClass}>
                <Store size={10} className="inline mr-1" />Market
              </label>
              <select
                value={form.market}
                onChange={(e) => setForm((p) => ({ ...p, market: e.target.value }))}
                className={inputClass}
              >
                <option value="">Select Market</option>
                {visibleMarkets.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="mt-1 flex gap-1">
                <input
                  type="text" value={newMarket}
                  onChange={(e) => setNewMarket(e.target.value)}
                  placeholder="Add market"
                  onKeyDown={(e) => e.key === "Enter" && addMarket()}
                  className={`flex-1 rounded-lg border px-2 py-1 text-[10px] outline-none ${
                    isDark
                      ? "border-yellow-500/20 bg-[#0f0d09] text-white"
                      : "border-yellow-200 bg-white text-gray-900"
                  }`}
                />
                <button onClick={addMarket} className="rounded-lg bg-yellow-500/20 px-2 text-yellow-500">
                  <Plus size={10} />
                </button>
              </div>
            </div>
          </div>

          {/* Save Customer */}
          {form.name !== "Walking Customer" && form.name.trim() && (
            <button
              onClick={handleSaveNewCustomer}
              disabled={saving}
              className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${
                isDark
                  ? "border border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              }`}
            >
              {saving
                ? <Loader2 size={12} className="inline animate-spin mr-1" />
                : <UserPlus size={12} className="inline mr-1" />
              }
              Save Customer
            </button>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-2 px-5 py-3.5 border-t ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"
        }`}>
          <button
            onClick={onClose}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              isDark
                ? "border border-gray-700 text-gray-400 hover:bg-gray-800"
                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Cancel (ESC)
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-5 py-2 text-sm font-bold text-black hover:from-yellow-400 hover:to-amber-400"
          >
            Continue (F8) →
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CustomerDialog;