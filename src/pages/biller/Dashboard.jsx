import { useTheme } from "../../hooks/useTheme";

const Dashboard = () => {
  const { isDark } = useTheme();

  return (
    <div
      className={`rounded-2xl border p-6 ${
        isDark
          ? "border-white/10 bg-white/5 text-white"
          : "border-gray-200 bg-white text-gray-900"
      }`}
    >
      <h1 className="text-2xl font-bold">Biller Dashboard</h1>
      <p className={`mt-2 text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
        Welcome to the biller panel.
      </p>
    </div>
  );
};

export default Dashboard;