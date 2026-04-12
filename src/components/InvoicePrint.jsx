import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { X, Printer } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const InvoicePrint = ({ order, store, onClose }) => {
  const { isDark } = useTheme();
  const printRef = useRef();

  const handlePrint = useReactToPrint({ contentRef: printRef });

  if (!order) return null;

  const formatDate = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString("en-PK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className={`relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl ${
          isDark ? "bg-[#1a1714]" : "bg-white"
        } p-6 shadow-2xl`}
      >
        {/* Header Buttons */}
        <div className="mb-4 flex items-center justify-between">
          <h2
            className={`text-lg font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Invoice Preview
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-2 font-semibold text-black hover:from-yellow-400 hover:to-amber-400"
            >
              <Printer size={16} />
              Print
            </button>
            <button
              onClick={onClose}
              className={`rounded-xl p-2 ${
                isDark
                  ? "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div
          ref={printRef}
          className="rounded-xl bg-white p-6 text-black"
          style={{ fontFamily: "monospace" }}
        >
          {/* Store Header */}
          <div className="mb-4 border-b-2 border-dashed border-gray-300 pb-4 text-center">
            <h1 className="text-xl font-bold uppercase">
              {store?.name || "AONE JEWELRY"}
            </h1>
            <p className="mt-1 text-xs text-gray-600">
              {store?.address || "Store Address"}
            </p>
            <p className="text-xs text-gray-600">
              Tel: {store?.phone || "Phone Number"}
            </p>
          </div>

          {/* Invoice Info */}
          <div className="mb-4 flex justify-between text-xs">
            <div>
              <p>
                <strong>Invoice:</strong> {order.serialNo}
              </p>
              <p>
                <strong>Bill:</strong> {order.billSerial}
              </p>
            </div>
            <div className="text-right">
              <p>
                <strong>Date:</strong> {formatDate(order.createdAt)}
              </p>
              <p>
                <strong>Status:</strong> {order.status || "Pending"}
              </p>
            </div>
          </div>

          {/* Customer */}
          <div className="mb-4 rounded bg-gray-50 p-2 text-xs">
            <p>
              <strong>Customer:</strong>{" "}
              {order.customer?.name || "Walking Customer"}
            </p>
            {order.customer?.phone && (
              <p>
                <strong>Phone:</strong> {order.customer.phone}
              </p>
            )}
          </div>

          {/* Items Table */}
          <table className="mb-4 w-full text-xs">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="py-2 text-left">#</th>
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Price</th>
                <th className="py-2 text-right">Disc</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, index) => {
                const lineTotal =
                  Number(item.price || 0) * Number(item.qty || 0) -
                  Number(item.discount || 0) * Number(item.qty || 0);
                return (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-1.5">{index + 1}</td>
                    <td className="py-1.5">
                      <div>{item.productName}</div>
                      <div className="text-[10px] text-gray-400">
                        {item.serialId}
                      </div>
                    </td>
                    <td className="py-1.5 text-center">{item.qty}</td>
                    <td className="py-1.5 text-right">
                      {Number(item.price || 0).toLocaleString()}
                    </td>
                    <td className="py-1.5 text-right">
                      {Number(item.discount || 0).toLocaleString()}
                    </td>
                    <td className="py-1.5 text-right font-bold">
                      {lineTotal.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mb-4 border-t-2 border-dashed border-gray-300 pt-3">
            <div className="flex justify-between text-xs">
              <span>Total Items:</span>
              <span>{order.items?.length || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Total Qty:</span>
              <span>{order.totalQty || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Discount:</span>
              <span>
                PKR {Number(order.totalDiscount || 0).toLocaleString()}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-300 pt-2 text-sm font-bold">
              <span>GRAND TOTAL:</span>
              <span>
                PKR {Number(order.totalAmount || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t-2 border-dashed border-gray-300 pt-3 text-center text-xs text-gray-500">
            <p className="font-semibold">Thank you for your purchase!</p>
            <p className="mt-1">
              Exchange within 7 days with receipt
            </p>
            <p className="mt-1">
              {store?.name || "AONE JEWELRY"} - Quality You Can Trust
            </p>
            <p className="mt-2 text-[10px]">
              Generated: {new Date().toLocaleString("en-PK")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePrint;