// src/components/cashier/BillCard.jsx
import React, { useState, useCallback, memo } from "react";
import {
  User, Phone, Clock, CheckCircle, XCircle,
  Eye, Tag, ChevronDown, ChevronUp,
  AlertCircle, Edit3, Zap, CreditCard,
} from "lucide-react";

const BillCard = memo(({
  order,
  isDark,
  onPayment,
  onView,
  onCancel,
  onEdit,
}) => {
  const [expanded, setExpanded] = useState(false);

  const isPaid = order.status === "paid";
  const isPending = order.status === "pending";
  const isCancelled = order.status === "cancelled";

  const cardBg = isDark ? "bg-[#1a1208]" : "bg-white";
  const border = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text = isDark ? "text-gray-100" : "text-gray-900";
  const subText = isDark ? "text-gray-400" : "text-gray-500";
  const rowBg = isDark ? "bg-[#0f0a04]" : "bg-gray-50";

  const getStatusStyle = useCallback(
    (status) => {
      const map = {
        paid: isDark
          ? "bg-emerald-900/30 text-emerald-400 border-emerald-700"
          : "bg-emerald-50 text-emerald-700 border-emerald-200",
        pending: isDark
          ? "bg-amber-900/30 text-amber-400 border-amber-700"
          : "bg-amber-50 text-amber-700 border-amber-200",
        cancelled: isDark
          ? "bg-red-900/30 text-red-400 border-red-700"
          : "bg-red-50 text-red-700 border-red-200",
      };
      return (
        map[status] ||
        (isDark
          ? "bg-gray-800 text-gray-400 border-gray-700"
          : "bg-gray-50 text-gray-600 border-gray-200")
      );
    },
    [isDark]
  );

  const getStatusIcon = useCallback((status) => {
    const map = {
      paid: <FiCheckCircle className="w-3.5 h-3.5" />,
      pending: <FiClock className="w-3.5 h-3.5" />,
      cancelled: <XCircle className="w-3.5 h-3.5" />,
    };
    return map[status] || <FiAlertCircle className="w-3.5 h-3.5" />;
  }, []);

  const formatOrderDate = useCallback((timestamp) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  }, []);

  const toggleExpand = useCallback(() => setExpanded((p) => !p), []);
  const handleView = useCallback(() => onView(order), [onView, order]);
  const handlePayment = useCallback(() => onPayment(order), [onPayment, order]);
  const handleCancel = useCallback(() => onCancel(order), [onCancel, order]);
  const handleEdit = useCallback(() => onEdit?.(order), [onEdit, order]);

  return (
    <div
      className={`${cardBg} border ${border} rounded-2xl overflow-hidden transition-all 
        hover:border-amber-500/50 hover:shadow-lg ${
          isDark ? "hover:shadow-amber-900/20" : "hover:shadow-amber-500/10"
        }`}
    >
      {/* PAID indicator bar */}
      {isPaid && (
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-green-400" />
      )}
      {isPending && (
        <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
      )}
      {isCancelled && (
        <div className="h-1 bg-gradient-to-r from-red-500 to-red-400" />
      )}

      {/* CARD HEADER */}
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
              <CreditCard
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
                {isPaid && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white">
                    <FiCheckCircle className="w-3 h-3" />
                    PAID
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className={`flex items-center gap-1 text-xs ${subText}`}>
                  <User className="w-3 h-3 text-amber-500" />
                  {order.customer?.name || "Walking Customer"}
                </span>
                {order.customer?.phone && (
                  <span className={`flex items-center gap-1 text-xs ${subText}`}>
                    <Phone className="w-3 h-3 text-amber-500" />
                    {order.customer.phone}
                  </span>
                )}
                <span className={`flex items-center gap-1 text-xs ${subText}`}>
                  <FiClock className="w-3 h-3 text-amber-500" />
                  {formatOrderDate(order.createdAt)}
                </span>
              </div>

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
            <span
              className={`text-xs px-2 py-1 rounded-lg ${
                isDark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-600"
              }`}
            >
              💳 {order.paymentType}
            </span>
          )}
          {order.billDiscount > 0 && (
            <span
              className={`text-xs px-2 py-1 rounded-lg ${
                isDark ? "bg-green-900/30 text-green-400" : "bg-green-50 text-green-700"
              }`}
            >
              🏷️ Discount: Rs. {order.billDiscount}
            </span>
          )}
          {order.lastEditedBy && (
            <span
              className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${
                isDark ? "bg-purple-900/30 text-purple-400" : "bg-purple-50 text-purple-700"
              }`}
            >
              <FiEdit3 className="w-3 h-3" />
              Edited by {order.lastEditedBy}
            </span>
          )}
        </div>

        {/* Expand Toggle */}
        <button
          onClick={toggleExpand}
          className={`flex items-center gap-1 mt-3 text-xs ${subText} hover:text-amber-500 transition-colors`}
        >
          {expanded ? (
            <FiChevronUp className="w-3.5 h-3.5" />
          ) : (
            <FiChevronDown className="w-3.5 h-3.5" />
          )}
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
                  {item.serialId && (
                    <span className={subText}>#{item.serialId}</span>
                  )}
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
              <div
                className={`flex items-center justify-between text-xs py-2 px-3 rounded-lg ${
                  isDark ? "bg-amber-900/20" : "bg-amber-50"
                }`}
              >
                <span className={`font-bold ${text}`}>Total</span>
                <span className="font-bold text-amber-500">
                  Rs. {order.totalAmount || 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div
        className={`px-4 py-3 border-t ${border} flex items-center gap-2 flex-wrap ${
          isDark ? "bg-[#0f0a04]/50" : "bg-gray-50/50"
        }`}
      >
        {/* View */}
        <button
          onClick={handleView}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium 
            border ${border} transition-all active:scale-95 ${
            isDark
              ? "text-gray-300 hover:border-amber-600 hover:text-amber-400"
              : "text-gray-600 hover:border-amber-400 hover:text-amber-600"
          }`}
        >
          <FiEye className="w-3.5 h-3.5" />
          View
        </button>

        {/* Edit - Only Pending */}
        {isPending && (
          <button
            onClick={handleEdit}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium 
              border transition-all active:scale-95 ${
              isDark
                ? "border-amber-700 text-amber-400 hover:bg-amber-900/30"
                : "border-amber-300 text-amber-600 hover:bg-amber-50"
            }`}
          >
            <FiEdit3 className="w-3.5 h-3.5" />
            Edit
          </button>
        )}

        {/* Payment - Only Pending */}
        {isPending && (
          <button
            onClick={handlePayment}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium 
              bg-emerald-500 hover:bg-emerald-600 text-white transition-all 
              shadow-md shadow-emerald-500/20 active:scale-95"
          >
            <FiZap className="w-3.5 h-3.5" />
            Pay Now
          </button>
        )}

        {/* Cancel - Only Pending */}
        {isPending && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium 
              bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 
              transition-all active:scale-95"
          >
            <XCircle className="w-3.5 h-3.5" />
            Cancel
          </button>
        )}

        {/* Paid Info */}
        {isPaid && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-bold ml-auto">
            <FiCheckCircle className="w-3.5 h-3.5" />
            Paid via {order.paymentType || "Cash"}
            {order.paidAt && (
              <span className={`text-xs ${subText} font-normal`}>
                · {new Date(
                    order.paidAt?.toDate?.() || order.paidAt
                  ).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
              </span>
            )}
          </span>
        )}

        {/* Cancelled Info */}
        {isCancelled && (
          <span
            className={`text-xs ${subText} italic flex items-center gap-1 ml-auto`}
          >
            <XCircle className="w-3 h-3 text-red-400" />
            {order.cancelReason || "Cancelled"}
          </span>
        )}
      </div>
    </div>
  );
});

BillCard.displayName = "BillCard";
export default BillCard;