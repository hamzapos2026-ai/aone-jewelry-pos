// src/pages/superadmin/Billers.jsx
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  RefreshCw,
  Settings,
  Loader2,
  Check,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { getStores, updateStore } from "../../modules/stores/storeService";

const getDefaultBillerPermissions = (store) => ({
  showInvoicePreview: false,
  showRecentOrders: true,
  showSearchPanel: true,
  showTimestamps: true,
  allowDirectSubmit: false,
  allowCancelBill: true,
  ...(store?.billerPermissions || {}),
});

const toggles = [
  ["showInvoicePreview", "Invoice Preview", "Open invoice print dialog during F8 checkout"],
  ["allowDirectSubmit", "Direct Submit", "Show bypass submit button for billers"],
  ["showSearchPanel", "Search Panel", "Allow billers to search orders"],
  ["showRecentOrders", "Recent Orders", "Show recent orders list"],
  ["showTimestamps", "Timestamps", "Show bill start/end time on biller screen"],
  ["allowCancelBill", "Cancel Bill", "Allow billers to cancel current bill"],
];

const BillersPage = () => {
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const [stores, setStores] = useState([]);
  const [storeSettings, setStoreSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedStore, setExpandedStore] = useState(null);

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedStores = await getStores();
      const normalized = fetchedStores.map((store) => ({
        ...store,
        billerPermissions: getDefaultBillerPermissions(store),
      }));
      setStores(normalized);
      setStoreSettings(
        Object.fromEntries(
          normalized.map((store) => [store.id, store.billerPermissions])
        )
      );
    } catch (error) {
      console.error("Failed to load stores:", error);
      toast.error("Unable to load biller settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const handleToggle = (storeId, key) => {
    setStoreSettings((prev) => ({
      ...prev,
      [storeId]: {
        ...prev[storeId],
        [key]: !prev[storeId]?.[key],
      },
    }));
  };

  const handleSave = async (storeId) => {
    const payload = storeSettings[storeId];
    if (!payload) return;
    setSavingId(storeId);
    try {
      await updateStore(storeId, { billerPermissions: payload });
      setStores((prev) => prev.map((store) =>
        store.id === storeId ? { ...store, billerPermissions: payload } : store
      ));
      toast.success("Biller settings saved.");
    } catch (error) {
      console.error("Save biller settings failed:", error);
      toast.error("Unable to save settings.");
    } finally {
      setSavingId(null);
    }
  };

  const filteredStores = stores.filter((store) =>
    store.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            Biller Settings
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Super admin can turn biller features on/off for each store.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadStores}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 transition-colors ${isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            <RefreshCw size={18} /> Reload
          </button>
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 transition-colors ${isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            <Settings size={18} /> Reset Filter
          </button>
        </div>
      </div>

      <div className={`rounded-3xl border p-4 ${isDark ? "border-yellow-500/10 bg-black/20" : "border-gray-200 bg-white"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${isDark ? "border-yellow-500/10 bg-white/5" : "border-gray-200 bg-gray-50"}`}>
            <Search size={18} className="text-yellow-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search stores..."
              className={`w-full bg-transparent text-sm outline-none ${isDark ? "text-white placeholder:text-gray-400" : "text-gray-700 placeholder:text-gray-500"}`}
            />
          </div>
          <div className="text-sm text-gray-500">
            {filteredStores.length} store(s) found
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-72 items-center justify-center rounded-3xl border border-dashed border-yellow-500/40 bg-yellow-50/50">
          <Loader2 className="animate-spin h-10 w-10 text-yellow-500" />
        </div>
      ) : (
        <div className="grid gap-5">
          {filteredStores.map((store) => {
            const settings = storeSettings[store.id] || getDefaultBillerPermissions(store);
            return (
              <div
                key={store.id}
                className={`rounded-3xl border p-5 shadow-sm transition ${isDark ? "border-yellow-500/10 bg-[#111]" : "border-gray-200 bg-white"}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className={`text-xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{store.name}</h2>
                    <p className={`mt-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>{store.address || "Store address not configured"}</p>
                    <p className={`mt-1 text-sm ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                      Manager: {store.manager || "N/A"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedStore(expandedStore === store.id ? null : store.id)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                    >
                      {expandedStore === store.id ? "Hide Settings" : "Edit Settings"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave(store.id)}
                      disabled={savingId === store.id}
                      className="inline-flex items-center gap-2 rounded-full bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-60"
                    >
                      {savingId === store.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Save
                    </button>
                  </div>
                </div>

                {expandedStore === store.id && (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {toggles.map(([key, label, desc]) => (
                      <label
                        key={key}
                        className={`rounded-3xl border p-4 transition ${isDark ? "border-yellow-500/10 bg-white/5" : "border-gray-200 bg-gray-50"}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{label}</p>
                            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>{desc}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggle(store.id, key)}
                            className={`relative h-6 w-11 rounded-full transition ${settings[key] ? "bg-yellow-500" : isDark ? "bg-gray-700" : "bg-gray-300"}`}
                          >
                            <span
                              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                              style={{ left: settings[key] ? "21px" : "2px" }}
                            />
                          </button>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BillersPage;
