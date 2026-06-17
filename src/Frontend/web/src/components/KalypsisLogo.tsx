import { Box } from "@mui/material";

interface KalypsisLogoProps {
  /** Logo image height in px */
  size?: number;
  /** Color treatment for the image (mix-blend tweak for dark backgrounds) */
  color?: "default" | "light";
  /**
   * Crop the left/right whitespace baked into the source asset. The container
   * width is shrunk relative to the image's natural ratio and the image is
   * scaled to cover, so the centred wordmark fills the space tightly.
   */
  crop?: boolean;
}

/**
 * The brand mark. The source asset is roughly 3:2 with padding on the sides —
 * `crop` shrinks the container's aspect ratio so the wordmark reads larger
 * for the same row height.
 */
export function KalypsisLogo({ size = 56, color = "default", crop = false }: KalypsisLogoProps) {
  if (crop) {
    // Container aspect ≈ 1.55:1 (vs natural 3:2 = 1.5:1) — wider than tall,
    // so cover-fit crops a touch off the left/right padding of the source.
    return (
      <Box
        sx={{
          height: size,
          width: size * 1.55,
          overflow: "hidden",
          flexShrink: 0,
          display: "block",
          // Tighter visual: a tiny inset hides the very edge of the JPG
          // compression band on white-on-white asset edges.
          borderRadius: 0.5
        }}
      >
        <Box
          component="img"
          src="/kalypsis-logo.jpg"
          alt="Kalypsis"
          sx={{
            height: "100%",
            width: "112%",
            marginLeft: "-6%",
            objectFit: "cover",
            objectPosition: "center",
            display: "block",
            mixBlendMode: color === "light" ? "screen" : "multiply",
            filter: color === "light" ? "brightness(1.15) contrast(1.05)" : "none"
          }}
        />
      </Box>
    );
  }

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
