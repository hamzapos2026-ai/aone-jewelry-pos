// src/pages/superadmin/Users.jsx

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  Key,
  Mail,
  Shield,
  BarChart3,
  Wallet,
  FileText,
  Crown,
  Search,
  Filter,
  MoreVertical,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { getAllUsers, sendPasswordReset, updateUserProfile } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import en from "../../lang/en.json";
import ur from "../../lang/ur.json";

const roleIcons = {
  superadmin: Crown,
  admin: Shield,
  manager: BarChart3,
  cashier: Wallet,
  biller: FileText,
};

const UsersPage = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { language } = useLanguage();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [resettingUser, setResettingUser] = useState(null);

  const t = language === "ur" ? ur : en;

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (userEmail) => {
    setResettingUser(userEmail);
    try {
      await sendPasswordReset(userEmail);
      toast.success("Password reset link sent to user");
    } catch (error) {
      console.error("Error sending reset:", error);
      toast.error("Failed to send reset link");
    } finally {
      setResettingUser(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

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
            User Management
          </h1>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Manage system users and their permissions
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors">
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${isDark ? "border-yellow-500/30 bg-white/5" : "border-yellow-400/50 bg-white"}`}>
            <Search size={18} className="text-yellow-600" />
            <input
              type="text"
              placeholder="Search users..."
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

      {/* Users Table */}
      <div className={`rounded-xl border-2 overflow-hidden ${isDark ? "border-yellow-500/30 bg-white/5" : "border-yellow-400/50 bg-white"}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${isDark ? "text-yellow-500" : "text-yellow-700"}`}>User</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${isDark ? "text-yellow-500" : "text-yellow-700"}`}>Role</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${isDark ? "text-yellow-500" : "text-yellow-700"}`}>Status</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${isDark ? "text-yellow-500" : "text-yellow-700"}`}>Last Login</th>
                <th className={`px-6 py-4 text-right text-sm font-semibold ${isDark ? "text-yellow-500" : "text-yellow-700"}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const RoleIcon = roleIcons[u.role] || Shield;
                return (
                  <tr key={u.uid} className={`border-b ${isDark ? "border-yellow-500/10" : "border-yellow-100"}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? "bg-yellow-500/20" : "bg-yellow-100"}`}>
                          <Users size={18} className="text-yellow-600" />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{u.name}</p>
                          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <RoleIcon size={16} className="text-yellow-600" />
                        <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                          {t.roles?.[u.role] || u.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        u.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        {u.lastLogin ? new Date(u.lastLogin.seconds * 1000).toLocaleDateString() : "Never"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handlePasswordReset(u.email)}
                          disabled={resettingUser === u.email}
                          className="p-2 text-yellow-600 hover:bg-yellow-100 rounded-lg transition-colors disabled:opacity-50"
                          title="Reset Password"
                        >
                          {resettingUser === u.email ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Key size={16} />
                          )}
                        </button>
                        <button className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Edit User">
                          <Edit size={16} />
                        </button>
                        <button className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="Delete User">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;