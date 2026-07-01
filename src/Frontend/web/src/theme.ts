import { createTheme, type Theme } from "@mui/material/styles";

/**
 * Palette / typography / component overrides for both light and dark modes.
 * Dark mode preserves the Kalypsis navy identity but flips backgrounds and
 * text so the platform stays readable at night. Density comes in via a
 * `spacing` scale factor so lists and cards can be compacted per-user.
 */
export function buildKalypsisTheme(mode: "light" | "dark", density: "comfortable" | "compact"): Theme {
  const dark = mode === "dark";
  const scale = density === "compact" ? 6 : 8; // MUI spacing unit
  return createTheme({
    palette: dark
      ? {
          mode: "dark",
          primary:   { main: "#1ea7e1", light: "#54b7ea", dark: "#0f5883" },
          secondary: { main: "#6fd2ff" },
          background: { default: "#0b1522", paper: "#111d2e" },
          text:      { primary: "#e6eef7", secondary: "#a6b5c6" },
          divider:   "rgba(148,191,230,0.18)"
        }
      : {
          mode: "light",
          primary:   { main: "#0b2545", light: "#1d4e89", dark: "#061a36" },
          secondary: { main: "#1ea7e1" },
          background: { default: "#f4f7fb", paper: "#ffffff" },
          text:      { primary: "#0b2545", secondary: "#456079" }
        },
    spacing: scale,
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
        styleOverrides: { root: { borderRadius: 8 } }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: dark
              ? "0 4px 24px rgba(0,0,0,0.35)"
              : "0 4px 24px rgba(11, 37, 69, 0.06)"
          }
        }
      },
      // Make the required-field asterisk red across every form so the
      // visible signal matches user expectation.
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
          asterisk: { color: "#d32f2f", fontWeight: 700, marginLeft: 2 }
        }
      }
    }
  });
}

/** Back-compat default light theme — used only by the initial render before
 * the localStorage-backed KalypsisThemeProvider kicks in. */
export const theme = buildKalypsisTheme("light", "comfortable");
