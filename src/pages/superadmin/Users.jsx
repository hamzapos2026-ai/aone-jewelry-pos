// src/pages/superadmin/Users.jsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserPlus, Edit, Trash2, Key, Shield, BarChart3, Wallet, FileText,
  Crown, Search, Loader2, X, Eye, EyeOff, AlertTriangle, Check, Mail, RefreshCw
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { db, auth } from "../../services/firebase";
import { 
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy 
} from "firebase/firestore";
import { 
  createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword 
} from "firebase/auth";

const roleIcons = { 
  superadmin: Crown, 
  admin: Shield, 
  manager: BarChart3, 
  cashier: Wallet, 
  biller: FileText 
};

// Modal Component
const Modal = ({ isOpen, onClose, children, title, isDark }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${
            isDark ? "bg-gray-900 border border-yellow-500/30" : "bg-white border border-yellow-200"
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              <X size={20} />
            </button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// User Form Modal
const UserFormModal = ({ isOpen, onClose, user, onSave, isDark, existingEmails, currentUserEmail }) => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "cashier",
    status: "active"
  });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPass, setShowAdminPass] = useState(false);
  const isEdit = !!user;

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        password: "",
        role: user.role || "cashier",
        status: user.status || "active"
      });
    } else {
      setForm({ name: "", email: "", password: "", role: "cashier", status: "active" });
    }
    setErrors({});
    setAdminPassword("");
  }, [user, isOpen]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email format";
    else if (!isEdit && existingEmails.includes(form.email.toLowerCase())) {
      e.email = "Email already exists";
    }
    if (!isEdit && form.password.length < 6) e.password = "Minimum 6 characters";
    if (!isEdit && !adminPassword) e.adminPassword = "Enter your password to create user";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(form, isEdit, adminPassword);
      onClose();
    } catch (err) {
      console.error("Save error:", err);
      toast.error(err.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = (error) =>
    `w-full px-4 py-3 rounded-xl border-2 transition-all outline-none ${
      isDark
        ? `bg-white/5 text-white placeholder:text-gray-500 ${
            error ? "border-red-500" : "border-yellow-500/30 focus:border-yellow-500"
          }`
        : `bg-gray-50 text-gray-900 placeholder:text-gray-400 ${
            error ? "border-red-500" : "border-yellow-200 focus:border-yellow-500"
          }`
    }`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit User" : "Add New User"} isDark={isDark}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            Full Name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass(errors.name)}
            placeholder="Enter full name"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Email */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            Email Address
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputClass(errors.email)}
            placeholder="user@example.com"
            disabled={isEdit}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        {/* Password - Only for new users */}
        {!isEdit && (
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClass(errors.password)}
                placeholder="Minimum 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>
        )}

        {/* Role & Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Role
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className={inputClass(false)}
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="cashier">Cashier</option>
              <option value="biller">Biller</option>
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className={inputClass(false)}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Admin Password - Required for creating new users */}
        {!isEdit && (
          <div className={`p-4 rounded-xl ${isDark ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-yellow-50 border border-yellow-200"}`}>
            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>
              🔐 Your Password (to stay logged in)
            </label>
            <div className="relative">
              <input
                type={showAdminPass ? "text" : "password"}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className={inputClass(errors.adminPassword)}
                placeholder="Enter your superadmin password"
              />
              <button
                type="button"
                onClick={() => setShowAdminPass(!showAdminPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showAdminPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.adminPassword && <p className="text-red-500 text-xs mt-1">{errors.adminPassword}</p>}
            <p className={`text-xs mt-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Required to re-authenticate after creating user
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
              isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-medium bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:from-yellow-600 hover:to-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
            {isEdit ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Delete Modal
const DeleteModal = ({ isOpen, onClose, user, onConfirm, isDark }) => {
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (isOpen) setConfirmText("");
  }, [isOpen]);

  const handleDelete = async () => {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    try {
      await onConfirm(user);
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete User" isDark={isDark}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.1 }}
        className="flex justify-center mb-4"
      >
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <AlertTriangle size={40} className="text-red-600" />
          </motion.div>
        </div>
      </motion.div>

      <div className="text-center mb-6">
        <p className={`text-lg font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
          Are you sure?
        </p>
        <p className={`text-sm mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          This will permanently delete{" "}
          <span className="font-semibold text-red-500">{user?.name}</span>
        </p>
        <p className={`text-xs mt-3 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
          Type <span className="font-mono font-bold text-red-500">DELETE</span> to confirm
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
          placeholder="Type DELETE"
          className={`mt-3 w-full px-4 py-2 rounded-lg border-2 text-center font-mono uppercase tracking-widest ${
            isDark
              ? "bg-white/5 border-red-500/50 text-white"
              : "bg-gray-50 border-red-200 text-gray-900"
          }`}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
            isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
          }`}
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting || confirmText !== "DELETE"}
          className="flex-1 py-3 rounded-xl font-medium bg-gradient-to-r from-red-500 to-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
        >
          {deleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
          Delete
        </button>
      </div>
    </Modal>
  );
};

// Reset Password Modal
const ResetModal = ({ isOpen, onClose, user, onConfirm, isDark }) => {
  const [sending, setSending] = useState(false);

  const handleReset = async () => {
    setSending(true);
    try {
      await onConfirm(user.email);
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to send reset link");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reset Password" isDark={isDark}>
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 flex items-center justify-center"
        >
          <Mail size={32} className="text-yellow-600" />
        </motion.div>
        <p className={isDark ? "text-gray-300" : "text-gray-700"}>
          Send password reset link to:
        </p>
        <p className="text-yellow-500 font-semibold mt-2 text-lg">{user?.email}</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
            isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
          }`}
        >
          Cancel
        </button>
        <button
          onClick={handleReset}
          disabled={sending}
          className="flex-1 py-3 rounded-xl font-medium bg-gradient-to-r from-yellow-500 to-amber-500 text-black disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sending ? <Loader2 className="animate-spin" size={18} /> : <Key size={18} />}
          Send Link
        </button>
      </div>
    </Modal>
  );
};

// Role Badge Component
const RoleBadge = ({ role, isDark }) => {
  const Icon = roleIcons[role] || Shield;
  const colors = {
    superadmin: "bg-purple-100 text-purple-700 border-purple-200",
    admin: "bg-blue-100 text-blue-700 border-blue-200",
    manager: "bg-green-100 text-green-700 border-green-200",
    cashier: "bg-orange-100 text-orange-700 border-orange-200",
    biller: "bg-pink-100 text-pink-700 border-pink-200"
  };

  const darkColors = {
    superadmin: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    admin: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    manager: "bg-green-500/20 text-green-400 border-green-500/30",
    cashier: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    biller: "bg-pink-500/20 text-pink-400 border-pink-500/30"
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${
      isDark ? darkColors[role] || darkColors.admin : colors[role] || colors.admin
    }`}>
      <Icon size={12} />
      {role?.charAt(0).toUpperCase() + role?.slice(1)}
    </span>
  );
};

// User Card Component
const UserCard = ({ user, onEdit, onDelete, onReset, isDark, isCurrentUser }) => {
  const Icon = roleIcons[user.role] || Shield;

  const iconBgColors = {
    superadmin: "bg-purple-100",
    admin: "bg-blue-100",
    manager: "bg-green-100",
    cashier: "bg-orange-100",
    biller: "bg-pink-100"
  };

  const iconColors = {
    superadmin: "text-purple-600",
    admin: "text-blue-600",
    manager: "text-green-600",
    cashier: "text-orange-600",
    biller: "text-pink-600"
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`p-5 rounded-2xl border-2 transition-all hover:shadow-lg ${
        isDark
          ? "bg-white/5 border-yellow-500/20 hover:border-yellow-500/40"
          : "bg-white border-yellow-100 hover:border-yellow-300"
      } ${isCurrentUser ? "ring-2 ring-yellow-500 ring-offset-2" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBgColors[user.role] || "bg-gray-100"}`}>
            <Icon size={24} className={iconColors[user.role] || "text-gray-600"} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                {user.name}
              </h3>
              {isCurrentUser && (
                <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full font-medium">
                  You
                </span>
              )}
            </div>
            <p className={`text-sm truncate ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              {user.email}
            </p>
          </div>
        </div>
      </div>

      {/* Status & Role */}
      <div className="flex items-center justify-between mb-4">
        <RoleBadge role={user.role} isDark={isDark} />
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          user.status === "active"
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700"
        }`}>
          {user.status || "active"}
        </span>
      </div>

      {/* Last Login */}
      <div className={`text-xs mb-4 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
        Last login: {user.lastLogin 
          ? new Date(user.lastLogin.seconds * 1000).toLocaleDateString() 
          : "Never"
        }
      </div>

      {/* Actions */}
      <div className={`flex items-center justify-end gap-2 pt-3 border-t ${
        isDark ? "border-gray-700" : "border-gray-100"
      }`}>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onReset(user)}
          className="p-2 rounded-lg text-yellow-600 hover:bg-yellow-100 transition-colors"
          title="Reset Password"
        >
          <Key size={16} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onEdit(user)}
          className="p-2 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors"
          title="Edit User"
        >
          <Edit size={16} />
        </motion.button>
        {!isCurrentUser && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onDelete(user)}
            className="p-2 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
            title="Delete User"
          >
            <Trash2 size={16} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

