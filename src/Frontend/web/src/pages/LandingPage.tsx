        {/* Secondary — Εγγραφή. White pill, ~1.8px royal-blue border, blue
            bold uppercase text; lighter blue shadow. Hover brightens the
            border and floods the fill with a very light blue tint. */}
        <Button
          component={RouterLink}
          to="/register"
          variant="outlined"
          endIcon={<ArrowForwardIcon sx={{ fontSize: 24 }} />}
          sx={{
            flex: { xs: "1 1 auto", sm: "1 1 0" },
            height: { xs: 58, md: 62 },
            borderRadius: "14px",
            px: { xs: 3, sm: 5, md: 6 },
            fontSize: { xs: 15, sm: 16, md: 17 },
            fontWeight: 800,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            color: "#17417f",
            bgcolor: "#ffffff",
            borderColor: "#2f6bd6",
            borderWidth: "1.8px",
            boxShadow: "0 8px 20px rgba(47,107,214,0.14)",
            transition:
              "transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease, border-color 180ms ease",
            "&:hover": {
              borderWidth: "1.8px",
              borderColor: "#17417f",
              bgcolor: "#eef4ff",
              boxShadow: "0 12px 26px rgba(47,107,214,0.22)",
              transform: "translateY(-2px)",
            },
            "&:active": { transform: "translateY(0)" },
          }}
        >
          {t("landing.v2.ctaRegister")}
        </Button>

        <Button
          component={RouterLink}
          to="/custom-software-solutions"
          variant="outlined"
          sx={{
            flex: { xs: "1 1 auto", sm: "1 1 0" },
            minWidth: { xs: "100%", sm: 220 },
            height: { xs: 58, md: 62 },
            borderRadius: "14px",
            px: { xs: 3, sm: 4, md: 5 },
            fontSize: { xs: 14, sm: 15, md: 16 },
            fontWeight: 800,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            color: "#17417f",
            bgcolor: "#ffffff",
            borderColor: "#2f6bd6",
            borderWidth: "1.8px",
            boxShadow: "0 8px 20px rgba(47,107,214,0.14)",
            transition:
              "transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease, border-color 180ms ease",
            "&:hover": {
              borderWidth: "1.8px",
              borderColor: "#17417f",
              bgcolor: "#eef4ff",
              boxShadow: "0 12px 26px rgba(47,107,214,0.22)",
              transform: "translateY(-2px)",
            },
            "&:active": { transform: "translateY(0)" },
          }}
        >
          Custom software
        </Button>
      </Stack>
    </Box>
  );
}
