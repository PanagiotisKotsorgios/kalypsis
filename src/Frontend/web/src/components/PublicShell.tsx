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

/**
 * Shell for every pre-login page. The `editorial` class scopes the
 * Mediterranean Editorial design system (Fraunces / DM Sans, cream paper,
 * grain texture, slow motion) to the public site only — the post-login app
 * keeps its existing MUI theme.
 */
export function PublicShell({ overlayHero, children, mainSx, hideFooter }: PublicShellProps) {
  return (
    <Box
      className="editorial"
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--paper)"
      }}
    >
      <PublicNav overlayHero={overlayHero} />
      <Box component="main" sx={{ flex: 1, ...mainSx }}>
        {children}
      </Box>
      {!hideFooter && <PublicFooter />}
    </Box>
  );
}
