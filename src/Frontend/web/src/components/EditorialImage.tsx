import { Box, type SxProps, type Theme } from "@mui/material";

/**
 * An editorial-treated photograph: warm sepia duotone tinted toward the
 * paper palette + a soft top/bottom vignette + grain overlay. Matches the
 * Mediterranean Editorial direction so photos read as part of the printed
 * spread rather than stock dropped in.
 */
export function EditorialImage({
  src,
  alt,
  caption,
  aspect = "5 / 4",
  align = "left",
  sx
}: {
  src: string;
  alt?: string;
  caption?: string;
  aspect?: string;
  align?: "left" | "right";
  sx?: SxProps<Theme>;
}) {
  return (
    <Box sx={{ position: "relative", ...sx }}>
      <Box sx={{
        position: "relative",
        aspectRatio: aspect,
        overflow: "hidden",
        bgcolor: "var(--paper-deep)",
        // Hairline frame like a magazine plate
        outline: "1px solid var(--rule)",
        outlineOffset: -1
      }}>
        <Box
          component="img"
          src={src}
          alt={alt ?? ""}
          loading="lazy"
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            // Warm editorial duotone: lift, slightly desaturate, tint toward sepia
            filter: "saturate(0.7) contrast(1.04) sepia(0.18)",
            display: "block"
          }}
        />
        {/* Top + bottom vignettes — keeps text legible if used as backdrop */}
        <Box sx={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(245,237,225,0.15) 0%, rgba(245,237,225,0) 32%, rgba(11,37,69,0.08) 100%)"
        }} />
        {/* Grain overlay */}
        <Box className="editorial-grain" sx={{ position: "absolute", inset: 0 }} />
      </Box>
      {caption && (
        <Box sx={{
          mt: 1.5,
          display: "flex",
          justifyContent: align === "right" ? "flex-end" : "flex-start",
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--ink-muted)"
        }}>
          — {caption}
        </Box>
      )}
    </Box>
  );
}
