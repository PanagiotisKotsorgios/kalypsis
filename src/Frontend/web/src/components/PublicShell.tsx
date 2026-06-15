import { Box, type SxProps, type Theme } from "@mui/material";
import type { ReactNode } from "react";
import { PublicNav } from "./PublicNav";
import { PublicFooter } from "./PublicFooter";

interface PublicShellProps {
  overlayHero?: boolean;
  children: ReactNode;
  mainSx?: SxProps<Theme>;
  hideFooter?: boolean;
}

export function PublicShell({ overlayHero, children, mainSx, hideFooter }: PublicShellProps) {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PublicNav overlayHero={overlayHero} />
      <Box component="main" sx={{ flex: 1, ...mainSx }}>
        {children}
      </Box>
      {!hideFooter && <PublicFooter />}
    </Box>
  );
}
