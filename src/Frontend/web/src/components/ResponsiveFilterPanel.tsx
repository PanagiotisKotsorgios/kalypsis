import { ReactNode, useState } from "react";
import {
  Box, Button, Card, Drawer, IconButton, Stack, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Keeps dense filter forms usable on phones. Desktop keeps the inline card;
 * small screens get one compact button and a bottom drawer with the exact
 * same controls, so the page never becomes a long scrolling form.
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
          <Box sx={{ minWidth: 0, flex: 1, overflow: "hidden" }}>{quickFilters}</Box>
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
      </Box>
    );
  }

  return (
    <Card sx={{ px: 1.5, py: 1.25, mb: 2, ...cardSx }}>
      {quickFilters}
      {children}
    </Card>
  );
}
