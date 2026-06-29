import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0b2545", light: "#1d4e89", dark: "#061a36" },
    secondary: { main: "#1ea7e1" },
    background: { default: "#f4f7fb", paper: "#ffffff" },
    text: { primary: "#0b2545", secondary: "#456079" }
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: [
      "'Inter'",
      "'Manrope'",
      "Segoe UI",
      "Roboto",
      "Helvetica",
      "Arial",
      "sans-serif"
    ].join(","),
    h1: { fontWeight: 800, letterSpacing: -0.5 },
    h2: { fontWeight: 800, letterSpacing: -0.5 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: "none" }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8 }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: "0 4px 24px rgba(11, 37, 69, 0.06)" }
      }
    },
    // Make the required-field asterisk red across every form (login, register,
    // forgot-password, contact, etc.) — the visible signal is what users expect.
    MuiFormLabel: {
      styleOverrides: {
        asterisk: {
          color: "#d32f2f",
          fontWeight: 700,
          marginLeft: 2,
          "&.Mui-error": { color: "#d32f2f" }
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        asterisk: {
          color: "#d32f2f",
          fontWeight: 700,
          marginLeft: 2
        }
      }
    }
  }
});
