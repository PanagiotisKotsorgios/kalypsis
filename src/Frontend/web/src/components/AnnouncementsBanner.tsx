import { Alert, AlertTitle, Box, Button, Chip, Stack } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

interface ActiveAnnouncement {
  id: string; title: string; body: string; severity: string;
  version: string | null; linkUrl: string | null; linkLabel: string | null;
  createdAt: string;
}

/**
 * Global banner rendered inside AppShell for every authenticated role.
 * Reads active announcements (platform-admin-authored, enabled, not-yet-
 * dismissed-by-this-user) from /api/announcements/active. Pressing × on
 * a banner posts to /api/announcements/{id}/dismiss so it never appears
 * for this user again — dismissals are per-user, so a colleague still
 * sees the same banner until they dismiss it too.
 *
 * Multiple active announcements stack from newest to oldest. Severity
 * maps to MUI Alert colour (info/success/warning/error).
 */
export function AnnouncementsBanner() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["announcements", "active"],
    queryFn: async () => (await api.get<ActiveAnnouncement[]>("/announcements/active")).data,
    // Silent 401 during token bootstrap: return [] rather than a red toast.
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => api.post(`/announcements/${id}/dismiss`),
    onMutate: async (id) => {
      // Optimistic remove — the banner disappears the moment you click ×.
      await qc.cancelQueries({ queryKey: ["announcements", "active"] });
      const prev = qc.getQueryData<ActiveAnnouncement[]>(["announcements", "active"]);
      qc.setQueryData<ActiveAnnouncement[]>(["announcements", "active"],
        (prev ?? []).filter(a => a.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["announcements", "active"], ctx.prev);
    },
  });

  const items = q.data ?? [];
  if (items.length === 0) return null;

  const severityFor = (s: string): "info" | "success" | "warning" | "error" => {
    const n = (s ?? "").toLowerCase();
    if (n === "success" || n === "warning" || n === "error") return n;
    return "info";
  };

  return (
    <Stack spacing={1} sx={{ px: { xs: 1.5, md: 2.5 }, pt: 1.5 }}>
      {items.map(a => (
        <Alert key={a.id} severity={severityFor(a.severity)}
          onClose={() => dismiss.mutate(a.id)}
          sx={{ alignItems: "flex-start" }}>
          <AlertTitle sx={{ mb: 0.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Box component="span" sx={{ fontWeight: 800 }}>{a.title}</Box>
            {a.version && (
              <Chip size="small" label={a.version} variant="outlined"
                sx={{ height: 20, fontSize: 11, fontFamily: "monospace" }} />
            )}
          </AlertTitle>
          {/* Preserve author's line breaks; plain text — no HTML injection. */}
          <Box component="div" sx={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.55 }}>
            {a.body}
          </Box>
          {a.linkUrl && (
            <Box sx={{ mt: 1 }}>
              <Button size="small" variant="outlined" component="a"
                href={a.linkUrl} target="_blank" rel="noopener noreferrer">
                {a.linkLabel || "Μάθε περισσότερα"}
              </Button>
            </Box>
          )}
        </Alert>
      ))}
    </Stack>
  );
}
