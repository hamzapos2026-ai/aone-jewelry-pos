// src/components/cashier/ViewBillModal.jsx
// ✅ NO "Item - xxx" text, items in toggle, no paid box, glass UI

import React, { useState, useEffect, useMemo } from "react";
import {
  X, Edit3, CheckCircle, XCircle, User,
  Phone, ChevronDown, MapPin, Package, Receipt, Store,
} from "lucide-react";

const ViewBillModal = ({
  order, isDark, userData, storeData,
  onClose, onPayment, onEdit, onCancel,
}) => {
  const [showItems, setShowItems] = useState(false);
  const isPending = order.status === "pending";
  const isPaid = order.status === "paid";

  const cardBg = isDark ? "bg-[#1a1208]" : "bg-white";
  const border = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text = isDark ? "text-gray-100" : "text-gray-900";
  const subText = isDark ? "text-gray-400" : "text-gray-500";
  const glassBg = isDark
    ? "bg-white/5 backdrop-blur-xl border-white/10"
    : "bg-white/60 backdrop-blur-xl border-gray-200/50";
  const glassHover = isDark ? "hover:bg-white/10" : "hover:bg-white/80";

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const formatDate = (ts) => {
    if (!ts) return "N/A";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString("en-PK");
    } catch { return "N/A"; }
  };

  // Deduplicate items
  const uniqueItems = useMemo(() => {
    const seen = new Set();
    return (order.items || []).filter(item => {
      const key = `${item.productName}__${item.serialId}__${item.price}__${item.qty}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [order.items]);

  // Glass toggle component
  const GlassToggle = ({ open, toggle, icon, label, badge }) => (
    <button onClick={toggle}
      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border
        transition-all duration-200 ${glassBg} ${glassHover}
        ${open ? "ring-1 ring-amber-500/30 border-amber-500/20" : ""}`}>
      <span className="flex items-center gap-2.5">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center
          ${open
            ? "bg-amber-500 text-white"
            : isDark ? "bg-white/10 text-amber-400" : "bg-amber-50 text-amber-600"
          }`}>
          {icon}
        </span>
        <span className={`text-sm font-bold ${text}`}>{label}</span>
        {badge && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
            ${isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"}`}>
            {badge}
          </span>
        )}
      </span>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center
        transition-transform duration-200 ${open ? "rotate-180" : ""}
        ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
        <ChevronDown className={`w-3.5 h-3.5 ${subText}`} />
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full max-w-lg ${cardBg} rounded-2xl border ${border}
          shadow-2xl backdrop-blur-xl`}
        style={{ maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border}
          sticky top-0 ${cardBg} z-10 backdrop-blur-xl`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-500
              rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Receipt className="text-white w-5 h-5" />
            </div>
            <div>
              <h2 className={`font-bold text-base ${text}`}>Bill Details</h2>
              <p className={`text-xs ${subText}`}>
                #{order.billSerial || order.serialNo}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPending && (
              <button onClick={() => onEdit?.(order)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                  bg-amber-500/20 text-amber-500 text-xs font-medium
                  hover:bg-amber-500/30 transition-all">
                <Edit3 className="w-3.5 h-3.5" />Edit
              </button>
            )}
            <button onClick={onClose}
              className={`p-1.5 rounded-lg hover:bg-red-500/10 ${subText}
                hover:text-red-500 transition-colors`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {/* Store + Bill Info */}
          <div className={`rounded-xl p-4 border ${glassBg}`}>
            <div className="flex items-center gap-2 mb-3">
              <Store className="text-amber-500 w-4 h-4" />
              <span className={`font-semibold text-sm ${text}`}>
                {storeData?.name || "Store"}
              </span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${
                isPaid ? "bg-emerald-500/20 text-emerald-500"
                : isPending ? "bg-amber-500/20 text-amber-500"
                : "bg-red-500/20 text-red-500"
              }`}>
                {order.status?.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className={subText}>Bill #</p>
                <p className={`font-semibold ${text}`}>#{order.billSerial || order.serialNo}</p>
              </div>
              <div>
                <p className={subText}>Created</p>
                <p className={`font-semibold ${text}`}>{formatDate(order.createdAt)}</p>
              </div>
              <div>
                <p className={subText}>Biller</p>
                <p className={`font-semibold ${text}`}>{order.billerName || "N/A"}</p>
              </div>
              <div>
                <p className={subText}>Payment</p>
                <p className={`font-semibold ${text}`}>{order.paymentType || "Cash"}</p>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className={`rounded-xl p-4 border ${glassBg}`}>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-amber-500" />
              <span className={`text-xs font-bold uppercase tracking-wide ${subText}`}>Customer</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className={text}>{order.customer?.name || "Walking Customer"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className={text}>{order.customer?.phone || "—"}</span>
              </div>
              {order.customer?.market && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span className={text}>{order.customer.market}</span>
                </div>
              )}
              {order.customer?.city && (
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${subText}`}>City:</span>
                  <span className={text}>{order.customer.city}</span>
                </div>
              )}
            </div>
          </div>

          {/* ✅ Items Toggle — NO "Item - ITEM-xxx" text, glass UI */}
          <div>
            <GlassToggle
              open={showItems}
              toggle={() => setShowItems(v => !v)}
              icon={<Package className="w-3.5 h-3.5" />}
              label="Items"
              badge={`${uniqueItems.length}`}
            />
            {showItems && (
              <div className={`mt-2 rounded-xl border overflow-hidden ${glassBg}`}>
                {uniqueItems.map((item, idx) => (
                  <div key={`${item.serialId || ""}_${idx}`}
                    className={`flex items-center justify-between px-4 py-3 text-sm
                      border-b last:border-b-0 ${isDark ? "border-white/5" : "border-gray-100"}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold ${text} truncate`}>{item.productName}</p>
                      {item.serialId && (
                        <p className={`text-[10px] ${subText} mt-0.5`}># {item.serialId}</p>
                      )}
                      <p className={`text-[10px] ${subText}`}>
                        Rs.{item.price} × {item.qty}
                      </p>
                    </div>
                    <span className="font-bold text-amber-500 ml-3">
                      Rs.{(item.total || item.qty * item.price || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Amount Summary */}
          <div className={`rounded-xl p-4 border ${glassBg} space-y-1.5`}>
            <div className="flex justify-between text-sm">
              <span className={subText}>Subtotal</span>
              <span className={text}>Rs.{(order.subtotal || 0).toLocaleString()}</span>
            </div>
            {(order.billDiscount || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className={subText}>Discount</span>
                <span className="text-green-500">-Rs.{order.billDiscount.toLocaleString()}</span>
              </div>
            )}
            <div className={`flex justify-between text-base font-bold pt-2 border-t
              ${isDark ? "border-white/10" : "border-gray-200"}`}>
              <span className={text}>Total</span>
              <span className="text-amber-500">Rs.{(order.totalAmount || 0).toLocaleString()}</span>
            </div>
            {isPaid && order.paidAt && (
              <div className="flex justify-between text-xs pt-1">
                <span className={subText}>Paid at</span>
                <span className="text-emerald-500 font-medium">{formatDate(order.paidAt)}</span>
              </div>
            )}
          </div>

          {order.lastEditedBy && (
            <div className={`text-xs ${subText} flex items-center gap-1`}>
              <Edit3 className="w-3 h-3" />
              Edited by <span className="font-medium text-amber-500">{order.lastEditedBy}</span>
            </div>
          )}
        </div>

        {/* Footer — NO paid checkbox */}
        <div className={`px-5 py-4 border-t ${border} sticky bottom-0 ${cardBg} backdrop-blur-xl`}>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl border ${border} text-sm font-medium
                ${subText} transition-all hover:border-gray-400`}>
              Close
            </button>
            {isPending && (
              <>
                <button onClick={() => onPayment(order)}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600
                    text-white text-sm font-bold flex items-center justify-center gap-1.5
                    shadow-lg shadow-emerald-500/20 active:scale-95">
                  <CheckCircle className="w-4 h-4" />Pay Now
                </button>
                <button onClick={() => onCancel?.(order)}
                  className="py-2.5 px-3 rounded-xl bg-red-500/10 border border-red-500/30
                    text-red-500 hover:bg-red-500/20 transition-all active:scale-95">
                  <XCircle className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewBillModal;