import { Button } from "@mui/material";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function CompanyPromoButton() {
  const { i18n } = useTranslation();
  const english = (i18n.resolvedLanguage ?? i18n.language).startsWith("en");
  return (
    <Button
      component={RouterLink}
      to="/company"
      startIcon={<BusinessRoundedIcon />}
      endIcon={<ArrowForwardIosIcon sx={{ fontSize: "15px !important" }} />}
      sx={{
        minHeight: 60,
        px: { xs: 2.5, sm: 3.25 },
        borderRadius: 2,
        bgcolor: "#0b3b70",
        color: "#fff",
        fontSize: { xs: 16, sm: 18 },
        fontWeight: 850,
        textTransform: "none",
        boxShadow: "0 8px 22px rgba(12,55,100,.2)",
        "& .MuiButton-startIcon svg": { fontSize: 24 },
        "&:hover": { bgcolor: "#092d58", boxShadow: "0 10px 26px rgba(12,55,100,.28)" },
      }}
    >
      {english ? "Our Company" : "Η Εταιρεία μας"}
    </Button>
  );
}