// Main Users Page Component
const UsersPage = ({ defaultRoleFilter = "all" }) => {
  const { user: currentUser } = useAuth();
  const { isDark } = useTheme();
  const { language } = useLanguage();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState(defaultRoleFilter);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);

  // Load Users
  const loadUsers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Create or Update User
  const handleSaveUser = async (form, isEdit, adminPassword) => {
    try {
      if (isEdit) {
        // Update existing user
        await updateDoc(doc(db, "users", editUser.uid), {
          name: form.name,
          role: form.role,
          status: form.status,
          updatedAt: serverTimestamp()
        });
        toast.success("User updated successfully!");
      } else {
        // Create new user
        const currentEmail = currentUser.email;
        
        // Create the new user
        const userCred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        
        // Save to Firestore
        await setDoc(doc(db, "users", userCred.user.uid), {
          uid: userCred.user.uid,
          email: form.email.toLowerCase(),
          name: form.name,
          role: form.role,
          status: form.status,
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid
        });

        // Re-login as superadmin
        await signInWithEmailAndPassword(auth, currentEmail, adminPassword);
        
        toast.success("User created successfully!");
      }
      
      await loadUsers();
      setEditUser(null);
      setShowAddModal(false);
    } catch (error) {
      console.error("Save user error:", error);
      if (error.code === "auth/email-already-in-use") {
        throw new Error("Email already in use");
      } else if (error.code === "auth/wrong-password") {
        throw new Error("Your password is incorrect");
      } else if (error.code === "auth/weak-password") {
        throw new Error("Password is too weak");
      }
      throw error;
    }
  };

  // Delete User
  const handleDeleteUser = async (user) => {
    try {
      await deleteDoc(doc(db, "users", user.uid));
      toast.success("User deleted successfully!");
      await loadUsers();
    } catch (error) {
      console.error("Delete error:", error);
      throw new Error("Failed to delete user");
    }
  };

  // Reset Password
  const handleResetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset link sent!");
    } catch (error) {
      console.error("Reset error:", error);
      throw new Error("Failed to send reset link");
    }
  };

  // Filter Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const existingEmails = users.map((u) => u.email?.toLowerCase());

  // Stats
  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    admins: users.filter((u) => u.role === "admin").length,
    staff: users.filter((u) => ["cashier", "biller", "manager"].includes(u.role)).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <p className={isDark ? "text-gray-400" : "text-gray-600"}>Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            User Management
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Manage system users, roles and permissions
          </p>
        </div>
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={loadUsers}
            className={`p-3 rounded-xl transition-colors ${
              isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <RefreshCw size={18} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-black rounded-xl font-semibold shadow-lg hover:shadow-yellow-500/25 transition-all"
          >
            <UserPlus size={18} />
            Add User
          </motion.button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: stats.total, icon: Users, color: "yellow" },
          { label: "Active", value: stats.active, icon: Check, color: "green" },
          { label: "Admins", value: stats.admins, icon: Shield, color: "blue" },
          { label: "Staff", value: stats.staff, icon: Wallet, color: "purple" }
        ].map((stat) => (
          <motion.div
            key={stat.label}
            whileHover={{ y: -2 }}
            className={`p-4 rounded-xl border ${
              isDark ? "bg-white/5 border-yellow-500/20" : "bg-white border-yellow-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>{stat.label}</p>
                <p className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{stat.value}</p>
              </div>
              <div className={`p-2 rounded-lg bg-${stat.color}-100`}>
                <stat.icon size={20} className={`text-${stat.color}-600`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${
            isDark ? "border-yellow-500/30 bg-white/5" : "border-yellow-200 bg-white"
          }`}>
            <Search size={18} className="text-yellow-600" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`flex-1 bg-transparent outline-none ${
                isDark ? "text-white placeholder:text-gray-500" : "text-gray-800 placeholder:text-gray-400"
              }`}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className={`px-4 py-3 rounded-xl border-2 min-w-[150px] ${
            isDark
              ? "border-yellow-500/30 bg-gray-900 text-white"
              : "border-yellow-200 bg-white text-gray-800"
          }`}
        >
          <option value="all">All Roles</option>
          <option value="superadmin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="cashier">Cashier</option>
          <option value="biller">Biller</option>
        </select>
      </div>

      {/* Users Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filteredUsers.map((u) => (
            <UserCard
              key={u.uid}
              user={u}
              isDark={isDark}
              isCurrentUser={u.uid === currentUser?.uid}
              onEdit={setEditUser}
              onDelete={setDeleteUser}
              onReset={setResetUser}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredUsers.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Users size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className={`text-lg font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
            No users found
          </h3>
          <p className={`mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {searchTerm || roleFilter !== "all"
              ? "Try adjusting your filters"
              : "Add your first user to get started"}
          </p>
          {!searchTerm && roleFilter === "all" && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-6 py-2 bg-yellow-500 text-black rounded-lg font-medium hover:bg-yellow-600 transition-colors"
            >
              Add First User
            </button>
          )}
        </motion.div>
      )}

      {/* Modals */}
      <UserFormModal
        isOpen={showAddModal || !!editUser}
        onClose={() => {
          setShowAddModal(false);
          setEditUser(null);
        }}
        user={editUser}
        onSave={handleSaveUser}
        isDark={isDark}
        existingEmails={existingEmails}
        currentUserEmail={currentUser?.email}
      />

      <DeleteModal
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        user={deleteUser}
        onConfirm={handleDeleteUser}
        isDark={isDark}
      />

      <ResetModal
        isOpen={!!resetUser}
        onClose={() => setResetUser(null)}
        user={resetUser}
        onConfirm={handleResetPassword}
        isDark={isDark}
      />
    </div>
  );
};

export default UsersPage;