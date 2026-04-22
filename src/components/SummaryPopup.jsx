// src/components/SummaryPopup.jsx
import { useEffect } from "react";
import { motion } from "framer-motion";
import { X, FileText, ChevronRight } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const SummaryPopup = ({
  isOpen,
  items,
  totalQty,
  totalDiscount,
  subtotal,
  billDiscount,
  billDiscountType,
  setBillDiscount,
  setBillDiscountType,
  grandTotal,
  billSerial,
  customer,
  onProceed,
  onClose,
}) => {
  const { isDark } = useTheme();

  // ✅ FIX: F8 listener NAHI hai yahan
  // BillerDashboard ka handleF8Key (f8Step=2) handle karega
  // Sirf ESC yahan handle hoga
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
      // ✅ F8 deliberately missing — Dashboard handle karega
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1,   opacity: 1 }}
        exit={  { scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
          isDark
            ? "bg-[#15120d] border border-yellow-500/20"
            : "bg-white border border-yellow-200"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"
        }`}>
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-yellow-500" />
            <h2 className={`font-bold text-base ${isDark ? "text-white" : "text-gray-900"}`}>
              Bill Summary
            </h2>
            <span className={`text-[9px] px-2 py-0.5 rounded font-mono ${
              isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"
            }`}>
              #{billSerial}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-1 rounded font-semibold ${
              isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"
            }`}>
              F8 = Proceed
            </span>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/10">
              <X size={16} className={isDark ? "text-gray-400" : "text-gray-600"} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* Customer */}
          <div className={`rounded-xl border p-3 ${
            isDark ? "border-yellow-500/10 bg-black/20" : "border-gray-200 bg-gray-50"
          }`}>
            <p className="text-[10px] uppercase tracking-wide mb-1 text-gray-500">Customer</p>
            <p className={`font-semibold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
              {customer?.name || "Walking Customer"}
            </p>
            {customer?.phone && (
              <p className="text-xs text-gray-500 mt-0.5">{customer.phone}</p>
            )}
            {customer?.city && (
              <p className="text-xs text-gray-400 mt-0.5">
                {customer.city}{customer.market ? ` • ${customer.market}` : ""}
              </p>
            )}
          </div>

          {/* Items */}
          <div>
            <p className="text-[10px] uppercase tracking-wide mb-2 text-gray-500">
              Items ({items.length}) • Qty: {totalQty}
            </p>
            <div className={`rounded-xl border divide-y max-h-36 overflow-y-auto ${
              isDark
                ? "border-yellow-500/10 divide-yellow-500/10"
                : "border-gray-200 divide-gray-100"
            }`}>
              {items.map((item, idx) => {
                const discountPerUnit = item.discountType === "percent"
                  ? Math.round((item.price * item.discount) / 100)
                  : item.discount;
                const lineTotal = (item.price - discountPerUnit) * item.qty;
                const hasDisc   = discountPerUnit > 0;

                return (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`font-mono text-[10px] flex-shrink-0 ${
                        isDark ? "text-yellow-500/60" : "text-yellow-600/60"
                      }`}>
                        {idx + 1}
                      </span>
                      <span className={`truncate ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                        {item.productName || item.serialId}
                      </span>
                      <span className={isDark ? "text-gray-500" : "text-gray-400"}>
                        ×{item.qty}
                      </span>
                      {hasDisc && (
                        <span className="text-red-400 text-[9px]">
                          -{discountPerUnit * item.qty}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-yellow-500 flex-shrink-0 ml-2">
                      Rs.{lineTotal.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals Box */}
          <div className={`rounded-xl border p-4 space-y-3 ${
            isDark ? "border-yellow-500/20 bg-yellow-500/5" : "border-yellow-200 bg-yellow-50"
          }`}>
            {/* Subtotal */}
            <div className="flex justify-between text-sm">
              <span className={isDark ? "text-gray-400" : "text-gray-500"}>Subtotal</span>
              <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                Rs.{subtotal.toLocaleString()}
              </span>
            </div>

            {/* Item Discounts */}
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className={isDark ? "text-gray-400" : "text-gray-500"}>Item Discounts</span>
                <span className="font-semibold text-red-400">
                  −Rs.{totalDiscount.toLocaleString()}
                </span>
              </div>
            )}

            {/* Bill Discount — editable */}
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Bill Discount
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={billDiscount === 0 ? "" : billDiscount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") { setBillDiscount(0); return; }
                    if (/^\d*\.?\d*$/.test(val)) setBillDiscount(val);
                  }}
                  // ✅ Input mein F8 press → onProceed directly
                  onKeyDown={(e) => {
                    if (e.key === "F8") {
                      e.preventDefault();
                      e.stopPropagation();
                      onProceed();
                    }
                  }}
                  placeholder="0"
                  className={`w-20 rounded-lg border px-2 py-1.5 text-sm text-right font-semibold outline-none ${
                    isDark
                      ? "bg-black/30 border-yellow-500/30 text-white focus:border-yellow-500"
                      : "bg-white border-yellow-300 focus:border-yellow-500"
                  }`}
                />
                <button
                  onClick={() => setBillDiscountType((t) => t === "fixed" ? "percent" : "fixed")}
                  className={`px-2 py-1.5 text-xs font-bold rounded-lg ${
                    isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {billDiscountType === "percent" ? "%" : "Rs"}
                </button>
              </div>
            </div>

            <div className={`h-px ${isDark ? "bg-yellow-500/20" : "bg-yellow-300"}`} />

            {/* Grand Total */}
            <div className="flex justify-between items-center">
              <span className={`font-bold text-base ${isDark ? "text-white" : "text-gray-900"}`}>
                Grand Total
              </span>
              <span className="text-2xl font-extrabold text-yellow-500">
                Rs.{grandTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-5 py-4 border-t ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"
        }`}>
          <button
            onClick={onClose}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              isDark ? "text-gray-400 hover:text-yellow-400" : "text-gray-500 hover:text-yellow-600"
            }`}
          >
            ← Back (ESC)
          </button>
          <button
            onClick={onProceed}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-6 py-2.5 text-sm font-bold text-black hover:from-yellow-400 hover:to-amber-400 transition"
          >
            Print & Submit (F8)
            <ChevronRight size={16} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SummaryPopup;