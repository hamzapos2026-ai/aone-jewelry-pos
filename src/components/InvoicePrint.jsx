// src/components/InvoicePrint.jsx
// ✅ FIX: serialNo always from order prop (Firestore confirmed)
// ✅ FIX: Real serial updates invoice after background save
// ✅ FIX: directPrint closes only after real serial arrives

import { useRef, useEffect, useCallback, useState, memo } from "react";
import QRCode      from "qrcode";
import { motion }  from "framer-motion";
import { Printer, X, Eye, EyeOff } from "lucide-react";
import { useTheme }    from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";

const fmtTime = (d) => {
  if (!d) return "—";
  const dd = d instanceof Date ? d : new Date(d);
  return isNaN(dd) ? "—" : dd.toLocaleTimeString("en-PK", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
};

const fmtDate = (d) => {
  if (!d) return "—";
  const dd = d instanceof Date ? d : new Date(d);
  return isNaN(dd) ? "—" : dd.toLocaleDateString("en-PK", {
    year: "numeric", month: "short", day: "2-digit",
  });
};

const truncName = (raw = "", maxLen = 18) => {
  const clean = raw.startsWith("Item - ITEM-")
    ? raw.replace(/^Item - ITEM-[0-9]+-[0-9]+-?/, "").trim()
    : raw;
  const name = clean || "Item";
  return name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;
};

const PRINT_STYLES = `
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{
    font-family:'Courier New',Courier,monospace;
    font-size:11px;color:#000;background:#fff;
    width:72mm;max-width:72mm;margin:0 auto;
    padding:3mm 4mm;line-height:1.3;
    overflow-x:hidden;word-wrap:break-word;
  }
  .rw{width:100%;max-width:72mm;overflow:hidden;}
  table{width:100%;border-collapse:collapse;table-layout:fixed;}
  th,td{padding:1px;font-size:10px;text-align:left;vertical-align:top;word-wrap:break-word;}
  th{border-bottom:1px solid #000;font-weight:bold;}
  .r{text-align:right;}.c{text-align:center;}.b{font-weight:bold;}
  .div{border-top:1px dashed #000;margin:3px 0;}
  .div2{border-top:2px solid #000;margin:2px 0;}
  .sn{font-size:13px;font-weight:900;letter-spacing:0.5px;text-align:center;}
  .ttl{display:flex;justify-content:space-between;align-items:baseline;padding:2px 0;}
  .ttl-l{font-size:12px;font-weight:900;}
  .ttl-a{font-size:15px;font-weight:900;}
  .qr{text-align:center;padding:3px 0;}
  .qr img{display:block;margin:0 auto;width:56px;height:56px;}
  .ft{text-align:center;font-size:9px;line-height:1.3;}
  @media print{
    html,body{width:72mm;max-width:72mm;padding:2mm 3mm;}
    @page{margin:0;size:80mm auto;}
  }
`;

const InvoicePrint = ({
  order,
  store,
  onClose,
  directPrint   = false,
  autoClose     = false,
  showItemsInit = true,
  fontSize,
}) => {
  const { isDark }   = useTheme();
  const { settings } = useSettings();
  const printRef     = useRef(null);
  const hasPrinted   = useRef(false);
  const hasClosedRef = useRef(false);

  // ✅ serialNo — always from order prop
  // Real serial comes from saveOrder → result.serialNo
  // Dashboard updates printOrder.serialNo after background save
  const serialNo = order?.serialNo || order?.billSerial || "----";

  const [qrUrl,     setQrUrl]     = useState("");
  const [qrReady,   setQrReady]   = useState(false);
  const [showItems, setShowItems] = useState(showItemsInit ?? true);

  const items         = order?.items         || [];
  const customer      = order?.customer      || {};
  const totalQty      = order?.totalQty      || 0;
  const totalAmount   = order?.totalAmount   || 0;
  const totalDiscount = order?.totalDiscount || 0;
  const billDiscount  = order?.billDiscount  || 0;
  const footerNote    = settings?.invoice?.footerNote
    || "Thank you for your business!";

  const hasAnyDiscount =
    items.some((i) => (Number(i.discount) || 0) > 0) || billDiscount > 0;

  // ✅ QR from real serialNo — regenerates when order changes
  useEffect(() => {
    hasPrinted.current   = false;
    hasClosedRef.current = false;
    setQrUrl("");
    setQrReady(false);

    if (!serialNo || serialNo === "----") {
      setQrReady(true);
      return;
    }
    QRCode.toDataURL(serialNo, { width: 80, margin: 1 })
      .then((url) => { setQrUrl(url); setQrReady(true); })
      .catch(()   => { setQrReady(true); });
  }, [serialNo, order]);

  // ✅ Print with iframe fallback
  const handlePrint = useCallback(() => {
    const content = printRef.current;
    if (!content) return;

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<title>Invoice #${serialNo}</title>
<style>${PRINT_STYLES}</style>
</head><body>
<div class="rw">${content.innerHTML}</div>
<script>
window.onload=function(){
  setTimeout(function(){window.print();window.close();},250);
};
<\/script>
</body></html>`;

    let printed = false;
    try {
      const win = window.open(
        "", "_blank",
        "width=350,height=700,toolbar=no,menubar=no"
      );
      if (win) {
        win.document.write(html);
        win.document.close();
        printed = true;
      }
    } catch {}

    if (!printed) {
      try {
        const iframe = document.createElement("iframe");
        iframe.style.cssText =
          "position:fixed;top:-9999px;left:-9999px;" +
          "width:1px;height:1px;opacity:0;";
        document.body.appendChild(iframe);
        const idoc =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (idoc) {
          idoc.write(html);
          idoc.close();
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch {}
        }, 3000);
      } catch {}
    }
  }, [serialNo]);

  // ✅ directPrint — print immediately when QR ready
  useEffect(() => {
    if (!directPrint || !qrReady || hasPrinted.current) return;
    hasPrinted.current = true;
    handlePrint();
    if (!hasClosedRef.current) {
      hasClosedRef.current = true;
      onClose?.();
    }
  }, [directPrint, qrReady, handlePrint, onClose]);

  // ✅ Keyboard shortcuts
  useEffect(() => {
    if (directPrint) return;
    const handler = (e) => {
      if (e.key === "F8") {
        e.preventDefault();
        e.stopPropagation();
        handlePrint();
        setTimeout(() => onClose?.(), 300);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [directPrint, handlePrint, onClose]);

  // ✅ Receipt content
  const ReceiptContent = useCallback(() => (
    <div style={{
      width: "100%", maxWidth: "72mm", overflow: "hidden",
      fontFamily: "'Courier New',Courier,monospace",
    }}>
      {/* Store header */}
      <div style={{ textAlign: "center", marginBottom: 3 }}>
        <div style={{
          fontSize: 14, fontWeight: 900, letterSpacing: 1,
          wordBreak: "break-word",
        }}>
          {store?.name || "STORE"}
        </div>
        {store?.tagline && (
          <div style={{ fontSize: 9, opacity: 0.7, marginTop: 1 }}>
            {store.tagline}
          </div>
        )}
        {store?.address && (
          <div style={{ fontSize: 9, marginTop: 1 }}>{store.address}</div>
        )}
        {store?.phone && (
          <div style={{ fontSize: 9 }}>Ph: {store.phone}</div>
        )}
        {store?.ntn && (
          <div style={{ fontSize: 8, color: "#555" }}>NTN: {store.ntn}</div>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "3px 0" }} />

      {/* Serial + Date + Time */}
      <div style={{ textAlign: "center", marginBottom: 2 }}>
        <div style={{
          fontSize: 13, fontWeight: 900, letterSpacing: 0.5,
        }}>
          {serialNo}
        </div>
        <div style={{ fontSize: 9 }}>
          {fmtDate(order?.createdAt || order?.billStartTime || new Date())}
        </div>
        <div style={{ fontSize: 9 }}>
          {fmtTime(order?.billStartTime)}
          {order?.billEndTime ? ` — ${fmtTime(order.billEndTime)}` : ""}
        </div>
      </div>

      {/* Customer */}
      {(customer?.name || customer?.phone) && (
        <>
          <div style={{ borderTop: "1px dashed #000", margin: "3px 0" }} />
          <div style={{ fontSize: 10, marginBottom: 2 }}>
            {customer.name   && (
              <div><b>Cust:</b> {customer.name}</div>
            )}
            {customer.phone  && (
              <div><b>Ph:</b>   {customer.phone}</div>
            )}
            {customer.city   && (
              <div><b>City:</b> {customer.city}</div>
            )}
            {customer.market && (
              <div><b>Mkt:</b>  {customer.market}</div>
            )}
          </div>
        </>
      )}

      <div style={{ borderTop: "1px dashed #000", margin: "3px 0" }} />

      {/* Items */}
      {showItems && items.length > 0 && (
        <>
          <table style={{
            width: "100%", tableLayout: "fixed",
            borderCollapse: "collapse",
          }}>
            <colgroup>
              <col style={{ width: "14px" }} />
              <col />
              <col style={{ width: "22px" }} />
              <col style={{ width: "38px" }} />
              {hasAnyDiscount && <col style={{ width: "28px" }} />}
              <col style={{ width: "42px" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ fontSize: 9 }}>#</th>
                <th style={{ fontSize: 9 }}>Item</th>
                <th style={{ fontSize: 9, textAlign: "right" }}>Qt</th>
                <th style={{ fontSize: 9, textAlign: "right" }}>Rate</th>
                {hasAnyDiscount && (
                  <th style={{ fontSize: 9, textAlign: "right" }}>Dc</th>
                )}
                <th style={{
                  fontSize: 9, textAlign: "right", fontWeight: "bold",
                }}>Amt</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const discAmt = item.discountType === "percent"
                  ? Math.round((item.price * item.discount) / 100)
                  : Number(item.discount) || 0;
                const hasDisc   = discAmt > 0;
                const lineTotal = (item.price - discAmt) * item.qty;
                return (
                  <tr key={i} style={{ borderBottom: "1px dotted #ddd" }}>
                    <td style={{ fontSize: 10, fontWeight: "bold" }}>
                      {i + 1}
                    </td>
                    <td style={{
                      fontSize: 10, fontWeight: 500,
                      overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap", maxWidth: 0,
                    }}>
                      {truncName(item.productName || `Item ${i + 1}`, 18)}
                    </td>
                    <td style={{
                      fontSize: 10, textAlign: "right", fontWeight: "bold",
                    }}>
                      {item.qty}
                    </td>
                    <td style={{ fontSize: 10, textAlign: "right" }}>
                      {hasDisc ? (
                        <span style={{
                          textDecoration: "line-through",
                          opacity: 0.5, fontSize: 9,
                        }}>
                          {Number(item.price).toLocaleString()}
                        </span>
                      ) : Number(item.price).toLocaleString()}
                    </td>
                    {hasAnyDiscount && (
                      <td style={{
                        fontSize: 9, textAlign: "right",
                        color: "#c00", fontWeight: 500,
                      }}>
                        {hasDisc ? `-${discAmt}` : "—"}
                      </td>
                    )}
                    <td style={{
                      fontSize: 10, textAlign: "right", fontWeight: "bold",
                    }}>
                      {lineTotal.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ borderTop: "1px dashed #000", margin: "3px 0" }} />
        </>
      )}

      {/* Summary */}
      <div style={{ fontSize: 10, marginBottom: 2, fontWeight: 500 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Items: {items.length}</span>
          <span>Qty: {totalQty}</span>
        </div>
        {(totalDiscount - billDiscount) > 0 && (
          <div style={{
            display: "flex", justifyContent: "space-between", color: "#c00",
          }}>
            <span>Item Disc</span>
            <span>
              −Rs.{(totalDiscount - billDiscount).toLocaleString()}
            </span>
          </div>
        )}
        {billDiscount > 0 && (
          <div style={{
            display: "flex", justifyContent: "space-between", color: "#c00",
          }}>
            <span>Bill Disc</span>
            <span>−Rs.{billDiscount.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Grand total */}
      <div style={{
        borderTop: "2px solid #000",
        borderBottom: "1px dashed #000",
        margin: "2px 0", padding: "3px 0",
        display: "flex", justifyContent: "space-between",
        alignItems: "baseline",
      }}>
        <span style={{ fontSize: 12, fontWeight: 900 }}>TOTAL</span>
        <span style={{ fontSize: 15, fontWeight: 900 }}>
          Rs.{Number(totalAmount).toLocaleString()}
        </span>
      </div>

      {/* Payment */}
      {order?.amountReceived > 0 && (
        <div style={{ fontSize: 10, margin: "2px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Received:</span>
            <span>Rs.{Number(order.amountReceived).toLocaleString()}</span>
          </div>
          {order.changeGiven > 0 && (
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontWeight: "bold",
            }}>
              <span>Change:</span>
              <span>Rs.{Number(order.changeGiven).toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* QR */}
      {qrUrl && (
        <div style={{ textAlign: "center", margin: "4px 0" }}>
          <img
            src={qrUrl} alt="QR"
            style={{
              width: 56, height: 56,
              display: "block", margin: "0 auto",
            }}
          />
          <div style={{
            fontSize: 8, fontWeight: "bold",
            marginTop: 1, letterSpacing: 0.5,
          }}>
            {serialNo}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        textAlign: "center", fontSize: 9, marginTop: 3,
        borderTop: "1px dashed #000", paddingTop: 3,
      }}>
        <div style={{ lineHeight: 1.3, wordBreak: "break-word" }}>
          {footerNote}
        </div>
        {store?.name && (
          <div style={{ marginTop: 1, fontSize: 9, fontWeight: 900 }}>
            {store.name}
          </div>
        )}
      </div>
    </div>
  ), [
    serialNo, store, customer, items, showItems, qrUrl,
    totalQty, totalAmount, totalDiscount, billDiscount,
    hasAnyDiscount, footerNote, order,
  ]);

  // ✅ directPrint — hidden, no UI
  if (directPrint) {
    return (
      <div style={{
        position: "fixed", top: -99999, left: -99999,
        opacity: 0, pointerEvents: "none",
        width: "80mm", zIndex: -1,
      }}>
        <div ref={printRef}>
          <ReceiptContent />
        </div>
      </div>
    );
  }

  // ✅ Preview modal
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4">
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
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2 border-b flex-shrink-0 ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"
        }`}>
          <div className="flex items-center gap-2">
            <Printer size={13} className="text-yellow-500" />
            <span className={`font-bold text-sm ${
              isDark ? "text-white" : "text-gray-900"
            }`}>
              Invoice
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
              isDark
                ? "bg-yellow-500/10 text-yellow-400"
                : "bg-yellow-50 text-yellow-700"
            }`}>
              #{serialNo}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowItems((p) => !p)}
              title={showItems ? "Hide Items" : "Show Items"}
              className={`flex items-center gap-1 text-[10px] px-2 py-1
                rounded border transition ${
                showItems
                  ? isDark
                    ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                    : "bg-yellow-50 border-yellow-200 text-yellow-700"
                  : isDark
                    ? "bg-gray-500/10 border-gray-500/20 text-gray-400"
                    : "bg-gray-50 border-gray-200 text-gray-500"
              }`}
            >
              {showItems ? <Eye size={10} /> : <EyeOff size={10} />}
              <span>{showItems ? "Items" : "Hidden"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 hover:bg-black/10"
            >
              <X size={12} className={isDark ? "text-gray-400" : "text-gray-500"} />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden p-3
          flex justify-center ${isDark ? "bg-[#0a0908]" : "bg-gray-100"}`}
        >
          <div style={{
            width: "72mm", maxWidth: "72mm", minWidth: "72mm",
            fontFamily: "'Courier New',Courier,monospace",
            fontSize: 11, color: "#000", background: "#fff",
            padding: "6px 8px",
            boxShadow: "0 1px 8px rgba(0,0,0,0.13)",
            borderRadius: 4, overflow: "hidden",
          }}>
            <div ref={printRef}>
              <ReceiptContent />
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className={`flex items-center justify-between gap-2 px-4 py-2
          border-t flex-shrink-0 ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              isDark
                ? "border border-gray-600 text-gray-400 hover:bg-white/5"
                : "border border-gray-200 text-gray-600 hover:bg-gray-100"
            }`}
          >
            ← ESC
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className={`inline-flex items-center gap-1.5 rounded-lg
                px-3 py-1.5 text-xs font-semibold ${
                isDark
                  ? "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                  : "border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
              }`}
            >
              <Printer size={11} /> Print Only
            </button>
            <button
              type="button"
              onClick={() => {
                handlePrint();
                setTimeout(() => onClose?.(), 200);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg
                bg-gradient-to-r from-yellow-500 to-amber-500
                px-4 py-1.5 text-xs font-bold text-black
                hover:from-yellow-400 hover:to-amber-400
                active:scale-95 transition-transform"
            >
              <Printer size={11} /> F8 Print &amp; Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default memo(InvoicePrint);