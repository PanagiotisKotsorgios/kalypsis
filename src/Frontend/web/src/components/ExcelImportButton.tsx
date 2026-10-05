import { Button, type ButtonProps } from "@mui/material";
import TableViewOutlinedIcon from "@mui/icons-material/TableViewOutlined";

/**
 * Consistent Excel-style import action used across list pages.
 * The green treatment and spreadsheet icon make the upload action obvious
 * without changing the import behaviour of the page.
 */
export function ExcelImportButton({ children = "Εισαγωγή", sx, ...props }: ButtonProps) {
  return (
    <Button
      {...props}
      variant="contained"
      startIcon={props.startIcon ?? <TableViewOutlinedIcon />}
      sx={{
        bgcolor: "#217346",
        color: "#fff",
        fontWeight: 800,
        borderColor: "#217346",
        boxShadow: "0 2px 5px rgba(33,115,70,.22)",
        "&:hover": { bgcolor: "#185c37", borderColor: "#185c37", color: "#fff", boxShadow: "0 3px 8px rgba(24,92,55,.3)" },
        ...sx,
      }}
    >
      {children}
    </Button>
  );
}
