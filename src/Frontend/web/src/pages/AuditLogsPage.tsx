import { useState } from "react";
import {
  Box,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

interface AuditLog {
  id: string;
  tenantId: string | null;
  tenantName: string | null;
  userId: string | null;
  userEmail: string | null;
  entityName: string;
  entityId: string;
  action: string;
  oldValues: string | null;
  newValues: string | null;
  createdAt: string;
}

const ACTION_COLOR: Record<string, "default" | "info" | "success" | "warning" | "error"> = {
  Create: "success",
  Update: "info",
  Delete: "error"
};

export function AuditLogsPage() {
  const { t } = useTranslation();
  const [entityName, setEntityName] = useState("");
  const [action, setAction] = useState("");
  const [detail, setDetail] = useState<AuditLog | null>(null);

  const query = useQuery({
    queryKey: ["audit-logs", entityName, action],
    queryFn: async () => {
      const params: Record<string, string> = { take: "200" };
      if (entityName) params.entityName = entityName;
      if (action) params.action = action;
      const res = await api.get<AuditLog[]>("/audit-logs", { params });
      return res.data;
    }
  });

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>
        {t("audit.title")}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t("audit.subtitle")}
      </Typography>

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label={t("audit.filters.entityName")}
            value={entityName}
            onChange={(e) => setEntityName(e.target.value)}
            placeholder="User · Customer · Policy · ServiceRequest..."
            fullWidth
            size="small"
          />
          <TextField
            select
            label={t("audit.filters.action")}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            sx={{ minWidth: { sm: 200 } }}
            size="small"
          >
            <MenuItem value="">{t("audit.filters.allActions")}</MenuItem>
            <MenuItem value="Create">Create</MenuItem>
            <MenuItem value="Update">Update</MenuItem>
            <MenuItem value="Delete">Delete</MenuItem>
          </TextField>
        </Stack>
      </Card>

      {query.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("audit.col.timestamp")}</TableCell>
                  <TableCell>{t("audit.col.action")}</TableCell>
                  <TableCell>{t("audit.col.entity")}</TableCell>
                  <TableCell>{t("audit.col.user")}</TableCell>
                  <TableCell>{t("audit.col.tenant")}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {(query.data ?? []).map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                      {new Date(row.createdAt).toLocaleString("el-GR")}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.action}
                        color={ACTION_COLOR[row.action] ?? "default"}
                        size="small"
                        sx={{ fontWeight: 700, minWidth: 64 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>{row.entityName}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                        {row.entityId.slice(0, 8)}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.userEmail ?? "—"}</TableCell>
                    <TableCell>{row.tenantName ?? "—"}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setDetail(row)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {(query.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography color="text.secondary" textAlign="center" py={4}>
                        {t("common.noData")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <Dialog open={!!detail} onClose={() => setDetail(null)} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {detail?.entityName}
            </Typography>
            <Chip
              label={detail?.action}
              color={detail ? ACTION_COLOR[detail.action] ?? "default" : "default"}
              size="small"
            />
            <Box sx={{ flex: 1 }} />
            <IconButton onClick={() => setDetail(null)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {detail && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {new Date(detail.createdAt).toLocaleString("el-GR")} · {detail.userEmail ?? "system"} · {detail.tenantName ?? "—"}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                {detail.entityName}#{detail.entityId}
              </Typography>
              {detail.oldValues && (
                <Box>
                  <Typography variant="overline" color="error">OLD</Typography>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: "#fdf3f3",
                      border: "1px solid",
                      borderColor: "error.light",
                      borderRadius: 1,
                      fontFamily: "monospace",
                      fontSize: 13,
                      whiteSpace: "pre-wrap",
                      overflowX: "auto"
                    }}
                  >
                    {pretty(detail.oldValues)}
                  </Box>
                </Box>
              )}
              {detail.newValues && (
                <Box>
                  <Typography variant="overline" color="success.main">NEW</Typography>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: "#f3faf3",
                      border: "1px solid",
                      borderColor: "success.light",
                      borderRadius: 1,
                      fontFamily: "monospace",
                      fontSize: 13,
                      whiteSpace: "pre-wrap",
                      overflowX: "auto"
                    }}
                  >
                    {pretty(detail.newValues)}
                  </Box>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function pretty(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
