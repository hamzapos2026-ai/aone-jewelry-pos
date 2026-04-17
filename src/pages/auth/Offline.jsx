import { useEffect } from "react";
import { WifiOff, RefreshCcw, AlertTriangle } from "lucide-react";

const Offline = ({ setupIncomplete = false }) => {
  const handleRetry = () => {
    if (navigator.onLine) {
      window.location.reload();
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      window.location.reload();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-black to-gray-900 px-4">
      <div className="w-full max-w-md rounded-3xl border border-yellow-500/20 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          {setupIncomplete ? (
            <AlertTriangle size={30} className="text-orange-400" />
          ) : (
            <WifiOff size={30} className="text-red-400" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-yellow-400">
          {setupIncomplete ? "Setup Required" : "You are offline"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-400">
          {setupIncomplete
            ? "The application setup is not complete. Please connect to the internet to complete the initial setup."
            : "Internet connection lost. Only billers can work offline. Please check your network connection and try again."
          }
        </p>

        <button
          onClick={handleRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 font-semibold text-black transition hover:bg-yellow-400"
        >
          <RefreshCcw size={16} />
          Retry
        </button>
      </div>
    </div>
  );
};

export default Offline;