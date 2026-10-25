import { Button } from "@mui/material";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { Link as RouterLink } from "react-router-dom";

export function HostingPromoButton() {
  return (
    <Button
      component={RouterLink}
      to="/hosting"
      startIcon={<DnsOutlinedIcon />}
      endIcon={<ArrowForwardIosIcon sx={{ fontSize: "15px !important" }} />}
      sx={{
        minHeight: 60,
        px: { xs: 2.5, sm: 3.25 },
        borderRadius: 2,
        bgcolor: "#15864A",
        color: "#fff",
        fontSize: { xs: 16, sm: 18 },
        fontWeight: 850,
        textTransform: "none",
        boxShadow: "0 8px 22px rgba(12,95,51,.2)",
        "& .MuiButton-startIcon svg": { fontSize: 24 },
        "&:hover": { bgcolor: "#0F713D", boxShadow: "0 10px 26px rgba(12,95,51,.28)" },
      }}
    >
      Web Hosting
    </Button>
  );
}
