import { useEffect, useState } from "react";
import { Alert, Box, FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
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
          const primary = (r.data ?? []).find(o => o.isPrimary) ?? (r.data ?? [])[0];
          if (primary) {
            localStorage.setItem("kalypsis.activeOfficeId", primary.officeId);
            setSelected(primary.officeId);
          }
        }
      })
      .catch(() => { if (alive) setError("Δεν ήταν δυνατή η φόρτωση των υποκαταστημάτων."); });
    return () => { alive = false; };
  }, [isAgency]);

  if (!isAgency || offices.length === 0) return null;

  const change = (value: string) => {
    setSelected(value);
    if (value) localStorage.setItem("kalypsis.activeOfficeId", value);
    else localStorage.removeItem("kalypsis.activeOfficeId");
    window.location.reload();
  };

  return (
    <Box sx={{ px: { xs: 1, md: 2 }, pt: 1, pb: 0.5 }}>
      {error && <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>}
      <FormControl size="small" sx={{ minWidth: 260, maxWidth: "100%" }}>
        <InputLabel id="agency-office-label">Υποκατάστημα</InputLabel>
        <Select
          labelId="agency-office-label"
          value={selected}
          label="Υποκατάστημα"
          onChange={e => change(e.target.value)}
          startAdornment={<BusinessIcon sx={{ mr: 1, color: "text.secondary" }} />}
        >
          {offices.map(o => (
            <MenuItem key={o.officeId} value={o.officeId}>
              <Box>
                <Typography variant="body2">{o.officeName}</Typography>
                {o.isPrimary && <Typography variant="caption" color="text.secondary">Κύριο υποκατάστημα</Typography>}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
