import { ReactNode, useState } from "react";
import { Box, Button, Drawer, IconButton, Stack, Typography } from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";

/** A compact quick-filter trigger used on dashboards and other pages without a detailed filter form. */
export function QuickFilterPopup({ children, label = "Γρήγορα φίλτρα" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button size="small" variant="outlined" startIcon={<FilterListIcon />} onClick={() => setOpen(true)}>
          {label}
        </Button>
      </Stack>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "70vh" } }}
      >
        <Box sx={{ p: 2, overflowY: "auto" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography variant="h6" fontWeight={800}>{label}</Typography>
            <IconButton size="small" onClick={() => setOpen(false)} aria-label="Κλείσιμο γρήγορων φίλτρων">
              <CloseIcon />
            </IconButton>
          </Stack>
          {children}
          <Button fullWidth variant="contained" sx={{ mt: 1.5 }} onClick={() => setOpen(false)}>
            Εφαρμογή
          </Button>
        </Box>
      </Drawer>
    </>
  );
}
