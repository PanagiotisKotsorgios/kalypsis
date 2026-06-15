import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0f4c81" },
    secondary: { main: "#f6a623" },
    background: { default: "#f5f7fa", paper: "#ffffff" }
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: [
      "Inter",
      "Segoe UI",
      "Roboto",
      "Helvetica",
      "Arial",
      "sans-serif"
    ].join(",")
  }
});
