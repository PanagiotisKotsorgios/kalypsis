import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "./auth/AuthContext";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider, CssBaseline } from "@mui/material";

import App from "./App";
import { theme as staticLightTheme } from "./theme";
import "./styles/editorial.css";
import "./styles/a11y.css";
import "./styles/app-mobile.css";
import "./styles/print.css";
import { i18n } from "./i18n";
import { AuthProvider } from "./auth/AuthContext";
import { PackagesProvider } from "./auth/PackagesContext";
import { PremiumProvider } from "./auth/PremiumContext";
import { UndoProvider } from "./components/UndoToast";
import { WorkspaceProvider } from "./auth/WorkspaceContext";
import { MaintenanceProvider } from "./auth/MaintenanceContext";
import { ImpersonationProvider } from "./impersonation/ImpersonationContext";
import { AuthenticatedThemeGate } from "./theme/AuthenticatedThemeGate";

// Global drag defence — if the user drags files from Explorer/Finder
// and drops them ANYWHERE on the page that isn't wired to accept an
// upload, the browser's default action is to navigate the tab to the
// file:// URL. That's a full-page navigation which the user perceives
// as a "soft refresh": the SPA reloads, dialogs close, filters reset.
// We swallow every stray dragover/drop at the window level; local
// drop zones (upload dialogs, etc.) still work because their own
// stopPropagation happens BEFORE the bubble reaches window.
if (typeof window !== "undefined") {
  const swallow = (e: DragEvent) => {
    // If a nested handler explicitly said "yes, I'm accepting this
    // drop" (called preventDefault) we still want to prevent the
    // browser from navigating. If nothing accepted, still block —
    // stray navigation is never the right outcome for a Kalypsis page.
    e.preventDefault();
  };
  window.addEventListener("dragover", swallow, false);
  window.addEventListener("drop", swallow, false);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Long default staleTime + no auto-refetch on mount / reconnect
      // keeps background refetches from firing while a modal / drawer
      // is open — which was closing dialogs and losing scroll/filter
      // state on data-heavy pages. Individual pages that DO want
      // polling (Ermes inbox, notification bell, bridge imports) opt
      // in explicitly via `refetchInterval` on their own query.
      staleTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    }
  }
});

/**
 * Purges the react-query cache whenever the signed-in user changes.
 * Without this, user-A's cached /customers, /policies, /reports etc.
 * would briefly render for user-B on the next login before individual
 * queries re-fired — a real data-leak on any shared browser. Uses a
 * ref to detect actual transitions (undefined → id, id-a → id-b) and
 * skips same-user re-renders + first mount.
 */
function AuthQueryCacheReset() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const last = useRef<string | null | undefined>(user?.userId);
  useEffect(() => {
    const prev = last.current;
    const now = user?.userId;
    if (prev !== undefined && prev !== now) {
      qc.clear();
    }
    last.current = now;
  }, [user?.userId, qc]);
  return null;
}

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
              <AuthQueryCacheReset />
              <AuthenticatedThemeGate>
                {/* Impersonation must sit ABOVE PackagesProvider so the
                    packages hook can react to «entered as tenant X» and
                    re-fetch /me/packages — otherwise superadmin toggling
                    packages for a tenant they've entered goes unnoticed. */}
                <ImpersonationProvider>
                  <PackagesProvider>
                    <PremiumProvider>
                      <WorkspaceProvider>
                        <UndoProvider>
                          <BrowserRouter>
                            <App />
                          </BrowserRouter>
                        </UndoProvider>
                      </WorkspaceProvider>
                    </PremiumProvider>
                  </PackagesProvider>
                </ImpersonationProvider>
              </AuthenticatedThemeGate>
            </AuthProvider>
          </MaintenanceProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </I18nextProvider>
  </React.StrictMode>
);
