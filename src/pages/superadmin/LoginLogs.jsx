// src/pages/superadmin/LoginLogs.jsx

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Shield,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { getLoginLogs } from "../../services/authService";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import en from "../../lang/en.json";
import ur from "../../lang/ur.json";

const roleIcons = {
  superadmin: Shield,
  admin: Shield,
  manager: Shield,
  cashier: Shield,
  biller: Shield,
};

const LoginLogsPage = () => {
  const { isDark } = useTheme();
  const { language } = useLanguage();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const t = language === "ur" ? ur : en;

  useEffect(() => {
    loadLoginLogs();
  }, []);

  const loadLoginLogs = async () => {
    try {
      const loginLogs = await getLoginLogs(200); // Get last 200 logs
      setLogs(loginLogs);
    } catch (error) {
      console.error("Error loading login logs:", error);
      toast.error("Failed to load login logs");
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || log.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

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
            Login Activity Logs
          </h1>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Monitor user login activities and security
          </p>
        </div>
        <div className={`px-4 py-2 rounded-lg ${isDark ? "bg-yellow-500/20" : "bg-yellow-100"}`}>
          <span className={`text-sm font-medium ${isDark ? "text-yellow-400" : "text-yellow-800"}`}>
            Total Logs: {logs.length}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${isDark ? "border-yellow-500/30 bg-white/5" : "border-yellow-400/50 bg-white"}`}>
            <Search size={18} className="text-yellow-600" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`flex-1 bg-transparent outline-none ${isDark ? "text-white placeholder:text-gray-400" : "text-gray-800 placeholder:text-gray-500"}`}
            />
          </div>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className={`px-4 py-3 rounded-xl border-2 ${isDark ? "border-yellow-500/30 bg-white/5 text-white" : "border-yellow-400/50 bg-white text-gray-800"}`}
        >
          <option value="all">All Roles</option>
          <option value="superadmin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="cashier">Cashier</option>
          <option value="biller">Biller</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className={`rounded-xl border-2 overflow-hidden ${isDark ? "border-yellow-500/30 bg-white/5" : "border-yellow-400/50 bg-white"}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${isDark ? "text-yellow-500" : "text-yellow-700"}`}>User</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${isDark ? "text-yellow-500" : "text-yellow-700"}`}>Role</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${isDark ? "text-yellow-500" : "text-yellow-700"}`}>Login Time</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${isDark ? "text-yellow-500" : "text-yellow-700"}`}>IP Address</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${isDark ? "text-yellow-500" : "text-yellow-700"}`}>Device</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const RoleIcon = roleIcons[log.role] || Shield;
                return (
                  <tr key={log.id} className={`border-b ${isDark ? "border-yellow-500/10" : "border-yellow-100"}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? "bg-yellow-500/20" : "bg-yellow-100"}`}>
                          <User size={14} className="text-yellow-600" />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{log.name}</p>
                          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>{log.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <RoleIcon size={14} className="text-yellow-600" />
                        <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                          {t.roles?.[log.role] || log.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>{formatDate(log.loginTime)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-mono ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        {log.ipAddress || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        {log.userAgent ? log.userAgent.split(' ').slice(0, 3).join(' ') + "..." : "Unknown"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredLogs.length === 0 && !loading && (
        <div className="text-center py-12">
          <Activity size={48} className={`mx-auto mb-4 ${isDark ? "text-gray-600" : "text-gray-400"}`} />
          <p className={`text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>No login logs found</p>
        </div>
      )}
    </div>
  );
};

export default LoginLogsPage;