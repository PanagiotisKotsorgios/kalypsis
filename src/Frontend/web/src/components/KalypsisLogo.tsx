import { Box, Stack, Typography } from "@mui/material";

interface KalypsisLogoProps {
  /** Logo image height in px */
  size?: number;
  /** Show the wordmark text next to the icon */
  showText?: boolean;
  /** Show the tagline below the wordmark */
  showTagline?: boolean;
  /** Color treatment */
  color?: "default" | "light";
}

export function KalypsisLogo({
  size = 56,
  showText = true,
  showTagline = false,
  color = "default"
}: KalypsisLogoProps) {
  const titleColor = color === "light" ? "common.white" : "primary.main";
  const subColor = color === "light" ? "rgba(255,255,255,0.78)" : "text.secondary";

  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
      <Box
        component="img"
        src="/kalypsis-logo.jpg"
        alt="Kalypsis"
        sx={{
          height: size,
          width: "auto",
          objectFit: "contain",
          mixBlendMode: color === "light" ? "screen" : "multiply",
          filter: color === "light" ? "brightness(1.1) contrast(1.05)" : "none",
          flexShrink: 0
        }}
      />
      {showText && (
        <Stack spacing={0} sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              color: titleColor,
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: -0.5,
              fontFamily: "'Manrope', 'Inter', sans-serif",
              fontSize: size > 60 ? 28 : size > 44 ? 22 : 18
            }}
          >
            KALYPSIS
          </Typography>
          {showTagline && (
            <Typography
              variant="caption"
              sx={{
                color: subColor,
                letterSpacing: 1.4,
                fontSize: 11,
                textTransform: "uppercase",
                mt: 0.4
              }}
            >
              Insurance Platform
            </Typography>
          )}
        </Stack>
      )}
    </Stack>
  );
}
