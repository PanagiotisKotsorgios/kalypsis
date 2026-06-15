import { Box, type SxProps, type Theme } from "@mui/material";

interface BrandImageProps {
  seed: string;
  width?: number;
  height?: number;
  blur?: number;
  overlay?: "dark" | "navy" | "navy-strong" | "tint" | "none";
  sx?: SxProps<Theme>;
  rounded?: boolean;
  aspect?: string;
}

/**
 * A background image from picsum.photos (deterministic via seed),
 * with a branded gradient overlay so it reads as a designer-curated
 * marketing image rather than a random stock photo.
 */
export function BrandImage({
  seed,
  width = 1600,
  height = 900,
  blur = 0,
  overlay = "navy",
  sx,
  rounded = false,
  aspect
}: BrandImageProps) {
  const url = `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}${blur > 0 ? `?blur=${blur}` : ""}`;

  const gradient =
    overlay === "navy-strong"
      ? "linear-gradient(120deg, rgba(11,37,69,0.94) 0%, rgba(29,78,137,0.82) 60%, rgba(30,167,225,0.55) 130%)"
      : overlay === "navy"
      ? "linear-gradient(120deg, rgba(11,37,69,0.88) 0%, rgba(29,78,137,0.68) 60%, rgba(30,167,225,0.32) 130%)"
      : overlay === "tint"
      ? "linear-gradient(120deg, rgba(11,37,69,0.55) 0%, rgba(11,37,69,0.18) 100%)"
      : overlay === "dark"
      ? "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.7) 100%)"
      : "none";

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          overlay === "none" ? `url("${url}")` : `${gradient}, url("${url}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: rounded ? 3 : 0,
        aspectRatio: aspect,
        ...sx
      }}
    />
  );
}
