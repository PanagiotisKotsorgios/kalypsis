import { ReactNode, useState } from "react";
import {
  Box, Button, Card, Drawer, IconButton, Stack, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Keeps dense filter forms usable on every screen size. Detailed filters stay
 * available on desktop, while quick filters are always behind one compact
 * popup button so they do not add another confusing row to the page.
 */
export function ResponsiveFilterPanel({
  children,
  quickFilters,
  activeCount = 0,
  title = "Φίλτρα",
  cardSx,
  quickButtonPlacement = "panel",
  quickOpen: controlledQuickOpen,
  onQuickOpenChange,
  compactButtonPlacement = "panel",
  compactOpen: controlledCompactOpen,
  onCompactOpenChange,
  compactAt = "md",
  compactButtonSx,
}: {
  children: ReactNode;
  quickFilters?: ReactNode;
  activeCount?: number;
  title?: string;
  cardSx?: object;
  /** Render the quick-filter trigger outside this card (for example beside Print). */
  quickButtonPlacement?: "panel" | "external";
  /** Optional controlled state so a page-level toolbar button can open the drawer. */
  quickOpen?: boolean;
  onQuickOpenChange?: (open: boolean) => void;
  /** Render the compact full-filter trigger outside this component. */
  compactButtonPlacement?: "panel" | "external";
  /** Optional controlled state for the compact full-filter drawer. */
  compactOpen?: boolean;
  onCompactOpenChange?: (open: boolean) => void;
  /** Breakpoint at and below which the full filter form moves into a drawer. */
  compactAt?: "sm" | "md" | "lg" | "xl";
  /** Page-scoped visual treatment for the compact full-filter trigger. */
  compactButtonSx?: object;
}) {
  const theme = useTheme();
  // Treat phones and narrow tablets as compact so dense filter forms never
  // push the actual table far below the fold.
  const isCompact = useMediaQuery(theme.breakpoints.down(compactAt));
  const [internalCompactOpen, setInternalCompactOpen] = useState(false);
  const [internalQuickOpen, setInternalQuickOpen] = useState(false);
  const compactOpen = controlledCompactOpen ?? internalCompactOpen;
  const setCompactOpen = (next: boolean) => {
    onCompactOpenChange?.(next);
    if (controlledCompactOpen === undefined) setInternalCompactOpen(next);
  };
  const quickOpen = controlledQuickOpen ?? internalQuickOpen;
  const setQuickOpen = (next: boolean) => {
    onQuickOpenChange?.(next);
    if (controlledQuickOpen === undefined) setInternalQuickOpen(next);
  };

  const quickDrawer = quickFilters ? (
    <Drawer
      anchor="bottom"
      open={quickOpen}
      onClose={() => setQuickOpen(false)}
      PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "70vh" } }}
    >
      <Box sx={{ p: 2, overflowY: "auto" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography variant="h6" fontWeight={800}>Γρήγορα φίλτρα</Typography>
          <IconButton size="small" onClick={() => setQuickOpen(false)} aria-label="Κλείσιμο γρήγορων φίλτρων">
            <CloseIcon />
          </IconButton>
        </Stack>
        {quickFilters}
        <Button fullWidth variant="contained" sx={{ mt: 1.5 }} onClick={() => setQuickOpen(false)}>
          Εφαρμογή
        </Button>
      </Box>
    </Drawer>
  ) : null;

  if (isCompact) {
    return (
      <>
        {compactButtonPlacement === "panel" && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
              <Button
                size="small"
                variant={activeCount > 0 ? "contained" : "outlined"}
                startIcon={<FilterListIcon />}
                onClick={() => setCompactOpen(true)}
                sx={{ flexShrink: 0, whiteSpace: "nowrap", ...compactButtonSx }}
              >
                {title}{activeCount > 0 ? ` (${activeCount})` : ""}
              </Button>
              {quickFilters && quickButtonPlacement === "panel" && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<FilterListIcon />}
                  onClick={() => setQuickOpen(true)}
                  sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  Γρήγορα
                </Button>
              )}
            </Stack>
          </Box>
        )}
        <Drawer
          anchor="bottom"
          open={compactOpen}
          onClose={() => setCompactOpen(false)}
          PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "86vh" } }}
        >
          <Box sx={{ p: 2, overflowY: "auto" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography variant="h6" fontWeight={800}>{title}</Typography>
              <IconButton size="small" onClick={() => setCompactOpen(false)} aria-label="Κλείσιμο φίλτρων">
                <CloseIcon />
              </IconButton>
            </Stack>
            {children}
            <Button
              fullWidth
              variant="contained"
              sx={{ mt: 1.5 }}
              onClick={() => setCompactOpen(false)}
            >
              Εφαρμογή φίλτρων
            </Button>
          </Box>
        </Drawer>
        {quickDrawer}
      </>
    );
  }

  return (
    <>
      <Card sx={{ px: 1.5, py: 1.25, mb: 2, ...cardSx }}>
        {quickFilters && quickButtonPlacement === "panel" && (
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 0.75 }}>
            <Button
              size="small"
              variant={activeCount > 0 ? "contained" : "outlined"}
              startIcon={<FilterListIcon />}
              onClick={() => setQuickOpen(true)}
              sx={{ whiteSpace: "nowrap" }}
            >
              Γρήγορα φίλτρα{activeCount > 0 ? ` (${activeCount})` : ""}
            </Button>
          </Stack>
        )}
        {children}
      </Card>
      {quickDrawer}
    </>
  );
}
