import { useState } from "react";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import RequestQuoteOutlinedIcon from "@mui/icons-material/RequestQuoteOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ContractRequestDialog } from "./ContractRequestDialog";

/** One concise next step instead of a second package catalogue on the homepage. */
export function PublicPricingCooperationSection() {
  const { i18n } = useTranslation();
  const english = i18n.resolvedLanguage?.startsWith("en") ?? false;
  const [contractOpen, setContractOpen] = useState(false);
  return <>
    <Box component="section" aria-labelledby="public-pricing-cooperation-title" sx={{ py: { xs: 4, md: 5 }, bgcolor: "#FFFFFF", borderBottom: "1px solid #E2E9F1" }}>
      <Container maxWidth="lg">
        <Box sx={{ bgcolor: "#EDF3F9", border: "1px solid #C8D8E8", borderRadius: 3, p: { xs: 2.5, sm: 3.5 }, display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: { xs: "stretch", md: "center" }, gap: { xs: 3, md: 4 } }}>
          <Stack direction="row" gap={2} alignItems="flex-start" sx={{ flex: 1, minWidth: 0 }}>
            <Box aria-hidden sx={{ display: { xs: "none", sm: "grid" }, width: 52, height: 56, flexShrink: 0, placeItems: "center", borderRadius: 2, bgcolor: "#0B305C", color: "#FFFFFF" }}><RequestQuoteOutlinedIcon sx={{ fontSize: 30 }} /></Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ color: "#27679E", fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", mb: .75 }}>{english ? "Pricing & cooperation" : "Τιμολόγηση & συνεργασία"}</Typography>
              <Typography component="h2" id="public-pricing-cooperation-title" sx={{ color: "#102D55", fontSize: { xs: 24, md: 27 }, lineHeight: 1.3, fontWeight: 800, letterSpacing: "-.02em", textWrap: "balance", mb: 1 }}>{english ? "Choose the right solution for your agency." : "Η κατάλληλη λύση για το γραφείο σας."}</Typography>
              <Typography sx={{ color: "#536B89", fontSize: 15, lineHeight: 1.7, maxWidth: 540 }}>{english ? "Explore detailed pricing and package options, or send our team a request for a cooperation agreement." : "Δείτε αναλυτικά τις τιμές και τις επιλογές πακέτων ή στείλτε στην ομάδα μας αίτημα για σύμβαση συνεργασίας."}</Typography>
            </Box>
          </Stack>
          <Stack gap={1.25} sx={{ flexShrink: 0, width: { xs: "100%", md: 300 } }}>
            <Button component={RouterLink} to="/pricing" variant="contained" disableElevation startIcon={<RequestQuoteOutlinedIcon />} endIcon={<ArrowForwardIcon />} sx={{ bgcolor: "#0B305C", color: "#FFFFFF", borderRadius: 1.75, px: 2, py: 1.25, minHeight: 46, textTransform: "none", fontWeight: 750, lineHeight: 1.5, "&:hover": { bgcolor: "#164B7D" } }}>{english ? "Detailed pricing" : "Αναλυτική τιμολόγηση"}</Button>
            <Button onClick={() => setContractOpen(true)} variant="outlined" startIcon={<DescriptionOutlinedIcon />} aria-haspopup="dialog" aria-expanded={contractOpen} sx={{ bgcolor: "#F8FBFE", color: "#145A9E", borderColor: "#7399C0", borderRadius: 1.75, px: 2, py: 1.25, minHeight: 46, textTransform: "none", fontWeight: 750, lineHeight: 1.5, "&:hover": { bgcolor: "#E0ECF8", borderColor: "#145A9E" } }}>{english ? "Request a cooperation agreement" : "Αίτημα σύμβασης συνεργασίας"}</Button>
          </Stack>
        </Box>
      </Container>
    </Box>
    <ContractRequestDialog open={contractOpen} onClose={() => setContractOpen(false)} />
  </>;
}
