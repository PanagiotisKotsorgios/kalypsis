import { Box, Stack, Typography } from "@mui/material";

interface KalypsisLogoProps {
  size?: number;
  showText?: boolean;
  variant?: "horizontal" | "icon";
  color?: "default" | "light";
}

export function KalypsisLogo({
  size = 40,
  showText = true,
  variant = "horizontal",
  color = "default"
}: KalypsisLogoProps) {
  const textColor = color === "light" ? "common.white" : "primary.main";

  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box
        component="img"
        src="/kalypsis-logo.jpg"
        alt="Kalypsis"
        sx={{
          height: size,
          width: "auto",
          objectFit: "contain",
          mixBlendMode: color === "light" ? "screen" : "multiply"
        }}
      />
      {showText && variant === "horizontal" && (
        <Stack spacing={0}>
          <Typography variant="h6" sx={{ color: textColor, lineHeight: 1.1, fontWeight: 800 }}>
            KALYPSIS
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: color === "light" ? "rgba(255,255,255,0.7)" : "text.secondary", letterSpacing: 1 }}
          >
            INSURANCE PLATFORM
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
