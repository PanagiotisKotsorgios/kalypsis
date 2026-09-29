import { useEffect, useState } from "react";
import { Alert, Box, Chip, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import { api } from "../api/client";
import type { Role } from "../auth/AuthContext";

interface OfficeOption { officeId: string; officeName: string; isPrimary: boolean; }

/**
 * Visible only to office-facing roles.  Changing it reloads the current page
 * so every query starts with the new server-validated office scope.
 */
export function AgencyOfficeSwitcher({ role }: { role: Role | undefined }) {
  const isAgency = role === "AgencyAdmin" || role === "AgencyUser";
  const isAdmin = role === "AgencyAdmin";
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [selected, setSelected] = useState(() => localStorage.getItem("kalypsis.activeOfficeId") ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAgency) return;
    let alive = true;
    api.get<OfficeOption[]>("/agency-offices/mine")
      .then(r => {
        if (!alive) return;
        setOffices(r.data ?? []);
        const current = localStorage.getItem("kalypsis.activeOfficeId");
        const valid = current && (r.data ?? []).some(o => o.officeId === current);
        if (!valid) {
          // Administrators start in a safe all-office reporting view. Staff
          // without a saved choice start in their primary office.
          const primary = isAdmin
            ? undefined
            : ((r.data ?? []).find(o => o.isPrimary) ?? (r.data ?? [])[0]);
          if (primary) {
            localStorage.setItem("kalypsis.activeOfficeId", primary.officeId);
            setSelected(primary.officeId);
          } else {
            localStorage.removeItem("kalypsis.activeOfficeId");
            setSelected("");
          }
        }
      })
      .catch(() => { if (alive) setError("Δεν ήταν δυνατή η φόρτωση των γραφείων."); });
    return () => { alive = false; };
  }, [isAgency, isAdmin]);

  if (!isAgency || offices.length === 0) return null;

  const selectedOffice = offices.find(o => o.officeId === selected);
  const change = (value: string) => {
    setSelected(value);
    if (value) localStorage.setItem("kalypsis.activeOfficeId", value);
    else localStorage.removeItem("kalypsis.activeOfficeId");
    window.location.reload();
  };

  return (
    <Box sx={{ px: { xs: 1, md: 2 }, pt: 1, pb: 0.5 }}>
      {error && <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
      <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 300 }, maxWidth: "100%" }}>
        <InputLabel id="agency-office-label">Γραφείο</InputLabel>
        <Select
          labelId="agency-office-label"
          value={selected}
          label="Γραφείο"
          onChange={e => change(e.target.value)}
          startAdornment={<BusinessIcon sx={{ mr: 1, color: "text.secondary" }} />}
        >
          {isAdmin && (
            <MenuItem value="">
              <Box>
                <Typography variant="body2" fontWeight={700}>Όλα τα γραφεία</Typography>
                <Typography variant="caption" color="text.secondary">Συγκεντρωτικά δεδομένα όλου του οργανισμού</Typography>
              </Box>
            </MenuItem>
          )}
          {offices.map(o => (
            <MenuItem key={o.officeId} value={o.officeId}>
              <Box>
                <Typography variant="body2">{o.officeName}</Typography>
                {o.isPrimary && <Typography variant="caption" color="text.secondary">Κύριο υποκατάστημα</Typography>}
              </Box>
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>Εφαρμόζεται σε dashboard, λίστες παραγωγής, οικονομικά και αναφορές.</FormHelperText>
      </FormControl>
      <Chip
        size="small"
        color={isAdmin && !selected ? "primary" : "default"}
        variant={isAdmin && !selected ? "filled" : "outlined"}
        label={isAdmin && !selected ? "Όλα τα γραφεία" : `Γραφείο: ${selectedOffice?.officeName ?? "ενεργό"}`}
        sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
      />
      </Stack>
    </Box>
  );
}
