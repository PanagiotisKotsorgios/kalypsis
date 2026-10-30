import { Box, Typography } from "@mui/material";

export function CompanyComingSoonBadge({ english }: { english: boolean }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", px: 2, py: 1.25, bgcolor: "#e8f3fd", borderBottom: "1px solid #c7e0f4" }}>
      <Typography role="status" sx={{ px: 2, py: .65, borderRadius: 999, bgcolor: "#0b2545", color: "#fff", fontSize: { xs: 12, sm: 14 }, fontWeight: 850, letterSpacing: ".025em", textAlign: "center" }}>
        {english ? "In development · Coming soon" : "Υπό ανάπτυξη · Σύντομα κοντά σας"}
      </Typography>
    </Box>
  );
}
