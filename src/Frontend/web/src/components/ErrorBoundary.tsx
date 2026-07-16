import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Box, Button, Card, Stack, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import BugReportIcon from "@mui/icons-material/BugReport";

/**
 * Route-level error boundary. Wraps every page render so a component throw
 * shows a recovery card instead of white-screening the entire app.
 *
 * Historically a single broken page (e.g. wrong shape on an API response)
 * would kill React's tree and leave a blank canvas — no way for the user to
 * recover except a hard refresh, and worse: after clicking around some
 * routes stayed broken because the shell state was gone. Wrapping the
 * routed page in this boundary keeps the AppShell + sidebar alive and gives
 * the user a "reload page" button that actually works.
 *
 * Reset key: pass the current URL path so navigating away automatically
 * clears any prior error (React remounts the boundary when key changes).
 */
interface Props {
  children: ReactNode;
  /** Change this whenever the surrounding context changes (e.g. route path) so the boundary resets. */
  resetKey?: string;
  /** Optional fallback override — defaults to the recovery card. */
  fallback?: ReactNode;
}
interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Surface the crash to the browser console so devs can grab the stack.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] page threw:", error, errorInfo);
    this.setState({ errorInfo });
  }

  componentDidUpdate(prevProps: Props) {
    // When the reset key changes (typically the route path), clear any
    // previously captured error so the fresh route gets a clean boundary.
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, errorInfo: null });
    }
  }

  reset = () => this.setState({ error: null, errorInfo: null });
  reload = () => window.location.reload();

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const msg = this.state.error.message || "Απρόσμενο σφάλμα";
    const stack = this.state.error.stack ?? "";

    return (
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 720, mx: "auto" }}>
        <Card sx={{ p: { xs: 3, md: 4 }, border: 1, borderColor: "error.light" }}>
          <Stack direction="row" spacing={2} alignItems="center" mb={2}>
            <BugReportIcon color="error" sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h5" fontWeight={800}>
                Κάτι πήγε στραβά σε αυτή τη σελίδα
              </Typography>
              <Typography color="text.secondary">
                Ο υπόλοιπος πίνακας εξακολουθεί να λειτουργεί — πάτησε «Ανανέωση» ή πλοηγήσου αλλού.
              </Typography>
            </Box>
          </Stack>

          <Alert severity="error" sx={{ mb: 2, fontFamily: "monospace", fontSize: 13 }}>
            {msg}
          </Alert>

          <Stack direction="row" spacing={1.5} mb={2}>
            <Button variant="contained" startIcon={<RefreshIcon />} onClick={this.reload}>
              Ανανέωση σελίδας
            </Button>
            <Button variant="outlined" onClick={this.reset}>
              Δοκίμασε ξανά
            </Button>
          </Stack>

          {import.meta.env.DEV && stack && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer", color: "#666", fontSize: 12 }}>
                Λεπτομέρειες (dev only)
              </summary>
              <Box component="pre" sx={{
                mt: 1, p: 2, borderRadius: 1,
                bgcolor: "rgba(0,0,0,0.04)", overflow: "auto",
                fontSize: 11, lineHeight: 1.5, maxHeight: 320
              }}>
                {stack}
              </Box>
            </details>
          )}
        </Card>
      </Box>
    );
  }
}
