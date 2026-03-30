import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Unauthorized = () => {
  const navigate = useNavigate();
  const session = JSON.parse(localStorage.getItem("session") || "null");

  const handleGoBack = () => {
    if (!session?.role) {
      navigate("/login", { replace: true });
      return;
    }

    switch (session.role) {
      case "superadmin":
        navigate("/superadmin/dashboard", { replace: true });
        break;
      case "admin":
        navigate("/admin/dashboard", { replace: true });
        break;
      case "manager":
        navigate("/manager/dashboard", { replace: true });
        break;
      case "cashier":
        navigate("/cashier/dashboard", { replace: true });
        break;
      case "biller":
        navigate("/biller/dashboard", { replace: true });
        break;
      default:
        navigate("/login", { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-black to-gray-900 px-4">
      <div className="w-full max-w-md rounded-3xl border border-yellow-500/20 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <ShieldAlert size={30} className="text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-yellow-400">Unauthorized Access</h1>
        <p className="mt-3 text-sm leading-6 text-gray-400">
          You do not have permission to access this page.
        </p>

        <button
          onClick={handleGoBack}
          className="mt-6 rounded-xl bg-yellow-500 px-5 py-2.5 font-semibold text-black transition hover:bg-yellow-400"
        >
          Go Back
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;