import { useMemo } from "react";
import { Autocomplete, Box, Chip, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import type { TextFieldProps, AutocompleteProps } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

/**
 * Option shape for SearchableSelect. `hint` is shown as secondary text
 * (usually AFM / code / policy number). `group` puts items under a header.
 * `disabled` greys the row out and prevents selection.
 */
export interface SearchOption<V = string> {
  value: V;
  label: string;
  hint?: string;
  group?: string;
  disabled?: boolean;
  /** Optional icon/chip content shown right-aligned. */
  badge?: React.ReactNode;
}

type Props<V> = {
  label: string;
  value: V | "" | null | undefined;
  onChange: (v: V | "") => void;
  options: SearchOption<V>[];
  placeholder?: string;
  helperText?: React.ReactNode;
  required?: boolean;
  fullWidth?: boolean;
  size?: "small" | "medium";
  disabled?: boolean;
  /** Show a leading magnifier icon on the input. Default true. */
  showSearchIcon?: boolean;
  /** Optional first row "— any —" that returns "". Default undefined (no clear row). */
  emptyLabel?: string;
  /** Number of chars before we do fuzzy scoring; below this it's substring match. */
  fuzzyMinChars?: number;
  /** Cap the shown option list — huge lists (5k+) tank rendering otherwise. */
  maxShown?: number;
  /** Escape hatch for any Autocomplete prop we haven't proxied. */
  autocompleteProps?: Partial<AutocompleteProps<SearchOption<V>, false, false, false>>;
  textFieldProps?: Partial<TextFieldProps>;
  sx?: TextFieldProps["sx"];
  /** Free-text callback so the caller can debounce a server search. */
  onInputChange?: (input: string) => void;
};

/**
 * Fuzzy scorer — Levenshtein-ish subsequence weight. Returns a positive
 * score for a match, 0 for no match. Higher = better. Used only when the
 * caller opts in via fuzzyMinChars; substring matches otherwise (faster
 * and clearer for short queries).
 */
function fuzzyScore(hay: string, needle: string): number {
  hay = hay.toLowerCase();
  needle = needle.toLowerCase();
  if (!needle) return 1;
  let hi = 0, ni = 0, score = 0, streak = 0;
  while (hi < hay.length && ni < needle.length) {
    if (hay[hi] === needle[ni]) {
      score += 2 + streak; // reward consecutive matches heavily
      streak++;
      ni++;
    } else {
      streak = 0;
    }
    hi++;
  }
  if (ni < needle.length) return 0;
  // Prefer matches that start closer to the beginning of the string.
  const positionPenalty = Math.min(hay.length, 30) * 0.1;
  return Math.max(0, score - positionPenalty);
}

/**
 * SearchableSelect — one-liner drop-in for `<TextField select>` with a
 * fuzzy-searchable option list, group headers, disabled rows, hint text
 * and an optional "empty" first row.
 *
 *   <SearchableSelect
 *     label="Πελάτης"
 *     value={customerId}
 *     onChange={setCustomerId}
 *     options={customers.map(c => ({
 *       value: c.id,
 *       label: c.displayName,
 *       hint: c.afm,
 *       group: c.categoryName,
 *     }))}
 *     emptyLabel="— Επιλέξτε —"
 *   />
 *
 * Renders as an MUI Autocomplete under the hood so keyboard navigation,
 * loading spinner and screen-reader semantics come for free.
 */
export function SearchableSelect<V = string>({
  label, value, onChange, options,
  placeholder, helperText, required, fullWidth = true, size = "small", disabled,
  showSearchIcon = true, emptyLabel, fuzzyMinChars = 3, maxShown = 400,
  autocompleteProps, textFieldProps, sx, onInputChange,
}: Props<V>) {
  // Prepend an empty row when the caller asks for one.
  const augmented = useMemo(() => {
    if (!emptyLabel) return options;
    return [{ value: "" as unknown as V, label: emptyLabel, hint: undefined }, ...options];
  }, [options, emptyLabel]);

  // MUI Autocomplete uses shallow reference equality by default, so we
  // resolve the current selection every render.
  const current = useMemo(() => {
    if (value === "" || value === null || value === undefined) {
      return emptyLabel ? augmented[0] : null;
    }
    return augmented.find(o => o.value === value) ?? null;
  }, [augmented, value, emptyLabel]);

  const filterOptions = (opts: SearchOption<V>[], state: { inputValue: string }) => {
    const q = state.inputValue.trim();
    if (!q) return opts.slice(0, maxShown);
    // Short queries → substring match on label + hint (cheap, predictable).
    if (q.length < fuzzyMinChars) {
      const needle = q.toLowerCase();
      return opts.filter(o =>
        o.label.toLowerCase().includes(needle)
        || (o.hint ?? "").toLowerCase().includes(needle)
      ).slice(0, maxShown);
    }
    // Longer queries → fuzzy scoring on label + hint concat, ranked desc.
    const scored: Array<{ o: SearchOption<V>; s: number }> = [];
    for (const o of opts) {
      const s = Math.max(
        fuzzyScore(o.label, q),
        (o.hint ? fuzzyScore(o.hint, q) : 0),
      );
      if (s > 0) scored.push({ o, s });
    }
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, maxShown).map(x => x.o);
  };

  return (
    <Autocomplete
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      options={augmented}
      value={current}
      onChange={(_, v) => onChange((v?.value ?? "") as V | "")}
      onInputChange={(_, input) => onInputChange?.(input)}
      isOptionEqualToValue={(a, b) => a.value === b.value}
      getOptionLabel={(o) => o.label}
      getOptionDisabled={(o) => !!o.disabled}
      groupBy={augmented.some(o => o.group) ? (o) => o.group ?? "" : undefined}
      filterOptions={filterOptions}
      renderOption={(props, o) => (
        <li {...props} key={String(o.value) + "|" + o.label}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ width: "100%" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{
                fontSize: 14, fontWeight: o.value === "" ? 400 : 600,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
              }}>
                {o.label}
              </Typography>
              {o.hint && (
                <Typography variant="caption" color="text.secondary" sx={{
                  fontFamily: "monospace", display: "block", lineHeight: 1.2
                }}>
                  {o.hint}
                </Typography>
              )}
            </Box>
            {o.badge && <Box>{o.badge}</Box>}
            {o.disabled && <Chip size="small" label="κλειδωμένο" variant="outlined" sx={{ fontSize: 10, height: 18 }} />}
          </Stack>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required}
          helperText={helperText}
          sx={sx}
          {...textFieldProps}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                {showSearchIcon && (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: "text.disabled" }} />
                  </InputAdornment>
                )}
                {params.InputProps.startAdornment}
              </>
            ),
          }}
        />
      )}
      {...autocompleteProps}
    />
  );
}
