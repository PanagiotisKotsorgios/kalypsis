import { useMemo } from "react";
import { Autocomplete, Checkbox, Chip, Stack, TextField, Typography, createFilterOptions } from "@mui/material";
import type { SearchOption } from "./SearchableSelect";

// Search the complete catalogue, while bounding the rendered checkbox list.
const filterMultiOptions = createFilterOptions<SearchOption<string>>({ limit: 300, stringify: option => `${option.label} ${option.value} ${option.hint ?? ""}` });

export function selectedMultiOptions(values: string[], options: SearchOption<string>[]) {
  const known = new Map(options.map(option => [option.value, option]));
  return [...new Set(values)].map(value => known.get(value) ?? { value, label: value });
}

/** Checkbox multi-selection with search; stored values never depend on labels or loaded options. */
export function SearchableMultiSelect({ label, values, options, onChange, helperText, disabled = false }: {
  label: string; values: string[]; options: SearchOption<string>[]; onChange: (values: string[]) => void;
  helperText?: string; disabled?: boolean;
}) {
  const selected = useMemo(() => selectedMultiOptions(values, options), [values, options]);
  const available = useMemo(() => [...new Map([...options, ...selected].map(option => [option.value, option])).values()], [options, selected]);
  return <Autocomplete multiple disableCloseOnSelect openOnFocus size="small" fullWidth disabled={disabled}
    options={available} value={selected} isOptionEqualToValue={(a, b) => a.value === b.value}
    filterOptions={filterMultiOptions}
    getOptionLabel={option => option.label} getOptionDisabled={option => !!option.disabled}
    onChange={(_, next) => onChange(next.map(option => option.value))}
    clearText="Καθαρισμός επιλογών" openText="Εμφάνιση επιλογών" closeText="Κλείσιμο επιλογών" noOptionsText="Δεν βρέθηκαν επιλογές"
    renderTags={(value, getTagProps) => <>
      {value.slice(0, 1).map((option, index) => {
        const { key, ...props } = getTagProps({ index });
        return <Chip {...props} key={key} size="small" label={option.label} title={option.label} sx={{ maxWidth: "calc(100% - 40px)" }} />;
      })}
      {value.length > 1 && <Typography variant="caption" sx={{ px: .5 }} title={value.map(option => option.label).join(", ")}>+{value.length - 1}</Typography>}
    </>}
    renderOption={(props, option, state) => {
      const { key, ...rest } = props;
      return <li {...rest} key={key}><Checkbox checked={state.selected} tabIndex={-1} disableRipple size="small" sx={{ mr: .5, p: .5 }} />
        <Stack sx={{ minWidth: 0 }}><Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{option.label}</Typography>
          {option.hint && <Typography variant="caption" color="text.secondary">{option.hint}</Typography>}
        </Stack>
      </li>;
    }}
    slotProps={{ listbox: { sx: {
      maxHeight: 300,
      "& .MuiAutocomplete-option": { color: "#123a64" },
      "& .MuiAutocomplete-option.Mui-focused": { bgcolor: "#e8f2fb", color: "#123a64" },
      "& .MuiAutocomplete-option[aria-selected='true']": { bgcolor: "#d8eafa", color: "#0b305c" },
      "& .MuiAutocomplete-option[aria-selected='true'].Mui-focused": { bgcolor: "#c8e1f6", color: "#0b305c" },
    } } }}
    renderInput={params => <TextField {...params} label={label} placeholder={values.length ? "Αναζήτηση…" : "Όλες οι επιλογές"} helperText={helperText} />}
    sx={{ minWidth: 0, "& .MuiAutocomplete-inputRoot": { flexWrap: "nowrap" }, "& .MuiAutocomplete-input": { minWidth: "20px !important" } }}
  />;
}
