import { useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, IconButton,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, Tab, Tabs, Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LoginIcon from "@mui/icons-material/Login";
import GroupIcon from "@mui/icons-material/Group";
import PeopleIcon from "@mui/icons-material/People";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";
import ReportIcon from "@mui/icons-material/Report";
import HandshakeIcon from "@mui/icons-material/Handshake";
import EuroIcon from "@mui/icons-material/Euro";
import EventIcon from "@mui/icons-material/Event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";
import { useImpersonation } from "../impersonation/ImpersonationContext";

interface TenantOverview {
  tenantId: string; name: string; code: string; isActive: boolean;
  subscriptionPlan: string; createdAt: string;
  userCount: number; customerCount: number; policyCount: number;
  activePolicyCount: number; documentCount: number; claimCount: number;
  producerCount: number; totalPremium: number;
  lastUserLoginAt: string | null;
  recentUsers: {
    id: string; email: string; firstName: string; lastName: string;
    role: string; isActive: boolean; createdAt: string; lastLoginAt: string | null;
  }[];
}

export function TenantDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { enter } = useImpersonation();
  const [tab, setTab] = useState<"overview" | "users" | "customers" | "policies">("overview");
  const [err, setErr] = useState<string | null>(null);

  const overviewQ = useQuery({
    queryKey: ["tenant-overview", id],
    enabled: !!id,
    queryFn: async () => (await api.get<TenantOverview>(`/tenants/${id}/overview`)).data
  });

  // Cross-tenant users list (filter by this tenant on the platform users endpoint).
  const usersQ = useQuery({
    queryKey: ["tenant-users", id],
    enabled: !!id && tab === "users",
    queryFn: async () => (await api.get(`/platform/users`, { params: { tenantId: id } })).data as TenantOverview["recentUsers"]
  });

  const setActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.post(`/platform/users/bulk`, { userIds: [userId], action: isActive ? "Activate" : "Deactivate" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["tenant-users", id] }); void qc.invalidateQueries({ queryKey: ["tenant-overview", id] }); }
  });

  const delUser = useMutation({
    mutationFn: async (userId: string) => api.delete(`/platform/users/${userId}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["tenant-users", id] }); void qc.invalidateQueries({ queryKey: ["tenant-overview", id] }); },
    onError: e => setErr(extractErrorMessage(e))
  });

  if (overviewQ.isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  if (overviewQ.error || !overviewQ.data) return <Alert severity="error">{t("tenants.loadError")}</Alert>;
  const o = overviewQ.data;

  const stats = [
    { icon: <GroupIcon />, label: t("tenants.stat.users"), value: o.userCount },
    { icon: <PeopleIcon />, label: t("tenants.stat.customers"), value: o.customerCount },
    { icon: <DescriptionIcon />, label: t("tenants.stat.policies"), value: o.policyCount, sub: `${o.activePolicyCount} ${t("tenants.stat.active")}` },
    { icon: <FolderIcon />, label: t("tenants.stat.documents"), value: o.documentCount },
    { icon: <ReportIcon />, label: t("tenants.stat.claims"), value: o.claimCount },
    { icon: <HandshakeIcon />, label: t("tenants.stat.producers"), value: o.producerCount },
    { icon: <EuroIcon />, label: t("tenants.stat.premium"), value: `${o.totalPremium.toFixed(0)} €` }
  ];

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <IconButton onClick={() => navigate("/app/tenants")} size="small"><ArrowBackIcon /></IconButton>
        <Typography variant="h4" sx={{ fontWeight: 800, flex: 1 }}>{o.name}</Typography>
        <Chip label={o.code} variant="outlined" />
        <Chip label={o.subscriptionPlan} color="primary" />
        <Chip label={o.isActive ? t("common.active") : t("common.inactive")} color={o.isActive ? "success" : "default"} />
        <Button startIcon={<LoginIcon />} variant="contained" onClick={() => { enter(o.tenantId, o.name); navigate("/app"); }}>
          {t("tenants.enterAs")}
        </Button>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(7, 1fr)" }, gap: 1.5, mb: 3 }}>
        {stats.map((s, i) => (
          <Card key={i}><CardContent sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: "rgba(11,37,69,0.06)", color: "primary.main" }}>{s.icon}</Avatar>
              <Box>
                <Typography variant="overline" color="text.secondary">{s.label}</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{s.value}</Typography>
                {s.sub && <Typography variant="caption" color="text.secondary">{s.sub}</Typography>}
              </Box>
            </Stack>
          </CardContent></Card>
        ))}
      </Box>

      <Card sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab label={t("tenants.tab.overview")} value="overview" />
          <Tab label={t("tenants.tab.users")} value="users" />
          <Tab label={t("tenants.tab.customers")} value="customers" />
          <Tab label={t("tenants.tab.policies")} value="policies" />
        </Tabs>
      </Card>

      {tab === "overview" && (
        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <EventIcon fontSize="small" color="action" />
                <Typography>{t("tenants.createdAt")}: {new Date(o.createdAt).toLocaleString("el-GR")}</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <EventIcon fontSize="small" color="action" />
                <Typography>{t("tenants.lastLogin")}: {o.lastUserLoginAt ? new Date(o.lastUserLoginAt).toLocaleString("el-GR") : "—"}</Typography>
              </Stack>
              <Typography variant="overline" color="text.secondary" sx={{ mt: 2 }}>{t("tenants.recentUsers")}</Typography>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Email</TableCell><TableCell>{t("tenants.userName")}</TableCell>
                  <TableCell>{t("tenants.userRole")}</TableCell>
                  <TableCell>{t("tenants.userLastLogin")}</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {o.recentUsers.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.firstName} {u.lastName}</TableCell>
                      <TableCell><Chip size="small" label={t(`roles.${u.role}`)} variant="outlined" /></TableCell>
                      <TableCell>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("el-GR") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          </CardContent>
        </Card>
      )}

      {tab === "users" && (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          {usersQ.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Email</TableCell>
                <TableCell>{t("tenants.userName")}</TableCell>
                <TableCell>{t("tenants.userRole")}</TableCell>
                <TableCell>{t("common.status")}</TableCell>
                <TableCell>{t("tenants.userLastLogin")}</TableCell>
                <TableCell align="right" />
              </TableRow></TableHead>
              <TableBody>
                {(usersQ.data ?? []).map(u => (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.firstName} {u.lastName}</TableCell>
                    <TableCell><Chip size="small" label={t(`roles.${u.role}`)} variant="outlined" /></TableCell>
                    <TableCell><Chip size="small" color={u.isActive ? "success" : "default"} label={u.isActive ? t("common.active") : t("common.inactive")} /></TableCell>
                    <TableCell>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("el-GR") : "—"}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => setActive.mutate({ userId: u.id, isActive: !u.isActive })}>
                        {u.isActive ? t("tenants.userDeactivate") : t("tenants.userActivate")}
                      </Button>
                      <Button size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) delUser.mutate(u.id); }}>
                        {t("common.delete")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {(tab === "customers" || tab === "policies") && (
        <Card sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary" gutterBottom>
            {t("tenants.enterToBrowse")}
          </Typography>
          <Button startIcon={<LoginIcon />} variant="contained" onClick={() => { enter(o.tenantId, o.name); navigate(tab === "customers" ? "/app/customers" : "/app/policies"); }}>
            {t("tenants.enterAs")}
          </Button>
        </Card>
      )}
    </Box>
  );
}
