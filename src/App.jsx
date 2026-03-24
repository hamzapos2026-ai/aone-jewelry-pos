import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { StoreProvider } from "./context/StoreContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { SetupProvider } from "./context/SetupContext"; // ⭐ NEW
import AppRoutes from "./routes/AppRoutes";

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SetupProvider> {/* ⭐ NEW - Setup check ke liye */}
          <AuthProvider>
            <StoreProvider>
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    borderRadius: "12px",
                    background: "#111",
                    color: "#fbbf24",
                    border: "1px solid rgba(251,191,36,0.3)",
                  },
                }}
              />
              <AppRoutes />
            </StoreProvider>
          </AuthProvider>
        </SetupProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;