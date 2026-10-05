import { useEffect, useState } from "react";
import { Alert, Box, Button, Menu, MenuItem, Stack, Typography } from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { api } from "../api/client";
import type { Role } from "../auth/AuthContext";
import { useLocation } from "react-router-dom";

interface OfficeOption { officeId: string; officeName: string; isPrimary: boolean; }
export const ALL_OFFICES_VALUE = "__all_offices__";

/**
 * Visible only to office-facing roles.  Changing it reloads the current page
 * so every query starts with the new server-validated office scope.
 */
export function AgencyOfficeSwitcher({ role }: { role: Role | undefined }) {
  const location = useLocation();
  const isAgency = role === "AgencyAdmin" || role === "AgencyOfficeAdmin" || role === "AgencyUser";
  const isAdmin = role === "AgencyAdmin";
  const isHome = location.pathname === "/app" || location.pathname === "/app/";
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [selected, setSelected] = useState(() => localStorage.getItem("kalypsis.activeOfficeId") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isAgency || !isHome) return;
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
  }, [isAgency, isAdmin, isHome]);

  if (!isAgency || !isHome || offices.length === 0) return null;

  const change = (value: string) => {
    setAnchorEl(null);
    setSelected(value);
    localStorage.setItem("kalypsis.activeOfficeId", value || ALL_OFFICES_VALUE);
    window.location.reload();
  };

  const selectedOfficeName = selected === ALL_OFFICES_VALUE
    ? "Όλα τα γραφεία"
    : offices.find(o => o.officeId === selected)?.officeName ?? "Γραφείο";

  return (
    <Box
      data-agency-office-switcher
      sx={{
        position: "absolute",
        top: { xs: 0, sm: 1 },
        right: { xs: 0, md: 12 },
        left: "auto",
        zIndex: 2,
        display: "flex",
        justifyContent: "flex-end",
        pointerEvents: "none",
      }}
    >
      {error && <Alert severity="warning" sx={{ position: "absolute", right: 0, top: 42, width: 280, pointerEvents: "auto" }}>{error}</Alert>}
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ pointerEvents: "auto" }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<BusinessIcon sx={{ fontSize: "16px !important" }} />}
          endIcon={<ArrowDropDownIcon sx={{ fontSize: "17px !important" }} />}
          onClick={e => setAnchorEl(e.currentTarget)}
          aria-label={`Επιλογή γραφείου: ${selectedOfficeName}`}
          sx={{
            minWidth: 0,
            maxWidth: { xs: 185, sm: 250, md: 290 },
            height: 36,
            px: 1,
            borderRadius: 1,
            bgcolor: "rgba(255,255,255,0.96)",
            color: "#0b2545",
            borderColor: "rgba(11,37,69,0.28)",
            fontSize: { xs: "0.72rem", sm: "0.8rem" },
            fontWeight: 800,
            textTransform: "none",
            boxShadow: "0 1px 3px rgba(11,37,69,0.10)",
            "& .MuiButton-startIcon, & .MuiButton-endIcon": { mx: 0.15 },
            "&:hover": { bgcolor: "rgba(11,37,69,0.06)", borderColor: "#0b2545" },
          }}
        >
          <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedOfficeName}
          </Box>
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          MenuListProps={{ dense: true, "aria-label": "Επιλογή γραφείου" }}
          slotProps={{ paper: { sx: { minWidth: 230, maxWidth: 300 } } }}
        >
          {isAdmin && (
            <MenuItem onClick={() => change(ALL_OFFICES_VALUE)} selected={selected === ALL_OFFICES_VALUE}>
              <Box>
                <Typography variant="body2" fontWeight={700}>Όλα τα γραφεία</Typography>
                <Typography variant="caption" color="text.secondary">Συγκεντρωτικά δεδομένα</Typography>
              </Box>
            </MenuItem>
          )}
          {offices.map(o => (
            <MenuItem key={o.officeId} onClick={() => change(o.officeId)} selected={o.officeId === selected}>
              <Box>
                <Typography variant="body2">{o.officeName}</Typography>
                {o.isPrimary && <Typography variant="caption" color="text.secondary">Κύριο υποκατάστημα</Typography>}
              </Box>
            </MenuItem>
          ))}
        </Menu>
      </Stack>
    </Box>
  );
}
