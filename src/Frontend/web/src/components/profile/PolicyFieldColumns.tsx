import { Children, type ReactNode } from "react";
import { Box, Stack, useMediaQuery, useTheme } from "@mui/material";
import { profileFieldGridSx } from "./ProfileFieldEditor";

/** Preserve reading/tab order when responsive semantic columns collapse. */
export function policyFieldColumns<T>(groups: readonly (readonly T[])[], count: number): readonly (readonly T[])[] {
  const columns = Math.max(1, Math.min(count, groups.length));
  if (columns === groups.length) return groups;
  const fields = groups.flat();
  const size = Math.ceil(fields.length / columns);
  return Array.from({ length: columns }, (_, index) => fields.slice(index * size, (index + 1) * size));
}

/** Policy-only layout: finish reading each column before moving right. */
export function PolicyFieldColumns({ section, groups }: { section: string; groups: readonly (readonly ReactNode[])[] }) {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up("lg"));
  const medium = useMediaQuery(theme.breakpoints.up("md"));
  const columns = policyFieldColumns(groups, wide ? 3 : medium ? 2 : 1);
  return <Box data-policy-layout={section} data-policy-columns={columns.length} sx={{ ...profileFieldGridSx,
    gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`, alignItems: "start", columnGap: 1 }}>
    {columns.map((fields, index) => <Stack key={index} data-policy-column={index + 1} spacing={.5} sx={{ minWidth: 0 }}>
      {Children.toArray(fields)}
    </Stack>)}
  </Box>;
}
