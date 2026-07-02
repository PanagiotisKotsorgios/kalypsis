import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";
import RestoreIcon from "@mui/icons-material/Restore";
import SearchIcon from "@mui/icons-material/Search";
import CategoryIcon from "@mui/icons-material/Category";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { SearchableTextField } from "../components/SearchableTextField";

interface RecycleCategoryDto {
  key: string;
  label: string;
  count: number;
}

interface RecycleItemDto {
  category: string;
  categoryLabel: string;
  id: string;
  title: string;
  subtitle: string | null;
  deletedAt: string;
  expiresAt: string;
  daysLeft: number;
}

interface RecyclePageDto {
  categories: RecycleCategoryDto[];
  items: RecycleItemDto[];
  total: number;
  page: number;
  pageSize: number;
  retentionDays: number;
}

const BORDER = "#d9e1ea";

function fmt(value: string) {
  return new Date(value).toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function RecycleBinPage() {
  const qc = useQueryClient();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["recycle-bin", category, search, page, pageSize],
    queryFn: async () => (await api.get<RecyclePageDto>("/recycle-bin", {
      params: {
        category,
        search: search.trim() || undefined,
        page,
        pageSize
      }
    })).data
  });

  const restore = useMutation({
    mutationFn: async (item: RecycleItemDto) => api.post(`/recycle-bin/${item.category}/${item.id}/restore`),
    onSuccess: (_, item) => {
      setMessage(`Η εγγραφή «${item.title}» επαναφέρθηκε.`);
      void qc.invalidateQueries({ queryKey: ["recycle-bin"] });
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const data = q.data;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
  const totalCount = useMemo(() => (data?.categories ?? []).reduce((sum, c) => sum + c.count, 0), [data?.categories]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{
            width: 48,
            height: 48,
            borderRadius: 2.5,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(30,167,225,0.10)",
            color: "secondary.main",
            border: "1px solid rgba(30,167,225,0.22)"
          }}>
            <RestoreFromTrashIcon />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 850 }}>Κάδος ανακύκλωσης</Typography>
            <Typography color="text.secondary">
              Διαγραμμένες εγγραφές ανά κατηγορία. Παραμένουν διαθέσιμες για επαναφορά για {data?.retentionDays ?? 30} ημέρες.
            </Typography>
          </Box>
        </Stack>
        <Chip
          icon={<CategoryIcon />}
          label={`${totalCount.toLocaleString("el-GR")} διαγραμμένες εγγραφές`}
          sx={{ fontWeight: 800, bgcolor: "rgba(11,37,69,0.06)" }}
        />
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message}</Alert>}

      <Card sx={{ mb: 2, border: `1px solid ${BORDER}` }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
            <TextField
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              size="small"
              fullWidth
              placeholder="Αναζήτηση σε τίτλο, περιγραφή, κωδικό ή κατηγορία…"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
            <SearchableTextField
              select
              size="small"
              label="Κατηγορία"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              sx={{ minWidth: 240 }}
            >
              <MenuItem value="all">Όλες οι κατηγορίες</MenuItem>
              {(data?.categories ?? []).map(c => (
                <MenuItem key={c.key} value={c.key}>{c.label} ({c.count})</MenuItem>
              ))}
            </SearchableTextField>
            <SearchableTextField
              select
              size="small"
              label="Ανά σελίδα"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              sx={{ minWidth: 130 }}
            >
              {[10, 25, 50, 100].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </SearchableTextField>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
            <Chip
              label={`Όλα · ${totalCount}`}
              color={category === "all" ? "primary" : "default"}
              variant={category === "all" ? "filled" : "outlined"}
              onClick={() => { setCategory("all"); setPage(1); }}
              sx={{ fontWeight: 800 }}
            />
            {(data?.categories ?? []).filter(c => c.count > 0).map(c => (
              <Chip
                key={c.key}
                label={`${c.label} · ${c.count}`}
                color={category === c.key ? "primary" : "default"}
                variant={category === c.key ? "filled" : "outlined"}
                onClick={() => { setCategory(c.key); setPage(1); }}
                sx={{ fontWeight: 800 }}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Κατηγορία</TableCell>
                <TableCell>Εγγραφή</TableCell>
                <TableCell>Διαγράφηκε</TableCell>
                <TableCell>Λήξη κάδου</TableCell>
                <TableCell align="right">Ενέργεια</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.items ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>
                    Δεν βρέθηκαν διαγραμμένες εγγραφές με αυτά τα φίλτρα.
                  </TableCell>
                </TableRow>
              )}
              {(data?.items ?? []).map(item => (
                <TableRow key={`${item.category}-${item.id}`} hover>
                  <TableCell>
                    <Chip size="small" label={item.categoryLabel} variant="outlined" sx={{ fontWeight: 800 }} />
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={850}>{item.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.subtitle ?? "—"}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{item.id}</Typography>
                  </TableCell>
                  <TableCell>{fmt(item.deletedAt)}</TableCell>
                  <TableCell>
                    <Typography>{fmt(item.expiresAt)}</Typography>
                    <Chip
                      size="small"
                      color={item.daysLeft <= 3 ? "warning" : "default"}
                      label={`${item.daysLeft} ημέρες ακόμα`}
                      sx={{ mt: 0.5 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Επαναφορά εγγραφής">
                      <span>
                        <IconButton
                          color="primary"
                          disabled={restore.isPending}
                          onClick={() => {
                            if (window.confirm(`Να επαναφερθεί η εγγραφή «${item.title}»;`)) restore.mutate(item);
                          }}
                        >
                          <RestoreIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(data?.total ?? 0) > 0 && (
            <Stack direction={{ xs: "column", md: "row" }} alignItems="center" justifyContent="space-between" gap={1.5} sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Σύνολο αποτελεσμάτων: {(data?.total ?? 0).toLocaleString("el-GR")}
              </Typography>
              <Pagination
                count={totalPages}
                page={Math.min(page, totalPages)}
                onChange={(_, value) => setPage(value)}
                color="primary"
                shape="rounded"
                showFirstButton
                showLastButton
              />
            </Stack>
          )}
        </Card>
      )}
    </Box>
  );
}
