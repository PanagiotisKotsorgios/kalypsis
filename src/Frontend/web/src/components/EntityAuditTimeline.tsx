import { Box, Card, CircularProgress, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { dateTime } from "../utils/format";

interface AuditRow {
  id: string;
  action: string;
  category: string | null;
  entityName: string;
  entityId: string;
  userId: string | null;
  userDisplayName?: string | null;
  createdAt: string;
  ipAddress?: string | null;
  metadata?: string | null;
}
interface PageResult {
  rows: AuditRow[];
  totalCount: number;
}

const ACTION_LABEL: Record<string, string> = {
  Create: "Δημιουργία",
  Update: "Ενημέρωση",
  Delete: "Διαγραφή",
  Renewed: "Ανανέωση",
  Cancelled: "Ακύρωση",
  Login: "Σύνδεση",
  Login2FA: "Σύνδεση 2FA",
};
const COLOR_BY_ACTION: Record<string, string> = {
  Create: "#2e7d32",
  Update: "#0288d1",
  Delete: "#c62828",
  Renewed: "#6a1b9a",
  Cancelled: "#ef6c00",
};

/**
 * Vertical timeline of audit-log entries for a single entity. Drop into
 * any detail page:
 *
 *   <EntityAuditTimeline entityName="Policy" entityId={p.id} />
 */
export function EntityAuditTimeline({ entityName, entityId }: { entityName: string; entityId: string }) {
  const q = useQuery({
    queryKey: ["entity-audit", entityName, entityId],
    queryFn: async () =>
      (await api.get<PageResult>(`/audit-logs/entity/${entityName}/${entityId}`)).data,
    enabled: !!entityId,
  });

  if (q.isLoading) return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={20} /></Box>
  );
  const rows = q.data?.rows ?? [];
  if (rows.length === 0) return (
    <Card variant="outlined" sx={{ p: 3, textAlign: "center" }}>
      <Typography variant="body2" color="text.secondary">
        Δεν υπάρχει ιστορικό μεταβολών για αυτή την εγγραφή ακόμη.
      </Typography>
    </Card>
  );

  return (
    <Stack spacing={0} sx={{ position: "relative", pl: 3 }}>
      {/* Vertical guide line */}
      <Box sx={{
        position: "absolute", left: 7, top: 8, bottom: 8, width: 2,
        bgcolor: "divider", borderRadius: 1
      }} />
      {rows.map((r, i) => {
        const color = COLOR_BY_ACTION[r.action] ?? "#3d4f6b";
        const label = ACTION_LABEL[r.action] ?? r.action;
        return (
          <Box key={r.id} sx={{ position: "relative", py: 1.25 }}>
            <Box sx={{
              position: "absolute", left: -22, top: 18, width: 12, height: 12,
              borderRadius: "50%", bgcolor: color,
              border: "2px solid #fff", boxShadow: "0 0 0 2px rgba(11,37,69,0.15)"
            }} />
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.25 }}>
              <Typography fontSize={13.5} fontWeight={700} sx={{ color }}>{label}</Typography>
              <Typography variant="caption" color="text.secondary">{dateTime(r.createdAt)}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {r.userDisplayName ?? "Σύστημα"}
              {r.category && ` · ${r.category}`}
              {i === 0 && <Typography component="span" variant="caption" sx={{ ml: 1, color: "primary.main", fontWeight: 700 }}>(πιο πρόσφατο)</Typography>}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}
