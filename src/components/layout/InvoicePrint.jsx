import { forwardRef } from "react";
import { Gem } from "lucide-react";

const InvoicePrint = forwardRef(({ invoice }, ref) => {
  const { id, customer, items = [], subtotal, tax, total, date } = invoice || {};

  return (
    <div ref={ref} className="bg-white p-8 text-black min-h-[600px]">
      {/* Header */}
      <div className="text-center border-b-2 border-gray-200 pb-4 mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Gem size={32} className="text-amber-600" />
          <h1 className="text-2xl font-bold">A ONE JEWELRY</h1>
        </div>
        <p className="text-gray-600">Premium Jewelry Store</p>
        <p className="text-sm text-gray-500">Phone: +92 300 1234567</p>
      </div>

      {/* Invoice Info */}
      <div className="flex justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">Invoice #</p>
          <p className="font-semibold">{id || "INV-001"}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Date</p>
          <p className="font-semibold">{date || new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Customer */}
      <div className="mb-6">
        <p className="text-sm text-gray-500">Bill To:</p>
        <p className="font-semibold">{customer?.name || "Walk-in Customer"}</p>
        <p className="text-sm text-gray-600">{customer?.phone || ""}</p>
      </div>

      {/* Items */}
      <table className="w-full mb-6">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-2">Item</th>
            <th className="text-center py-2">Qty</th>
            <th className="text-right py-2">Price</th>
            <th className="text-right py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2">{item.name}</td>
              <td className="text-center py-2">{item.qty}</td>
              <td className="text-right py-2">₨ {item.price?.toLocaleString()}</td>
              <td className="text-right py-2">₨ {(item.qty * item.price)?.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="border-t-2 border-gray-200 pt-4">
        <div className="flex justify-between py-1">
          <span>Subtotal</span>
          <span>₨ {subtotal?.toLocaleString() || 0}</span>
        </div>
        <div className="flex justify-between py-1">
          <span>Tax</span>
          <span>₨ {tax?.toLocaleString() || 0}</span>
        </div>
        <div className="flex justify-between py-2 text-xl font-bold border-t border-gray-200 mt-2">
          <span>Total</span>
          <span>₨ {total?.toLocaleString() || 0}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-8 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-500">Thank you for your business!</p>
        <p className="text-xs text-gray-400 mt-1">www.aonejewelry.com</p>
      </div>
    </div>
  );
});

InvoicePrint.displayName = "InvoicePrint";

export default InvoicePrint;