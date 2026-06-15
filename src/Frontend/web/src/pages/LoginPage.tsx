import { useState, type FormEvent } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAuth, type Role } from "../auth/AuthContext";
import { LanguageToggle } from "../components/LanguageToggle";

export function LoginPage() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const role: Role = email.includes("platform")
      ? "PlatformAdmin"
      : email.includes("admin")
      ? "AgencyAdmin"
      : email.includes("employee")
      ? "AgencyUser"
      : email.includes("producer")
      ? "Producer"
      : "Customer";

    signIn(
      {
        userId: "00000000-0000-0000-0000-000000000001",
        tenantId: role === "PlatformAdmin" ? null : "00000000-0000-0000-0000-000000000010",
        email: email || "demo@kalypsis.gr",
        role,
        firstName: "Demo",
        lastName: "User"
      },
      "dev-mock-token"
    );
    navigate("/", { replace: true });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f4c81 0%, #1976d2 100%)",
        p: 2
      }}
    >
      <Card sx={{ width: 400, maxWidth: "100%" }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" fontWeight={700}>
              {t("app.name")}
            </Typography>
            <LanguageToggle />
          </Stack>
          <Typography variant="h6" gutterBottom>
            {t("auth.loginTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {t("auth.loginSubtitle")}
          </Typography>
          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label={t("auth.email")}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
                fullWidth
              />
              <TextField
                label={t("auth.password")}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
              />
              <Button type="submit" variant="contained" size="large" fullWidth>
                {t("auth.signIn")}
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
