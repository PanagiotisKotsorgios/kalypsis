import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider, CssBaseline } from "@mui/material";

import App from "./App";
import { theme as staticLightTheme } from "./theme";
import "./styles/editorial.css";
import "./styles/a11y.css";
import "./styles/app-mobile.css";
import { i18n } from "./i18n";
import { AuthProvider } from "./auth/AuthContext";
import { PackagesProvider } from "./auth/PackagesContext";
import { PremiumProvider } from "./auth/PremiumContext";
import { UndoProvider } from "./components/UndoToast";
import { WorkspaceProvider } from "./auth/WorkspaceContext";
import { MaintenanceProvider } from "./auth/MaintenanceContext";
import { ImpersonationProvider } from "./impersonation/ImpersonationContext";
import { AuthenticatedThemeGate } from "./theme/AuthenticatedThemeGate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false }
  }
});

// Provider stack:
//
//   ThemeProvider(staticLightTheme)   ← outer, always-light theme for
//                                       every pre-login surface (landing,
//                                       login, register, contact, terms,
//                                       maintenance). No user preferences
//                                       ever leak into these pages.
//     AuthProvider                    ← authenticates + hydrates user
//       AuthenticatedThemeGate        ← inner ThemeProvider that only
//                                       reads per-user preferences AFTER
//                                       login. Overrides the outer light
//                                       theme via nested MUI theming.
//         BrowserRouter → App → routes
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={staticLightTheme}>
          <CssBaseline enableColorScheme />
          <MaintenanceProvider>
            <AuthProvider>
              <AuthenticatedThemeGate>
                <PackagesProvider>
                  <PremiumProvider>
                    <WorkspaceProvider>
                      <ImpersonationProvider>
                        <UndoProvider>
                          <BrowserRouter>
                            <App />
                          </BrowserRouter>
                        </UndoProvider>
                      </ImpersonationProvider>
                    </WorkspaceProvider>
                  </PremiumProvider>
                </PackagesProvider>
              </AuthenticatedThemeGate>
            </AuthProvider>
          </MaintenanceProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </I18nextProvider>
  </React.StrictMode>
);
