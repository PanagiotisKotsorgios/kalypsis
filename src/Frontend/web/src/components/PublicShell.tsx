import { Box, Container, type SxProps, type Theme } from "@mui/material";
import type { ReactNode } from "react";
import { PublicNav } from "./PublicNav";
import { PublicFooter } from "./PublicFooter";
import { PreloginDesktopDownload } from "./PreloginDesktopDownload";

interface PublicShellProps {
  overlayHero?: boolean;
  children: ReactNode;
  mainSx?: SxProps<Theme>;
  hideFooter?: boolean;
  modernNav?: boolean;
}

/**
 * Shell for every pre-login page. The `editorial` class scopes the
 * Mediterranean Editorial design system (Fraunces / DM Sans, cream paper,
 * grain texture, slow motion) to the public site only — the post-login app
 * keeps its existing MUI theme.
 */
export function PublicShell({ overlayHero, children, mainSx, hideFooter, modernNav = false }: PublicShellProps) {
  return (
    <Box
      className="editorial"
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: modernNav ? "#f4f7fb" : "var(--paper)"
      }}
    >
      <PublicNav overlayHero={overlayHero} modern={modernNav} />
      <Container maxWidth={false} sx={{ maxWidth: { xs: "100%", md: "96%", lg: "88%", xl: "1600px" }, px: { xs: 2, md: 3 }, mt: 1.5 }}>
        <Box sx={{ px: { xs: 1.5, md: 4.5 } }}>
          <PreloginDesktopDownload />
        </Box>
      </Container>
      <Box component="main" sx={{ flex: 1, ...mainSx }}>
        {children}
      </Box>
      {!hideFooter && <PublicFooter />}
    </Box>
  );
}
