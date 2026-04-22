// src/App.jsx - FIXED (removed duplicate Toaster)
import { Toaster } from "react-hot-toast";
import { AuthProvider }     from "./context/AuthContext";
import { StoreProvider }    from "./context/StoreContext";
import { ThemeProvider }    from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { SetupProvider }    from "./context/SetupContext";
import { SettingsProvider } from "./context/SettingsContext";
import AppRoutes from "./routes/AppRoutes";

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SetupProvider>
          <AuthProvider>
            <StoreProvider>
              <SettingsProvider>
                {/* ✅ Single Toaster - only here, removed from main.jsx */}
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 3000,
                    style: {
                      borderRadius: "12px",
                      background:   "#111",
                      color:        "#fbbf24",
                      border:       "1px solid rgba(251,191,36,0.3)",
                    },
                    success: {
                      duration: 3000,
                      style: {
                        background: "#111",
                        color:      "#4ade80",
                        border:     "1px solid rgba(74,222,128,0.3)",
                      },
                    },
                    error: {
                      duration: 4000,
                      style: {
                        background: "#111",
                        color:      "#f87171",
                        border:     "1px solid rgba(248,113,113,0.3)",
                      },
                    },
                  }}
                />
                <AppRoutes />
              </SettingsProvider>
            </StoreProvider>
          </AuthProvider>
        </SetupProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;