// src/pages/superadmin/Stores.jsx

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Store,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  MapPin,
  Phone,
  Mail,
  Loader2,
  X,
  Lock,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import en from "../../lang/en.json";
import ur from "../../lang/ur.json";
import { getStores, updateStore } from "../../modules/stores/storeService";

const StoresPage = () => {
  const { isDark } = useTheme();
  const { language } = useLanguage();

  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStore, setSelectedStore] = useState(null);
  const [storeSettings, setStoreSettings] = useState({
    showInvoicePreview: false,
    showRecentOrders: true,
    showSearchPanel: true,
    showTimestamps: true,
    allowDirectSubmit: false,
    allowCancelBill: true,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const t = language === "ur" ? ur : en;

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedStores = await getStores();
      const normalized = fetchedStores.map((store) => ({
        ...store,
        billerPermissions: {
          showInvoicePreview: false,
          showRecentOrders: true,
          showSearchPanel: true,
          showTimestamps: true,
          allowDirectSubmit: false,
          allowCancelBill: true,
          ...(store.billerPermissions || {}),
        },
      }));
      setStores(normalized);
    } catch (error) {
      console.error("Error loading stores:", error);
      toast.error("Unable to load stores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const filteredStores = stores.filter((store) =>
    store.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openStoreSettings = useCallback((store) => {
    setSelectedStore(store);
    setStoreSettings(store.billerPermissions || {
      showInvoicePreview: false,
      showRecentOrders: true,
      showSearchPanel: true,
      showTimestamps: true,
      allowDirectSubmit: false,
      allowCancelBill: true,
    });
    setSettingsOpen(true);
  }, []);

  const closeStoreSettings = useCallback(() => {
    setSettingsOpen(false);
    setSelectedStore(null);
  }, []);

  const handleStoreSettingChange = useCallback((key) => {
    setStoreSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const saveStoreSettings = useCallback(async () => {
    if (!selectedStore) return;
    setSavingSettings(true);
    try {
      const updated = await updateStore(selectedStore.id, {
        billerPermissions: storeSettings,
      });
      setStores((prev) => prev.map((store) =>
        store.id === selectedStore.id ? { ...store, billerPermissions: storeSettings } : store
      ));
      toast.success("Store settings saved.");
      closeStoreSettings();
    } catch (error) {
      console.error("Failed to save store settings:", error);
      toast.error("Unable to save store settings.");
    } finally {
      setSavingSettings(false);
    }
  }, [selectedStore, storeSettings, closeStoreSettings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            Store Management
          </h1>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Manage your jewelry stores and branches
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors">
          <Plus size={18} />
          Add Store
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${isDark ? "border-yellow-500/30 bg-white/5" : "border-yellow-400/50 bg-white"}`}>
            <Search size={18} className="text-yellow-600" />
            <input
              type="text"
              placeholder="Search stores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`flex-1 bg-transparent outline-none ${isDark ? "text-white placeholder:text-gray-400" : "text-gray-800 placeholder:text-gray-500"}`}
            />
          </div>
        </div>
      </div>

      {/* Stores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStores.map((store) => (
          <motion.div
            key={store.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border-2 p-6 ${isDark ? "border-yellow-500/30 bg-white/5" : "border-yellow-400/50 bg-white"}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isDark ? "bg-yellow-500/20" : "bg-yellow-100"}`}>
                <Store size={24} className="text-yellow-600" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openStoreSettings(store)}
                  className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                  title="Biller Settings"
                >
                  <Edit size={16} />
                </button>
              </div>
            </div>

            <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
              {store.name}
            </h3>

            <div className="space-y-2 text-sm">
              <div className={`flex items-center gap-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                <MapPin size={14} />
                <span>{store.address}</span>
              </div>
              <div className={`flex items-center gap-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                <Phone size={14} />
                <span>{store.phone}</span>
              </div>
              <div className={`flex items-center gap-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                <Mail size={14} />
                <span>{store.email}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-yellow-500/20">
              <div className="flex items-center justify-between">
                <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Manager: {store.manager}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  store.status === "active"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}>
                  {store.status}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {settingsOpen && selectedStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`w-full max-w-2xl rounded-3xl border p-6 shadow-2xl ${isDark ? "bg-[#111] border-yellow-500/20" : "bg-white border-yellow-200"}`}>
            <div className="flex items-center justify-between gap-3 mb-6">
              <div>
                <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Biller Settings</h2>
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>Update permissions for {selectedStore.name}</p>
              </div>
              <button
                onClick={closeStoreSettings}
                className={`rounded-full p-2 transition ${isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-700"}`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["showInvoicePreview", "Invoice Preview", "Open invoice print dialog during F8 checkout"],
                ["showRecentOrders", "Recent Orders", "Show recent orders on biller dashboard"],
                ["showSearchPanel", "Search Panel", "Allow biller to use order search"],
                ["showTimestamps", "Timestamps", "Show bill start/end times"],
                ["allowDirectSubmit", "Direct Submit", "Allow biller to submit without F8 flow"],
                ["allowCancelBill", "Cancel Bill", "Allow biller to cancel current bill"],
              ].map(([key, label, desc]) => (
                <label key={key} className={`flex flex-col gap-2 rounded-2xl border px-4 py-4 ${isDark ? "border-yellow-500/10 bg-black/20" : "border-gray-200 bg-gray-50"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{label}</span>
                    <button
                      type="button"
                      onClick={() => handleStoreSettingChange(key)}
                      className={`relative h-6 w-11 rounded-full transition ${storeSettings[key] ? "bg-yellow-500" : isDark ? "bg-gray-700" : "bg-gray-300"}`}
                    >
                      <span
                        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                        style={{ left: storeSettings[key] ? "21px" : "2px" }}
                      />
                    </button>
                  </div>
                  <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>{desc}</span>
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                onClick={closeStoreSettings}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isDark ? "border border-yellow-500/10 bg-transparent text-yellow-300 hover:bg-white/10" : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"}`}
              >
                Cancel
              </button>
              <button
                onClick={saveStoreSettings}
                disabled={savingSettings}
                className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingSettings ? "Saving…" : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoresPage;