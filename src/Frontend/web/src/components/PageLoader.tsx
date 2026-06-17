import { Box, CircularProgress, Fade } from "@mui/material";

/**
 * A centered loading spinner that fades in after 200ms so we don't flash on
 * quick loads. Use anywhere a page or section is waiting on data.
 */
export function PageLoader({ minHeight = "60vh" }: { minHeight?: number | string }) {
  return (
    <Fade in style={{ transitionDelay: "200ms" }}>
      <Box
        sx={{
          minHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%"
        }}
      >
        <CircularProgress size={48} thickness={4} />
      </Box>
    </Fade>
  );
}
