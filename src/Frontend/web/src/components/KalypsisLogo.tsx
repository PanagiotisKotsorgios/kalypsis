import { Box } from "@mui/material";

interface KalypsisLogoProps {
  /** Logo image height in px */
  size?: number;
  /** Color treatment for the image (mix-blend tweak for dark backgrounds) */
  color?: "default" | "light";
}

/**
 * The brand mark. The logo image itself already contains the wordmark and tagline,
 * so we never render text alongside it.
 */
export function KalypsisLogo({ size = 56, color = "default" }: KalypsisLogoProps) {
  return (
    <Box
      component="img"
      src="/kalypsis-logo.jpg"
      alt="Kalypsis"
      sx={{
        height: size,
        width: "auto",
        objectFit: "contain",
        display: "block",
        mixBlendMode: color === "light" ? "screen" : "multiply",
        filter: color === "light" ? "brightness(1.15) contrast(1.05)" : "none",
        flexShrink: 0
      }}
    />
  );
}
