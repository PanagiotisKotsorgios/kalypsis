import type { ReactNode } from "react";
import { Box, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { policyCoverageContainerSx, policyCoverageRowSx, policyCoverageTableSx } from "./profile/policyCoverageAppearance";

export interface PolicyCoverageRow {
  id: string; coverCode: string; coverName: string | null; coverageAmount: number | null;
}
const number = (value: number) => value.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Presentation only: mutations and permissions remain owned by the existing card. */
export function PolicyCoverageTable<T extends PolicyCoverageRow>({ rows, currency, readOnly = false, editingId, busy = false, onEdit, onDelete, renderDeductible }: {
  rows: T[]; currency: string; readOnly?: boolean; editingId?: string | null; busy?: boolean;
  onEdit: (row: T) => void; onDelete: (row: T) => void; renderDeductible?: (row: T) => ReactNode;
}) {
  const columnCount = 3 + (renderDeductible ? 1 : 0) + (readOnly ? 0 : 1);
  return <Box sx={policyCoverageContainerSx} tabIndex={0} role="region" aria-label="Πίνακας καλύψεων συμβολαίου">
    <Table stickyHeader size="small" aria-label="Καλύψεις συμβολαίου" sx={{ ...policyCoverageTableSx, minWidth: renderDeductible ? 560 : 380 }}>
      <TableHead><TableRow>
        <TableCell>Κωδικός</TableCell><TableCell>Κάλυψη</TableCell>
        <TableCell align="right">Κεφάλαιο ({currency})</TableCell>{renderDeductible && <TableCell>Απαλλαγή ({currency})</TableCell>}
        {!readOnly && <TableCell align="right">Ενέργειες</TableCell>}
      </TableRow></TableHead>
      <TableBody>{rows.map((row, index) => <TableRow key={row.id} hover selected={editingId === row.id} sx={policyCoverageRowSx(index)}>
        <TableCell sx={{ fontFamily: "monospace", fontWeight: 700, color: "#087CEB !important" }}>{row.coverCode || "—"}</TableCell>
        <TableCell sx={{ minWidth: 150, maxWidth: 260, overflowWrap: "anywhere" }}>{row.coverName || "—"}</TableCell>
        <TableCell align="right">{row.coverageAmount == null ? "—" : number(row.coverageAmount)}</TableCell>
        {renderDeductible && <TableCell sx={{ minWidth: 210 }}>{renderDeductible(row)}</TableCell>}
        {!readOnly && <TableCell align="right"><Stack direction="row" spacing={.5} justifyContent="flex-end">
          <Tooltip title="Επεξεργασία κάλυψης"><IconButton aria-label={`Επεξεργασία κάλυψης ${row.coverCode}`} size="small" disabled={busy || !!editingId && editingId !== row.id} onClick={() => onEdit(row)}
            sx={{ bgcolor: "#E4F2E8", color: "#107B46", "&:hover": { bgcolor: "#CEE8D7" } }}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Διαγραφή κάλυψης"><IconButton aria-label={`Διαγραφή κάλυψης ${row.coverCode}`} size="small" disabled={busy} onClick={() => onDelete(row)}
            sx={{ bgcolor: "#FCE8EB", color: "#C6283E", "&:hover": { bgcolor: "#F8D2D8" } }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
        </Stack></TableCell>}
      </TableRow>)}{!rows.length && <TableRow><TableCell colSpan={columnCount} align="center" sx={{ py: "16px !important" }}>Δεν υπάρχουν καταχωρημένες καλύψεις.</TableCell></TableRow>}</TableBody>
    </Table>
  </Box>;
}
