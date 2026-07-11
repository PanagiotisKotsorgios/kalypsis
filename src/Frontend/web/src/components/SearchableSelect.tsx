import { useMemo, useState } from "react";
import { Autocomplete, Box, Chip, InputAdornment, Stack, TextField, Typography, Button, Divider } from "@mui/material";
import type { TextFieldProps, AutocompleteProps } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";

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
  /**
   * When set, the dropdown shows a "+ Νέος/α/ο …" row below the results that
   * calls this handler with the current query. Meant for inline creation of
   * a customer / policy / producer etc. without leaving the popup you're in.
   * Receives the current input so the caller can prefill the create dialog.
   */
  onCreateNew?: (currentInput: string) => void;
  /** Label for the create row. Defaults to `+ Νέος πελάτης` when onCreateNew is set. */
  createNewLabel?: string;
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
  onCreateNew, createNewLabel,
}: Props<V>) {
  // Track the current input so the "+ Νέο …" row can hand it back to the
  // caller as a prefill (e.g. the user typed "Παπαδόπουλος" but no such
  // customer existed → open the create dialog with lastName pre-filled).
  const [currentInput, setCurrentInput] = useState("");
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
      onInputChange={(_, input) => { setCurrentInput(input); onInputChange?.(input); }}
      isOptionEqualToValue={(a, b) => a.value === b.value}
      getOptionLabel={(o) => o.label}
      getOptionDisabled={(o) => !!o.disabled}
      groupBy={augmented.some(o => o.group) ? (o) => o.group ?? "" : undefined}
      filterOptions={filterOptions}
      // UX niceties that make the field usable when it already displays an
      // "Όλα" / "— any —" placeholder: focusing highlights the text so the
      // next keystroke replaces it, the dropdown pops up right away, Home /
      // End behave as text-editing keys instead of jumping between options,
      // and typing that doesn't match anything is NOT thrown away on blur —
      // so the user can freely delete / retype without the field snapping
      // back to whatever was previously selected.
      selectOnFocus
      openOnFocus
      handleHomeEndKeys
      clearOnBlur={false}
      autoHighlight
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
      // When onCreateNew is set we wrap the results paper in a small strip
      // that renders a "+ Νέο …" button at the bottom. Clicking it fires
      // the callback with the current text so the create dialog can prefill.
      PaperComponent={onCreateNew ? (paperProps) => (
        <Box {...paperProps} sx={{
          bgcolor: "background.paper",
          boxShadow: 3,
          borderRadius: 1,
          overflow: "hidden",
          ...(paperProps as any).sx,
        }}>
          {(paperProps as any).children}
          <Divider />
          <Box
            onMouseDown={(e) => {
              // MouseDown fires BEFORE the Autocomplete's blur handler that
              // would otherwise close the dropdown before our click lands.
              e.preventDefault();
            }}
            sx={{ p: 0.5, bgcolor: "action.hover" }}
          >
            <Button
              fullWidth
              startIcon={<AddIcon fontSize="small" />}
              size="small"
              onClick={() => onCreateNew(currentInput)}
              sx={{
                justifyContent: "flex-start",
                fontWeight: 700,
                color: "primary.main",
                py: 0.75,
              }}
            >
              {createNewLabel ?? `Νέο${currentInput ? ` «${currentInput}»` : ""}`}
            </Button>
          </Box>
        </Box>
      ) : undefined}
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
