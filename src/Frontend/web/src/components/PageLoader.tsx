import { Box, CircularProgress, Fade, Stack, Typography } from "@mui/material";
import { KalypsisLogo } from "./KalypsisLogo";

/** A centered, branded loading state used while the secure app shell loads. */
export function PageLoader({ minHeight = "60vh" }: { minHeight?: number | string }) {
  return (
    <Fade in style={{ transitionDelay: "200ms" }}>
      <Box sx={{ minHeight, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
        <Stack alignItems="center" spacing={1.5} sx={{ px: 3, py: 4 }}>
          <Box
            aria-label="Kalypsis"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              px: 1.5,
              py: 1,
              borderRadius: 2.5,
              bgcolor: "#eef6fb",
              border: "1px solid #cfe3f0",
              boxShadow: "0 8px 22px rgba(11,37,69,.10)"
            }}
          >
            <KalypsisLogo size={80} crop />
          </Box>
          <Typography variant="h6" sx={{ color: "#0b2545", fontWeight: 800, letterSpacing: "0.01em" }}>
            Kalypsis
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CircularProgress size={20} thickness={4} sx={{ color: "#1e7bb8" }} />
            <Typography variant="body2" color="text.secondary">
              Φόρτωση ασφαλούς περιβάλλοντος…
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Fade>
  );
}
