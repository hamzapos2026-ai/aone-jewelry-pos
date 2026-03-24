import { useState } from "react";
import { Camera, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../hooks/useTheme";

const BarcodeScanner = ({ isOpen, onClose, onScan }) => {
  const { isDark } = useTheme();
  const [code, setCode] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.trim()) {
      onScan(code);
      setCode("");
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl border-2 p-6 ${
              isDark ? "border-yellow-500/30 bg-gray-900" : "border-yellow-300 bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                Scan Barcode
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className={`flex items-center justify-center h-40 rounded-xl mb-4 ${
              isDark ? "bg-white/5" : "bg-gray-100"
            }`}>
              <Camera size={48} className="text-yellow-500" />
            </div>

            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter barcode manually..."
                className={`w-full rounded-xl border-2 px-4 py-3 mb-4 outline-none ${
                  isDark
                    ? "border-yellow-500/30 bg-white/5 text-white"
                    : "border-yellow-300 bg-white text-gray-900"
                }`}
                autoFocus
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 py-3 font-semibold text-black"
              >
                Submit
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BarcodeScanner;