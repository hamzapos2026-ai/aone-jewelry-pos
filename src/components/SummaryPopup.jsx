// src/components/SummaryPopup.jsx
// ✅ Live grand total
// ✅ Bill discount editable
// ✅ F8 double-fire protected
// ✅ Compact spacing

import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { X, FileText } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const SummaryPopup = ({
  isOpen,
  items,
  totalQty,
  totalDiscount,
  subtotal,
  billDiscount      = 0,
  billDiscountType  = "fixed",
  grandTotal,
  billSerial,
  customer,
  onProceed,
  onClose,
  onBillDiscountChange,
  onBillDiscountTypeChange,
}) => {
  const { isDark }   = useTheme();
  const proceededRef = useRef(false);

  const [extraDisc,     setExtraDisc]     = useState(billDiscount);
  const [extraDiscType, setExtraDiscType] = useState(billDiscountType);

  useEffect(() => {
    if (isOpen) {
      proceededRef.current = false;
      setExtraDisc(billDiscount);
      setExtraDiscType(billDiscountType);
    }
  }, [isOpen, billDiscount, billDiscountType]);

  // Notify parent
  useEffect(() => {
    if (!isOpen) return;
    onBillDiscountChange?.(Number(extraDisc) || 0);
  }, [extraDisc, isOpen]); // eslint-disable-line

  useEffect(() => {
    if (!isOpen) return;
    onBillDiscountTypeChange?.(extraDiscType);
  }, [extraDiscType, isOpen]); // eslint-disable-line

  // Local grand total (instant update)
  const localBillDiscValue = useMemo(() => {
    const val = Number(extraDisc || 0);
    if (extraDiscType === "percent")
      return Math.round((subtotal * Math.min(100, Math.max(0, val))) / 100);
    return Math.max(0, val);
  }, [extraDisc, extraDiscType, subtotal]);

  const localGrandTotal = useMemo(
    () => Math.max(0, subtotal - localBillDiscValue),
    [subtotal, localBillDiscValue]
  );

  // Keyboard
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "F8") {
        e.preventDefault(); e.stopPropagation();
        if (proceededRef.current) return;
        proceededRef.current = true;
        onProceed();
        setTimeout(() => { proceededRef.current = false; }, 700);
      }
      if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isOpen, onProceed, onClose]);

  if (!isOpen) return null;

  const hasAnyDiscount = totalDiscount > 0 || localBillDiscValue > 0;

  const inputBase = `rounded-lg border px-2 py-1 text-xs outline-none text-center font-semibold ${
    isDark
      ? "border-yellow-500/20 bg-black/30 text-white"
      : "border-yellow-200 bg-white text-gray-900"}`;

  const handleProceed = () => {
    if (proceededRef.current) return;
    proceededRef.current = true;
    onProceed();
    setTimeout(() => { proceededRef.current = false; }, 700);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
          isDark
            ? "bg-[#15120d] border border-yellow-500/20"
            : "bg-white border border-yellow-200"}`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2 border-b ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-yellow-500" />
            <h2 className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
              Bill Summary
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] px-2 py-0.5 rounded ${
              isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"}`}>
              F8 = Proceed
            </span>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-black/10">
              <X size={12} className={isDark ? "text-gray-400" : "text-gray-600"} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-3 space-y-2 max-h-[65vh] overflow-y-auto">

          {/* Serial + Customer row */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-xl border p-2 text-center ${
              isDark ? "border-yellow-500/20 bg-yellow-500/5"
                     : "border-yellow-200 bg-yellow-50"}`}>
              <p className="text-[9px] uppercase tracking-wide text-gray-500">Bill Serial</p>
              <p className="text-lg font-bold text-yellow-500 font-mono">
                {billSerial || "PENDING"}
              </p>
            </div>
            <div className={`rounded-xl border p-2 ${
              isDark ? "border-yellow-500/10 bg-black/20" : "border-gray-200 bg-gray-50"}`}>
              <p className="text-[9px] uppercase tracking-wide text-gray-500">Customer</p>
              <p className={`font-semibold text-sm truncate ${
                isDark ? "text-white" : "text-gray-900"}`}>
                {customer?.name || "Walking Customer"}
              </p>
              {customer?.phone && (
                <p className="text-[10px] text-gray-400">{customer.phone}</p>
              )}
            </div>
          </div>

          {/* Items list */}
          <div>
            <p className="text-[9px] uppercase tracking-wide text-gray-500 mb-1">
              Items ({items.length})
            </p>
            <div className={`rounded-xl border divide-y max-h-32 overflow-y-auto ${
              isDark ? "border-yellow-500/10 divide-yellow-500/10"
                     : "border-gray-200 divide-gray-100"}`}>
              {items.map((item, i) => {
                const discAmt = item.discountType === "percent"
                  ? Math.round((item.price * item.discount) / 100)
                  : Number(item.discount) || 0;
                const lineTotal = (item.price - discAmt) * item.qty;
                return (
                  <div key={item.id || i}
                    className="flex items-center justify-between px-3 py-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex h-4 w-4 items-center justify-center
                        rounded-full text-[8px] font-bold ${
                        isDark ? "bg-yellow-500/20 text-yellow-400"
                               : "bg-yellow-100 text-yellow-700"}`}>
                        {i + 1}
                      </span>
                      <span className={`text-xs ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                        Rs.{item.price.toLocaleString()} ×{item.qty}
                      </span>
                      {discAmt > 0 && (
                        <span className="text-[10px] text-red-400">
                          -{discAmt.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-yellow-500">
                      Rs.{lineTotal.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className={`rounded-xl border p-2.5 space-y-1.5 ${
            isDark ? "border-yellow-500/20 bg-yellow-500/5"
                   : "border-yellow-200 bg-yellow-50"}`}>

            <div className="flex justify-between text-xs">
              <span className={isDark ? "text-gray-400" : "text-gray-600"}>
                Items × Qty
              </span>
              <span className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                {items.length} × {totalQty}
              </span>
            </div>

            {hasAnyDiscount && (
              <div className="flex justify-between text-xs">
                <span className={isDark ? "text-gray-400" : "text-gray-600"}>Subtotal</span>
                <span className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                  Rs.{subtotal.toLocaleString()}
                </span>
              </div>
            )}

            {totalDiscount > 0 && (
              <div className="flex justify-between text-xs">
                <span className={isDark ? "text-gray-400" : "text-gray-600"}>Item Discount</span>
                <span className="font-bold text-red-400">
                  −Rs.{totalDiscount.toLocaleString()}
                </span>
              </div>
            )}

            {/* Editable bill discount */}
            <div className="flex items-center justify-between text-xs">
              <span className={isDark ? "text-gray-400" : "text-gray-600"}>
                Bill Discount
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0"
                  value={extraDisc}
                  onChange={(e) => setExtraDisc(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className={`w-16 ${inputBase}`}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExtraDiscType((t) => t === "fixed" ? "percent" : "fixed");
                  }}
                  className={`text-[10px] font-bold px-1.5 py-1 rounded-lg ${
                    isDark ? "bg-yellow-500/10 text-yellow-400"
                           : "bg-yellow-50 text-yellow-700"}`}
                >
                  {extraDiscType === "percent" ? "%" : "Rs"}
                </button>
                {localBillDiscValue > 0 && (
                  <span className="text-red-400 text-xs font-bold">
                    −{localBillDiscValue.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <div className={`h-px ${isDark ? "bg-yellow-500/20" : "bg-yellow-300"}`} />

            {/* Grand Total */}
            <div className="flex justify-between items-baseline">
              <span className={`font-bold text-sm ${
                isDark ? "text-yellow-400" : "text-yellow-700"}`}>
                Grand Total
              </span>
              <span className="font-extrabold text-yellow-500 text-2xl">
                Rs.{localGrandTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-4 py-2 border-t ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
          <button onClick={onClose}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
              isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}>
            ← Back (ESC)
          </button>
          <button
            onClick={handleProceed}
            className="rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500
              px-5 py-2 text-sm font-bold text-black hover:from-yellow-400 hover:to-amber-400"
          >
            Print & Submit (F8) →
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SummaryPopup;