// src/components/InvoicePrint.jsx
import { useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Printer } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import Barcode from "react-barcode";

const InvoicePrint = ({ order, store, onClose, billStartTime, billEndTime }) => {
  const { isDark } = useTheme();
  const printRef = useRef(null);

  const fmtTime = (d) => {
    if (!d) return "—";
    const dd = d instanceof Date ? d : new Date(d);
    return dd.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  };
  const fmtDate = (d) => {
    if (!d) return "—";
    const dd = d instanceof Date ? d : new Date(d);
    return dd.toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "2-digit" });
  };

  const handlePrint = useCallback(() => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank", "width=820,height=750");
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Invoice ${order.serialNo || ""}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Courier New',Courier,monospace;font-size:12px;color:#000;background:#fff;
             width:80mm;margin:0 auto;padding:10px}
        .center{text-align:center}
        .divider{border-top:1px dashed #000;margin:7px 0}
        .divider-solid{border-top:2px solid #000;margin:7px 0}
        table{width:100%;border-collapse:collapse}
        th,td{padding:2px 4px;font-size:11px}
        th{text-align:left;border-bottom:1px solid #000}
        .strike{text-decoration:line-through;opacity:.5;font-size:9px;display:block}
        /* ── BARCODE ── */
        .barcode-section{
          text-align:center;
          margin:14px auto 8px;
          display:flex;
          flex-direction:column;
          align-items:center;
        }
        .barcode-section svg{
          display:block;
          margin:0 auto;
          max-width:100%;
        }
        @media print{
          body{width:80mm}
          @page{margin:0;size:80mm auto}
        }
      </style></head><body>
      ${content.innerHTML}
      <script>window.onload=()=>{window.print();window.close()}<\/script>
    </body></html>`);
    win.document.close();
  }, [order.serialNo]);

  // F8 inside print modal = close & submit
  useEffect(() => {
    const h = (e) => {
      if (e.key === "F8") { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [onClose]);

  const items         = order.items         || [];
  const customer      = order.customer      || {};
  const totalQty      = order.totalQty      || 0;
  const totalAmount   = order.totalAmount   || 0;
  const totalDiscount = order.totalDiscount || 0;
  const serialNo      = order.serialNo      || order.billSerial || "—";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`relative flex max-h-[95vh] w-full max-w-lg flex-col rounded-2xl shadow-2xl overflow-hidden ${
          isDark ? "bg-[#15120d] border border-yellow-500/20" : "bg-white border border-yellow-200"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-yellow-500" />
            <h2 className={`font-bold text-base ${isDark ? "text-white" : "text-gray-900"}`}>
              Invoice Preview
            </h2>
            <span className={`text-[10px] px-2 py-0.5 rounded ${isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"}`}>
              F8 = Submit
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-2 text-sm font-bold text-black hover:from-yellow-400 hover:to-amber-400"
            >
              <Printer size={14} />Print
            </button>
            <button
              onClick={onClose}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isDark
                  ? "border border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              }`}
            >
              ✓ Submit (F8)
            </button>
          </div>
        </div>

        {/* Receipt preview */}
        <div className="flex-1 overflow-y-auto p-6 flex justify-center">
          <div
            ref={printRef}
            style={{
              width: "80mm",
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "12px",
              color: "#000",
              background: "#fff",
              padding: "10px",
            }}
          >
            {/* Store header */}
            <div style={{ textAlign: "center", marginBottom: "6px" }}>
              <div style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "3px" }}>
                {store?.name || "AONE JEWELRY"}
              </div>
              {store?.tagline && (
                <div style={{ fontSize: "10px", marginTop: "1px", opacity: 0.7 }}>{store.tagline}</div>
              )}
              {store?.address && (
                <div style={{ fontSize: "10px", marginTop: "2px" }}>{store.address}</div>
              )}
              {store?.phone && (
                <div style={{ fontSize: "10px" }}>Ph: {store.phone}</div>
              )}
            </div>

            <div style={{ borderTop: "1px dashed #000", margin: "7px 0" }} />

            {/* Bill info */}
            <div style={{ textAlign: "center", marginBottom: "5px" }}>
              <div style={{ fontSize: "14px", fontWeight: "bold", letterSpacing: "1px" }}>{serialNo}</div>
              <div style={{ fontSize: "10px", marginTop: "2px" }}>
                {fmtDate(order.createdAt || new Date())}
                {"  |  "}
                {fmtTime(billStartTime || order.billStartTime)}
                {(billEndTime || order.billEndTime) && (
                  <> – {fmtTime(billEndTime || order.billEndTime)}</>
                )}
              </div>
            </div>

            {/* Customer */}
            {(customer.name || customer.phone) && (
              <>
                <div style={{ borderTop: "1px dashed #000", margin: "7px 0" }} />
                <div style={{ fontSize: "11px" }}>
                  <div><b>Customer:</b> {customer.name || "Walking Customer"}</div>
                  {customer.phone  && <div><b>Phone:</b>  {customer.phone}</div>}
                  {customer.city   && <div><b>City:</b>   {customer.city}</div>}
                  {customer.market && <div><b>Market:</b> {customer.market}</div>}
                </div>
              </>
            )}

            <div style={{ borderTop: "1px dashed #000", margin: "7px 0" }} />

            {/* Items */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <th style={{ textAlign: "left",  padding: "2px 2px", width: "18px" }}>#</th>
                  <th style={{ textAlign: "left",  padding: "2px 2px" }}>Serial</th>
                  <th style={{ textAlign: "right", padding: "2px 2px" }}>Price</th>
                  <th style={{ textAlign: "right", padding: "2px 2px", width: "22px" }}>Qty</th>
                  <th style={{ textAlign: "right", padding: "2px 2px" }}>Disc</th>
                  <th style={{ textAlign: "right", padding: "2px 2px" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const hasDisc   = Number(item.discount) > 0;
                  const lineTotal = item.price * item.qty - item.discount * item.qty;
                  return (
                    <tr key={i} style={{ borderBottom: "1px dotted #ddd" }}>
                      <td style={{ padding: "2px 2px" }}>{i + 1}</td>
                      <td style={{ padding: "2px 2px", fontFamily: "monospace", fontSize: "10px" }}>
                        {item.serialId}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 2px" }}>
                        {hasDisc ? (
                          <>
                            <span style={{ textDecoration: "line-through", opacity: 0.45, fontSize: "9px", display: "block" }}>
                              {item.price.toLocaleString()}
                            </span>
                            <span>{(item.price - item.discount).toLocaleString()}</span>
                          </>
                        ) : item.price.toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 2px" }}>{item.qty}</td>
                      <td style={{ textAlign: "right", padding: "2px 2px" }}>
                        {hasDisc ? item.discount.toLocaleString() : "—"}
                      </td>
                      <td style={{ textAlign: "right", padding: "2px 2px", fontWeight: "bold" }}>
                        {lineTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ borderTop: "1px dashed #000", margin: "7px 0" }} />

            {/* Sub-totals */}
            <table style={{ width: "100%", fontSize: "11px" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "1px 2px" }}>Total Items</td>
                  <td style={{ textAlign: "right", padding: "1px 2px" }}>{items.length}</td>
                </tr>
                <tr>
                  <td style={{ padding: "1px 2px" }}>Total Qty</td>
                  <td style={{ textAlign: "right", padding: "1px 2px" }}>{totalQty}</td>
                </tr>
                {totalDiscount > 0 && (
                  <tr>
                    <td style={{ padding: "1px 2px" }}>Total Discount</td>
                    <td style={{ textAlign: "right", padding: "1px 2px", color: "#c53030" }}>
                      − Rs. {totalDiscount.toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Grand total */}
            <div style={{
              borderTop: "2px solid #000", margin: "7px 0 0", paddingTop: "5px",
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
            }}>
              <span style={{ fontSize: "14px", fontWeight: 900 }}>GRAND TOTAL</span>
              <span style={{ fontSize: "18px", fontWeight: 900 }}>Rs. {totalAmount.toLocaleString()}</span>
            </div>

            <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

            {/* ── BARCODE — centered, bigger font ── */}
            <div
              className="barcode-section"
              style={{
                textAlign: "center",
                margin: "14px auto 8px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <Barcode
                value={serialNo}
                width={2.4}          /* bar width */
                height={75}          /* bar height */
                fontSize={16}        /* text under barcode — increased to 16px */
                margin={6}
                background="#ffffff"
                lineColor="#000000"
                displayValue={true}
                textAlign="center"
                textPosition="bottom"
                textMargin={5}
                font="'Courier New', Courier, monospace"
              />
            </div>

            {/* Footer */}
            <div style={{ textAlign: "center", fontSize: "10px", marginTop: "8px", borderTop: "1px dashed #000", paddingTop: "6px" }}>
              <div style={{ fontWeight: "bold" }}>Thank you for your business!</div>
              {store?.name && (
                <div style={{ marginTop: "3px", fontSize: "11px", fontWeight: 900, letterSpacing: "1px" }}>
                  {store.name}
                </div>
              )}
              <div style={{ marginTop: "3px", opacity: 0.55 }}>Cashier handover — pending payment</div>
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div className={`flex items-center justify-end gap-3 px-5 py-4 border-t ${isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-5 py-2.5 font-bold text-black hover:from-yellow-400 hover:to-amber-400"
          >
            <Printer size={16} />Print Invoice
          </button>
          <button
            onClick={onClose}
            className={`rounded-xl px-5 py-2.5 font-semibold transition ${
              isDark
                ? "border border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >
            ✓ Done &amp; Submit (F8)
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default InvoicePrint;