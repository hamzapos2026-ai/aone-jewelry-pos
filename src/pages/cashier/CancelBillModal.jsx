import React, { useState } from "react";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { recordBillDeletion } from "../../services/deletedBillsService";
import { FiX, FiXCircle, FiAlertTriangle } from "react-icons/fi";
import { toast } from "react-hot-toast";

const CANCEL_REASONS = [
  "Customer changed mind",
  "Duplicate bill",
  "Wrong items",
  "Payment issue",
  "Customer request",
  "Other",
];

const CancelBillModal = ({ order, isDark, userData, onClose }) => {
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [loading, setLoading] = useState(false);

  const finalReason = reason === "Other" ? customReason : reason;

  const handleCancel = async () => {
    if (!finalReason.trim()) {
      toast.error("Please provide a reason for cancellation");
      return;
    }

    setLoading(true);
    try {
      const orderRef = doc(db, "orders", order.id);
      
      // ✅ Update order status to cancelled
      await updateDoc(orderRef, {
        status: "cancelled",
        cancelReason: finalReason,
        cancelledBy: userData?.displayName || userData?.name || "Cashier",
        cancelledUserId: userData?.uid || "",
        cancelledAt: serverTimestamp(),
      });

      // ✅ Save to deletedBills collection with reason (for admin tracking)
      await recordBillDeletion(
        {
          serialNo: order.billSerial || order.serialNo || "UNKNOWN",
          storeId: userData?.storeId || order.storeId || null,
          items: order.items || [],
          totalAmount: order.totalAmount || 0,
          totalDiscount: order.totalDiscount || order.billDiscount || 0,
          totalQty: order.totalQty || 0,
          customer: order.customer || null,
          billerId: order.billerId || userData?.uid || null,
          billerName: order.billerName || userData?.displayName || userData?.name || null,
          billStartTime: order.billStartTime || null,
          billEndTime: order.billEndTime || null,
          reason: `CANCELLED: ${finalReason}`,
          cancelledBy: userData?.displayName || userData?.name || "Cashier",
          cancelledUserId: userData?.uid || "",
        },
        userData?.storeId || order.storeId,
        true // isOnline
      );

      // ✅ Create audit log
      await addDoc(collection(db, "auditLogs"), {
        action: "BILL_CANCELLED",
        orderId: order.id,
        billSerial: order.billSerial || order.serialNo,
        userId: userData?.uid || "",
        userName: userData?.displayName || userData?.name || "Cashier",
        role: userData?.role || "cashier",
        storeId: userData?.storeId || "",
        cancelReason: finalReason,
        before: { status: order.status },
        after: { status: "cancelled" },
        timestamp: serverTimestamp(),
      });

      toast.success("Bill cancelled successfully");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel bill");
    } finally {
      setLoading(false);
    }
  };

  const cardBg = isDark ? "bg-[#1a1208]" : "bg-white";
  const border = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text = isDark ? "text-gray-100" : "text-gray-900";
  const subText = isDark ? "text-gray-400" : "text-gray-500";
  const inputBg = isDark
    ? "bg-[#120d06] border-[#2a1f0f] text-gray-100"
    : "bg-gray-50 border-gray-200 text-gray-900";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className={`relative w-full max-w-sm ${cardBg} rounded-2xl border ${border} shadow-2xl`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-500/20 rounded-xl flex items-center justify-center">
              <FiXCircle className="text-red-500 w-5 h-5" />
            </div>
            <div>
              <h2 className={`font-bold text-base ${text}`}>Cancel Bill</h2>
              <p className={`text-xs ${subText}`}>
                #{order.billSerial || order.serialNo}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${subText} hover:text-red-500`}>
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Warning */}
          <div className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? "bg-red-900/20 border border-red-800" : "bg-red-50 border border-red-200"}`}>
            <FiAlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className={`text-sm font-medium text-red-500`}>
                This action cannot be undone
              </p>
              <p className={`text-xs ${subText} mt-0.5`}>
                Bill #{order.billSerial || order.serialNo} worth Rs.{" "}
                {order.totalAmount} will be cancelled
              </p>
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className={`block text-xs font-medium ${subText} mb-2`}>
              Select Reason <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
                    reason === r
                      ? "border-red-500 bg-red-500/10 text-red-500"
                      : `${border} ${subText} hover:border-red-300`
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Reason */}
          {reason === "Other" && (
            <div>
              <label className={`block text-xs font-medium ${subText} mb-1.5`}>
                Custom Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={2}
                placeholder="Enter custom cancellation reason..."
                className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} focus:outline-none focus:border-red-500 resize-none`}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t ${border} flex items-center gap-3`}>
          <button
            onClick={onClose}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl border ${border} text-sm font-medium ${subText} transition-all`}
          >
            Go Back
          </button>
          <button
            onClick={handleCancel}
            disabled={loading || !finalReason.trim()}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <FiXCircle className="w-4 h-4" />
            )}
            {loading ? "Cancelling..." : "Cancel Bill"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelBillModal;