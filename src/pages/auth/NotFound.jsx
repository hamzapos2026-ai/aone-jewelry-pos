import { FileWarning } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useNetworkStatus from "../../hooks/useNetworkStatus";

const NotFound = () => {
  const navigate = useNavigate();
  const isOnline = useNetworkStatus();

  const handleNavigation = () => {
    if (!isOnline) {
      // When offline, try to get auth state from localStorage
      try {
        const userData = localStorage.getItem("userData");
        const setupComplete = localStorage.getItem("setupComplete") === "true";

        if (!setupComplete) {
          navigate("/", { replace: true });
          return;
        }

        if (userData) {
          const parsedUserData = JSON.parse(userData);
          if (parsedUserData.role === "biller") {
            navigate("/biller/dashboard", { replace: true });
            return;
          }
        }

        navigate("/auth/login", { replace: true });
      } catch (error) {
        navigate("/auth/login", { replace: true });
      }
    } else {
      navigate("/auth/login", { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-black to-gray-900 px-4">
      <div className="w-full max-w-md rounded-3xl border border-yellow-500/20 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
          <FileWarning size={30} className="text-yellow-400" />
        </div>

        <h1 className="text-4xl font-bold text-yellow-400">404</h1>
        <p className="mt-2 text-lg font-semibold text-white">Page Not Found</p>
        <p className="mt-3 text-sm leading-6 text-gray-400">
          The page you are looking for does not exist or has been moved.
          {!isOnline && " You appear to be offline."}
        </p>

        <button
          onClick={handleNavigation}
          className="mt-6 rounded-xl bg-yellow-500 px-5 py-2.5 font-semibold text-black transition hover:bg-yellow-400"
        >
          {isOnline ? "Go to Login" : "Go to Dashboard"}
        </button>
      </div>
    </div>
  );
};

export default NotFound;