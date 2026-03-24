// src/pages/superadmin/Stores.jsx

import { useEffect, useState } from "react";
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
} from "lucide-react";
import toast from "react-hot-toast";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import en from "../../lang/en.json";
import ur from "../../lang/ur.json";

const StoresPage = () => {
  const { isDark } = useTheme();
  const { language } = useLanguage();

  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const t = language === "ur" ? ur : en;

  useEffect(() => {
    // Mock data for now - replace with actual Firebase data later
    const mockStores = [
      {
        id: "1",
        name: "A ONE Jewelry Main Store",
        address: "123 Main Street, City",
        phone: "+92-300-1234567",
        email: "main@aonejewelry.com",
        status: "active",
        manager: "John Doe",
      },
      {
        id: "2",
        name: "A ONE Jewelry Branch 1",
        address: "456 Branch Road, City",
        phone: "+92-300-7654321",
        email: "branch1@aonejewelry.com",
        status: "active",
        manager: "Jane Smith",
      },
    ];

    setTimeout(() => {
      setStores(mockStores);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredStores = stores.filter((store) =>
    store.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <button className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Edit Store">
                  <Edit size={16} />
                </button>
                <button className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="Delete Store">
                  <Trash2 size={16} />
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
    </div>
  );
};

export default StoresPage;