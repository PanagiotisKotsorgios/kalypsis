import { useState } from "react";
import { Box, Card, Tab, Tabs, Typography } from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import HandshakeIcon from "@mui/icons-material/Handshake";
import { InsuranceCompaniesPage } from "./InsuranceCompaniesPage";

/**
 * Unified directory entry point for external business partners. Both tabs use
 * the InsuranceCompany entity: a broker/agency is a collaborating business
 * partner (Grand Cover, Din Cover, Brokers Union), not an AgencyOffice branch.
 * Actual branches remain available only under Administration → Office
 * management.
 */
export function CompaniesAndAgenciesPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Card variant="outlined" sx={{ mb: 2, px: { xs: 1, md: 1.5 }, pt: 1, pb: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          {tab === 0 ? <BusinessIcon color="primary" /> : <HandshakeIcon color="primary" />}
          <Box>
            <Typography variant="h5" fontWeight={800}>Εταιρείες &amp; Πρακτορεία</Typography>
            <Typography variant="body2" color="text.secondary">
              Πλήρεις καρτέλες ασφαλιστικών εταιρειών και συνεργαζόμενων πρακτορείων. Τα υποκαταστήματα διαχειρίζονται ξεχωριστά.
            </Typography>
          </Box>
        </Box>
        <Tabs
          value={tab}
          onChange={(_, value: number) => setTab(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ minHeight: 38, "& .MuiTab-root": { minHeight: 38, py: 0.5, px: 1.25 } }}
        >
          <Tab icon={<BusinessIcon fontSize="small" />} iconPosition="start" label="Ασφαλιστικές εταιρείες" />
          <Tab icon={<HandshakeIcon fontSize="small" />} iconPosition="start" label="Πρακτορεία / διαμεσολαβητές" />
        </Tabs>
      </Card>

      {tab === 0 ? <InsuranceCompaniesPage /> : <InsuranceCompaniesPage onlyBrokers />}
    </Box>
  );
}

export default CompaniesAndAgenciesPage;
