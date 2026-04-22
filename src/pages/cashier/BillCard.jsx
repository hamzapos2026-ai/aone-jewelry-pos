import React, { useState } from "react";
import {
  FiUser,
  FiPhone,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiEye,
  FiTag,
  FiChevronDown,
  FiChevronUp,
  FiAlertCircle,
  FiEdit3,
} from "react-icons/fi";
import { MdPayment } from "react-icons/md";

const BillCard = ({
  order,
  isDark,
  onPayment,
  onView,
  onCancel,
}) => {
  const [expanded, setExpanded] = useState(false);

  const isPaid = order.status === "paid";
  const isPending = order.status === "pending";
  const isCancelled = order.status === "cancelled";

  // Theme classes - KHUD DEFINE
  const cardBg = isDark ? "bg-[#1a1208]" : "bg-white";
  const border = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text = isDark ? "text-gray-100" : "text-gray-900";
  const subText = isDark ? "text-gray-400" : "text-gray-500";
  const rowBg = isDark ? "bg-[#0f0a04]" : "bg-gray-50";

  // ✅ KHUD DEFINE - Props se nahi aayega
  const getStatusStyle = (status) => {
    switch (status) {
      case "paid":
        return isDark
          ? "bg-emerald-900/30 text-emerald-400 border-emerald-700"
          : "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "pending":
        return isDark
          ? "bg-amber-900/30 text-amber-400 border-amber-700"
          : "bg-amber-50 text-amber-700 border-amber-200";
      case "cancelled":
        return isDark
          ? "bg-red-900/30 text-red-400 border-red-700"
          : "bg-red-50 text-red-700 border-red-200";
      default:
        return isDark
          ? "bg-gray-800 text-gray-400 border-gray-700"
          : "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  // ✅ KHUD DEFINE - Props se nahi aayega
  const getStatusIcon = (status) => {
    switch (status) {
      case "paid":
        return <FiCheckCircle className="w-3.5 h-3.5" />;
      case "pending":
        return <FiClock className="w-3.5 h-3.5" />;
      case "cancelled":
        return <FiXCircle className="w-3.5 h-3.5" />;
      default:
        return <FiAlertCircle className="w-3.5 h-3.5" />;
    }
  };

  const formatOrderDate = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  return (
    <div
      className={`${cardBg} border ${border} rounded-2xl overflow-hidden transition-all 
        hover:border-amber-500/50 hover:shadow-lg ${
          isDark ? "hover:shadow-amber-900/20" : "hover:shadow-amber-500/10"
        }`}
    >
      {/* ========== CARD HEADER ========== */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left Side */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isPaid
                  ? "bg-emerald-500/20"
                  : isPending
                  ? "bg-amber-500/20"
                  : "bg-red-500/20"
              }`}
            >
              <MdPayment
                className={`w-5 h-5 ${
                  isPaid
                    ? "text-emerald-500"
                    : isPending
                    ? "text-amber-500"
                    : "text-red-500"
                }`}
              />
            </div>

            <div className="flex-1 min-w-0">
              {/* Bill Number + Status */}
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-bold text-base ${text}`}>
                  #{order.billSerial || order.serialNo || order.id?.slice(0, 8)}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full 
                    text-xs font-medium border ${getStatusStyle(order.status)}`}
                >
                  {getStatusIcon(order.status)}
                  {order.status?.toUpperCase()}
                </span>
              </div>

              {/* Customer Info */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className={`flex items-center gap-1 text-xs ${subText}`}>
                  <FiUser className="w-3 h-3 text-amber-500" />
                  {order.customer?.name || "Walking Customer"}
                </span>
                {order.customer?.phone && (
                  <span className={`flex items-center gap-1 text-xs ${subText}`}>
                    <FiPhone className="w-3 h-3 text-amber-500" />
                    {order.customer.phone}
                  </span>
                )}
                <span className={`flex items-center gap-1 text-xs ${subText}`}>
                  <FiClock className="w-3 h-3 text-amber-500" />
                  {formatOrderDate(order.createdAt)}
                </span>
              </div>

              {/* Cashier */}
              {order.billerName && (
                <p className={`text-xs ${subText} mt-1`}>
                  Cashier:{" "}
                  <span className="font-medium text-amber-500">
                    {order.billerName}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Right - Amount */}
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-bold text-amber-500">
              Rs. {(order.totalAmount || 0).toLocaleString()}
            </p>
            {order.billDiscount > 0 && (
              <p className={`text-xs ${subText} line-through`}>
                Rs. {(order.subtotal || 0).toLocaleString()}
              </p>
            )}
            <p className={`text-xs ${subText} mt-0.5`}>
              {order.items?.length || 0} items · Qty: {order.totalQty || 0}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {order.paymentType && (
            <span className={`text-xs px-2 py-1 rounded-lg ${
              isDark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-600"
            }`}>
              💳 {order.paymentType}
            </span>
          )}
          {order.billDiscount > 0 && (
            <span className={`text-xs px-2 py-1 rounded-lg ${
              isDark ? "bg-green-900/30 text-green-400" : "bg-green-50 text-green-700"
            }`}>
              🏷️ Discount: Rs. {order.billDiscount}
            </span>
          )}
          {order.lastEditedBy && (
            <span className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${
              isDark ? "bg-purple-900/30 text-purple-400" : "bg-purple-50 text-purple-700"
            }`}>
              <FiEdit3 className="w-3 h-3" />
              Edited
            </span>
          )}
        </div>

        {/* Expand Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-1 mt-3 text-xs ${subText} hover:text-amber-500 transition-colors`}
        >
          {expanded ? <FiChevronUp className="w-3.5 h-3.5" /> : <FiChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Hide" : "Show"} items ({order.items?.length || 0})
        </button>

        {/* Expanded Items */}
        {expanded && (
          <div className="mt-3 space-y-1.5">
            {order.items?.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between text-xs py-2 px-3 rounded-lg ${rowBg}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FiTag className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  <span className={`${text} truncate`}>{item.productName}</span>
                  <span className={subText}>#{item.serialId}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={subText}>x{item.qty}</span>
                  <span className="font-semibold text-amber-500">
                    Rs. {item.total}
                  </span>
                </div>
              </div>
            ))}

            {/* Summary */}
            <div className={`mt-2 pt-2 border-t ${border} space-y-1`}>
              <div className="flex items-center justify-between text-xs py-1 px-3">
                <span className={subText}>Subtotal</span>
                <span className={text}>Rs. {order.subtotal || 0}</span>
              </div>
              {order.billDiscount > 0 && (
                <div className="flex items-center justify-between text-xs py-1 px-3">
                  <span className="text-green-500">Discount</span>
                  <span className="text-green-500">- Rs. {order.billDiscount}</span>
                </div>
              )}
              <div className={`flex items-center justify-between text-xs py-2 px-3 rounded-lg ${
                isDark ? "bg-amber-900/20" : "bg-amber-50"
              }`}>
                <span className={`font-bold ${text}`}>Total</span>
                <span className="font-bold text-amber-500">
                  Rs. {order.totalAmount || 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========== ACTION BUTTONS ========== */}
      <div className={`px-4 py-3 border-t ${border} flex items-center gap-2 flex-wrap ${
        isDark ? "bg-[#0f0a04]/50" : "bg-gray-50/50"
      }`}>
        {/* View */}
        <button
          onClick={() => onView(order)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium 
            border ${border} transition-all active:scale-95 ${
            isDark
              ? "text-gray-300 hover:border-amber-600 hover:text-amber-400"
              : "text-gray-600 hover:border-amber-400 hover:text-amber-600"
          }`}
        >
          <FiEye className="w-3.5 h-3.5" />
          View Bill
        </button>

        {/* Payment - Only Pending */}
        {isPending && (
          <button
            onClick={() => onPayment(order)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium 
              bg-emerald-500 hover:bg-emerald-600 text-white transition-all 
              shadow-md shadow-emerald-500/20 active:scale-95"
          >
            <FiCheckCircle className="w-3.5 h-3.5" />
            Receive Payment
          </button>
        )}

        {/* Cancel - Only Pending */}
        {isPending && (
          <button
            onClick={() => onCancel(order)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium 
              bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 
              transition-all active:scale-95"
          >
            <FiXCircle className="w-3.5 h-3.5" />
            Cancel
          </button>
        )}

        {/* Paid Info */}
        {isPaid && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium ml-auto">
            <FiCheckCircle className="w-3.5 h-3.5" />
            Paid via {order.paymentType || "Cash"}
          </span>
        )}

        {/* Cancelled Info */}
        {isCancelled && (
          <span className={`text-xs ${subText} italic flex items-center gap-1 ml-auto`}>
            <FiXCircle className="w-3 h-3 text-red-400" />
            {order.cancelReason || "Cancelled"}
          </span>
        )}
      </div>
    </div>
  );
};

export default BillCard;