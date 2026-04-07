import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Clock3,
  Eye,
  EyeOff,
  Package,
  Printer,
  Send,
  ShoppingCart,
  User,
  Wifi,
  WifiOff,
  X,
  Database,
  Loader2,
} from "lucide-react";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { useTheme } from "../../hooks/useTheme";
import useNetworkStatus from "../../hooks/useNetworkStatus";
import { db } from "../../services/firebase";

const Dashboard = () => {
  const { isDark } = useTheme();
  const isOnline = useNetworkStatus();
  const productInputRef = useRef(null);

  const [showRecentOrders, setShowRecentOrders] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [recentOrders, setRecentOrders] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [customer, setCustomer] = useState({
    name: "Walking Customer",
    phone: "",
  });

  const [form, setForm] = useState({
    productName: "",
    serialId: "",
    price: "",
    qty: 1,
    discount: 0,
  });

  const [items, setItems] = useState([]);

  useEffect(() => {
    productInputRef.current?.focus();

    const timer = setTimeout(() => {
      setShowRecentOrders(false);
    }, 7000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    loadRecentOrders();
  }, []);

  const addAlert = (text, type = "warning") => {
    setAlerts((prev) => {
      const exists = prev.some((item) => item.text === text);
      if (exists) return prev;
      return [...prev, { id: Date.now() + Math.random(), text, type }];
    });
  };

  const removeAlert = (id) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  const clearAlertByText = (text) => {
    setAlerts((prev) => prev.filter((alert) => alert.text !== text));
  };

  const loadRecentOrders = async () => {
    setLoadingOrders(true);

    try {
      const ordersQuery = query(
        collection(db, "orders"),
        orderBy("createdAt", "desc"),
        limit(5)
      );

      const ordersSnap = await getDocs(ordersQuery);

      if (!ordersSnap.empty) {
        const orders = ordersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRecentOrders(orders);
        clearAlertByText("No recent orders found.");
      } else {
        setRecentOrders([]);
        addAlert("No recent orders found.");
      }
    } catch (error) {
      console.error("Recent orders load error:", error);
      addAlert("Failed to load recent orders.", "error");
    } finally {
      setLoadingOrders(false);
    }
  };

  const inputClass = `w-full rounded-xl border px-3 py-3 outline-none transition ${
    isDark
      ? "border-yellow-500/20 bg-[#0f0d09] text-white placeholder:text-gray-500 focus:border-yellow-500/50"
      : "border-yellow-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-yellow-500"
  }`;

  const cardClass = `${
    isDark
      ? "border border-yellow-500/20 bg-[#15120d]/95"
      : "border border-yellow-200 bg-white"
  } rounded-2xl`;

  const totalQty = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    [items]
  );

  const totalDiscount = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.discount || 0) * Number(item.qty || 0),
        0
      ),
    [items]
  );

  const grandTotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const lineTotal =
          Number(item.price || 0) * Number(item.qty || 0) -
          Number(item.discount || 0) * Number(item.qty || 0);
        return sum + lineTotal;
      }, 0),
    [items]
  );

  const handleAddItem = () => {
    if (!form.productName.trim() || !form.price) {
      addAlert("Product name and price are required.", "error");
      return;
    }

    const newItem = {
      id: Date.now(),
      serialId: form.serialId || `SR-${Date.now()}`,
      productName: form.productName,
      price: Number(form.price),
      qty: Number(form.qty),
      discount: Number(form.discount),
    };

    setItems((prev) => [...prev, newItem]);

    setForm({
      productName: "",
      serialId: "",
      price: "",
      qty: 1,
      discount: 0,
    });

    clearAlertByText("Product name and price are required.");
    setTimeout(() => productInputRef.current?.focus(), 50);
  };

  const handleDeleteRow = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleQtyChange = (id, value) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: Number(value) || 1 } : item
      )
    );
  };

  const handleDiscountChange = (id, value) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, discount: Number(value) || 0 } : item
      )
    );
  };

  const handleResetBill = () => {
    setItems([]);
    setCustomer({
      name: "Walking Customer",
      phone: "",
    });
    setForm({
      productName: "",
      serialId: "",
      price: "",
      qty: 1,
      discount: 0,
    });
    setTimeout(() => productInputRef.current?.focus(), 50);
  };

  const handleSubmitOrder = async () => {
    if (submitting) return;

    if (items.length === 0) {
      addAlert("Please add at least one product before submitting.", "error");
      return;
    }

    try {
      setSubmitting(true);

      const serialNo = `ORD-${Date.now()}`;

      const preparedItems = items.map((item) => ({
        serialId: item.serialId || "",
        productName: item.productName || "",
        price: Number(item.price || 0),
        qty: Number(item.qty || 0),
        discount: Number(item.discount || 0),
        total:
          Number(item.price || 0) * Number(item.qty || 0) -
          Number(item.discount || 0) * Number(item.qty || 0),
      }));

      const orderData = {
        serialNo,
        customer: {
          name: customer.name?.trim() || "Walking Customer",
          phone: customer.phone?.trim() || "",
        },
        items: preparedItems,
        totalQty,
        totalAmount: grandTotal,
        totalDiscount,
        paymentType: null,
        status: "pending",
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "orders"), orderData);

      const newRecentOrder = {
        id: docRef.id,
        ...orderData,
        createdAt: new Date(),
      };

      setRecentOrders((prev) => [newRecentOrder, ...prev].slice(0, 5));
      clearAlertByText("No recent orders found.");
      clearAlertByText("Please add at least one product before submitting.");
      addAlert(`Order ${serialNo} submitted successfully.`, "success");

      handleResetBill();
      setShowRecentOrders(true);

      setTimeout(() => {
        loadRecentOrders();
      }, 500);
    } catch (error) {
      console.error("Submit order error:", error);
      addAlert("Failed to submit order.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            Biller Dashboard
          </h1>
          <p className={`mt-1 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Fast billing screen for creating orders and sending to cashier
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
              isOnline
                ? isDark
                  ? "border border-green-500/20 bg-green-500/10 text-green-400"
                  : "border border-green-200 bg-green-50 text-green-700"
                : isDark
                ? "border border-red-500/20 bg-red-500/10 text-red-400"
                : "border border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
            {isOnline ? "Online" : "Offline"}
          </div>

          <button
            onClick={loadRecentOrders}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              isDark
                ? "border border-yellow-500/20 bg-[#15120d] text-yellow-400 hover:bg-[#1b1711]"
                : "border border-yellow-200 bg-white text-yellow-700 hover:bg-yellow-50"
            }`}
          >
            Refresh
          </button>

          <button
            onClick={() => setShowRecentOrders((prev) => !prev)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              isDark
                ? "border border-yellow-500/20 bg-[#15120d] text-yellow-400 hover:bg-[#1b1711]"
                : "border border-yellow-200 bg-white text-yellow-700 hover:bg-yellow-50"
            }`}
          >
            {showRecentOrders ? <EyeOff size={16} /> : <Eye size={16} />}
            {showRecentOrders ? "Hide Recent" : "Show Recent"}
          </button>
        </div>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`flex items-start justify-between gap-3 rounded-2xl border p-4 ${
                  alert.type === "error"
                    ? isDark
                      ? "border-red-500/20 bg-red-500/10 text-red-300"
                      : "border-red-200 bg-red-50 text-red-700"
                    : alert.type === "success"
                    ? isDark
                      ? "border-green-500/20 bg-green-500/10 text-green-300"
                      : "border-green-200 bg-green-50 text-green-700"
                    : isDark
                    ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
                    : "border-yellow-200 bg-yellow-50 text-yellow-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <p className="text-sm">{alert.text}</p>
                </div>

                <button
                  onClick={() => removeAlert(alert.id)}
                  className="rounded-lg p-1 hover:bg-black/10"
                >
                  <X size={16} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Recent Orders */}
      {showRecentOrders && (
        <section className={`${cardClass} p-4`}>
          <div className="mb-3 flex items-center gap-2">
            <Clock3 size={16} className="text-yellow-500" />
            <h2 className={`text-sm font-semibold uppercase tracking-widest ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>
              Recent Orders (Top 5)
            </h2>
          </div>

          {loadingOrders ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className={`h-28 animate-pulse rounded-xl ${
                    isDark ? "bg-white/5" : "bg-gray-100"
                  }`}
                />
              ))}
            </div>
          ) : recentOrders.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {recentOrders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl border p-4 ${
                    isDark
                      ? "border-yellow-500/20 bg-black/30"
                      : "border-yellow-200 bg-yellow-50/40"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-yellow-500">
                        {order.serialNo || order.id}
                      </p>
                      <p className={`mt-1 text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                        {order.customer?.name || "Walking Customer"}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 capitalize">
                      {order.status || "pending"}
                    </span>
                  </div>

                  <p className="mt-3 text-xl font-bold text-yellow-500">
                    PKR {Number(order.totalAmount || 0).toLocaleString()}
                  </p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div
              className={`flex flex-col items-center justify-center rounded-2xl border border-dashed py-10 text-center ${
                isDark
                  ? "border-yellow-500/20 bg-black/20 text-gray-400"
                  : "border-yellow-200 bg-yellow-50/20 text-gray-600"
              }`}
            >
              <Database size={34} className="mb-3 text-yellow-500" />
              <p className="font-medium">No recent orders found</p>
              <p className="mt-1 text-sm">Orders will appear here when available</p>
            </div>
          )}
        </section>
      )}

      {/* Main Grid */}
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        {/* Left Panel */}
        <section className={`${cardClass} p-4`}>
          <div className="mb-4 flex items-center gap-2">
            <ShoppingCart size={18} className="text-yellow-500" />
            <h2 className={`text-sm font-semibold uppercase tracking-widest ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>
              Product Entry
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Product Name
              </label>
              <input
                ref={productInputRef}
                type="text"
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                placeholder="Enter product name..."
                className={inputClass}
              />
            </div>

            <div>
              <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Serial ID / Barcode
              </label>
              <input
                type="text"
                value={form.serialId}
                onChange={(e) => setForm({ ...form, serialId: e.target.value })}
                placeholder="Enter serial / barcode..."
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Price (PKR)
                </label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Quantity
                </label>
                <input
                  type="number"
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Discount (PKR)
              </label>
              <input
                type="number"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
                placeholder="0"
                className={inputClass}
              />
            </div>

            <div className={`my-4 h-px ${isDark ? "bg-yellow-500/10" : "bg-yellow-200"}`} />

            <div>
              <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Customer Name
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div>
              <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Customer Phone
              </label>
              <input
                type="text"
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                placeholder="Enter customer phone..."
                className={inputClass}
              />
            </div>

            <button
              onClick={handleAddItem}
              className="w-full rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-3 font-semibold text-black transition hover:from-yellow-400 hover:to-amber-400"
            >
              Add Product
            </button>
          </div>
        </section>

        {/* Right Panel */}
        <div className="space-y-4">
          <section className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className={`${isDark ? "bg-yellow-500/10 text-yellow-500" : "bg-yellow-50 text-yellow-700"}`}>
                  <tr>
                    <th className="px-4 py-4 text-left">S.No</th>
                    <th className="px-4 py-4 text-left">Serial ID</th>
                    <th className="px-4 py-4 text-left">Product Name</th>
                    <th className="px-4 py-4 text-left">Price</th>
                    <th className="px-4 py-4 text-left">Qty</th>
                    <th className="px-4 py-4 text-left">Discount</th>
                    <th className="px-4 py-4 text-left">Total</th>
                    <th className="px-4 py-4 text-left">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-4 py-14 text-center">
                        <div className={`${isDark ? "text-gray-500" : "text-gray-500"} flex flex-col items-center justify-center`}>
                          <Package size={30} className="mb-2 text-yellow-500" />
                          <p className="font-medium">No bill items added</p>
                          <p className="mt-1 text-sm">Products will appear here after entry</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => {
                      const lineTotal =
                        item.price * item.qty - item.discount * item.qty;

                      return (
                        <motion.tr
                          key={item.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`border-t ${
                            isDark
                              ? "border-yellow-500/10 text-white"
                              : "border-yellow-100 text-gray-900"
                          }`}
                        >
                          <td className="px-4 py-4">{index + 1}</td>
                          <td className="px-4 py-4 text-yellow-500">{item.serialId}</td>
                          <td className="px-4 py-4 font-medium">{item.productName}</td>
                          <td className="px-4 py-4">PKR {item.price.toLocaleString()}</td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => handleQtyChange(item.id, e.target.value)}
                              className={`w-20 rounded-lg border px-2 py-1 outline-none ${
                                isDark
                                  ? "border-yellow-500/20 bg-black/30 text-white"
                                  : "border-yellow-200 bg-white text-gray-900"
                              }`}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              min="0"
                              value={item.discount}
                              onChange={(e) => handleDiscountChange(item.id, e.target.value)}
                              className={`w-24 rounded-lg border px-2 py-1 outline-none ${
                                isDark
                                  ? "border-yellow-500/20 bg-black/30 text-white"
                                  : "border-yellow-200 bg-white text-gray-900"
                              }`}
                            />
                          </td>
                          <td className="px-4 py-4 font-bold text-yellow-500">
                            PKR {lineTotal.toLocaleString()}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => handleDeleteRow(item.id)}
                              className={`rounded-lg px-3 py-1 text-xs font-medium ${
                                isDark
                                  ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                  : "bg-red-50 text-red-600 hover:bg-red-100"
                              }`}
                            >
                              Delete
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`${cardClass} p-5`}>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.25em] ${isDark ? "text-yellow-500" : "text-yellow-700"}`}>
                  Grand Total
                </p>

                <h3 className="mt-3 text-4xl font-extrabold text-yellow-500">
                  PKR {grandTotal.toLocaleString()}
                </h3>

                <div className="mt-4 grid grid-cols-3 gap-3 max-w-xl">
                  <div className={`${isDark ? "border-yellow-500/10 bg-black/25" : "border-yellow-100 bg-yellow-50/30"} rounded-xl border px-4 py-3`}>
                    <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>Items</p>
                    <p className={`mt-1 text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                      {items.length}
                    </p>
                  </div>

                  <div className={`${isDark ? "border-yellow-500/10 bg-black/25" : "border-yellow-100 bg-yellow-50/30"} rounded-xl border px-4 py-3`}>
                    <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>Total Qty</p>
                    <p className={`mt-1 text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                      {totalQty}
                    </p>
                  </div>

                  <div className={`${isDark ? "border-yellow-500/10 bg-black/25" : "border-yellow-100 bg-yellow-50/30"} rounded-xl border px-4 py-3`}>
                    <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>Discount</p>
                    <p className={`mt-1 text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                      PKR {totalDiscount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-medium ${
                    isDark
                      ? "border border-yellow-500/20 bg-slate-800/80 text-white hover:bg-slate-700"
                      : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                  }`}
                >
                  <Printer size={18} />
                  Print
                </button>

                <button
                  onClick={handleResetBill}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-medium ${
                    isDark
                      ? "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      : "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                  }`}
                >
                  Reset
                </button>

                <button
                  onClick={handleSubmitOrder}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-5 py-3 font-semibold text-black hover:from-yellow-400 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  {submitting ? "Submitting..." : "Submit Order"}
                </button>
              </div>
            </div>
          </section>

          <section className={`${cardClass} p-4`}>
            <div className="mb-3 flex items-center gap-2">
              <Package size={16} className="text-yellow-500" />
              <h3 className={`text-sm font-semibold uppercase tracking-widest ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>
                Keyboard Shortcuts
              </h3>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                "F8 - Print Bill",
                "Insert - Unlock Bill",
                "+ - Submit Bill",
                "- - Delete Row",
                "* - Clear Bill",
                "/ - Cancel Bill",
                "0 - New Bill",
                "Esc - Reset Screen",
              ].map((hotkey) => (
                <div
                  key={hotkey}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    isDark ? "bg-black/30 text-gray-300" : "bg-gray-50 text-gray-700"
                  }`}
                >
                  {hotkey}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;