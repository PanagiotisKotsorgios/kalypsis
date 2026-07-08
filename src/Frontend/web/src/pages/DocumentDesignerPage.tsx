import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Switch, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DesignServicesIcon from "@mui/icons-material/DesignServices";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { SearchableTextField } from "../components/SearchableTextField";

interface TemplateDto {
  id: string; code: string; name: string; kind: string;
  pageSize: string; orientation: string;
  headerHtml: string | null; bodyHtml: string | null; footerHtml: string | null;
  isDefault: boolean; isActive: boolean;
}
interface RuleDto {
  id: string; documentKind: string; prefix: string; suffix: string;
  padding: number; nextNumber: number; resetYear: number | null; isActive: boolean;
}

const KINDS = ["Receipt", "Payment", "CreditNote", "Policy", "Letter", "Other"];
const PAGES = ["A4", "A5", "Thermal80mm"];
const ORIENTATIONS = ["Portrait", "Landscape"];

export function DocumentDesignerPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <DesignServicesIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("docDesigner.title")}</Typography>
            <HelpHint id="page.docDesigner" />
          </Stack>
          <Typography color="text.secondary">{t("docDesigner.subtitle")}</Typography>
        </Box>
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t("docDesigner.tabTemplates")} />
        <Tab label={t("docDesigner.tabNumbering")} />
      </Tabs>
      {tab === 0 && <TemplatesPanel />}
      {tab === 1 && <NumberingPanel />}
    </Box>
  );
}

function TemplatesPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateDto | null>(null);

  const q = useQuery({ queryKey: ["doc-templates"], queryFn: async () => (await api.get<TemplateDto[]>("/document-templates")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/document-templates/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["doc-templates"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)} sx={{ mb: 2 }}>{t("docDesigner.createTemplate")}</Button>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("docDesigner.code")}</TableCell>
              <TableCell>{t("docDesigner.name")}</TableCell>
              <TableCell>{t("docDesigner.kind")}</TableCell>
              <TableCell>{t("docDesigner.pageSize")}</TableCell>
              <TableCell>{t("docDesigner.default")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).map(t1 => (
                <TableRow key={t1.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{t1.code}</TableCell>
                  <TableCell>{t1.name}</TableCell>
                  <TableCell>{t1.kind}</TableCell>
                  <TableCell>{t1.pageSize} · {t1.orientation}</TableCell>
                  <TableCell>{t1.isDefault && <Chip size="small" color="primary" label="default" />}</TableCell>
                  <TableCell><Chip size="small" color={t1.isActive ? "success" : "default"} label={t1.isActive ? t("common.active") : t("common.inactive")} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(t1)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(t1.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <TemplateDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["doc-templates"] }); setCreateOpen(false); }} />
      <TemplateDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["doc-templates"] }); setEditing(null); }} />
    </Box>
  );
}

function TemplateDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: TemplateDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const [form, setForm] = useState({
    code: "", name: "", kind: "Receipt", pageSize: "A4", orientation: "Portrait",
    headerHtml: "", bodyHtml: "", footerHtml: "", isDefault: false, isActive: true
  });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (item) setForm({
      code: item.code, name: item.name, kind: item.kind,
      pageSize: item.pageSize, orientation: item.orientation,
      headerHtml: item.headerHtml ?? "", bodyHtml: item.bodyHtml ?? "", footerHtml: item.footerHtml ?? "",
      isDefault: item.isDefault, isActive: item.isActive
    });
    else if (open) setForm({
      code: "", name: "", kind: "Receipt", pageSize: "A4", orientation: "Portrait",
      headerHtml: "", bodyHtml: "", footerHtml: "", isDefault: false, isActive: true
    });
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        code: form.code.trim(), name: form.name.trim(), kind: form.kind,
        pageSize: form.pageSize, orientation: form.orientation,
        headerHtml: form.headerHtml || null, bodyHtml: form.bodyHtml || null, footerHtml: form.footerHtml || null,
        isDefault: form.isDefault, isActive: form.isActive
      };
      if (editing) return (await api.put(`/document-templates/${item!.id}`, body)).data;
      return (await api.post("/document-templates", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editing ? t("docDesigner.editTemplate") : t("docDesigner.createTemplate")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label={t("docDesigner.code")} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} fullWidth />
            <TextField required label={t("docDesigner.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth sx={{ flex: 2 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label={t("docDesigner.kind")} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} fullWidth>
              {KINDS.map(k => <MenuItem key={k} value={k}>{String(t(`documentTemplateKind.${k}`, k))}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField label={t("docDesigner.pageSize")} value={form.pageSize} onChange={e => setForm({ ...form, pageSize: e.target.value })} fullWidth>
              {PAGES.map(p => <MenuItem key={p} value={p}>{String(t(`pageSize.${p}`, p))}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField label={t("docDesigner.orientation")} value={form.orientation} onChange={e => setForm({ ...form, orientation: e.target.value })} fullWidth>
              {ORIENTATIONS.map(o => <MenuItem key={o} value={o}>{String(t(`pageOrientation.${o}`, o))}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <TextField label={t("docDesigner.headerHtml")} value={form.headerHtml} onChange={e => setForm({ ...form, headerHtml: e.target.value })} fullWidth multiline rows={3} placeholder='<div><img src="{{logo}}" /></div>' />
          <TextField label={t("docDesigner.bodyHtml")} value={form.bodyHtml} onChange={e => setForm({ ...form, bodyHtml: e.target.value })} fullWidth multiline rows={6} placeholder="<h1>{{title}}</h1><p>{{description}}</p>" />
          <TextField label={t("docDesigner.footerHtml")} value={form.footerHtml} onChange={e => setForm({ ...form, footerHtml: e.target.value })} fullWidth multiline rows={2} />
          <Stack direction="row" spacing={3}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} />
              <Typography>{t("docDesigner.makeDefault")}</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
              <Typography>{form.isActive ? t("common.active") : t("common.inactive")}</Typography>
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.code.trim() || !form.name.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function NumberingPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RuleDto | null>(null);

  const q = useQuery({ queryKey: ["numbering"], queryFn: async () => (await api.get<RuleDto[]>("/numbering")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/numbering/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["numbering"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)} sx={{ mb: 2 }}>{t("docDesigner.createRule")}</Button>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("docDesigner.documentKind")}</TableCell>
              <TableCell>{t("docDesigner.prefix")}</TableCell>
              <TableCell>{t("docDesigner.padding")}</TableCell>
              <TableCell>{t("docDesigner.suffix")}</TableCell>
              <TableCell>{t("docDesigner.preview")}</TableCell>
              <TableCell align="right">{t("docDesigner.next")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).map(r => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{r.documentKind}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{r.prefix || "—"}</TableCell>
                  <TableCell>{r.padding}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{r.suffix || "—"}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", color: "primary.main" }}>
                    {r.prefix}{String(r.nextNumber).padStart(r.padding, "0")}{r.suffix}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{r.nextNumber}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(r)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(r.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <RuleDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["numbering"] }); setCreateOpen(false); }} />
      <RuleDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["numbering"] }); setEditing(null); }} />
    </Box>
  );
}

function RuleDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: RuleDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const [form, setForm] = useState({ documentKind: "Receipt", prefix: "", suffix: "", padding: 6, nextNumber: 1, resetYear: "", isActive: true });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (item) setForm({ documentKind: item.documentKind, prefix: item.prefix, suffix: item.suffix, padding: item.padding, nextNumber: item.nextNumber, resetYear: item.resetYear?.toString() ?? "", isActive: item.isActive });
    else if (open) setForm({ documentKind: "Receipt", prefix: "", suffix: "", padding: 6, nextNumber: 1, resetYear: "", isActive: true });
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        documentKind: form.documentKind, prefix: form.prefix, suffix: form.suffix,
        padding: Number(form.padding), nextNumber: Number(form.nextNumber),
        resetYear: form.resetYear ? Number(form.resetYear) : null, isActive: form.isActive
      };
      if (editing) return (await api.put(`/numbering/${item!.id}`, body)).data;
      return (await api.post("/numbering", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{editing ? t("docDesigner.editRule") : t("docDesigner.createRule")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <SearchableTextField label={t("docDesigner.documentKind")} value={form.documentKind} onChange={e => setForm({ ...form, documentKind: e.target.value })} fullWidth disabled={editing}>
            {KINDS.map(k => <MenuItem key={k} value={k}>{String(t(`documentTemplateKind.${k}`, k))}</MenuItem>)}
          </SearchableTextField>
          <Stack direction="row" spacing={2}>
            <TextField label={t("docDesigner.prefix")} value={form.prefix} onChange={e => setForm({ ...form, prefix: e.target.value })} fullWidth placeholder="ΑΠ-" />
            <TextField label={t("docDesigner.suffix")} value={form.suffix} onChange={e => setForm({ ...form, suffix: e.target.value })} fullWidth placeholder="/2026" />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField type="number" label={t("docDesigner.padding")} value={form.padding} onChange={e => setForm({ ...form, padding: Number(e.target.value) })} sx={{ width: 120 }} />
            <TextField type="number" label={t("docDesigner.nextNumber")} value={form.nextNumber} onChange={e => setForm({ ...form, nextNumber: Number(e.target.value) })} fullWidth />
            <TextField type="number" label={t("docDesigner.resetYear")} value={form.resetYear} onChange={e => setForm({ ...form, resetYear: e.target.value })} sx={{ width: 140 }} />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t("docDesigner.preview")}: <code>{form.prefix}{String(form.nextNumber).padStart(form.padding, "0")}{form.suffix}</code>
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
