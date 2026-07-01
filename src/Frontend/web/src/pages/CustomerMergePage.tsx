import { useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, RadioGroup, Radio,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography
} from "@mui/material";
import MergeIcon from "@mui/icons-material/Merge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { date } from "../utils/format";

interface DuplicateGroup {
  groupKey: string; matchedOn: string;
  customers: { id: string; customerNumber: string; displayName: string;
    afm: string | null; email: string | null; phone: string | null;
    createdAt: string; policyCount: number; }[];
}
interface MergeResult { policiesMoved: number; claimsMoved: number; receiptsMoved: number; contactsMoved: number; documentsMoved: number; removed: number; }

export function CustomerMergePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<MergeResult | null>(null);

  const q = useQuery({ queryKey: ["duplicates"], queryFn: async () =>
    (await api.get<DuplicateGroup[]>("/customer-merge/duplicates")).data });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <MergeIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("merge.title")}</Typography>
            <HelpHint id="page.merge" />
          </Stack>
          <Typography color="text.secondary">{t("merge.subtitle")}</Typography>
        </Box>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {result && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setResult(null)}>
          {t("merge.success", { policies: result.policiesMoved, receipts: result.receiptsMoved, removed: result.removed })}
        </Alert>
      )}
      {q.isLoading ? <CircularProgress /> : (q.data ?? []).length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">{t("merge.noDuplicates")}</Typography>
        </Card>
      ) : (
        <Stack spacing={3}>
          {(q.data ?? []).map(g => <GroupCard key={g.groupKey + g.matchedOn} group={g}
            onMerged={(r) => { setResult(r); void qc.invalidateQueries({ queryKey: ["duplicates"] }); }}
            onError={setErr} />)}
        </Stack>
      )}
    </Box>
  );
}

function GroupCard({ group, onMerged, onError }: { group: DuplicateGroup; onMerged: (r: MergeResult) => void; onError: (m: string) => void }) {
  const { t } = useTranslation();
  const [keepId, setKeepId] = useState(group.customers[0]?.id ?? "");
  const [removeIds, setRemoveIds] = useState<Set<string>>(new Set());

  const merge = useMutation({
    mutationFn: async () => (await api.post<MergeResult>("/customer-merge/merge", {
      keepId, removeIds: Array.from(removeIds)
    })).data,
    onSuccess: onMerged, onError: e => onError(extractErrorMessage(e))
  });

  const toggleRemove = (id: string) => {
    if (id === keepId) return;
    const ns = new Set(removeIds);
    if (ns.has(id)) ns.delete(id); else ns.add(id);
    setRemoveIds(ns);
  };

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip size="small" color="warning" label={t("merge.matchedOn")} />
          <Typography fontWeight={700}>{group.matchedOn}: <code>{group.groupKey}</code></Typography>
          <Typography color="text.secondary" variant="caption">({group.customers.length} {t("merge.matches")})</Typography>
        </Stack>
        <Button variant="contained" size="small" startIcon={<MergeIcon />} disabled={merge.isPending || removeIds.size === 0 || !keepId}
          onClick={() => { if (confirm(t("merge.confirm", { count: removeIds.size }))) merge.mutate(); }}>
          {merge.isPending ? <CircularProgress size={16} /> : t("merge.action")}
        </Button>
      </Stack>
      <RadioGroup value={keepId} onChange={e => setKeepId(e.target.value)}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell padding="checkbox">{t("merge.keep")}</TableCell>
            <TableCell padding="checkbox">{t("merge.remove")}</TableCell>
            <TableCell>{t("merge.customerNumber")}</TableCell>
            <TableCell>{t("merge.name")}</TableCell>
            <TableCell>{t("merge.afm")}</TableCell>
            <TableCell>{t("merge.email")}</TableCell>
            <TableCell>{t("merge.phone")}</TableCell>
            <TableCell align="right">{t("merge.policies")}</TableCell>
            <TableCell>{t("merge.created")}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {group.customers.map(c => (
              <TableRow key={c.id} hover>
                <TableCell padding="checkbox"><Radio value={c.id} size="small" /></TableCell>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={removeIds.has(c.id)}
                    disabled={c.id === keepId}
                    onChange={() => toggleRemove(c.id)} />
                </TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{c.customerNumber}</TableCell>
                <TableCell sx={{ fontWeight: c.id === keepId ? 700 : 400 }}>{c.displayName}</TableCell>
                <TableCell>{c.afm ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell align="right">{c.policyCount}</TableCell>
                <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{date(c.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </RadioGroup>
    </Card>
  );
}
