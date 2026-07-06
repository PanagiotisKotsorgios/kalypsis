import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Box } from "@mui/material";

// Filter-row tooltips are no longer rendered inline. Instead these components
// silently attach a `data-field-tip` attribute to the nearest MUI form control
// so BackOfficeActionHelp can pick it up and render a gray ⓘ at the top-right
// outside the field. This preserves developer-authored tip text without
// requiring per-page edits.

function attachTip(el: HTMLElement | null | undefined, tip: string) {
  if (!el || !tip) return;
  if (el.dataset.fieldTip === tip) return;
  el.dataset.fieldTip = tip;
}

/**
 * Used as an InputAdornment child in existing pages. Now renders an invisible
 * sentinel that finds the enclosing TextField/FormControl and stamps the tip
 * onto it as `data-field-tip`.
 */
export function FilterHelp({ title }: { title: string; wrapper?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const anchor = ref.current?.closest<HTMLElement>(
      ".MuiTextField-root, .MuiFormControl-root, .MuiInputBase-root"
    );
    attachTip(anchor, title);
  }, [title]);
  return <span ref={ref} style={{ display: "none" }} data-filter-help />;
}

/**
 * Wraps a filter field. Previously it drew its own absolute ⓘ; now it just
 * relays the tip text to the wrapped field via `data-field-tip`.
 */
export function FilterFieldWrap({ tip, children, sx }: {
  tip: string; children: ReactNode; sx?: object;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const anchor = ref.current?.querySelector<HTMLElement>(
      ".MuiTextField-root, .MuiFormControl-root, .MuiInputBase-root"
    );
    attachTip(anchor, tip);
  }, [tip]);
  return (
    <Box ref={ref} sx={{ display: "flex", alignItems: "center", ...sx }}>
      {children}
    </Box>
  );
}
