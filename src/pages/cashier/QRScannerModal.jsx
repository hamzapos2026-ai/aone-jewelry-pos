import React, { useEffect, useRef, useState } from "react";
import { FiX, FiCamera } from "react-icons/fi";
import { BsQrCode } from "react-icons/bs";
import { toast } from "react-hot-toast";

const QRScannerModal = ({ isDark, onResult, onClose }) => {
  const [manualInput, setManualInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const cardBg = isDark ? "bg-[#1a1208]" : "bg-white";
  const border = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text = isDark ? "text-gray-100" : "text-gray-900";
  const subText = isDark ? "text-gray-400" : "text-gray-500";
  const inputBg = isDark
    ? "bg-[#120d06] border-[#2a1f0f] text-gray-100"
    : "bg-gray-50 border-gray-200 text-gray-900";

  const startCamera = async () => {
    try {
      setScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error("Camera access denied or not available");
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const handleManualSubmit = () => {
    if (!manualInput.trim()) {
      toast.error("Please enter a bill number");
      return;
    }
    onResult(manualInput.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className={`relative w-full max-w-sm ${cardBg} rounded-2xl border ${border} shadow-2xl`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <BsQrCode className="text-amber-500 w-5 h-5" />
            </div>
            <h2 className={`font-bold text-base ${text}`}>Scan QR Code</h2>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${subText} hover:text-red-500`}>
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Camera Preview */}
          <div
            className={`aspect-square rounded-xl overflow-hidden border-2 border-dashed ${
              scanning ? "border-amber-500" : border
            } flex items-center justify-center relative ${
              isDark ? "bg-[#0f0a04]" : "bg-gray-100"
            }`}
          >
            {scanning ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Scanner Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-amber-500 rounded-lg">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-amber-500 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-amber-500 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-amber-500 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-amber-500 rounded-br-lg" />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center">
                <BsQrCode className={`w-16 h-16 ${subText} mx-auto mb-3 opacity-30`} />
                <p className={`text-sm ${subText}`}>Camera not started</p>
              </div>
            )}
          </div>

          {/* Camera Controls */}
          {!scanning ? (
            <button
              onClick={startCamera}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all"
            >
              <FiCamera className="w-4 h-4" />
              Start Camera
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="w-full py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-500 text-sm font-medium flex items-center justify-center gap-2 transition-all"
            >
              Stop Camera
            </button>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className={`flex-1 h-px ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
            <span className={`text-xs ${subText}`}>OR enter manually</span>
            <div className={`flex-1 h-px ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          </div>

          {/* Manual Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              placeholder="Enter bill number e.g. BILL-001"
              className={`flex-1 px-3 py-2.5 rounded-xl border text-sm ${inputBg} focus:outline-none focus:border-amber-500`}
            />
            <button
              onClick={handleManualSubmit}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-all"
            >
              Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;