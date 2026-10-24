import { FinancialFilters } from "../components/FinancialFilters";
import { ClaimListTableFrame } from "../components/ClaimListLayout";
import { useEffect, useMemo, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import { FilterHelp, FilterFieldWrap } from "../components/FilterHelp";
import {
  Alert, Box, Button, Chip, CircularProgress,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/EditOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { money, date } from "../utils/format";
import { useTableState } from "../components/useTableState";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import { NumberedPager, RecordCountChip, TableToolbar } from "../components/TableToolbar";
import { SearchableTextField } from "../components/SearchableTextField";
import { ReceiptDetailDialog } from "../components/profile/ReceiptDetailDialog";
import { useUndoable } from "../components/UndoToast";
import { useColumnPreferences } from "../hooks/useColumnPreferences";
import { ColumnPreferencesButton } from "../components/ColumnPreferencesButton";
import { SavedReportsButton } from "../components/SavedReportsButton";
import { UnifiedActionsMenu } from "../components/UnifiedActionsMenu";

const METHODS = ["Cash","Card","BankTransfer","Cheque","PromissoryNote","Other"] as const;
type Method = typeof METHODS[number];
interface ReceiptDto {
  id: string; number: string; receivedOn: string;
  customerId: string; customerName: string;
  policyId: string | null; policyNumber: string | null;
  method: Method; amount: number; currency: string; notes: string | null;
  transactionReference: string | null; policyPaymentStatus?:string|null; details?: Record<string,string|null>;
}

export function ReceiptsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingMode, setEditingMode] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptDto | null>(null);

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<Method | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [saveFilterRequest, setSaveFilterRequest] = useState(0);
  const [clearSavedFilterRequest, setClearSavedFilterRequest] = useState(0);
  const [exportAction, setExportAction] = useState<{ token: number; action: "xlsx" | "csv" | "pdf" | "print" }>({ token: 0, action: "xlsx" });
  const [columnsRequest, setColumnsRequest] = useState(0);

  const q = useQuery({
    queryKey: ["receipts"],
    queryFn: async () => (await api.get<ReceiptDto[]>("/receipts")).data
  });
  const { pushUndoable } = useUndoable();
  const del = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/receipts/${id}`); return id; },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ["receipts"] });
      pushUndoable({
        category: "receipts", id,
        message: "Η είσπραξη διαγράφηκε",
        onRestore: () => { void qc.invalidateQueries({ queryKey: ["receipts"] }); }
      });
    },
    onError: e => setErr(extractErrorMessage(e))
  });

  const rawRows = q.data ?? [];
  const filtered = useMemo(() => rawRows.filter(r => {
    if (methodFilter && r.method !== methodFilter) return false;
    if (fromDate && r.receivedOn < fromDate) return false;
    if (toDate   && r.receivedOn > toDate)   return false;
    if (customerFilter) {
      const c = customerFilter.toLowerCase();
      if (!`${r.customerName} ${r.policyNumber ?? ""}`.toLowerCase().includes(c)) return false;
    }
    return true;
  }), [rawRows, methodFilter, fromDate, toDate, customerFilter]);

  const table = useTableState<ReceiptDto>({
    rows: filtered,
    searchableText: (r) => `${r.number} ${r.customerName} ${r.policyNumber ?? ""} ${r.method} ${r.notes ?? ""}`,
    pageSize: 25
  });
  const rows = table.paged;
  const receiptCols = useColumnPreferences("receipts", [
    { key: "number",   label: "Αριθμός απόδειξης", alwaysVisible: true },
    { key: "date",     label: "Ημερομηνία" },
    { key: "customer", label: "Πελάτης" },
    { key: "policy",   label: "Συμβόλαιο" },
    { key: "policyStatus", label: "Κατάσταση συμβολαίου" },
    { key: "method",   label: "Τρόπος" },
    { key: "txRef",    label: "Αναφορά συναλλαγής", defaultVisible: false },
    { key: "amount",   label: "Ποσό" },
  ]);
  const total = Object.entries(table.filtered.reduce<Record<string,number>>((s,r)=>({...s,[r.currency]:(s[r.currency]??0)+r.amount}),{})).map(([currency,amount])=>money(amount,currency)).join(" · ");
  const savedReceiptFilters = { search, methodFilter, fromDate, toDate, customerFilter };
  const clearReceiptFilters = () => {
    setSearch(""); setMethodFilter(""); setFromDate(""); setToDate(""); setCustomerFilter("");
    table.setQuery(""); table.setPage(1);
    setClearSavedFilterRequest(value => value + 1);
  };
  const loadSavedReceiptFilters = (filters: Partial<typeof savedReceiptFilters>) => {
    setSearch(filters.search ?? "");
    setMethodFilter((filters.methodFilter ?? "") as Method | "");
    setFromDate(filters.fromDate ?? "");
    setToDate(filters.toDate ?? "");
    setCustomerFilter(filters.customerFilter ?? "");
    table.setQuery(filters.search ?? "");
    table.setPage(1);
  };

  const inferType = (key: string): ColumnType =>
    key === "date" ? "date" : key === "amount" ? "number" : "string";
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      const map: Record<string, keyof ReceiptDto> = {
        number: "number", date: "receivedOn", customer: "customerName",
        policy: "policyNumber", method: "method", txRef: "transactionReference",
        amount: "amount",
      };
      const dtoKey = map[key];
      if (!dtoKey) return;
      table.toggleSort(dtoKey);
      if (table.sortDir !== dir) table.toggleSort(dtoKey);
    },
    onHide: (key) => receiptCols.toggleVisibility(key),
  });
  const rowMenu = useRowContextMenu<ReceiptDto>({
    entityLabel: "απόδειξης",
    onDelete: (r) => { if (confirm(t("common.confirmDelete"))) del.mutate(r.id); },
  });

  useEffect(() => { table.setQuery(search); }, [search, table]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.65, minHeight: 28, color: "text.secondary" }}>
            <HomeOutlinedIcon fontSize="small" sx={{ flexShrink: 0 }} />
            <ChevronRightIcon fontSize="small" sx={{ flexShrink: 0, mx: 0.25, color: "primary.main" }} />
            <Typography variant="caption" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Οικονομικά</Typography>
            <ChevronRightIcon fontSize="small" sx={{ flexShrink: 0, mx: 0.25, color: "primary.main" }} />
            <Typography variant="caption" sx={{ fontWeight: 800, color: "primary.dark", whiteSpace: "nowrap" }}>Εισπράξεις</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5} useFlexGap flexWrap="wrap">
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("receipts.title")}</Typography>
            <HelpHint id="page.receipts" />
            <RecordCountChip count={table.filtered.length} />
          </Stack>
          <Typography color="text.secondary">{t("receipts.subtitle")}</Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center" useFlexGap flexWrap="wrap" sx={{ minWidth: 0, maxWidth: "100%" }}>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">{t("receipts.totalShown")}</Typography>
            <Typography variant="h5" fontWeight={800}>{total || money(0)}</Typography>
          </Box>
          <TableToolbar query="" onQuery={()=>{}} count={rawRows.length} filteredCount={table.filtered.length} pageSize={table.pageSize} onPageSize={table.setPageSize}
            hideSearch hideCount hidePageSize hideActionButtons hideColumnPicker snapshotExport exportRows={table.filtered} exportFileName="receipts" printTitle="Εισπράξεις"
            exportColumns={receiptCols.visibleColumns.map(c=>({key:c.key,label:c.label,map:(r:ReceiptDto)=>c.key==="date"?date(r.receivedOn):c.key==="customer"?r.customerName:c.key==="policy"?r.policyNumber??"":c.key==="method"?t(`paymentMethod.${r.method}`):c.key==="txRef"?r.transactionReference??"":c.key==="amount"?money(r.amount,r.currency):c.key==="policyStatus"?r.policyPaymentStatus??"":r.number}))} actionRequest={exportAction} />
          <UnifiedActionsMenu createLabel={t("receipts.create")} onCreate={() => { setEditingMode(true); setEditingReceipt(null); setCreateOpen(true); }}
            onSaveFilter={() => setSaveFilterRequest(value => value + 1)}
            onExport={action => setExportAction(value => ({ token: value.token + 1, action }))}
            onColumns={() => setColumnsRequest(value => value + 1)} disabledExports={!table.filtered.length} />
        </Stack>
      </Stack>

      <FinancialFilters title="Φίλτρα εισπράξεων" savedFilters={<SavedReportsButton
            entity="receipts"
            currentFilters={savedReceiptFilters}
            onLoad={loadSavedReceiptFilters}
            onClear={clearReceiptFilters} clearRequestToken={clearSavedFilterRequest}
            saveRequestToken={saveFilterRequest}
            showSaveMenuItem={false}
          />}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap" alignItems={{ md: "center" }} useFlexGap>
          <TextField size="small" placeholder="Αναζήτηση…"
            value={search} onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 200 }}
            InputProps={{
              endAdornment: <FilterHelp title="Αναζήτηση σε αριθμό απόδειξης, πελάτη, συμβόλαιο ή σημείωση." />
            }} />
          <FilterFieldWrap tip="Φιλτράρετε τις αποδείξεις ανά τρόπο πληρωμής (Μετρητά, Κάρτα, Μεταφορά κ.λπ.).">
            <SearchableTextField size="small" label="Μέθοδος"
              value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as Method | "")}
              sx={{ minWidth: 150, width: "100%" }}>
              <MenuItem value="">Όλες</MenuItem>
              {METHODS.map(m => <MenuItem key={m} value={m}>{t(`paymentMethod.${m}`)}</MenuItem>)}
            </SearchableTextField>
          </FilterFieldWrap>
          <TextField size="small" label="Πελάτης / Συμβόλαιο"
            value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} sx={{ minWidth: 180 }}
            InputProps={{
              endAdornment: <FilterHelp title="Ονοματεπώνυμο πελάτη ή αριθμός συμβολαίου για στοχευμένη αναζήτηση." />
            }} />
          <FilterFieldWrap tip="Ημερομηνία έκδοσης από — εμφανίζει αποδείξεις από αυτήν την ημέρα και μετά.">
            <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }}
              value={fromDate} onChange={(e) => setFromDate(e.target.value)} sx={{ minWidth: 140, width: "100%" }} />
          </FilterFieldWrap>
          <FilterFieldWrap tip="Ημερομηνία έκδοσης έως — εμφανίζει αποδείξεις μέχρι αυτήν την ημέρα.">
            <TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }}
              value={toDate} onChange={(e) => setToDate(e.target.value)} sx={{ minWidth: 140, width: "100%" }} />
          </FilterFieldWrap>
          <Button size="small" onClick={clearReceiptFilters} color="error" variant="contained">Καθαρισμός</Button>
        </Stack>
      </FinancialFilters>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <ClaimListTableFrame label="Λίστα εισπράξεων" pagination={<NumberedPager page={table.page} totalPages={table.totalPages} onPage={table.setPage} totalRows={table.filtered.length} pageSize={table.pageSize} onPageSize={table.setPageSize} />}>
          <Table size="small" stickyHeader>
            <TableHead><TableRow>
              {receiptCols.visibleColumns.map(c => (
                <TableCell
                  key={c.key}
                  align={c.key === "amount" ? "right" : "left"}
                  onContextMenu={(e) => headerMenu.open(e, { key: c.key, label: c.label, type: inferType(c.key), canHide: !c.alwaysVisible })}
                  sx={{ userSelect: "none" }}
                >
                  {c.label}
                </TableCell>
              ))}
              <TableCell align="right" padding="checkbox">
                <ColumnPreferencesButton
                  orderedColumns={receiptCols.orderedColumns}
                  hiddenSet={receiptCols.hiddenSet}
                  toggleVisibility={receiptCols.toggleVisibility}
                  moveColumn={receiptCols.moveColumn}
                  reset={receiptCols.reset}
                  openRequestToken={columnsRequest}
                  hideButton
                />
              </TableCell>
            </TableRow></TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={receiptCols.visibleColumns.length + 1} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("receipts.empty")}</TableCell></TableRow>
              )}
              {rows.map(r => (
                <TableRow key={r.id} hover onDoubleClick={() => {setEditingMode(false);setEditingReceipt(r);}} onContextMenu={(e) => rowMenu.open(e, r)}>
                  {receiptCols.visibleColumns.map(c => {
                    switch (c.key) {
                      case "number":
                        return <TableCell key={c.key} sx={{ fontWeight: 700, fontFamily: "monospace" }}>{r.number}</TableCell>;
                      case "date":
                        return <TableCell key={c.key}>{date(r.receivedOn)}</TableCell>;
                      case "customer":
                        return <TableCell key={c.key}>{r.customerName}</TableCell>;
                      case "policy":
                        return <TableCell key={c.key}>{r.policyNumber ?? "—"}</TableCell>;
                      case "policyStatus":
                        return <TableCell key={c.key}><Chip size="small" label={r.policyPaymentStatus??"—"} sx={{fontWeight:700}} /></TableCell>;
                      case "method":
                        return <TableCell key={c.key}>{t(`paymentMethod.${r.method}`)}</TableCell>;
                      case "txRef":
                        return <TableCell key={c.key} sx={{ fontFamily: "monospace" }}>{r.transactionReference ?? "—"}</TableCell>;
                      case "amount":
                        return <TableCell key={c.key} align="right" sx={{ fontWeight: 700 }}>{money(r.amount, r.currency)}</TableCell>;
                      default: return <TableCell key={c.key}>—</TableCell>;
                    }
                  })}
                  <TableCell align="right">
                    <IconButton size="small" color="success" title="Επεξεργασία" onClick={(event) => { event.stopPropagation(); setEditingMode(true); setEditingReceipt(r); }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(r.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ClaimListTableFrame>
      )}
      {headerMenu.menu}
      {rowMenu.menu}

      {(createOpen || editingReceipt) && <ReceiptDetailDialog item={editingReceipt} initialEditing={editingMode} onClose={() => {setCreateOpen(false);setEditingReceipt(null);}} onSaved={() => {
        void qc.invalidateQueries({queryKey:["receipts"]});
        void qc.invalidateQueries({queryKey:["policy-payment-summary"]});
      }} />}
    </Box>
  );
}
