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
  FiEdit3,
  FiCheckCircle,
  FiXCircle,
  FiUser,
  FiPhone,
  FiTag,
  FiClock,
  FiHash,
  FiShoppingBag,
} from "react-icons/fi";
import { MdReceiptLong, MdStorefront } from "react-icons/md";
import { toast } from "react-hot-toast";

const ViewBillModal = ({
  order,
  isDark,
  userData,
  storeData,
  onClose,
  onPayment,
  onCancel,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [customerName, setCustomerName] = useState(
    order.customer?.name || "Walking Customer"
  );
  const [customerPhone, setCustomerPhone] = useState(
    order.customer?.phone || ""
  );
  const [discount, setDiscount] = useState(order.billDiscount || 0);
  const [discountReason, setDiscountReason] = useState(
    order.discountReason || ""
  );
  const [saving, setSaving] = useState(false);

  const subtotal = order.subtotal || 0;
  const finalAmount = Math.max(0, subtotal - Number(discount));
  const isPending = order.status === "pending";

  const handleSave = async () => {
    if (Number(discount) > 0 && !discountReason.trim()) {
      toast.error("Discount reason is required");
      return;
    }

    setSaving(true);
    try {
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, {
        "customer.name": customerName,
        "customer.phone": customerPhone,
        billDiscount: Number(discount),
        discountReason,
        totalAmount: finalAmount,
        lastEditedBy: userData?.displayName || userData?.name || "Cashier",
        lastEditedAt: serverTimestamp(),
        lastEditedUserId: userData?.uid || "",
      });

      // Audit log
      await addDoc(collection(db, "auditLogs"), {
        action: "BILL_EDITED",
        orderId: order.id,
        billSerial: order.billSerial || order.serialNo,
        userId: userData?.uid || "",
        userName: userData?.displayName || userData?.name || "Cashier",
        role: userData?.role || "cashier",
        storeId: userData?.storeId || "",
        before: {
          customerName: order.customer?.name,
          customerPhone: order.customer?.phone,
          billDiscount: order.billDiscount,
          totalAmount: order.totalAmount,
        },
        after: {
          customerName,
          customerPhone,
          billDiscount: Number(discount),
          totalAmount: finalAmount,
        },
        timestamp: serverTimestamp(),
      });

      toast.success("Bill updated successfully!");
      setEditMode(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update bill");
    } finally {
      setSaving(false);
    }
  };

  const cardBg = isDark ? "bg-[#1a1208]" : "bg-white";
  const border = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text = isDark ? "text-gray-100" : "text-gray-900";
  const subText = isDark ? "text-gray-400" : "text-gray-500";
  const inputBg = isDark
    ? "bg-[#120d06] border-[#2a1f0f] text-gray-100"
    : "bg-gray-50 border-gray-200 text-gray-900";
  const rowBg = isDark ? "bg-[#0f0a04]" : "bg-gray-50";

  const formatDate = (ts) => {
    if (!ts) return "N/A";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("en-PK");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-lg ${cardBg} rounded-2xl border ${border} shadow-2xl`}
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border} sticky top-0 ${cardBg} z-10`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <MdReceiptLong className="text-amber-500 w-5 h-5" />
            </div>
            <div>
              <h2 className={`font-bold text-base ${text}`}>
                Bill Details
              </h2>
              <p className={`text-xs ${subText}`}>
                #{order.billSerial || order.serialNo}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPending && !editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-500 text-xs font-medium hover:bg-amber-500/30 transition-all"
              >
                <FiEdit3 className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg hover:bg-red-500/10 ${subText} hover:text-red-500 transition-colors`}
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bill Content */}
        <div className="p-5 space-y-4">
          {/* Store & Bill Info */}
          <div className={`rounded-xl p-4 border ${border} ${rowBg}`}>
            <div className="flex items-center gap-2 mb-3">
              <MdStorefront className="text-amber-500 w-4 h-4" />
              <span className={`font-semibold text-sm ${text}`}>
                {storeData?.name || "Store"}
              </span>
              <span
                className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  order.status === "paid"
                    ? "bg-emerald-500/20 text-emerald-500"
                    : order.status === "pending"
                    ? "bg-amber-500/20 text-amber-500"
                    : "bg-red-500/20 text-red-500"
                }`}
              >
                {order.status?.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className={subText}>Bill Number</span>
                <p className={`font-medium ${text}`}>
                  #{order.billSerial || order.serialNo}
                </p>
              </div>
              <div>
                <span className={subText}>Created</span>
                <p className={`font-medium ${text}`}>
                  {formatDate(order.createdAt)}
                </p>
              </div>
              <div>
                <span className={subText}>Cashier</span>
                <p className={`font-medium ${text}`}>
                  {order.billerName || "N/A"}
                </p>
              </div>
              <div>
                <span className={subText}>Payment Type</span>
                <p className={`font-medium ${text}`}>
                  {order.paymentType || "Not Set"}
                </p>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className={`rounded-xl p-4 border ${border}`}>
            <h3 className={`text-xs font-semibold ${subText} uppercase tracking-wide mb-3`}>
              Customer Information
            </h3>
            {editMode ? (
              <div className="space-y-2.5">
                <div>
                  <label className={`text-xs ${subText} mb-1 block`}>
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
                  <label className={`text-xs ${subText} mb-1 block`}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} focus:outline-none focus:border-amber-500`}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <FiUser className="w-4 h-4 text-amber-500" />
                  <span className={text}>{order.customer?.name || "Walking Customer"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FiPhone className="w-4 h-4 text-amber-500" />
                  <span className={text}>{order.customer?.phone || "—"}</span>
                </div>
                {order.customer?.city && (
                  <div className="flex items-center gap-2 col-span-2">
                    <span className={subText}>City:</span>
                    <span className={text}>{order.customer.city}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items */}
          <div className={`rounded-xl border ${border} overflow-hidden`}>
            <div className={`px-4 py-2.5 ${rowBg} border-b ${border}`}>
              <h3 className={`text-xs font-semibold ${subText} uppercase tracking-wide`}>
                Items ({order.items?.length || 0})
              </h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <p className={`font-medium ${text}`}>{item.productName}</p>
                    <p className={`text-xs ${subText}`}>#{item.serialId}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold text-amber-500`}>
                      Rs. {item.total}
                    </p>
                    <p className={`text-xs ${subText}`}>
                      Rs. {item.price} x {item.qty}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Discount (edit mode) */}
          {editMode && (
            <div className={`rounded-xl p-4 border ${border} space-y-2.5`}>
              <h3 className={`text-xs font-semibold ${subText} uppercase tracking-wide mb-2`}>
                Discount
              </h3>
              <div>
                <label className={`text-xs ${subText} mb-1 block`}>
                  Discount Amount (Rs.)
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
              {Number(discount) > 0 && (
                <div>
                  <label className={`text-xs ${subText} mb-1 block`}>
                    Discount Reason{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="Enter reason..."
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} focus:outline-none focus:border-amber-500`}
                  />
                </div>
              )}
            </div>
          )}

          {/* Amount Summary */}
          <div className={`rounded-xl p-4 border ${border} ${rowBg} space-y-1.5`}>
            <div className="flex justify-between text-sm">
              <span className={subText}>Subtotal</span>
              <span className={text}>Rs. {order.subtotal || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className={subText}>Discount</span>
              <span className="text-green-500">
                - Rs. {editMode ? Number(discount) : order.billDiscount || 0}
              </span>
            </div>
            <div className={`flex justify-between text-base font-bold pt-2 border-t ${border}`}>
              <span className={text}>Total</span>
              <span className="text-amber-500">
                Rs. {editMode ? finalAmount : order.totalAmount || 0}
              </span>
            </div>
            {order.amountReceived && (
              <div className="flex justify-between text-sm">
                <span className={subText}>Received</span>
                <span className={text}>Rs. {order.amountReceived}</span>
              </div>
            )}
            {order.changeGiven > 0 && (
              <div className="flex justify-between text-sm">
                <span className={subText}>Change Given</span>
                <span className="text-emerald-500">Rs. {order.changeGiven}</span>
              </div>
            )}
          </div>

          {/* Last edited info */}
          {order.lastEditedBy && (
            <div className={`text-xs ${subText} flex items-center gap-1`}>
              <FiEdit3 className="w-3 h-3" />
              Last edited by{" "}
              <span className="font-medium text-amber-500">
                {order.lastEditedBy}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t ${border} sticky bottom-0 ${cardBg}`}>
          {editMode ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditMode(false)}
                disabled={saving}
                className={`flex-1 py-2.5 rounded-xl border ${border} text-sm font-medium ${subText} hover:border-gray-400 transition-all`}
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-bold transition-all flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiCheckCircle className="w-4 h-4" />
                )}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onClose}
                className={`flex-1 py-2.5 rounded-xl border ${border} text-sm font-medium ${subText} transition-all`}
              >
                Close
              </button>
              {isPending && (
                <>
                  <button
                    onClick={() => onPayment(order)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                  >
                    <FiCheckCircle className="w-4 h-4" />
                    Pay Now
                  </button>
                  <button
                    onClick={() => onCancel(order)}
                    className="py-2.5 px-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm font-medium transition-all hover:bg-red-500/20"
                  >
                    <FiXCircle className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewBillModal;