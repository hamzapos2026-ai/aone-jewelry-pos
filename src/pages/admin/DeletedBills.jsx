import React, { useState, useEffect } from "react";
import {
  collection, query, where, onSnapshot, orderBy, getDocs,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  FiFilter, FiDownload, FiCalendar, FiUser, FiTrendingDown,
  FiSearch, FiX,
} from "react-icons/fi";
import { MdReceiptLong, MdStore } from "react-icons/md";
import { toast } from "react-hot-toast";

const DeletedBills = () => {
  const { isDark } = useTheme();
  const { userData } = useAuth();
  const [deletedBills, setDeletedBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    storeId: "",
    reason: "",
    billerName: "",
  });
  const [stores, setStores] = useState([]);

  // Fetch stores for filter
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const snap = await getDocs(collection(db, "stores"));
        setStores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Error fetching stores:", e);
      }
    };
    fetchStores();
  }, []);

  // Real-time deleted bills
  useEffect(() => {
    let q = query(collection(db, "deletedBills"), orderBy("deletedAt", "desc"));
    
    const unsub = onSnapshot(q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setDeletedBills(data);
        setLoading(false);
      },
      () => {
        setDeletedBills([]);
        setLoading(false);
      }
    );
    
    return () => unsub();
  }, []);

  // Apply filters
  useEffect(() => {
    let result = [...deletedBills];

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((b) => {
        const d = b.deletedAt?.toDate ? b.deletedAt.toDate() : new Date(b.deletedAt || 0);
        return d >= from;
      });
    }

    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((b) => {
        const d = b.deletedAt?.toDate ? b.deletedAt.toDate() : new Date(b.deletedAt || 0);
        return d <= to;
      });
    }

    if (filters.storeId) {
      result = result.filter((b) => b.storeId === filters.storeId);
    }

    if (filters.reason) {
      result = result.filter((b) =>
        b.reason?.toLowerCase().includes(filters.reason.toLowerCase())
      );
    }

    if (filters.billerName) {
      result = result.filter((b) =>
        b.billerName?.toLowerCase().includes(filters.billerName.toLowerCase())
      );
    }

    setFilteredBills(result);
  }, [deletedBills, filters]);

  const handleDownloadCSV = () => {
    const headers = ["Bill #", "Amount", "Discount", "Items", "Reason", "Biller", "Store", "Date"];
    const rows = filteredBills.map((b) => [
      b.serialNo || "N/A",
      b.totalAmount || 0,
      b.totalDiscount || 0,
      b.totalQty || 0,
      b.reason || "N/A",
      b.billerName || "N/A",
      stores.find((s) => s.id === b.storeId)?.name || "N/A",
      b.deletedAt?.toDate?.().toLocaleString() || b.deletedAt || "N/A",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deleted-bills-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("CSV downloaded!");
  };

  const bgCard = isDark ? "bg-[#15120d]" : "bg-white";
  const borderCard = isDark ? "border-yellow-500/20" : "border-yellow-200";
  const text = isDark ? "text-gray-100" : "text-gray-900";
  const subText = isDark ? "text-gray-400" : "text-gray-600";
  const inputBg = isDark ? "bg-[#0f0d09] border-yellow-500/20" : "bg-white border-yellow-200";

  return (
    <div className={`min-h-screen p-6 ${isDark ? "bg-[#0a0804]" : "bg-gray-50"}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
              <FiTrendingDown className="text-red-500 w-6 h-6" />
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${text}`}>Deleted Bills Report</h1>
              <p className={`text-sm ${subText}`}>Track all cancelled and deleted bills</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className={`${bgCard} border ${borderCard} rounded-2xl p-4`}>
            <p className={`text-xs uppercase ${subText} mb-1`}>Total Deleted</p>
            <p className="text-2xl font-bold text-red-500">{deletedBills.length}</p>
          </div>
          <div className={`${bgCard} border ${borderCard} rounded-2xl p-4`}>
            <p className={`text-xs uppercase ${subText} mb-1`}>Filtered Results</p>
            <p className="text-2xl font-bold text-yellow-500">{filteredBills.length}</p>
          </div>
          <div className={`${bgCard} border ${borderCard} rounded-2xl p-4`}>
            <p className={`text-xs uppercase ${subText} mb-1`}>Total Lost</p>
            <p className="text-2xl font-bold text-orange-500">
              Rs. {filteredBills.reduce((s, b) => s + (b.totalAmount || 0), 0).toLocaleString()}
            </p>
          </div>
          <div className={`${bgCard} border ${borderCard} rounded-2xl p-4`}>
            <p className={`text-xs uppercase ${subText} mb-1`}>Items Lost</p>
            <p className="text-2xl font-bold text-amber-500">
              {filteredBills.reduce((s, b) => s + (b.totalQty || 0), 0)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className={`${bgCard} border ${borderCard} rounded-2xl p-5 mb-6`}>
          <div className="flex items-center gap-2 mb-4">
            <FiFilter className={`w-5 h-5 ${subText}`} />
            <h2 className={`text-lg font-bold ${text}`}>Filters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Date From */}
            <div>
              <label className={`block text-xs font-medium ${subText} mb-1.5`}>Date From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border ${inputBg} text-sm focus:outline-none focus:border-yellow-500`}
              />
            </div>

            {/* Date To */}
            <div>
              <label className={`block text-xs font-medium ${subText} mb-1.5`}>Date To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border ${inputBg} text-sm focus:outline-none focus:border-yellow-500`}
              />
            </div>

            {/* Store */}
            <div>
              <label className={`block text-xs font-medium ${subText} mb-1.5`}>Store</label>
              <select
                value={filters.storeId}
                onChange={(e) => setFilters((p) => ({ ...p, storeId: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border ${inputBg} text-sm focus:outline-none focus:border-yellow-500`}
              >
                <option value="">All Stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Reason */}
            <div>
              <label className={`block text-xs font-medium ${subText} mb-1.5`}>Reason</label>
              <input
                type="text"
                placeholder="Search reason..."
                value={filters.reason}
                onChange={(e) => setFilters((p) => ({ ...p, reason: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border ${inputBg} text-sm focus:outline-none focus:border-yellow-500`}
              />
            </div>

            {/* Biller */}
            <div>
              <label className={`block text-xs font-medium ${subText} mb-1.5`}>Biller</label>
              <input
                type="text"
                placeholder="Biller name..."
                value={filters.billerName}
                onChange={(e) => setFilters((p) => ({ ...p, billerName: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border ${inputBg} text-sm focus:outline-none focus:border-yellow-500`}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setFilters({ dateFrom: "", dateTo: "", storeId: "", reason: "", billerName: "" })}
              className={`px-4 py-2 rounded-lg border ${borderCard} text-sm font-medium ${subText} hover:bg-yellow-500/10`}
            >
              Clear Filters
            </button>
            <button
              onClick={handleDownloadCSV}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-sm font-bold hover:from-yellow-600 hover:to-amber-600 flex items-center gap-2"
            >
              <FiDownload className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Results */}
        <div className={`${bgCard} border ${borderCard} rounded-2xl overflow-hidden`}>
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin mx-auto mb-4" />
              <p className={subText}>Loading deleted bills...</p>
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="p-8 text-center">
              <MdReceiptLong className={`w-16 h-16 mx-auto mb-4 ${subText} opacity-20`} />
              <p className={`text-lg font-semibold ${text} mb-1`}>No Deleted Bills</p>
              <p className={subText}>No bills match your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={isDark ? "bg-[#1a1508]" : "bg-gray-50"}>
                  <tr>
                    <th className={`px-6 py-3 text-left font-semibold ${subText} border-b ${borderCard}`}>Bill #</th>
                    <th className={`px-6 py-3 text-left font-semibold ${subText} border-b ${borderCard}`}>Amount</th>
                    <th className={`px-6 py-3 text-left font-semibold ${subText} border-b ${borderCard}`}>Discount</th>
                    <th className={`px-6 py-3 text-left font-semibold ${subText} border-b ${borderCard}`}>Qty</th>
                    <th className={`px-6 py-3 text-left font-semibold ${subText} border-b ${borderCard}`}>Reason</th>
                    <th className={`px-6 py-3 text-left font-semibold ${subText} border-b ${borderCard}`}>Biller</th>
                    <th className={`px-6 py-3 text-left font-semibold ${subText} border-b ${borderCard}`}>Store</th>
                    <th className={`px-6 py-3 text-left font-semibold ${subText} border-b ${borderCard}`}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.map((bill) => (
                    <tr
                      key={bill.id}
                      className={`border-b ${borderCard} hover:${isDark ? "bg-white/5" : "bg-gray-50"} transition`}
                    >
                      <td className="px-6 py-4 font-mono font-bold text-red-500">
                        {bill.serialNo || "N/A"}
                      </td>
                      <td className={`px-6 py-4 ${text}`}>
                        Rs. {(bill.totalAmount || 0).toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 text-orange-500 font-medium`}>
                        Rs. {(bill.totalDiscount || 0).toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 ${text}`}>
                        {bill.totalQty || 0} items
                      </td>
                      <td className={`px-6 py-4 text-xs ${subText}`}>
                        <span className="bg-red-500/10 text-red-400 px-2.5 py-1.5 rounded-lg inline-block">
                          {bill.reason?.replace("CANCELLED: ", "") || "N/A"}
                        </span>
                      </td>
                      <td className={`px-6 py-4 ${text} flex items-center gap-2`}>
                        <FiUser className="w-4 h-4 text-gray-400" />
                        {bill.billerName || "N/A"}
                      </td>
                      <td className={`px-6 py-4 ${text} flex items-center gap-2`}>
                        <MdStore className="w-4 h-4 text-gray-400" />
                        {stores.find((s) => s.id === bill.storeId)?.name || "N/A"}
                      </td>
                      <td className={`px-6 py-4 text-xs ${subText}`}>
                        {bill.deletedAt?.toDate
                          ? bill.deletedAt.toDate().toLocaleString()
                          : new Date(bill.deletedAt || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeletedBills;
