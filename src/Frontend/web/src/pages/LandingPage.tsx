import { Box, Button, Container, Stack, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Link as RouterLink } from "react-router-dom";

export function LandingPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f4f9ff",
        color: "#0b2545",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Container maxWidth="md">
        <Stack spacing={3} alignItems="center" textAlign="center">
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: 36, md: 56 },
              fontWeight: 900,
              letterSpacing: "-0.04em",
              lineHeight: 1.08,
            }}
          >
            Kalypsis
          </Typography>

          <Typography sx={{ fontSize: { xs: 18, md: 22 }, lineHeight: 1.6, maxWidth: 700 }}>
            Smarter operations for insurance and sales teams.
          </Typography>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="center"
            sx={{ width: "100%" }}
          >
            <Button
              component={RouterLink}
              to="/login"
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 999,
                fontWeight: 800,
                textTransform: "uppercase",
                bgcolor: "#0b2545",
                color: "#fff",
                "&:hover": { bgcolor: "#163d68" },
              }}
            >
              Login
            </Button>

            <Button
              component={RouterLink}
              to="/register"
              variant="outlined"
              endIcon={<ArrowForwardIcon />}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 999,
                fontWeight: 800,
                textTransform: "uppercase",
                borderColor: "#2f6bd6",
                color: "#17417f",
                bgcolor: "#ffffff",
                "&:hover": { bgcolor: "#eef4ff", borderColor: "#17417f" },
              }}
            >
              Register
            </Button>

            <Button
              component={RouterLink}
              to="/custom-software-solutions"
              variant="outlined"
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 999,
                fontWeight: 800,
                textTransform: "uppercase",
                borderColor: "#2f6bd6",
                color: "#17417f",
                bgcolor: "#ffffff",
                "&:hover": { bgcolor: "#eef4ff", borderColor: "#17417f" },
              }}
            >
              Custom software
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
