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
}: {
  children: ReactNode;
  quickFilters?: ReactNode;
  activeCount?: number;
  title?: string;
  cardSx?: object;
}) {
  const theme = useTheme();
  // Treat phones and narrow tablets as compact so dense filter forms never
  // push the actual table far below the fold.
  const isCompact = useMediaQuery(theme.breakpoints.down("md"));
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

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
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <Button
            size="small"
            variant={activeCount > 0 ? "contained" : "outlined"}
            startIcon={<FilterListIcon />}
            onClick={() => setOpen(true)}
            sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
          >
            {title}{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
          {quickFilters && (
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
        <Drawer
          anchor="bottom"
          open={open}
          onClose={() => setOpen(false)}
          PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "86vh" } }}
        >
          <Box sx={{ p: 2, overflowY: "auto" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography variant="h6" fontWeight={800}>{title}</Typography>
              <IconButton size="small" onClick={() => setOpen(false)} aria-label="Κλείσιμο φίλτρων">
                <CloseIcon />
              </IconButton>
            </Stack>
            {children}
            <Button fullWidth variant="contained" sx={{ mt: 1.5 }} onClick={() => setOpen(false)}>
              Εφαρμογή φίλτρων
            </Button>
          </Box>
        </Drawer>
        {quickDrawer}
      </Box>
    );
  }

  return (
    <>
      <Card sx={{ px: 1.5, py: 1.25, mb: 2, ...cardSx }}>
        {quickFilters && (
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
