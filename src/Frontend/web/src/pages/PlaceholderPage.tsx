import { Card, CardContent, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          {t(titleKey)}
        </Typography>
        <Typography color="text.secondary">{t("common.noData")}</Typography>
      </CardContent>
    </Card>
  );
}
