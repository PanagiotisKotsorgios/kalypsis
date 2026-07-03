import { useEffect, useMemo, useState } from "react";
import {
  Box, Chip, Dialog, InputAdornment, List, ListItemButton, ListItemText, Stack, TextField, Typography
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ArticleIcon from "@mui/icons-material/Article";
import PeopleIcon from "@mui/icons-material/People";
import ExploreIcon from "@mui/icons-material/Explore";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

interface CommandItem {
  key: string;
  label: string;
  hint?: string;
  category: "page" | "policy" | "customer";
  onSelect: () => void;
}

const PAGE_COMMANDS: { label: string; to: string }[] = [
  { label: "Πίνακας ελέγχου", to: "/app" },
  { label: "Πελάτες", to: "/app/customers" },
  { label: "Συμβόλαια", to: "/app/policies" },
  { label: "Έγγραφα", to: "/app/documents" },
  { label: "Ζημιές", to: "/app/claims" },
  { label: "Εισπράξεις", to: "/app/receipts" },
  { label: "Πληρωμές", to: "/app/payments" },
  { label: "Συνεργάτες", to: "/app/producers" },
  { label: "Ασφαλιστικές Εταιρείες", to: "/app/insurance-companies" },
  { label: "Γέφυρες", to: "/app/carrier-bridges" },
  { label: "Παραμετροποίηση προμηθειών", to: "/app/commission-rules" },
  { label: "Λίστες παραγωγής", to: "/app/production-lists" },
  { label: "Εκκαθαρίσεις προμηθειών", to: "/app/commission-runs" },
  { label: "Ταυτοποίηση Οικονομικών", to: "/app/reconciliation-dashboard" },
  { label: "Ταυτοποίηση Συνεργατών", to: "/app/producer-reconciliation" },
  { label: "Ρυθμίσεις", to: "/app/settings" },
  { label: "Χρήστες", to: "/app/users" },
  { label: "Όλα τα εργαλεία", to: "/app/all-tools" },
];

/**
 * ⌘K / Ctrl+K palette. Search across pages by static label; policies + customers
 * hit the server-side search after a 300ms debounce. Enter picks the top item,
 * Esc closes. Ignores keystrokes originating in text inputs so opening the
 * palette can't shadow the user's typing.
 */
export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Detect ⌘K / Ctrl+K regardless of the currently-focused element so
      // it works even inside an input. That's the whole point of a global
      // palette.
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const policiesQ = useQuery({
    queryKey: ["cmdk-policies", debounced],
    queryFn: async () => (await api.get<{ id: string; policyNumber: string; customerDisplay: string }[]>(
      "/policies", { params: { search: debounced } })).data,
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  });
  const customersQ = useQuery({
    queryKey: ["cmdk-customers", debounced],
    queryFn: async () => (await api.get<{
      id: string; customerNumber: string; type: string; firstName?: string; lastName?: string; companyName?: string;
    }[]>("/customers", { params: { search: debounced } })).data,
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  });

  const items = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();
    const pageItems: CommandItem[] = PAGE_COMMANDS
      .filter(c => !q || c.label.toLowerCase().includes(q))
      .map(c => ({
        key: `page:${c.to}`, label: c.label, hint: c.to, category: "page",
        onSelect: () => { setOpen(false); navigate(c.to); }
      }));
    const policyItems: CommandItem[] = (policiesQ.data ?? []).slice(0, 8).map(p => ({
      key: `policy:${p.id}`, label: `Συμβόλαιο ${p.policyNumber}`, hint: p.customerDisplay,
      category: "policy",
      onSelect: () => { setOpen(false); navigate(`/app/policies?documentPolicyId=${p.id}`); }
    }));
    const customerItems: CommandItem[] = (customersQ.data ?? []).slice(0, 8).map(c => ({
      key: `customer:${c.id}`,
      label: c.type === "Individual"
        ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.customerNumber
        : (c.companyName ?? c.customerNumber),
      hint: c.customerNumber,
      category: "customer",
      onSelect: () => { setOpen(false); navigate(`/app/customers/${c.id}`); }
    }));
    return [...pageItems, ...policyItems, ...customerItems];
  }, [query, policiesQ.data, customersQ.data, navigate]);

  useEffect(() => { setHighlight(0); }, [debounced, query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(items.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(0, h - 1)); }
    else if (e.key === "Enter") {
      const it = items[highlight];
      if (it) { e.preventDefault(); it.onSelect(); }
    }
  };

  const iconFor = (c: CommandItem["category"]) =>
    c === "page" ? <ExploreIcon fontSize="small" />
    : c === "policy" ? <ArticleIcon fontSize="small" />
    : <PeopleIcon fontSize="small" />;

  return (
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"
      PaperProps={{ sx: { position: "absolute", top: 60 } }}>
      <Box sx={{ p: 1.5 }}>
        <TextField autoFocus fullWidth size="small" value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Μετάβαση σε πελάτη, συμβόλαιο ή σελίδα…"
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
          }}
        />
      </Box>
      <List dense sx={{ maxHeight: 420, overflowY: "auto", pt: 0 }}>
        {items.length === 0 && (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            Δεν βρέθηκε αποτέλεσμα.
          </Box>
        )}
        {items.map((it, i) => (
          <ListItemButton key={it.key} selected={i === highlight}
            onMouseEnter={() => setHighlight(i)}
            onClick={it.onSelect}
            sx={{ py: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ width: "100%" }}>
              {iconFor(it.category)}
              <ListItemText primary={it.label}
                secondary={it.hint}
                primaryTypographyProps={{ fontWeight: 600 }}
                secondaryTypographyProps={{ variant: "caption", sx: { fontFamily: "monospace" } }} />
              <Chip size="small" variant="outlined" label={
                it.category === "page" ? "σελίδα"
                : it.category === "policy" ? "συμβόλαιο" : "πελάτης"
              } sx={{ height: 20, fontSize: 10 }} />
            </Stack>
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ p: 1, borderTop: 1, borderColor: "divider", display: "flex", justifyContent: "space-between" }}>
        <Typography variant="caption" color="text.secondary">
          ↑↓ πλοήγηση · Enter επιλογή · Esc κλείσιμο
        </Typography>
        <Typography variant="caption" color="text.disabled">⌘K</Typography>
      </Box>
    </Dialog>
  );
}
