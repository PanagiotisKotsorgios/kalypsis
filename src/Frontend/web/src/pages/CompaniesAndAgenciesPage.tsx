import { useState } from "react";
import { Box, Card, Tab, Tabs, Typography } from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import { InsuranceCompaniesPage } from "./InsuranceCompaniesPage";
import { AgencyOfficesPage } from "./AgencyOfficesPage";

/**
 * Unified directory entry point for an agency's external organisations.
 * The existing carrier and office pages remain available at their original
 * URLs; this surface simply keeps the two related directories together in a
 * single sidebar destination without duplicating their data or mutations.
 */
export function CompaniesAndAgenciesPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Card variant="outlined" sx={{ mb: 2, px: { xs: 1, md: 1.5 }, pt: 1, pb: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          {tab === 0 ? <BusinessIcon color="primary" /> : <HomeWorkIcon color="primary" />}
          <Box>
            <Typography variant="h5" fontWeight={800}>Εταιρείες &amp; Πρακτορεία</Typography>
            <Typography variant="body2" color="text.secondary">
              Πλήρεις καρτέλες ασφαλιστικών εταιρειών και υποκαταστημάτων του γραφείου.
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
          <Tab icon={<HomeWorkIcon fontSize="small" />} iconPosition="start" label="Πρακτορεία / υποκαταστήματα" />
        </Tabs>
      </Card>

      {tab === 0 ? <InsuranceCompaniesPage /> : <AgencyOfficesPage />}
    </Box>
  );
}

export default CompaniesAndAgenciesPage;
