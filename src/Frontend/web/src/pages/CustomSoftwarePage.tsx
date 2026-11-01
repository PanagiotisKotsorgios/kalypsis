import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { PublicShell } from "../components/PublicShell";

export function CustomSoftwarePage() {
  return (
    <PublicShell modernNav>
      <Box
        sx={{
          py: { xs: 8, md: 12 },
          background:
            "linear-gradient(180deg, #f5f9ff 0%, #edf5ff 42%, #f9fbff 100%)",
          color: "#0b2545",
        }}
      >
        <Container maxWidth="lg">
          <Stack spacing={3} sx={{ maxWidth: 760 }}>
            <Typography
              sx={{
                fontSize: 12,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "#1f7bb3",
                fontWeight: 800,
              }}
            >
              Custom software
            </Typography>

            <Typography
              component="h1"
              sx={{
                fontSize: { xs: 36, md: 54 },
                fontWeight: 900,
                lineHeight: 1.08,
                letterSpacing: "-0.03em",
              }}
            >
              Λύσεις λογισμικού σχεδιασμένες για το γραφείο σας
            </Typography>

            <Typography
              sx={{
                fontSize: { xs: 17, md: 19 },
                lineHeight: 1.7,
                color: "#3d4f6b",
              }}
            >
              Η Kalypsis αναπτύσσει εξειδικευμένα εργαλεία για ασφαλιστικά γραφεία,
              ομάδες πωλήσεων, παραγωγής και διαχείρισης διαδικασιών — από
              εσωτερικά dashboard έως αυτόματες ροές εργασίας, διασύνδεση με
              συστήματα και custom λειτουργίες που ταιριάζουν ακριβώς στις ανάγκες σας.
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button
                component={RouterLink}
                to="/contact"
                variant="contained"
                sx={{
                  borderRadius: 999,
                  px: 3,
                  py: 1.4,
                  fontWeight: 800,
                  textTransform: "none",
                  bgcolor: "#0b2545",
                  color: "#fff",
                  boxShadow: "0 14px 28px rgba(11,37,69,0.18)",
                  "&:hover": { bgcolor: "#163d68" },
                }}
              >
                Επικοινωνήστε μαζί μας
              </Button>
              <Button
                component={RouterLink}
                to="/pricing"
                variant="outlined"
                sx={{
                  borderRadius: 999,
                  px: 3,
                  py: 1.4,
                  fontWeight: 800,
                  textTransform: "none",
                  borderColor: "#1f7bb3",
                  color: "#0b2545",
                  "&:hover": { borderColor: "#0b2545", bgcolor: "rgba(31,123,179,0.04)" },
                }}
              >
                Δείτε τα πακέτα
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </PublicShell>
  );
}
