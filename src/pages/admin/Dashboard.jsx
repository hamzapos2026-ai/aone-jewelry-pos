import { useMemo } from "react";
import { useLanguage } from "../../hooks/useLanguage";
import { LayoutDashboard, Users, Package, BarChart3 } from "lucide-react";

const Dashboard = () => {
  const { language } = useLanguage();

  const t = useMemo(() => ({
    title: language === "ur" ? "ایڈمن ڈیش بورڈ" : "Admin Dashboard",
    subtitle: language === "ur" ? "نیچے کا خلاصہ دیکھیں" : "View your quick summary",
    panels: {
      users: language === "ur" ? "صارف" : "Users",
      stores: language === "ur" ? "اسٹورز" : "Stores",
      sales: language === "ur" ? "فروخت" : "Sales",
      inventory: language === "ur" ? "انوینٹری" : "Inventory",
    },
  }), [language]);

  const cards = [
    { icon: LayoutDashboard, value: 134, label: t.panels.users, bg: "from-sky-500 to-indigo-500" },
    { icon: Users, value: 45, label: t.panels.stores, bg: "from-emerald-500 to-teal-500" },
    { icon: BarChart3, value: 261, label: t.panels.sales, bg: "from-amber-500 to-orange-500" },
    { icon: Package, value: 99, label: t.panels.inventory, bg: "from-violet-500 to-fuchsia-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
        <h1 className="text-3xl font-bold mb-1 text-slate-900 dark:text-white">{t.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-300">{t.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-full bg-gradient-to-r ${card.bg} text-white mb-4`}>
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold">{card.label}</span>
              </div>
              <p className="text-4xl font-bold text-slate-900 dark:text-white">{card.value}</p>
              <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
                {language === "ur" ? "آخری 30 دن" : "Last 30 days"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;