import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography
} from "@mui/material";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

interface NotificationDto {
  id: string;
  title: string;
  body: string;
  category: string | null;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<NotificationDto[]>("/notifications")).data
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    }
  });

  const markAll = useMutation({
    mutationFn: async () => api.post("/notifications/read-all"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    }
  });

  const rows = listQuery.data ?? [];
  const unreadCount = rows.filter((n) => !n.isRead).length;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t("notifications.title")}
          </Typography>
          <Typography color="text.secondary">
            {t("notifications.subtitle", { count: unreadCount })}
          </Typography>
        </Box>
        {unreadCount > 0 && (
          <Button startIcon={<DoneAllIcon />} variant="outlined" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            {t("notifications.markAll")}
          </Button>
        )}
      </Stack>

      {listQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Typography color="text.secondary">{t("notifications.empty")}</Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {rows.map((n) => (
            <Card
              key={n.id}
              sx={{
                borderLeft: "4px solid",
                borderLeftColor: n.isRead ? "divider" : "primary.main",
                bgcolor: n.isRead ? "background.paper" : "rgba(11,37,69,0.03)"
              }}
            >
              <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                    {n.category && <Chip label={n.category} size="small" variant="outlined" />}
                    <Typography variant="caption" color="text.secondary">
                      {new Date(n.createdAt).toLocaleString("el-GR")}
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontWeight: n.isRead ? 500 : 800, mb: 0.5 }}>{n.title}</Typography>
                  <Typography color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>{n.body}</Typography>
                </Box>
                {!n.isRead && (
                  <IconButton onClick={() => markRead.mutate(n.id)} title={t("notifications.markRead")}>
                    <MarkEmailReadIcon />
                  </IconButton>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
