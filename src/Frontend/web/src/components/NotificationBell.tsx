import { Badge, IconButton } from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

interface UnreadCount { count: number }

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => (await api.get<UnreadCount>("/notifications/unread-count")).data,
    refetchInterval: 60_000,
    staleTime: 30_000
  });
  const count = q.data?.count ?? 0;

  return (
    <IconButton
      onClick={() => navigate("/app/notifications")}
      title={t("notifications.title")}
      sx={{ color: "inherit" }}
    >
      <Badge badgeContent={count} color="error">
        <NotificationsIcon />
      </Badge>
    </IconButton>
  );
}
