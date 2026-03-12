import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { StoreProvider } from "./context/StoreContext";
import AppRoutes from "./routes/AppRoutes";

function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <Toaster position="top-right" />
        <AppRoutes />
      </StoreProvider>
    </AuthProvider>
  );
}

export default App;