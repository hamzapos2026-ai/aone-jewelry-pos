// src/components/cashier/BillSearchBar.jsx
import React, { useState, useCallback, useRef, memo } from "react";
import {
  Search, XCircle, RefreshCw, Clock, CheckCircle,
  X, AlertTriangle, FileText, QrCode,
} from "lucide-react";

const BillSearchBar = memo(({
  isDark,
  searchQuery,
  setSearchQuery,
  activeFilter,
  setActiveFilter,
  stats,
  onQrScan,
  onReset,
  suggestions = [],
  searching = false,
  searchError = "",
  onBillSelect,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimerRef = useRef(null);

  const cardBg = isDark ? "bg-[#1a1208]" : "bg-white";
  const border = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text = isDark ? "text-gray-100" : "text-gray-900";
  const subText = isDark ? "text-gray-400" : "text-gray-500";
  const inputBg = isDark
    ? "bg-[#120d06] border-[#2a1f0f]"
    : "bg-gray-50 border-gray-200";

  const filterTabs = [
    { key: "all", label: "All", count: stats.total, icon: <FileText className="w-3 h-3" /> },
    { key: "pending", label: "Pending", count: stats.pending, icon: <Clock className="w-3 h-3" /> },
    { key: "paid", label: "Paid", count: stats.paid, icon: <CheckCircle className="w-3 h-3" /> },
    { key: "cancelled", label: "Cancelled", count: stats.cancelled, icon: <X className="w-3 h-3" /> },
  ];

  const handleInputChange = useCallback(
    (e) => {
      const value = e.target.value;
      setSearchQuery(value);
      setShowSuggestions(value.length >= 2);
    },
    [setSearchQuery]
  );

  const handleSuggestionClick = useCallback(
    (bill) => {
      setSearchQuery("");
      setShowSuggestions(false);
      onBillSelect?.(bill);
    },
    [setSearchQuery, onBillSelect]
  );

  const handleClear = useCallback(() => {
    setSearchQuery("");
    setShowSuggestions(false);
  }, [setSearchQuery]);

  const handleBlur = useCallback(() => {
    blurTimerRef.current = setTimeout(() => setShowSuggestions(false), 200);
  }, []);

  const handleFocus = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    if (searchQuery.length >= 2 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [searchQuery, suggestions.length]);

  return (
    <div className="relative">
      <div className={`${cardBg} border ${border} rounded-2xl p-4`}>
        {/* Search Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${subText}`} />
            <input
              type="text"
              placeholder="Search bill #, customer name, phone..."
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className={`w-full pl-10 pr-10 py-2.5 rounded-xl border ${inputBg} ${text} text-sm 
                focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 
                transition-all placeholder:text-gray-500`}
            />
            {searchQuery && (
              <button
                onClick={handleClear}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${subText} hover:text-red-500 transition-colors`}
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
            {searching && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <button
            onClick={onQrScan}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 
              hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-sm font-medium 
              transition-all shadow-md shadow-amber-500/20 whitespace-nowrap active:scale-95"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">Scan QR</span>
            <span className="sm:hidden">QR</span>
          </button>

          <button
            onClick={onReset}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${border} ${cardBg} 
              ${subText} text-sm hover:border-amber-500 hover:text-amber-500 transition-all active:scale-95`}
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium 
                transition-all border active:scale-95 ${
                  activeFilter === tab.key
                    ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20"
                    : isDark
                    ? "border-[#2a1f0f] text-gray-400 hover:border-amber-700 hover:text-amber-400"
                    : "border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600"
                }`}
            >
              {tab.icon}
              {tab.label}
              <span
                className={`px-1.5 py-0.5 rounded-md text-xs font-bold ${
                  activeFilter === tab.key
                    ? "bg-white/20 text-white"
                    : isDark
                    ? "bg-gray-800 text-gray-500"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Error */}
        {searchError && (
          <div className={`mt-3 pt-3 border-t ${border}`}>
            <div
              className={`flex items-center gap-2 text-sm ${
                isDark ? "text-red-400" : "text-red-600"
              }`}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{searchError}</span>
            </div>
          </div>
        )}

        {searchQuery && !searchError && (
          <div className={`mt-3 pt-3 border-t ${border}`}>
            <p className={`text-xs ${subText} flex items-center gap-2`}>
              <Search className="w-3 h-3 text-amber-500" />
              <span>Searching:</span>
              <span className="text-amber-500 font-medium">"{searchQuery}"</span>
              {suggestions.length > 0 && (
                <span className="text-green-500 font-bold">
                  ({suggestions.length} found)
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className={`absolute top-full left-0 right-0 mt-2 ${cardBg} border ${border} 
            rounded-2xl shadow-xl z-50 max-h-64 overflow-y-auto`}
        >
          {suggestions.map((bill) => (
            <button
              key={bill.id}
              onClick={() => handleSuggestionClick(bill)}
              className={`w-full text-left px-4 py-3 hover:bg-amber-500/10 border-b ${border} 
                last:border-b-0 transition-colors`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className={`font-semibold ${text} text-sm`}>
                    Bill #{bill.serialNo || bill.billSerial}
                  </div>
                  <div className={`text-xs ${subText} mt-0.5`}>
                    {bill.customer?.name || "Walking Customer"} ·{" "}
                    Rs. {bill.totalAmount?.toLocaleString() || 0}
                  </div>
                  <div className={`text-xs ${subText}`}>
                    {bill.customer?.phone || "No phone"}
                  </div>
                </div>
                <div
                  className={`text-xs px-2 py-1 rounded-full font-bold ${
                    bill.status === "paid"
                      ? "bg-green-500/20 text-green-400"
                      : bill.status === "pending"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {bill.status?.toUpperCase()}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

BillSearchBar.displayName = "BillSearchBar";
export default BillSearchBar;