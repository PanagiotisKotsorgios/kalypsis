import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography
} from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";
import NotificationsIcon from "@mui/icons-material/Notifications";
import AssignmentIcon from "@mui/icons-material/Assignment";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AddIcon from "@mui/icons-material/Add";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { money, date } from "../utils/format";

interface Policy {
  id: string;
  policyNumber: string;
  policyType: string;
  insuranceCompanyName: string;
  startDate: string;
  endDate: string;
  premium: number;
  currency: string;
  status: string;
}

interface DocumentDto {
  id: string;
  fileName: string;
  policyNumber: string;
  documentType: string;
  sizeBytes: number;
  createdAt: string;
}

interface Notification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export function CustomerDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const policiesQuery = useQuery({
    queryKey: ["customer-policies"],
    queryFn: async () => (await api.get<Policy[]>("/policies")).data
  });
  const documentsQuery = useQuery({
    queryKey: ["customer-documents"],
    queryFn: async () => (await api.get<DocumentDto[]>("/documents")).data
  });
  const notificationsQuery = useQuery({
    queryKey: ["customer-notifications"],
    queryFn: async () => (await api.get<Notification[]>("/notifications")).data
  });

  const policies = policiesQuery.data ?? [];
  const activePolicies = policies.filter((p) => p.status === "Active");
  const expiringSoon = activePolicies.filter((p) => {
    const days = Math.ceil((new Date(p.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 30;
  });
  const documents = documentsQuery.data ?? [];
  const recentDocs = documents.slice(0, 4);
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const loading = policiesQuery.isLoading || documentsQuery.isLoading || notificationsQuery.isLoading;

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Friendly hero greeting */}
      <Card
        sx={{
          mb: 3,
          background: "linear-gradient(135deg, #0b2545 0%, #1d4e89 60%, #1ea7e1 130%)",
          color: "common.white",
          borderRadius: 4,
          overflow: "hidden",
          position: "relative"
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: 2 }}>
            {t("customerDashboard.eyebrow")}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5, mb: 1 }}>
            {t("customerDashboard.hello", { name: user?.firstName })}
          </Typography>
          <Typography sx={{ opacity: 0.92, maxWidth: 560 }}>
            {t("customerDashboard.subtitle")}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3 }} alignItems="flex-start">
            <Button
              variant="contained"
              color="secondary"
              size="large"
              startIcon={<AddIcon />}
              onClick={() => navigate("/app/contracts/new")}
              sx={{ fontWeight: 700 }}
            >
              {t("customerDashboard.cta.newContract")}
            </Button>
            {expiringSoon.length > 0 && (
              <Chip
                icon={<EventBusyIcon sx={{ color: "common.white !important" }} />}
                label={t("customerDashboard.expiringHint", { count: expiringSoon.length })}
                sx={{
                  bgcolor: "rgba(255,255,255,0.16)",
                  color: "common.white",
                  border: "1px solid rgba(255,255,255,0.3)",
                  fontWeight: 700,
                  alignSelf: "center"
                }}
              />
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Big tiles */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          mb: 3
        }}
      >
        <BigTile
          icon={<DescriptionIcon />}
          number={activePolicies.length}
          labelKey="customerDashboard.tile.policies"
          onClick={() => navigate("/app/policies")}
          color="primary.main"
        />
        <BigTile
          icon={<EventBusyIcon />}
          number={expiringSoon.length}
          labelKey="customerDashboard.tile.expiring"
          onClick={() => navigate("/app/policies")}
          color="warning.main"
          highlight={expiringSoon.length > 0}
        />
        <BigTile
          icon={<FolderIcon />}
          number={documents.length}
          labelKey="customerDashboard.tile.documents"
          onClick={() => navigate("/app/documents")}
          color="secondary.main"
        />
        <BigTile
          icon={<NotificationsIcon />}
          number={unreadCount}
          labelKey="customerDashboard.tile.notifications"
          onClick={() => navigate("/app/notifications")}
          color="#f6a623"
          highlight={unreadCount > 0}
        />
      </Box>

      {/* Two-column quick lists */}
      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        {/* My contracts shortcut */}
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {t("customerDashboard.section.contracts")}
              </Typography>
              <Button size="small" endIcon={<ChevronRightIcon />} onClick={() => navigate("/app/policies")}>
                {t("customerDashboard.viewAll")}
              </Button>
            </Stack>

            {activePolicies.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>
                {t("customerDashboard.noContracts")}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {activePolicies.slice(0, 4).map((p) => (
                  <Card
                    key={p.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      cursor: "pointer",
                      "&:hover": { borderColor: "primary.main", bgcolor: "rgba(11,37,69,0.02)" }
                    }}
                    onClick={() => navigate(`/app/contracts/${p.id}`)}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1.5}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" mb={0.4} flexWrap="wrap">
                          <Chip label={p.policyNumber} size="small" variant="outlined" />
                          <Typography variant="body2" color="text.secondary">
                            {t(`policies.types.${p.policyType}`)}
                          </Typography>
                        </Stack>
                        <Typography fontWeight={700} noWrap>
                          {p.insuranceCompanyName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {date(p.startDate)} → {date(p.endDate)}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                        <Typography fontWeight={800}>
                          {money(p.premium, p.currency)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Recent documents shortcut */}
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {t("customerDashboard.section.documents")}
              </Typography>
              <Button size="small" endIcon={<ChevronRightIcon />} onClick={() => navigate("/app/documents")}>
                {t("customerDashboard.viewAll")}
              </Button>
            </Stack>

            {recentDocs.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>
                {t("customerDashboard.noDocuments")}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {recentDocs.map((d) => (
                  <Card
                    key={d.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      cursor: "pointer",
                      "&:hover": { borderColor: "secondary.main", bgcolor: "rgba(30,167,225,0.04)" }
                    }}
                    onClick={() => navigate("/app/documents")}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1.5,
                          bgcolor: "rgba(30,167,225,0.12)",
                          color: "secondary.main",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}
                      >
                        <FolderIcon />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={700} noWrap>
                          {d.fileName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {d.policyNumber} · {Math.round(d.sizeBytes / 1024)} KB
                        </Typography>
                      </Box>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* CTA card to file a request */}
      <Card sx={{ mt: 3, borderRadius: 3, bgcolor: "rgba(11,37,69,0.04)" }}>
        <CardActionArea onClick={() => navigate("/app/requests")} sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 2,
                bgcolor: "primary.main",
                color: "common.white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <AssignmentIcon />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {t("customerDashboard.cta.title")}
              </Typography>
              <Typography color="text.secondary">{t("customerDashboard.cta.subtitle")}</Typography>
            </Box>
            <ChevronRightIcon color="action" />
          </Stack>
        </CardActionArea>
      </Card>
    </Box>
  );
}

interface BigTileProps {
  icon: React.ReactNode;
  number: number;
  labelKey: string;
  color: string;
  highlight?: boolean;
  onClick: () => void;
}

function BigTile({ icon, number, labelKey, color, highlight, onClick }: BigTileProps) {
  const { t } = useTranslation();
  return (
    <Card
      sx={{
        borderRadius: 3,
        borderLeft: highlight ? "5px solid" : undefined,
        borderLeftColor: color,
        transition: "transform 180ms, box-shadow 180ms",
        "&:hover": { transform: "translateY(-2px)", boxShadow: "0 10px 24px rgba(11,37,69,0.10)" }
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: `${color}1f`,
              color
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
              {number}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.4 }}>
              {t(labelKey)}
            </Typography>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
