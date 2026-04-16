// src/components/SummaryPopup.jsx
import { useEffect } from "react";
import { motion } from "framer-motion";
import { X, FileText, ShoppingBag } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const SummaryPopup = ({
  isOpen, items, totalQty, totalDiscount, grandTotal,
  billSerial, customer, onProceed, onClose,
}) => {
  const { isDark } = useTheme();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "F8") {
        e.preventDefault();
        e.stopPropagation();
        onProceed();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isOpen, onProceed]);

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
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
          isDark ? "bg-[#15120d] border border-yellow-500/20" : "bg-white border border-yellow-200"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-yellow-500" />
            <h2 className={`font-bold text-base ${isDark ? "text-white" : "text-gray-900"}`}>
              Bill Summary
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-1 rounded ${isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"}`}>
              F8 = Proceed
            </span>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/10">
              <X size={16} className={isDark ? "text-gray-400" : "text-gray-600"} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Bill Info */}
          <div className={`rounded-xl border p-3 ${isDark ? "border-yellow-500/20 bg-yellow-500/5" : "border-yellow-200 bg-yellow-50/50"}`}>
            <p className={`text-[10px] uppercase tracking-wide ${isDark ? "text-gray-500" : "text-gray-500"}`}>Bill Serial</p>
            <p className="text-lg font-bold text-yellow-500">{billSerial}</p>
          </div>

          {/* Customer */}
          <div className={`rounded-xl border p-3 ${isDark ? "border-yellow-500/10 bg-black/20" : "border-gray-200 bg-gray-50"}`}>
            <p className={`text-[10px] uppercase tracking-wide mb-1 ${isDark ? "text-gray-500" : "text-gray-500"}`}>Customer</p>
            <p className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`}>{customer?.name || "Walking Customer"}</p>
            {customer?.phone && <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>{customer.phone}</p>}
            {(customer?.city || customer?.market) && (
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                {[customer.city, customer.market].filter(Boolean).join(" • ")}
              </p>
            )}
          </div>

          {/* Items Preview */}
          <div>
            <p className={`text-[10px] uppercase tracking-wide mb-2 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
              Items ({items.length})
            </p>
            <div className={`rounded-xl border divide-y max-h-32 overflow-y-auto ${isDark ? "border-yellow-500/10 divide-yellow-500/10" : "border-gray-200 divide-gray-100"}`}>
              {items.map((item, i) => {
                const hasDisc = Number(item.discount) > 0;
                const lineTotal = item.price * item.qty - item.discount * item.qty;
                return (
                  <div key={item.id} className={`flex items-center justify-between px-3 py-2 text-xs ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold ${isDark ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-700"}`}>
                        {i + 1}
                      </span>
                      <span className="font-mono text-[10px] text-yellow-500">{item.serialId}</span>
                      <span>×{item.qty}</span>
                    </div>
                    <div className="text-right">
                      {hasDisc && (
                        <span className={`line-through text-[9px] mr-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                          {(item.price * item.qty).toLocaleString()}
                        </span>
                      )}
                      <span className="font-bold text-yellow-500">{lineTotal.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className={`rounded-xl border p-4 space-y-2 ${isDark ? "border-yellow-500/20 bg-yellow-500/5" : "border-yellow-200 bg-yellow-50"}`}>
            <div className="flex justify-between text-sm">
              <span className={isDark ? "text-gray-400" : "text-gray-600"}>Total Items</span>
              <span className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{items.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className={isDark ? "text-gray-400" : "text-gray-600"}>Total Qty</span>
              <span className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{totalQty}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className={isDark ? "text-gray-400" : "text-gray-600"}>Total Discount</span>
                <span className="font-bold text-red-400">- Rs. {totalDiscount.toLocaleString()}</span>
              </div>
            )}
            <div className={`h-px my-1 ${isDark ? "bg-yellow-500/20" : "bg-yellow-300"}`} />
            <div className="flex justify-between">
              <span className={`font-bold ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>Grand Total</span>
              <span className="text-xl font-extrabold text-yellow-500">Rs. {grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-5 py-4 border-t ${isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
          <button
            onClick={onClose}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
          >
            ← Back (ESC)
          </button>
          <button
            onClick={onProceed}
            className="rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-6 py-2.5 text-sm font-bold text-black hover:from-yellow-400 hover:to-amber-400"
          >
            Submit & Print (F8)
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SummaryPopup;