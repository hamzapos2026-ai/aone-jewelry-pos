// src/components/cashier/EditBillModal.jsx
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  doc, updateDoc, addDoc, collection, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import {
  FiX, FiSave, FiPlus, FiTrash2, FiCopy, FiEdit3,
  FiUser, FiPhone, FiTag, FiDollarSign, FiCheckCircle,
  FiAlertCircle, FiZap, FiArrowDown, FiArrowUp,
} from "react-icons/fi";
import { MdPayment } from "react-icons/md";
import { toast } from "react-hot-toast";

const PAYMENT_METHODS = [
  { value: "Cash", icon: "💵" },
  { value: "EasyPaisa", icon: "📱" },
  { value: "JazzCash", icon: "📲" },
  { value: "Bank Transfer", icon: "🏦" },
  { value: "Card", icon: "💳" },
];

const EditBillModal = ({ order, isDark, userData, storeData, onClose, onPayment }) => {
  // Customer
  const [customerName, setCustomerName] = useState(order.customer?.name || "Walking Customer");
  const [customerPhone, setCustomerPhone] = useState(order.customer?.phone || "");
  const [paymentMethod, setPaymentMethod] = useState(order.paymentType || "Cash");
  const [comments, setComments] = useState(order.comments || "");

  // Items - EDITABLE
  const [items, setItems] = useState(() =>
    (order.items || []).map((item, i) => ({
      ...item,
      _id: `item_${i}_${Date.now()}`,
      _originalQty: item.qty,
      _originalTotal: item.total,
      _originalPrice: item.price,
      _isNew: false,
      _isDuplicate: false,
      _isDeleted: false,
    }))
  );

  // Discount
  const [extraDiscount, setExtraDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [saving, setSaving] = useState(false);

  const cardBg = isDark ? "bg-[#1a1208]" : "bg-white";
  const border = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text = isDark ? "text-gray-100" : "text-gray-900";
  const subText = isDark ? "text-gray-400" : "text-gray-500";
  const inputBg = isDark
    ? "bg-[#120d06] border-[#2a1f0f] text-gray-100"
    : "bg-gray-50 border-gray-200 text-gray-900";
  const rowBg = isDark ? "bg-[#0f0a04]" : "bg-gray-50";
  const accent = "text-amber-500";

  // ===== CALCULATIONS =====
  const originalSubtotal = useMemo(
    () => order.subtotal || order.items?.reduce((s, i) => s + (i.total || 0), 0) || 0,
    [order]
  );

  const originalTotal = order.totalAmount || 0;
  const originalDiscount = order.billDiscount || 0;

  const activeItems = useMemo(
    () => items.filter((i) => !i._isDeleted),
    [items]
  );

  const newSubtotal = useMemo(
    () => activeItems.reduce((s, i) => s + (Number(i.qty) * Number(i.price) || 0), 0),
    [activeItems]
  );

  const totalDiscount = useMemo(
    () => originalDiscount + Number(extraDiscount || 0),
    [originalDiscount, extraDiscount]
  );

  const newTotal = useMemo(
    () => Math.max(0, newSubtotal - totalDiscount),
    [newSubtotal, totalDiscount]
  );

  const totalDifference = newTotal - originalTotal;

  // ===== ITEM OPERATIONS =====
  const updateItem = useCallback((id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item._id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "qty" || field === "price") {
          updated.total = Number(updated.qty || 0) * Number(updated.price || 0);
        }
        return updated;
      })
    );
  }, []);

  const deleteItem = useCallback((id) => {
    setItems((prev) =>
      prev.map((item) =>
        item._id === id ? { ...item, _isDeleted: true } : item
      )
    );
    toast.success("Item removed", { duration: 1000 });
  }, []);

  const restoreItem = useCallback((id) => {
    setItems((prev) =>
      prev.map((item) =>
        item._id === id ? { ...item, _isDeleted: false } : item
      )
    );
  }, []);

  const duplicateItem = useCallback((id) => {
    setItems((prev) => {
      const original = prev.find((i) => i._id === id);
      if (!original) return prev;
      const dup = {
        ...original,
        _id: `dup_${Date.now()}_${Math.random()}`,
        _isDuplicate: true,
        _isNew: true,
        _isDeleted: false,
        qty: original.qty,
      };
      const idx = prev.findIndex((i) => i._id === id);
      const newArr = [...prev];
      newArr.splice(idx + 1, 0, dup);
      return newArr;
    });
    toast.success("Item duplicated!", { icon: "📋", duration: 1000 });
  }, []);

  const addNewItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        _id: `new_${Date.now()}`,
        productName: "New Item",
        serialId: "",
        price: 0,
        qty: 1,
        total: 0,
        _isNew: true,
        _isDuplicate: false,
        _isDeleted: false,
        _originalQty: 0,
        _originalTotal: 0,
        _originalPrice: 0,
      },
    ]);
  }, []);

  // ===== SAVE =====
  const handleSave = useCallback(async () => {
    if (activeItems.length === 0) {
      toast.error("Bill must have at least 1 item!");
      return;
    }
    if (Number(extraDiscount) > 0 && !discountReason.trim()) {
      toast.error("Discount reason required!");
      return;
    }

    setSaving(true);
    const finalItems = activeItems.map((i) => ({
      productName: i.productName,
      serialId: i.serialId || "",
      price: Number(i.price) || 0,
      qty: Number(i.qty) || 0,
      total: Number(i.qty) * Number(i.price) || 0,
    }));

    try {
      await Promise.all([
        updateDoc(doc(db, "orders", order.id), {
          items: finalItems,
          "customer.name": customerName,
          "customer.phone": customerPhone,
          paymentType: paymentMethod,
          comments: comments,
          subtotal: newSubtotal,
          billDiscount: totalDiscount,
          discountReason: extraDiscount > 0
            ? discountReason
            : order.discountReason || "",
          totalAmount: newTotal,
          totalQty: finalItems.reduce((s, i) => s + i.qty, 0),
          lastEditedBy: userData?.displayName || userData?.name || "Cashier",
          lastEditedAt: serverTimestamp(),
          lastEditedUserId: userData?.uid || "",
          editHistory: [
            ...(order.editHistory || []),
            {
              editedBy: userData?.displayName || userData?.name || "Cashier",
              editedAt: new Date().toISOString(),
              previousTotal: originalTotal,
              newTotal: newTotal,
              previousItems: order.items?.length || 0,
              newItems: finalItems.length,
              reason: comments || discountReason || "Edited",
            },
          ],
        }),
        addDoc(collection(db, "auditLogs"), {
          action: "BILL_EDITED",
          orderId: order.id,
          billSerial: order.billSerial || order.serialNo,
          userId: userData?.uid || "",
          userName: userData?.displayName || userData?.name || "Cashier",
          role: userData?.role || "cashier",
          storeId: userData?.storeId || "",
          before: {
            totalAmount: originalTotal,
            subtotal: originalSubtotal,
            itemCount: order.items?.length || 0,
            discount: originalDiscount,
          },
          after: {
            totalAmount: newTotal,
            subtotal: newSubtotal,
            itemCount: finalItems.length,
            discount: totalDiscount,
          },
          difference: totalDifference,
          timestamp: serverTimestamp(),
        }),
      ]);

      toast.success("Bill updated successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save!");
    } finally {
      setSaving(false);
    }
  }, [
    activeItems, extraDiscount, discountReason, customerName, customerPhone,
    paymentMethod, comments, newSubtotal, totalDiscount, newTotal, order,
    userData, originalTotal, originalSubtotal, originalDiscount, totalDifference,
    onClose,
  ]);

  // ===== SAVE + PAY =====
  const handleSaveAndPay = useCallback(async () => {
    if (activeItems.length === 0) {
      toast.error("Bill must have at least 1 item!");
      return;
    }

    setSaving(true);
    const finalItems = activeItems.map((i) => ({
      productName: i.productName,
      serialId: i.serialId || "",
      price: Number(i.price) || 0,
      qty: Number(i.qty) || 0,
      total: Number(i.qty) * Number(i.price) || 0,
    }));

    try {
      await updateDoc(doc(db, "orders", order.id), {
        items: finalItems,
        "customer.name": customerName,
        "customer.phone": customerPhone,
        paymentType: paymentMethod,
        comments,
        subtotal: newSubtotal,
        billDiscount: totalDiscount,
        totalAmount: newTotal,
        totalQty: finalItems.reduce((s, i) => s + i.qty, 0),
        status: "paid",
        paidAt: serverTimestamp(),
        paidBy: userData?.uid || "",
        paidByName: userData?.displayName || userData?.name || "Cashier",
        billEndTime: new Date().toISOString(),
        amountReceived: newTotal,
        changeGiven: 0,
        lastEditedBy: userData?.displayName || userData?.name || "Cashier",
        lastEditedAt: serverTimestamp(),
      });

      toast.success(`⚡ Paid! Rs.${newTotal.toLocaleString()}`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed!");
    } finally {
      setSaving(false);
    }
  }, [
    activeItems, customerName, customerPhone, paymentMethod, comments,
    newSubtotal, totalDiscount, newTotal, order, userData, onClose,
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-2xl ${cardBg} rounded-2xl border ${border} shadow-2xl flex flex-col`}
        style={{ maxHeight: "92vh" }}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${border} flex-shrink-0`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <FiEdit3 className="text-amber-500 w-5 h-5" />
            </div>
            <div>
              <h2 className={`font-bold text-base ${text}`}>
                Edit Bill #{order.billSerial || order.serialNo}
              </h2>
              <p className={`text-xs ${subText}`}>
                Modify items, customer info, discount
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${subText} hover:text-red-500 hover:bg-red-500/10 transition-colors`}
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-bold ${subText} mb-1 block`}>
                <FiUser className="inline w-3 h-3 mr-1 text-amber-500" />
                Customer
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} focus:outline-none focus:border-amber-500`}
              />
            </div>
            <div>
              <label className={`text-xs font-bold ${subText} mb-1 block`}>
                <FiPhone className="inline w-3 h-3 mr-1 text-amber-500" />
                Phone
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
            <label className={`text-xs font-bold ${subText} mb-1.5 block`}>
              Payment Method
            </label>
            <div className="flex gap-2 flex-wrap">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all active:scale-95 ${
                    paymentMethod === m.value
                      ? "border-amber-500 bg-amber-500/20 text-amber-500"
                      : `${border} ${subText} hover:border-amber-400`
                  }`}
                >
                  {m.icon} {m.value}
                </button>
              ))}
            </div>
          </div>

          {/* Items Table */}
          <div className={`rounded-xl border ${border} overflow-hidden`}>
            <div
              className={`px-4 py-2.5 ${rowBg} border-b ${border} flex items-center justify-between`}
            >
              <h3
                className={`text-xs font-bold ${subText} uppercase tracking-wider`}
              >
                Items ({activeItems.length})
              </h3>
              <button
                onClick={addNewItem}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-white text-xs font-bold active:scale-95"
              >
                <FiPlus className="w-3 h-3" />
                Add Item
              </button>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((item) => (
                <div
                  key={item._id}
                  className={`px-4 py-3 transition-all ${
                    item._isDeleted
                      ? "opacity-30 bg-red-500/5 line-through"
                      : item._isDuplicate
                      ? isDark
                        ? "bg-blue-900/10"
                        : "bg-blue-50/50"
                      : item._isNew
                      ? isDark
                        ? "bg-green-900/10"
                        : "bg-green-50/50"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {/* Labels */}
                    {item._isDuplicate && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500 font-bold">
                        DUPLICATE
                      </span>
                    )}
                    {item._isNew && !item._isDuplicate && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-500 font-bold">
                        NEW
                      </span>
                    )}
                    {item._isDeleted && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-500 font-bold">
                        REMOVED
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    {/* Name (col-span-4) */}
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={item.productName}
                        onChange={(e) =>
                          updateItem(item._id, "productName", e.target.value)
                        }
                        disabled={item._isDeleted}
                        className={`w-full px-2 py-1.5 rounded border text-xs ${inputBg} focus:outline-none focus:border-amber-500 disabled:opacity-40`}
                      />
                    </div>

                    {/* Serial (col-span-2) */}
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={item.serialId || ""}
                        onChange={(e) =>
                          updateItem(item._id, "serialId", e.target.value)
                        }
                        disabled={item._isDeleted}
                        placeholder="ID"
                        className={`w-full px-2 py-1.5 rounded border text-xs ${inputBg} focus:outline-none focus:border-amber-500 disabled:opacity-40`}
                      />
                    </div>

                    {/* Price (col-span-2) */}
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) =>
                          updateItem(item._id, "price", e.target.value)
                        }
                        disabled={item._isDeleted}
                        min={0}
                        className={`w-full px-2 py-1.5 rounded border text-xs ${inputBg} focus:outline-none focus:border-amber-500 disabled:opacity-40`}
                      />
                    </div>

                    {/* Qty (col-span-1) */}
                    <div className="col-span-1">
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) =>
                          updateItem(item._id, "qty", e.target.value)
                        }
                        disabled={item._isDeleted}
                        min={1}
                        className={`w-full px-2 py-1.5 rounded border text-xs text-center ${inputBg} focus:outline-none focus:border-amber-500 disabled:opacity-40`}
                      />
                    </div>

                    {/* Total (col-span-1) */}
                    <div className="col-span-1 text-right">
                      <span
                        className={`text-xs font-bold ${accent}`}
                      >
                        {(
                          Number(item.qty) * Number(item.price) || 0
                        ).toLocaleString()}
                      </span>
                    </div>

                    {/* Actions (col-span-2) */}
                    <div className="col-span-2 flex items-center gap-1 justify-end">
                      {item._isDeleted ? (
                        <button
                          onClick={() => restoreItem(item._id)}
                          className="p-1 rounded text-green-500 hover:bg-green-500/10 text-xs"
                          title="Restore"
                        >
                          ↩️
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => duplicateItem(item._id)}
                            className="p-1 rounded text-blue-500 hover:bg-blue-500/10"
                            title="Duplicate"
                          >
                            <FiCopy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteItem(item._id)}
                            className="p-1 rounded text-red-500 hover:bg-red-500/10"
                            title="Remove"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Original vs New comparison */}
                  {!item._isNew && !item._isDeleted && (
                    <div className="mt-1.5 flex items-center gap-3">
                      {item._originalQty !== Number(item.qty) && (
                        <span className={`text-[10px] ${subText}`}>
                          Qty: {item._originalQty} →{" "}
                          <span className={accent}>{item.qty}</span>
                        </span>
                      )}
                      {item._originalPrice !== Number(item.price) && (
                        <span className={`text-[10px] ${subText}`}>
                          Price: {item._originalPrice} →{" "}
                          <span className={accent}>{item.price}</span>
                        </span>
                      )}
                      {item._originalTotal !==
                        Number(item.qty) * Number(item.price) && (
                        <span className={`text-[10px] ${subText}`}>
                          Total: Rs.{item._originalTotal} →{" "}
                          <span className={`font-bold ${accent}`}>
                            Rs.
                            {(
                              Number(item.qty) * Number(item.price)
                            ).toLocaleString()}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Discount Section */}
          <div className={`rounded-xl p-4 border ${border} ${rowBg}`}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-blue-500 mb-1 block">
                  Biller Discount
                </label>
                <div
                  className={`px-3 py-2 rounded-lg border ${border} text-sm font-bold text-blue-500 ${
                    isDark ? "bg-blue-900/10" : "bg-blue-50"
                  }`}
                >
                  Rs. {originalDiscount}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-green-500 mb-1 block">
                  Extra Discount
                </label>
                <input
                  type="number"
                  value={extraDiscount}
                  onChange={(e) =>
                    setExtraDiscount(
                      Math.min(Number(e.target.value), newSubtotal)
                    )
                  }
                  min={0}
                  max={newSubtotal}
                  className={`w-full px-3 py-2 rounded-lg border text-sm font-bold ${inputBg} focus:outline-none focus:border-green-500`}
                />
              </div>
            </div>
            {Number(extraDiscount) > 0 && (
              <div className="mt-2">
                <label className="text-xs font-bold text-red-500 mb-1 block">
                  Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Why discount?"
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} focus:outline-none focus:border-red-500`}
                />
              </div>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className={`text-xs font-bold ${subText} mb-1 block`}>
              Comments
            </label>
            <input
              type="text"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Notes..."
              className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} focus:outline-none focus:border-amber-500`}
            />
          </div>

          {/* ===== BEFORE / AFTER COMPARISON ===== */}
          <div
            className={`rounded-xl p-4 border-2 ${
              totalDifference === 0
                ? border
                : totalDifference > 0
                ? "border-green-500"
                : "border-red-500"
            } ${isDark ? "bg-[#0f0a04]" : "bg-white"}`}
          >
            <h3
              className={`text-xs font-bold ${accent} uppercase mb-3 tracking-wider`}
            >
              Summary Comparison
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Before */}
              <div className={`rounded-lg p-3 ${rowBg}`}>
                <p className={`text-xs font-bold ${subText} mb-2`}>
                  📋 BEFORE (Original)
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className={subText}>Subtotal</span>
                    <span className={text}>
                      Rs. {originalSubtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className={subText}>Discount</span>
                    <span className="text-green-500">
                      -Rs. {originalDiscount}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between text-sm font-bold pt-1 border-t ${border}`}
                  >
                    <span className={text}>Total</span>
                    <span className={text}>
                      Rs. {originalTotal.toLocaleString()}
                    </span>
                  </div>
                  <p className={`text-[10px] ${subText}`}>
                    {order.items?.length || 0} items
                  </p>
                </div>
              </div>

              {/* After */}
              <div
                className={`rounded-lg p-3 ${
                  isDark ? "bg-amber-900/10" : "bg-amber-50"
                }`}
              >
                <p className={`text-xs font-bold ${accent} mb-2`}>
                  ✏️ AFTER (Modified)
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className={subText}>Subtotal</span>
                    <span className={text}>
                      Rs. {newSubtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className={subText}>Total Discount</span>
                    <span className="text-green-500">
                      -Rs. {totalDiscount}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between text-sm font-bold pt-1 border-t ${border}`}
                  >
                    <span className={accent}>New Total</span>
                    <span className={`text-lg font-extrabold ${accent}`}>
                      Rs. {newTotal.toLocaleString()}
                    </span>
                  </div>
                  <p className={`text-[10px] ${subText}`}>
                    {activeItems.length} items
                  </p>
                </div>
              </div>
            </div>

            {/* Difference */}
            {totalDifference !== 0 && (
              <div
                className={`mt-3 pt-3 border-t ${border} flex items-center justify-center gap-2`}
              >
                {totalDifference > 0 ? (
                  <FiArrowUp className="w-4 h-4 text-green-500" />
                ) : (
                  <FiArrowDown className="w-4 h-4 text-red-500" />
                )}
                <span
                  className={`text-sm font-bold ${
                    totalDifference > 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {totalDifference > 0 ? "+" : ""}Rs.{" "}
                  {totalDifference.toLocaleString()} difference
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-4 border-t ${border} flex items-center gap-3 flex-shrink-0`}
        >
          <button
            onClick={onClose}
            disabled={saving}
            className={`px-4 py-2.5 rounded-xl border ${border} text-sm font-medium ${subText} transition-all active:scale-95`}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <FiSave className="w-4 h-4" />
            )}
            Save Changes
          </button>

          {order.status === "pending" && (
            <button
              onClick={handleSaveAndPay}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 text-white text-sm font-extrabold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 ml-auto"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FiZap className="w-4 h-4" />
              )}
              Save + Pay Rs. {newTotal.toLocaleString()}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditBillModal;