import { Outlet } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

const CashierLayout = () => {
  const { isDark } = useTheme();
  
  return (
    <div
      className={`min-h-screen w-full ${
        isDark ? "bg-[#0a0805]" : "bg-gray-50"
      }`}
    >
      <Outlet />
    </div>
  );
};

export default CashierLayout;