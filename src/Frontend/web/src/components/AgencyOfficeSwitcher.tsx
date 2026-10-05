import { useEffect, useState } from "react";
import { Alert, Box, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import { api } from "../api/client";
import type { Role } from "../auth/AuthContext";

interface OfficeOption { officeId: string; officeName: string; isPrimary: boolean; }
export const ALL_OFFICES_VALUE = "__all_offices__";

/**
 * Visible only to office-facing roles.  Changing it reloads the current page
 * so every query starts with the new server-validated office scope.
 */
export function AgencyOfficeSwitcher({ role }: { role: Role | undefined }) {
  const isAgency = role === "AgencyAdmin" || role === "AgencyOfficeAdmin" || role === "AgencyUser";
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
        const valid = current === ALL_OFFICES_VALUE
          || Boolean(current && (r.data ?? []).some(o => o.officeId === current));
        if (!valid) {
          // The current/primary office is the safe default for every user.
          // The organisation-wide view remains an explicit administrator
          // choice below, never the implicit first view.
          const primary = (r.data ?? []).find(o => o.isPrimary) ?? (r.data ?? [])[0];
          if (primary) {
            localStorage.setItem("kalypsis.activeOfficeId", primary.officeId);
            setSelected(primary.officeId);
          } else {
            localStorage.setItem("kalypsis.activeOfficeId", ALL_OFFICES_VALUE);
            setSelected(ALL_OFFICES_VALUE);
          }
        }
      })
      .catch(() => { if (alive) setError("Δεν ήταν δυνατή η φόρτωση των γραφείων."); });
    return () => { alive = false; };
  }, [isAgency, isAdmin]);

  if (!isAgency || offices.length === 0) return null;

  const change = (value: string) => {
    setSelected(value);
    localStorage.setItem("kalypsis.activeOfficeId", value || ALL_OFFICES_VALUE);
    window.location.reload();
  };

  return (
    <Box
      data-agency-office-switcher
      sx={{
        position: "absolute",
        top: { xs: 0, sm: 1 },
        right: 0,
        left: { xs: "auto", md: "50%" },
        zIndex: 2,
        display: "flex",
        justifyContent: "flex-end",
        pointerEvents: "none",
      }}
    >
      {error && <Alert severity="warning" sx={{ position: "absolute", right: 0, top: 42, width: 280, pointerEvents: "auto" }}>{error}</Alert>}
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ pointerEvents: "auto" }}>
      <FormControl size="small" sx={{ minWidth: { xs: 185, sm: 220 }, maxWidth: { xs: 210, sm: 260 } }}>
        <InputLabel id="agency-office-label">Γραφείο</InputLabel>
        <Select
          labelId="agency-office-label"
          value={selected}
          label="Γραφείο"
          onChange={e => change(e.target.value)}
          startAdornment={<BusinessIcon sx={{ mr: 1, color: "text.secondary" }} />}
          sx={{
            height: 38,
            bgcolor: "rgba(255,255,255,0.96)",
            borderRadius: 1.25,
            fontSize: { xs: "0.78rem", sm: "0.82rem" },
            fontWeight: 700,
            boxShadow: "0 1px 4px rgba(11,37,69,0.10)",
            "& .MuiSelect-select": { py: 0.75, pr: 3.5 },
          }}
        >
          {isAdmin && (
            <MenuItem value={ALL_OFFICES_VALUE}>
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
      </FormControl>
      </Stack>
    </Box>
  );
}
