import { type ReactNode } from "react";
import { Box } from "@mui/material";

// The prominent navy-filled "?" affordance was retired: agency dashboards
// now show a single gray ⓘ per field, positioned at the top-right outside
// each field (see BackOfficeActionHelp). To avoid churning ~50 page files
// that still reference these exports, we keep the components in place but
// render nothing (HelpHint) / just the label (LabelWithHelp).

interface HelpHintProps {
  id?: string;
  title?: ReactNode;
  body?: ReactNode;
  size?: "small" | "medium";
  sx?: object;
}

export function HelpHint(_: HelpHintProps) {
  return null;
}

export function LabelWithHelp({ label, sx }: {
  label: ReactNode;
  helpId?: string;
  helpTitle?: ReactNode;
  helpBody?: ReactNode;
  sx?: object;
}) {
  return (
    <Box component="span" sx={{ fontSize: 13, fontWeight: 600, color: "text.secondary", ...sx }}>
      {label}
    </Box>
  );
}
