import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  DollarSign,
  Eye,
  Filter,
  Package,
  Search,
  User,
  Download,
  Printer,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  startAfter,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useTheme } from "../../context/ThemeContext";
import useNetworkStatus from "../../hooks/useNetworkStatus";
import { format } from "date-fns";

const SalesHistory = () => {
  const { isDark } = useTheme();
  const isOnline = useNetworkStatus();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const loadOrders = async (loadMore = false) => {
    if (!isOnline) return;

    try {
      setLoading(true);
      let q = query(
        collection(db, "orders"),
        orderBy("createdAt", "desc"),
        limit(20)
      );

      if (loadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      // Apply filters
      if (statusFilter !== "all") {
        q = query(q, where("status", "==", statusFilter));
      }

      const snapshot = await getDocs(q);
      const ordersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (loadMore) {
        setOrders((prev) => [...prev, ...ordersData]);
      } else {
        setOrders(ordersData);
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 20);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [isOnline, statusFilter]);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.serialNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.phone?.includes(searchTerm);

    return matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "completed":
        return "bg-green-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const handlePrint = (order) => {
    // TODO: Implement print functionality
    console.log("Print order:", order);
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log("Export orders");
  };

  return (
    <div className={`min-h-screen p-6 ${isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Sales History</h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage all sales transactions
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by order number, customer name, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                  isDark
                    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-4 py-2 rounded-lg border ${
              isDark
                ? "bg-gray-800 border-gray-700 text-white"
                : "bg-white border-gray-300 text-gray-900"
            }`}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {loading && orders.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No orders found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm ? "Try adjusting your search criteria" : "No sales orders yet"}
              </p>
            </div>
          ) : (
            <>
              {filteredOrders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-6 rounded-lg border ${
                    isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                  } shadow-sm`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{order.serialNo}</h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium text-white rounded-full ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {order.customer?.name || "Walk-in Customer"}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {order.createdAt?.toDate
                            ? format(order.createdAt.toDate(), "MMM dd, yyyy")
                            : "N/A"}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {order.createdAt?.toDate
                            ? format(order.createdAt.toDate(), "HH:mm")
                            : "N/A"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        ${order.totalAmount?.toFixed(2) || "0.00"}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {order.totalQty || 0} items
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePrint(order)}
                        className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        Print
                      </button>
                      <button className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}

              {hasMore && (
                <div className="text-center py-4">
                  <button
                    onClick={() => loadOrders(true)}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesHistory;