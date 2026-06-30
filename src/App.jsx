import React from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./components/ui/Toast/ToastProvider";
import { ConfirmProvider } from "./components/ui/ConfirmProvider";
import Routes from "./Routes";

function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <Routes />
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
