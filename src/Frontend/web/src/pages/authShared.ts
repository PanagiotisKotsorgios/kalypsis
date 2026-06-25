// Shared styles for the pre-login auth pages (Login / Register / Forgot).
// Centralised so all three pages stay visually identical and tweaks land
// everywhere at once.

/** Bigger TextField with a darker navy hairline border. */
export const authFieldSx = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "#ffffff",
    borderRadius: 2,
    fontSize: 17,
    "& fieldset": {
      borderWidth: 1.5,
      borderColor: "rgba(11,37,69,0.32)"
    },
    "&:hover fieldset": { borderColor: "rgba(11,37,69,0.65)", borderWidth: 1.5 },
    "&.Mui-focused fieldset": { borderColor: "#0b2545", borderWidth: 2 }
  },
  "& .MuiOutlinedInput-input": {
    py: 2,
    fontSize: 17,
    color: "#0b2545"
  }
} as const;

/** Big primary submit button — same dimensions on every auth form. */
export const authButtonSx = {
  py: 1.9,
  borderRadius: 2,
  fontWeight: 800,
  fontSize: 18,
  letterSpacing: "0.02em",
  textTransform: "none",
  bgcolor: "#0b2545",
  "&:hover": { bgcolor: "#1f3a64" }
} as const;

/** Input label sizing applied via `InputLabelProps={{ sx: authLabelSx }}`. */
export const authLabelSx = { fontSize: 16, fontWeight: 500 } as const;
