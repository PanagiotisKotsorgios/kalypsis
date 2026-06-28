import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { I18nextProvider } from "react-i18next";

import App from "./App";
import { theme } from "./theme";
import "./styles/editorial.css";
import "./styles/a11y.css";
import "./styles/app-mobile.css";
import { i18n } from "./i18n";
import { AuthProvider } from "./auth/AuthContext";
import { PackagesProvider } from "./auth/PackagesContext";
import { PremiumProvider } from "./auth/PremiumContext";
import { WorkspaceProvider } from "./auth/WorkspaceContext";
import { MaintenanceProvider } from "./auth/MaintenanceContext";
import { ImpersonationProvider } from "./impersonation/ImpersonationContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false }
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <MaintenanceProvider>
            <AuthProvider>
              <PackagesProvider>
                <PremiumProvider>
                  <WorkspaceProvider>
                    <ImpersonationProvider>
                      <BrowserRouter>
                        <App />
                      </BrowserRouter>
                    </ImpersonationProvider>
                  </WorkspaceProvider>
                </PremiumProvider>
              </PackagesProvider>
            </AuthProvider>
          </MaintenanceProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </I18nextProvider>
  </React.StrictMode>
);
