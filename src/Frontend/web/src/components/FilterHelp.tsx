import type { ReactNode } from "react";
import { Box, Tooltip } from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

/**
 * Small ⓘ affordance used at the right edge of a filter input. Two shapes:
 *
 *   • <FilterHelp title="…" />   — bare icon; drop into an InputAdornment.
 *   • <FilterHelp title="…" wrapper /> — positioned absolutely at right:28
 *     for selects/date pickers where the built-in caret would collide.
 *
 * For fields that don't accept `InputProps` (e.g. our custom
 * SearchableTextField), wrap the field in <FilterFieldWrap tip="…"> to
 * add the ⓘ on the right side without touching internal input APIs.
 */
export function FilterHelp({ title, wrapper }: { title: string; wrapper?: boolean }) {
  const icon = (
    <Tooltip title={title} arrow placement="top">
      <HelpOutlineIcon
        fontSize="small"
        sx={{ color: "text.disabled", opacity: 0.7, cursor: "help",
              "&:hover": { color: "primary.main", opacity: 1 } }}
      />
    </Tooltip>
  );
  if (!wrapper) return icon;
  return (
    <Box sx={{ position: "absolute", right: 28, top: "50%", transform: "translateY(-50%)",
               display: "flex", alignItems: "center", pointerEvents: "auto" }}>
      {icon}
    </Box>
  );
}

/**
 * Wrap a filter input so a ⓘ icon appears at its right edge without
 * modifying the input component's props. Useful for wrappers that don't
 * accept InputProps (SearchableTextField, SearchableSelect).
 */
export function FilterFieldWrap({ tip, children, sx }: {
  tip: string; children: ReactNode; sx?: object;
}) {
  return (
    <Box sx={{ position: "relative", display: "flex", alignItems: "center", ...sx }}>
      {children}
      <Box sx={{ position: "absolute", right: 30, top: "50%", transform: "translateY(-50%)",
                 pointerEvents: "auto" }}>
        <Tooltip title={tip} arrow placement="top">
          <HelpOutlineIcon
            fontSize="small"
            sx={{ color: "text.disabled", opacity: 0.7, cursor: "help",
                  "&:hover": { color: "primary.main", opacity: 1 } }}
          />
        </Tooltip>
      </Box>
    </Box>
  );
}
