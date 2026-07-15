import type { ReactNode } from "react";
import { Alert, Box, Card, Stack, Typography } from "@mui/material";
import ConstructionIcon from "@mui/icons-material/Construction";
import type { SvgIconComponent } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

// Placeholder σελίδα για features που έχουν sidebar entry αλλά δεν έχουν
// γραφτεί ακόμη. Δείχνει τίτλο + σύντομη περιγραφή + info alert με
// αναφορά ότι είναι υπό ανάπτυξη. Τα points είναι σύντομη λίστα με τι
// θα κάνει η σελίδα όταν ολοκληρωθεί — βοηθά τους operators να ξέρουν
// τι έρχεται και να ζητήσουν προτεραιότητα.

interface Props {
  title: string;
  subtitle?: string;
  Icon?: SvgIconComponent;
  points?: string[];
  extra?: ReactNode;
}

export function UnderConstructionPage({ title, subtitle, Icon, points, extra }: Props) {
  const { t } = useTranslation();
  const HeaderIcon = Icon ?? ConstructionIcon;
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <HeaderIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{title}</Typography>
          {subtitle && <Typography color="text.secondary">{subtitle}</Typography>}
        </Box>
      </Stack>
      <Alert severity="info" icon={<ConstructionIcon />} sx={{ mb: 2 }}>
        {t("underConstruction.body",
          "Αυτή η λειτουργία είναι υπό ανάπτυξη και θα ενεργοποιηθεί σε επόμενη έκδοση. Επικοινωνήστε μαζί μας αν θέλετε να την προτεραιοποιήσουμε.")}
      </Alert>
      {points && points.length > 0 && (
        <Card variant="outlined" sx={{ p: 3 }}>
          <Typography fontWeight={700} mb={1.5}>
            {t("underConstruction.whatItWillDo", "Τι θα προσφέρει:")}
          </Typography>
          <Box component="ul" sx={{ pl: 3, m: 0 }}>
            {points.map((p, i) => (
              <Typography key={i} component="li" sx={{ mb: 0.5, color: "text.secondary" }}>{p}</Typography>
            ))}
          </Box>
        </Card>
      )}
      {extra}
    </Box>
  );
}
