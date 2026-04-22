import React, { useState, useEffect } from "react";
import {
  FiSearch,
  FiXCircle,
  FiRefreshCw,
  FiClock,
  FiCheckCircle,
  FiX,
  FiAlertTriangle,
  FiFileText,
} from "react-icons/fi";
import { BsQrCode } from "react-icons/bs";

const BillSearchBar = ({
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

  const cardBg = isDark ? "bg-[#1a1208]" : "bg-white";
  const border = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text = isDark ? "text-gray-100" : "text-gray-900";
  const subText = isDark ? "text-gray-400" : "text-gray-500";
  const inputBg = isDark
    ? "bg-[#120d06] border-[#2a1f0f]"
    : "bg-gray-50 border-gray-200";

  const filterTabs = [
    {
      key: "all",
      label: "All Bills",
      count: stats.total,
      icon: <FiFileText className="w-3 h-3" />,
    },
    {
      key: "pending",
      label: "Pending",
      count: stats.pending,
      icon: <FiClock className="w-3 h-3" />,
    },
    {
      key: "paid",
      label: "Paid",
      count: stats.paid,
      icon: <FiCheckCircle className="w-3 h-3" />,
    },
    {
      key: "cancelled",
      label: "Cancelled",
      count: stats.cancelled,
      icon: <FiX className="w-3 h-3" />,
    },
  ];

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSuggestions(value.length >= 2);
  };

  const handleSuggestionClick = (bill) => {
    setSearchQuery("");
    setShowSuggestions(false);
    if (onBillSelect) onBillSelect(bill);
  };

  const handleInputFocus = () => {
    if (searchQuery.length >= 2 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow clicks
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div className="relative">
      <div className={`${cardBg} border ${border} rounded-2xl p-4`}>
        {/* Search Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <FiSearch
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${subText}`}
            />
            <input
              type="text"
              placeholder="Search bill number, customer name, phone..."
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className={`w-full pl-10 pr-10 py-2.5 rounded-xl border ${inputBg} ${text} text-sm 
                focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 
                transition-all placeholder:text-gray-500`}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowSuggestions(false);
                }}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${subText} 
                  hover:text-red-500 transition-colors`}
              >
                <FiXCircle className="w-4 h-4" />
              </button>
            )}
            {searching && (
              <div className="absolute right-12 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* QR Scanner Button */}
          <button
            onClick={onQrScan}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 
              hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-sm font-medium 
              transition-all shadow-md shadow-amber-500/20 whitespace-nowrap active:scale-95"
          >
            <BsQrCode className="w-4 h-4" />
            <span className="hidden sm:inline">Scan QR</span>
            <span className="sm:hidden">QR</span>
          </button>

          {/* Reset Button */}
          <button
            onClick={onReset}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${border} ${cardBg} 
              ${subText} text-sm hover:border-amber-500 hover:text-amber-500 transition-all 
              active:scale-95`}
          >
            <FiRefreshCw className="w-4 h-4" />
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
                className={`px-1.5 py-0.5 rounded-md text-xs ${
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
            <div className={`flex items-center gap-2 text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>
              <FiAlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{searchError}</span>
            </div>
          </div>
        )}

        {/* Search Results Count */}
        {searchQuery && !searchError && (
          <div className={`mt-3 pt-3 border-t ${border}`}>
            <p className={`text-xs ${subText} flex items-center gap-2`}>
              <FiSearch className="w-3 h-3 text-amber-500" />
              <span>Searching for:</span>
              <span className="text-amber-500 font-medium">"{searchQuery}"</span>
              {suggestions.length > 0 && (
                <span className="text-green-500">
                  ({suggestions.length} found)
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Auto-Suggest Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className={`absolute top-full left-0 right-0 mt-2 ${cardBg} border ${border} rounded-2xl shadow-xl z-50 max-h-64 overflow-y-auto`}>
          {suggestions.map((bill) => (
            <button
              key={bill.id}
              onClick={() => handleSuggestionClick(bill)}
              className={`w-full text-left px-4 py-3 hover:bg-amber-500/10 border-b ${border} last:border-b-0 transition-colors`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className={`font-semibold ${text} text-sm`}>
                    Bill #{bill.serialNo || bill.billSerial}
                  </div>
                  <div className={`text-xs ${subText} mt-1`}>
                    {bill.customer?.name || "Walking Customer"} • Rs. {bill.totalAmount?.toLocaleString() || 0}
                  </div>
                  <div className={`text-xs ${subText}`}>
                    {bill.customer?.phone || "No phone"} • {new Date(bill.createdAt?.toDate?.() || bill.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className={`text-xs px-2 py-1 rounded-full ${
                  bill.status === "paid"
                    ? "bg-green-500/20 text-green-400"
                    : bill.status === "pending"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-red-500/20 text-red-400"
                }`}>
                  {bill.status}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default BillSearchBar;