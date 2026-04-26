// src/components/InvoicePrint.jsx
// ✅ FULLY FIXED: Content stays inside bill, responsive, 80mm thermal ready
// ✅ F8 = print + close | ESC = close
// ✅ QR centered | columns aligned | product names truncate
// ✅ No overflow — everything fits inside bill boundary

import { useRef, useEffect, useCallback, useState } from "react";
import QRCode from "qrcode";
import { motion } from "framer-motion";
import { Printer, Check, X } from "lucide-react";
import { useTheme }    from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";

/* ── helpers ─────────────────────────────────────────────── */
const fmtTime = (d) => {
  if (!d) return "—";
  const dd = d instanceof Date ? d : new Date(d);
  if (isNaN(dd)) return "—";
  return dd.toLocaleTimeString("en-PK", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
};

const fmtDate = (d) => {
  if (!d) return "—";
  const dd = d instanceof Date ? d : new Date(d);
  if (isNaN(dd)) return "—";
  return dd.toLocaleDateString("en-PK", {
    year: "numeric", month: "short", day: "2-digit",
  });
};

/* ── truncate product name for receipt ─────────────────── */
const truncName = (raw = "", maxLen = 18) => {
  const clean = raw.startsWith("Item - ITEM-")
    ? raw.replace(/^Item - ITEM-[0-9]+-[0-9]+-?/, "").trim()
    : raw;
  const name = clean || "Item";
  return name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;
};

/* ══════════════════════════════════════════════════════════
   RECEIPT PRINT STYLES — 80mm thermal safe
══════════════════════════════════════════════════════════ */
const PRINT_STYLES = `
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{
    font-family:'Courier New',Courier,monospace;
    font-size:11px;
    color:#000;
    background:#fff;
    width:72mm;
    max-width:72mm;
    margin:0 auto;
    padding:3mm 4mm;
    line-height:1.3;
    overflow-x:hidden;
    word-wrap:break-word;
    overflow-wrap:break-word;
  }
  .receipt-wrap{
    width:100%;
    max-width:72mm;
    overflow:hidden;
  }
  table{
    width:100%;
    max-width:100%;
    border-collapse:collapse;
    table-layout:fixed;
  }
  th,td{
    padding:1px 1px;
    font-size:10px;
    text-align:left;
    vertical-align:top;
    word-wrap:break-word;
    overflow-wrap:break-word;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  th{border-bottom:1px solid #000;font-weight:bold;}
  .r{text-align:right;}
  .c{text-align:center;}
  .b{font-weight:bold;}
  .divider{border-top:1px dashed #000;margin:3px 0;}
  .divider-bold{border-top:2px solid #000;margin:3px 0;}
  .store-name{font-size:14px;font-weight:900;letter-spacing:1px;text-align:center;}
  .serial{font-size:13px;font-weight:900;letter-spacing:0.5px;text-align:center;}
  .total-row{
    display:flex;justify-content:space-between;align-items:baseline;
    padding:2px 0;
  }
  .total-label{font-size:12px;font-weight:900;}
  .total-amount{font-size:15px;font-weight:900;}
  .summary-row{display:flex;justify-content:space-between;font-size:10px;}
  .disc-row{display:flex;justify-content:space-between;font-size:10px;color:#c00;}
  .footer-text{text-align:center;font-size:9px;line-height:1.3;}
  .qr-wrap{text-align:center;padding:3px 0;}
  .qr-wrap img{display:block;margin:0 auto;width:56px;height:56px;}
  .qr-serial{font-size:8px;font-weight:bold;letter-spacing:0.5px;margin-top:1px;text-align:center;}
  .meta-line{font-size:9px;text-align:center;}
  .cust-line{font-size:10px;}
  .cust-line b{font-weight:700;}

  /* item name column */
  .col-idx{width:12px;}
  .col-name{width:auto;}
  .col-qty{width:22px;}
  .col-price{width:38px;}
  .col-disc{width:30px;}
  .col-total{width:42px;}

  .item-name{
    max-width:100%;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
    font-weight:500;
    font-size:10px;
  }

  @media print{
    html,body{width:72mm;max-width:72mm;padding:2mm 3mm;}
    @page{margin:0;size:80mm auto;}
  }
`;

const InvoicePrint = ({ order, store, onClose, directPrint = false }) => {
  const { isDark }   = useTheme();
  const { settings } = useSettings();
  const printRef     = useRef(null);
  const hasPrinted   = useRef(false);

  const [qrUrl,   setQrUrl]   = useState("");
  const [qrReady, setQrReady] = useState(false);

  const items         = order?.items         || [];
  const customer      = order?.customer      || {};
  const totalQty      = order?.totalQty      || 0;
  const totalAmount   = order?.totalAmount   || 0;
  const totalDiscount = order?.totalDiscount || 0;
  const billDiscount  = order?.billDiscount  || 0;
  const serialNo      = order?.serialNo || order?.billSerial || "----";
  const createdAt     = order?.createdAt;
  const billStartTime = order?.billStartTime;
  const billEndTime   = order?.billEndTime;
  const footerNote    = settings?.invoice?.footerNote || "Thank you for your business!";

  const hasAnyDiscount = items.some((i) => (Number(i.discount) || 0) > 0) || billDiscount > 0;

  // Column count for colgroup
  const colCount = hasAnyDiscount ? 6 : 5;

  // QR code generation
  useEffect(() => {
    QRCode.toDataURL(serialNo, {
      width: 80, margin: 1, color: { dark: "#000", light: "#fff" },
    })
      .then((url) => { setQrUrl(url); setQrReady(true); })
      .catch(()   => { setQrReady(true); });
  }, [serialNo]);

  /* ── print handler ───────────────────────────────────── */
  const handlePrint = useCallback(() => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank", "width=350,height=700");
    if (!win) { alert("Allow popups to print."); return; }

    win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Invoice #${serialNo}</title>
<style>${PRINT_STYLES}</style>
</head><body>
<div class="receipt-wrap">
${content.innerHTML}
</div>
<script>
window.onload=function(){setTimeout(function(){window.print();window.close();},250);};
<\/script>
</body></html>`);
    win.document.close();
  }, [serialNo]);

  // directPrint auto-fire
  useEffect(() => {
    if (!directPrint || !qrReady || hasPrinted.current) return;
    hasPrinted.current = true;
    handlePrint();
    setTimeout(() => onClose?.(), 800);
  }, [directPrint, qrReady, handlePrint, onClose]);

  // Keyboard: F8 print+close, ESC close
  useEffect(() => {
    if (directPrint) return;
    const handler = (e) => {
      if (e.key === "F8") {
        e.preventDefault(); e.stopPropagation();
        handlePrint();
        setTimeout(() => onClose?.(), 400);
      }
      if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [directPrint, handlePrint, onClose]);

  /* ══════════════════════════════════════════════════════
     RECEIPT CONTENT — fits inside 72mm usable width
  ══════════════════════════════════════════════════════ */
  const Receipt = () => (
    <div style={{ width: "100%", maxWidth: "72mm", overflow: "hidden" }}>

      {/* ── Store Header ── */}
      <div style={{ textAlign: "center", marginBottom: 3 }}>
        <div className="store-name" style={{
          fontSize: 14, fontWeight: 900, letterSpacing: 1,
          wordBreak: "break-word", lineHeight: 1.2,
        }}>
          {store?.name || "STORE"}
        </div>
        {store?.tagline && (
          <div style={{ fontSize: 9, opacity: 0.7, marginTop: 1, wordBreak: "break-word" }}>
            {store.tagline}
          </div>
        )}
        {store?.address && (
          <div style={{ fontSize: 9, marginTop: 1, wordBreak: "break-word" }}>
            {store.address}
          </div>
        )}
        {store?.phone && <div style={{ fontSize: 9 }}>Ph: {store.phone}</div>}
        {store?.ntn   && <div style={{ fontSize: 8, color: "#555" }}>NTN: {store.ntn}</div>}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "3px 0" }} />

      {/* ── Serial + Date ── */}
      <div style={{ textAlign: "center", marginBottom: 2 }}>
        <div style={{
          fontSize: 13, fontWeight: 900, letterSpacing: 0.5,
          wordBreak: "break-word",
        }}>
          {serialNo}
        </div>
        <div style={{ fontSize: 9, marginTop: 1 }}>
          {fmtDate(createdAt || new Date())}
        </div>
        <div style={{ fontSize: 9 }}>
          {fmtTime(billStartTime)}
          {billEndTime ? ` — ${fmtTime(billEndTime)}` : ""}
        </div>
      </div>

      {/* ── Customer ── */}
      {(customer?.name || customer?.phone) && (
        <>
          <div style={{ borderTop: "1px dashed #000", margin: "3px 0" }} />
          <div style={{ fontSize: 10, marginBottom: 2 }}>
            {customer.name   && <div style={{ wordBreak: "break-word" }}><b>Cust:</b> {customer.name}</div>}
            {customer.phone  && <div><b>Ph:</b> {customer.phone}</div>}
            {customer.city   && <div><b>City:</b> {customer.city}</div>}
            {customer.market && <div><b>Mkt:</b> {customer.market}</div>}
          </div>
        </>
      )}

      <div style={{ borderTop: "1px dashed #000", margin: "3px 0" }} />

      {/* ── Items Table ── */}
      <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
        <colgroup>
          <col style={{ width: "14px" }} />
          <col style={{ width: "auto" }} />
          <col style={{ width: "22px" }} />
          <col style={{ width: "38px" }} />
          {hasAnyDiscount && <col style={{ width: "28px" }} />}
          <col style={{ width: "42px" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ fontSize: 9, padding: "1px" }}>#</th>
            <th style={{ fontSize: 9, padding: "1px" }}>Item</th>
            <th style={{ fontSize: 9, padding: "1px", textAlign: "right" }}>Qt</th>
            <th style={{ fontSize: 9, padding: "1px", textAlign: "right" }}>Rate</th>
            {hasAnyDiscount && (
              <th style={{ fontSize: 9, padding: "1px", textAlign: "right" }}>Dc</th>
            )}
            <th style={{ fontSize: 9, padding: "1px", textAlign: "right", fontWeight: "bold" }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const discAmt = item.discountType === "percent"
              ? Math.round((item.price * item.discount) / 100)
              : Number(item.discount) || 0;
            const hasDisc   = discAmt > 0;
            const lineTotal = (item.price - discAmt) * item.qty;
            const itemName  = truncName(item.productName || `Item ${i + 1}`, 18);

            return (
              <tr key={i} style={{ borderBottom: "1px dotted #ddd" }}>
                <td style={{ fontSize: 10, padding: "1px", fontWeight: "bold" }}>
                  {i + 1}
                </td>
                <td style={{
                  fontSize: 10, padding: "1px", fontWeight: 500,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  maxWidth: 0,  /* forces ellipsis in fixed table */
                }}>
                  {itemName}
                </td>
                <td style={{ fontSize: 10, padding: "1px", textAlign: "right", fontWeight: "bold" }}>
                  {item.qty}
                </td>
                <td style={{ fontSize: 10, padding: "1px", textAlign: "right" }}>
                  {hasDisc ? (
                    <span style={{ textDecoration: "line-through", opacity: 0.5, fontSize: 9 }}>
                      {Number(item.price).toLocaleString()}
                    </span>
                  ) : (
                    Number(item.price).toLocaleString()
                  )}
                </td>
                {hasAnyDiscount && (
                  <td style={{
                    fontSize: 9, padding: "1px", textAlign: "right",
                    color: "#c00", fontWeight: 500,
                  }}>
                    {hasDisc ? `-${discAmt}` : "—"}
                  </td>
                )}
                <td style={{ fontSize: 10, padding: "1px", textAlign: "right", fontWeight: "bold" }}>
                  {lineTotal.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ borderTop: "1px dashed #000", margin: "3px 0" }} />

      {/* ── Summary ── */}
      <div style={{ fontSize: 10, marginBottom: 2, fontWeight: 500 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Items: {items.length}</span>
          <span>Qty: {totalQty}</span>
        </div>
        {(totalDiscount - billDiscount) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#c00" }}>
            <span>Item Disc</span>
            <span>−Rs.{(totalDiscount - billDiscount).toLocaleString()}</span>
          </div>
        )}
        {billDiscount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#c00" }}>
            <span>Bill Disc</span>
            <span>−Rs.{billDiscount.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* ── Grand Total ── */}
      <div style={{
        borderTop: "2px solid #000", borderBottom: "1px dashed #000",
        margin: "2px 0", padding: "3px 0",
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
      }}>
        <span style={{ fontSize: 12, fontWeight: 900 }}>TOTAL</span>
        <span style={{ fontSize: 15, fontWeight: 900 }}>Rs.{totalAmount.toLocaleString()}</span>
      </div>

      {/* ── QR Code ── */}
      {qrUrl && (
        <div style={{ textAlign: "center", margin: "4px 0", padding: "2px 0" }}>
          <img
            src={qrUrl} alt="QR"
            style={{
              width: 56, height: 56,
              display: "block", margin: "0 auto",
            }}
          />
          <div style={{
            fontSize: 8, fontWeight: "bold", marginTop: 1,
            letterSpacing: 0.5, wordBreak: "break-word", textAlign: "center",
          }}>
            {serialNo}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{
        textAlign: "center", fontSize: 9, marginTop: 3,
        borderTop: "1px dashed #000", paddingTop: 3,
      }}>
        <div style={{ lineHeight: 1.3, wordBreak: "break-word" }}>{footerNote}</div>
        {store?.name && (
          <div style={{ marginTop: 1, fontSize: 9, fontWeight: 900, letterSpacing: 0.5 }}>
            {store.name}
          </div>
        )}
      </div>
    </div>
  );

  /* ── directPrint: hidden render ──────────────────────── */
  if (directPrint) {
    return (
      <div style={{
        position: "fixed", top: -99999, left: -99999,
        opacity: 0, pointerEvents: "none", width: "80mm",
      }}>
        <div ref={printRef}><Receipt /></div>
      </div>
    );
  }

  /* ── Preview Modal ──────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <motion.div
        initial={{ scale: 0.93, opacity: 0 }}
        animate={{ scale: 1,    opacity: 1 }}
        transition={{ duration: 0.12 }}
        className={`relative flex max-h-[95vh] w-full max-w-[340px] flex-col
          rounded-2xl shadow-2xl overflow-hidden ${
          isDark
            ? "bg-[#15120d] border border-yellow-500/20"
            : "bg-white border border-yellow-200"
        }`}
      >
        {/* Header bar */}
        <div className={`flex items-center justify-between px-4 py-2 border-b flex-shrink-0 ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"
        }`}>
          <div className="flex items-center gap-2">
            <Printer size={13} className="text-yellow-500" />
            <span className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
              Invoice Preview
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
              isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"
            }`}>
              #{serialNo}
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-black/10">
            <X size={12} className={isDark ? "text-gray-400" : "text-gray-500"} />
          </button>
        </div>

        {/* ✅ Scrollable preview — fixed width container */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden p-3 flex justify-center ${
          isDark ? "bg-[#0a0908]" : "bg-gray-100"
        }`}>
          <div style={{
            width: "72mm",
            maxWidth: "72mm",
            minWidth: "72mm",
            fontFamily: "'Courier New',Courier,monospace",
            fontSize: 11,
            color: "#000",
            background: "#fff",
            padding: "6px 8px",
            boxShadow: "0 1px 8px rgba(0,0,0,0.13)",
            borderRadius: 4,
            overflow: "hidden",
            wordWrap: "break-word",
            overflowWrap: "break-word",
          }}>
            <div ref={printRef}><Receipt /></div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className={`flex items-center justify-between gap-2 px-4 py-2
          border-t flex-shrink-0 ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"
        }`}>
          <button onClick={onClose}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              isDark
                ? "border border-gray-600 text-gray-400 hover:bg-white/5"
                : "border border-gray-200 text-gray-600 hover:bg-gray-100"
            }`}>
            ← ESC
          </button>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              data-action="print-invoice"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
                text-xs font-semibold ${
                isDark
                  ? "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                  : "border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
              }`}
            >
              <Printer size={11} /> Print Only
            </button>
            <button
              onClick={() => { handlePrint(); setTimeout(() => onClose?.(), 400); }}
              data-action="print-and-submit"
              className="inline-flex items-center gap-1.5 rounded-lg
                bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-1.5
                text-xs font-bold text-black hover:from-yellow-400 hover:to-amber-400"
            >
              <Check size={11} /> Print & Submit (F8)
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InvoicePrint;