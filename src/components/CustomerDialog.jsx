// src/components/CustomerDialog.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Phone, MapPin, Store, Search, Plus, UserPlus, Loader2 } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { collection, getDocs, query, where, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";

const CITIES = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Sialkot", "Gujranwala"];
const MARKETS = ["Anarkali", "Liberty", "Saddar", "Tariq Road", "Hyderi", "Mall Road", "Raja Bazaar", "G-9 Markaz", "F-10 Markaz"];

const CustomerDialog = ({
  isOpen, initialCustomer, onSubmit, onClose,
  runtimeCities = [], runtimeMarkets = [],
  onAddCity, onAddMarket, isSuperAdmin,
  storeId,
}) => {
  const { isDark } = useTheme();
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const searchRef = useRef(null);

  const [form, setForm] = useState({
    name: "Walking Customer",
    phone: "",
    city: "",
    market: "",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCity, setNewCity] = useState("");
  const [newMarket, setNewMarket] = useState("");

  const allCities = [...new Set([...CITIES, ...runtimeCities])].sort();
  const allMarkets = [...new Set([...MARKETS, ...runtimeMarkets])].sort();

  useEffect(() => {
    if (isOpen && initialCustomer) {
      setForm({
        name: initialCustomer.name || "Walking Customer",
        phone: initialCustomer.phone || "",
        city: initialCustomer.city || "",
        market: initialCustomer.market || "",
      });
      setTimeout(() => phoneRef.current?.focus(), 100);
    }
  }, [isOpen, initialCustomer]);

  // Search customers by phone/name
  const handleSearch = useCallback(async (q) => {
    setSearchQuery(q);
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results = [];

      // Search by phone
      if (/^\d+$/.test(q)) {
        const phoneSnap = await getDocs(
          query(
            collection(db, "customers"),
            where("phone", ">=", q),
            where("phone", "<=", q + "\uf8ff"),
            limit(8)
          )
        );
        phoneSnap.docs.forEach((d) =>
          results.push({ id: d.id, ...d.data() })
        );
      }

      // Search by name
      const nameSnap = await getDocs(
        query(
          collection(db, "customers"),
          where("nameLower", ">=", q.toLowerCase()),
          where("nameLower", "<=", q.toLowerCase() + "\uf8ff"),
          limit(8)
        )
      );
      nameSnap.docs.forEach((d) => {
        if (!results.find((r) => r.id === d.id)) {
          results.push({ id: d.id, ...d.data() });
        }
      });

      // Also search in orders for customer data
      if (results.length < 3 && /^\d{4,}$/.test(q)) {
        const orderSnap = await getDocs(
          query(
            collection(db, "orders"),
            where("customer.phone", ">=", q),
            where("customer.phone", "<=", q + "\uf8ff"),
            limit(5)
          )
        );
        orderSnap.docs.forEach((d) => {
          const c = d.data().customer;
          if (c?.phone && !results.find((r) => r.phone === c.phone)) {
            results.push({
              id: `order-${d.id}`,
              name: c.name || "Walking Customer",
              phone: c.phone,
              city: c.city || "",
              market: c.market || "",
              fromOrders: true,
            });
          }
        });
      }

      setSearchResults(results);
    } catch (e) {
      console.error("Customer search error:", e);
    } finally {
      setSearching(false);
    }
  }, []);

  // Select from search results
  const selectCustomer = (c) => {
    setForm({
      name: c.name || "Walking Customer",
      phone: c.phone || "",
      city: c.city || "",
      market: c.market || "",
    });
    setSearchQuery("");
    setSearchResults([]);
  };

  // Save new customer to Firebase
  const handleSaveNewCustomer = async () => {
    if (!form.name.trim() || form.name === "Walking Customer") return;
    setSaving(true);
    try {
      await addDoc(collection(db, "customers"), {
        name: form.name.trim(),
        nameLower: form.name.trim().toLowerCase(),
        phone: form.phone.trim(),
        city: form.city,
        market: form.market,
        storeId: storeId || null,
        createdAt: serverTimestamp(),
      });
      setShowAddNew(false);
    } catch (e) {
      console.error("Save customer error:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => {
    onSubmit({
      name: form.name.trim() || "Walking Customer",
      phone: form.phone.trim(),
      city: form.city,
      market: form.market,
    });
  };

  // Handle F8 inside dialog = submit
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "F8") {
        e.preventDefault();
        e.stopPropagation();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isOpen, form]);

  // Handle Enter = submit
  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Add custom city
  const addCity = () => {
    if (newCity.trim()) {
      onAddCity?.(newCity.trim());
      setForm({ ...form, city: newCity.trim() });
      setNewCity("");
    }
  };

  // Add custom market
  const addMarket = () => {
    if (newMarket.trim()) {
      onAddMarket?.(newMarket.trim());
      setForm({ ...form, market: newMarket.trim() });
      setNewMarket("");
    }
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
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
          isDark ? "bg-[#15120d] border border-yellow-500/20" : "bg-white border border-yellow-200"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
          <div className="flex items-center gap-2">
            <User size={18} className="text-yellow-500" />
            <h2 className={`font-bold text-base ${isDark ? "text-white" : "text-gray-900"}`}>
              Customer Details
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-1 rounded ${isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"}`}>
              F8 = Submit
            </span>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/10">
              <X size={16} className={isDark ? "text-gray-400" : "text-gray-600"} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* ── Customer Search ── */}
          <div>
            <label className={labelClass}>
              <Search size={10} className="inline mr-1" />
              Search Customer (Phone / Name)
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Type phone or name to search..."
                className={`${inputClass} pl-9`}
              />
              {searching && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-500 animate-spin" />
              )}
            </div>

            {/* Search Results Dropdown */}
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className={`mt-1 rounded-xl border max-h-40 overflow-y-auto ${
                    isDark ? "border-yellow-500/20 bg-[#0f0d09]" : "border-yellow-200 bg-white"
                  }`}
                >
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectCustomer(c)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between border-b last:border-0 transition ${
                        isDark
                          ? "border-yellow-500/10 hover:bg-yellow-500/10 text-white"
                          : "border-yellow-100 hover:bg-yellow-50 text-gray-900"
                      }`}
                    >
                      <div>
                        <span className="font-medium">{c.name}</span>
                        {c.phone && (
                          <span className={`ml-2 text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                            {c.phone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {c.city && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                            {c.city}
                          </span>
                        )}
                        {c.fromOrders && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-orange-500/10 text-orange-400" : "bg-orange-50 text-orange-600"}`}>
                            history
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className={`h-px ${isDark ? "bg-yellow-500/10" : "bg-yellow-100"}`} />

          {/* ── Customer Form ── */}
          <div>
            <label className={labelClass}>Customer Name</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                ref={nameRef}
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={onKeyDown}
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Phone Number</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                ref={phoneRef}
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                onKeyDown={onKeyDown}
                placeholder="03XX-XXXXXXX"
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                <MapPin size={10} className="inline mr-1" />City
              </label>
              <select
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className={inputClass}
              >
                <option value="">Select City</option>
                {allCities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="mt-1 flex gap-1">
                <input
                  type="text"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="Add city"
                  className={`flex-1 rounded-lg border px-2 py-1 text-[10px] outline-none ${
                    isDark ? "border-yellow-500/20 bg-[#0f0d09] text-white" : "border-yellow-200 bg-white text-gray-900"
                  }`}
                  onKeyDown={(e) => e.key === "Enter" && addCity()}
                />
                <button onClick={addCity} className="rounded-lg bg-yellow-500/20 px-2 text-yellow-500 text-xs">
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
                onChange={(e) => setForm({ ...form, market: e.target.value })}
                className={inputClass}
              >
                <option value="">Select Market</option>
                {allMarkets.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div className="mt-1 flex gap-1">
                <input
                  type="text"
                  value={newMarket}
                  onChange={(e) => setNewMarket(e.target.value)}
                  placeholder="Add market"
                  className={`flex-1 rounded-lg border px-2 py-1 text-[10px] outline-none ${
                    isDark ? "border-yellow-500/20 bg-[#0f0d09] text-white" : "border-yellow-200 bg-white text-gray-900"
                  }`}
                  onKeyDown={(e) => e.key === "Enter" && addMarket()}
                />
                <button onClick={addMarket} className="rounded-lg bg-yellow-500/20 px-2 text-yellow-500 text-xs">
                  <Plus size={10} />
                </button>
              </div>
            </div>
          </div>

          {/* Save as New Customer Button */}
          {form.phone && form.name !== "Walking Customer" && (
            <button
              onClick={handleSaveNewCustomer}
              disabled={saving}
              className={`w-full flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                isDark
                  ? "border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              }`}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {saving ? "Saving..." : "Save as New Customer"}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-5 py-4 border-t ${isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
          <button
            onClick={onClose}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Cancel (ESC)
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-6 py-2.5 text-sm font-bold text-black hover:from-yellow-400 hover:to-amber-400"
          >
            Continue (F8)
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CustomerDialog;