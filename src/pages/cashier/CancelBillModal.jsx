// src/components/cashier/CancelBillModal.jsx
// ✅ Dropdown + custom type option
// ✅ Saves to cashierActions collection with full data

import React, { useState, useCallback } from "react";
import {
  doc, updateDoc, addDoc, collection, serverTimestamp, deleteDoc,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { X, XCircle, AlertTriangle, ChevronDown, Edit3 } from "lucide-react";
import { toast } from "react-hot-toast";

const CANCEL_REASONS = [
  "Customer changed mind",
  "Duplicate bill",
  "Wrong items entered",
  "Wrong price entered",
  "Wrong customer",
  "Payment issue",
  "Customer request",
  "Item out of stock",
  "System error / test bill",
  "Biller mistake",
  "Customer not available",
  "Manager request",
  "Price dispute",
  "Returned goods",
];

const CancelBillModal = ({ order, isDark, userData, onClose }) => {
  const [mode, setMode]               = useState("select"); // "select" or "custom"
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason]     = useState("");
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [loading, setLoading]               = useState(false);

  const finalReason = mode === "custom" ? customReason.trim() : selectedReason;

  const cardBg  = isDark ? "bg-[#1a1208]"     : "bg-white";
  const border  = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text    = isDark ? "text-gray-100"     : "text-gray-900";
  const subText = isDark ? "text-gray-400"     : "text-gray-500";
  const inputBg = isDark
    ? "bg-[#120d06] border-[#2a1f0f] text-gray-100"
    : "bg-gray-50 border-gray-200 text-gray-900";
  const dropBg  = isDark ? "bg-[#1a1208]" : "bg-white";

  const handleCancel = useCallback(async () => {
    if (!finalReason) {
      toast.error("Please provide a reason!"); return;
    }
    setLoading(true);

    const storeId    = userData?.storeId || order.storeId || "default";
    const cashierName = userData?.displayName || userData?.name || "Cashier";
    const now        = new Date();

    try {
      await Promise.all([
        // 1. Update order status
        updateDoc(doc(db, "orders", order.id), {
          status:          "cancelled",
          cancelReason:    finalReason,
          cancelledBy:     cashierName,
          cancelledUserId: userData?.uid || "",
          cancelledAt:     serverTimestamp(),
        }),

        // 2. ✅ Save to cashierActions (full record)
        addDoc(collection(db, "cashierActions"), {
          actionType:    "CANCELLED",
          orderId:       order.id,
          billSerial:    order.billSerial || order.serialNo || "—",
          serialNo:      order.serialNo   || order.billSerial || "—",
          storeId,
          cashierId:     userData?.uid || "",
          cashierName,
          reason:        finalReason,
          totalAmount:   order.totalAmount   || 0,
          totalDiscount: order.totalDiscount || 0,
          totalQty:      order.totalQty      || 0,
          customer:      order.customer      || {},
          items:         order.items         || [],
          billerName:    order.billerName    || "",
          billerId:      order.billerId      || "",
          billStartTime: order.billStartTime || null,
          date:          now.toISOString().split("T")[0],
          time:          now.toLocaleTimeString("en-PK"),
          timestamp:     serverTimestamp(),
        }),

        // 3. Audit log
        addDoc(collection(db, "auditLogs"), {
          action:      "BILL_CANCELLED_BY_CASHIER",
          orderId:     order.id,
          billSerial:  order.billSerial || order.serialNo,
          userId:      userData?.uid || "",
          userName:    cashierName,
          reason:      finalReason,
          amount:      order.totalAmount || 0,
          storeId,
          timestamp:   serverTimestamp(),
        }),
      ]);

      toast.success(`Bill #${order.billSerial || order.serialNo} cancelled`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Cancel failed!");
    } finally {
      setLoading(false);
    }
  }, [finalReason, order, userData, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-sm ${cardBg} rounded-2xl border ${border} shadow-2xl`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-500/20 rounded-xl flex items-center justify-center">
              <XCircle className="text-red-500 w-5 h-5" />
            </div>
            <div>
              <h2 className={`font-bold text-base ${text}`}>Cancel Bill</h2>
              <p className={`text-xs ${subText}`}>#{order.billSerial || order.serialNo}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${subText} hover:text-red-500`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Warning */}
          <div className={`flex items-start gap-3 p-3 rounded-xl ${
            isDark ? "bg-red-900/20 border border-red-800" : "bg-red-50 border border-red-200"
          }`}>
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-500">Cannot be undone</p>
              <p className={`text-xs ${subText} mt-0.5`}>
                #{order.billSerial || order.serialNo} · Rs. {(order.totalAmount || 0).toLocaleString()}
                {order.customer?.name ? ` · ${order.customer.name}` : ""}
              </p>
            </div>
          </div>

          {/* ✅ Mode toggle: Select or Custom type */}
          <div className="flex gap-2">
            <button
              onClick={() => { setMode("select"); setCustomReason(""); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                mode === "select"
                  ? "border-red-500 bg-red-500/10 text-red-500"
                  : `${border} ${subText}`
              }`}
            >
              Select Reason
            </button>
            <button
              onClick={() => { setMode("custom"); setSelectedReason(""); setDropdownOpen(false); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                mode === "custom"
                  ? "border-red-500 bg-red-500/10 text-red-500"
                  : `${border} ${subText}`
              }`}
            >
              <Edit3 className="w-3 h-3" /> Type Custom
            </button>
          </div>

          {/* ── Select dropdown ── */}
          {mode === "select" && (
            <div>
              <label className={`block text-xs font-semibold ${subText} mb-2`}>
                Reason <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className={`w-full flex items-center justify-between px-4 py-3
                    rounded-xl border text-sm font-medium transition-all ${
                    selectedReason
                      ? "border-red-500 bg-red-500/5 text-red-500"
                      : `${inputBg} ${isDark ? "text-gray-400" : "text-gray-500"}`
                  }`}
                >
                  <span className="truncate">{selectedReason || "Select a reason..."}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {dropdownOpen && (
                  <div className={`absolute top-full left-0 right-0 mt-1 z-50
                    rounded-xl border ${border} ${dropBg} shadow-xl max-h-48
                    overflow-y-auto`}>
                    {CANCEL_REASONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => { setSelectedReason(r); setDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm border-b
                          last:border-0 transition-colors ${
                          isDark ? "border-[#2a1f0f] hover:bg-red-900/20" : "border-gray-100 hover:bg-red-50"
                        } ${selectedReason === r ? "text-red-500 font-bold bg-red-500/10" : text}`}
                      >
                        {selectedReason === r && "✓ "}{r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Custom type ── */}
          {mode === "custom" && (
            <div>
              <label className={`block text-xs font-semibold ${subText} mb-2`}>
                Type your reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
                autoFocus
                placeholder="Describe the cancel reason..."
                className={`w-full px-3 py-2.5 rounded-xl border text-sm ${inputBg}
                  focus:outline-none focus:border-red-500 resize-none transition-all`}
              />
              {customReason.trim() && (
                <p className={`text-[10px] ${subText} mt-1`}>
                  {customReason.trim().length} characters
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t ${border} flex items-center gap-3`}>
          <button onClick={onClose} disabled={loading}
            className={`flex-1 py-2.5 rounded-xl border ${border} text-sm font-medium ${subText}`}>
            Back
          </button>
          <button onClick={handleCancel} disabled={loading || !finalReason}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50
              text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-95">
            {loading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <XCircle className="w-4 h-4" />}
            {loading ? "Cancelling..." : "Cancel Bill"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelBillModal;