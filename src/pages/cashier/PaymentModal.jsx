import React, { useState } from "react";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import {
  FiX,
  FiCheckCircle,
  FiDollarSign,
  FiUser,
  FiPhone,
  FiTag,
  FiMessageSquare,
  FiAlertCircle,
} from "react-icons/fi";
import { MdPayment } from "react-icons/md";
import { toast } from "react-hot-toast";

const PAYMENT_METHODS = [
  { value: "Cash", icon: "💵", label: "Cash" },
  { value: "EasyPaisa", icon: "📱", label: "EasyPaisa" },
  { value: "Bank Transfer", icon: "🏦", label: "Bank Transfer" },
];

const PaymentModal = ({ order, isDark, userData, storeData, onClose }) => {
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [discount, setDiscount] = useState(order.billDiscount || 0);
  const [discountReason, setDiscountReason] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [customerName, setCustomerName] = useState(
    order.customer?.name || "Walking Customer"
  );
  const [customerPhone, setCustomerPhone] = useState(
    order.customer?.phone || ""
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const subtotal = order.subtotal || order.totalAmount || 0;
  const finalAmount = Math.max(0, subtotal - Number(discount));
  const changeGiven =
    amountReceived !== ""
      ? Math.max(0, Number(amountReceived) - finalAmount)
      : 0;

  const handleSubmit = async () => {
    if (discount > 0 && !discountReason.trim()) {
      toast.error("Please provide a reason for the discount");
      return;
    }
    if (
      paymentMethod === "Cash" &&
      amountReceived !== "" &&
      Number(amountReceived) < finalAmount
    ) {
      toast.error("Amount received is less than total amount");
      return;
    }

    setLoading(true);
    try {
      const orderRef = doc(db, "orders", order.id);
      const updateData = {
        status: "paid",
        paymentType: paymentMethod,
        billDiscount: Number(discount),
        discountReason: discountReason || "",
        totalAmount: finalAmount,
        amountReceived: Number(amountReceived) || finalAmount,
        changeGiven: changeGiven,
        notes: notes,
        paidAt: serverTimestamp(),
        "customer.name": customerName,
        "customer.phone": customerPhone,
        paidBy: userData?.uid || userData?.id || "unknown",
        billerName: userData?.displayName || userData?.name || "Cashier",
      };

      await updateDoc(orderRef, updateData);

      // Audit Log
      await addDoc(collection(db, "auditLogs"), {
        action: "PAYMENT_RECEIVED",
        orderId: order.id,
        billSerial: order.billSerial || order.serialNo,
        userId: userData?.uid || "",
        userName: userData?.displayName || userData?.name || "Cashier",
        role: userData?.role || "cashier",
        storeId: userData?.storeId || "",
        storeName: storeData?.name || "",
        before: {
          status: order.status,
          totalAmount: order.totalAmount,
          billDiscount: order.billDiscount,
        },
        after: {
          status: "paid",
          totalAmount: finalAmount,
          billDiscount: Number(discount),
          paymentType: paymentMethod,
        },
        timestamp: serverTimestamp(),
      });

      toast.success("Payment received successfully! ✅");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to process payment");
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
  const labelText = isDark ? "text-gray-300" : "text-gray-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md ${cardBg} rounded-2xl border ${border} shadow-2xl overflow-hidden`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${border}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <MdPayment className="text-emerald-500 w-5 h-5" />
            </div>
            <div>
              <h2 className={`font-bold text-base ${text}`}>
                Receive Payment
              </h2>
              <p className={`text-xs ${subText}`}>
                Bill #{order.billSerial || order.serialNo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg hover:bg-red-500/10 ${subText} hover:text-red-500 transition-colors`}
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Amount Summary */}
          <div
            className={`rounded-xl p-4 ${
              isDark ? "bg-amber-900/20 border border-amber-800" : "bg-amber-50 border border-amber-200"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className={`text-sm ${subText}`}>Subtotal</span>
              <span className={`font-semibold ${text}`}>
                Rs. {subtotal.toLocaleString()}
              </span>
            </div>
            {Number(discount) > 0 && (
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm text-green-500">Discount</span>
                <span className="font-semibold text-green-500">
                  - Rs. {Number(discount).toLocaleString()}
                </span>
              </div>
            )}
            <div
              className={`flex justify-between items-center mt-2 pt-2 border-t ${border}`}
            >
              <span className={`font-bold ${text}`}>Total Amount</span>
              <span className="font-bold text-xl text-amber-500">
                Rs. {finalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-medium ${labelText} mb-1.5`}>
                <FiUser className="inline w-3 h-3 mr-1 text-amber-500" />
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} focus:outline-none focus:border-amber-500`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium ${labelText} mb-1.5`}>
                <FiPhone className="inline w-3 h-3 mr-1 text-amber-500" />
                Phone Number
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="03XX-XXXXXXX"
                className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} focus:outline-none focus:border-amber-500`}
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className={`block text-xs font-medium ${labelText} mb-2`}>
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  onClick={() => setPaymentMethod(method.value)}
                  className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-medium transition-all ${
                    paymentMethod === method.value
                      ? "border-amber-500 bg-amber-500/20 text-amber-500"
                      : `${border} ${subText} hover:border-amber-400`
                  }`}
                >
                  <span className="text-base">{method.icon}</span>
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Received (Cash only) */}
          {paymentMethod === "Cash" && (
            <div>
              <label className={`block text-xs font-medium ${labelText} mb-1.5`}>
                <FiDollarSign className="inline w-3 h-3 mr-1 text-amber-500" />
                Amount Received (Rs.)
              </label>
              <input
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder={finalAmount.toString()}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} focus:outline-none focus:border-amber-500`}
              />
              {amountReceived !== "" && changeGiven > 0 && (
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className={subText}>Change to return:</span>
                  <span className="font-bold text-emerald-500">
                    Rs. {changeGiven.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Discount */}
          <div>
            <label className={`block text-xs font-medium ${labelText} mb-1.5`}>
              <FiTag className="inline w-3 h-3 mr-1 text-amber-500" />
              Discount (Rs.)
            </label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              min={0}
              max={subtotal}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} focus:outline-none focus:border-amber-500`}
            />
          </div>

          {/* Discount Reason (required if discount > 0) */}
          {Number(discount) > 0 && (
            <div>
              <label className={`block text-xs font-medium ${labelText} mb-1.5`}>
                <FiAlertCircle className="inline w-3 h-3 mr-1 text-red-500" />
                Discount Reason{" "}
                <span className="text-red-500">*Required</span>
              </label>
              <input
                type="text"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="Enter reason for discount..."
                className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} focus:outline-none focus:border-amber-500 ${
                  !discountReason.trim() ? "border-red-500" : ""
                }`}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={`block text-xs font-medium ${labelText} mb-1.5`}>
              <FiMessageSquare className="inline w-3 h-3 mr-1 text-amber-500" />
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Add any notes..."
              className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} focus:outline-none focus:border-amber-500 resize-none`}
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div
          className={`px-5 py-4 border-t ${border} flex items-center gap-3`}
        >
          <button
            onClick={onClose}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl border ${border} text-sm font-medium ${subText} hover:border-red-400 hover:text-red-500 transition-all`}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <FiCheckCircle className="w-4 h-4" />
            )}
            {loading ? "Processing..." : "Confirm Payment"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;