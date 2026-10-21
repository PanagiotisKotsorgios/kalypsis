import {
  Autocomplete, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, FormGroup, Stack, TextField, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import FilterListIcon from "@mui/icons-material/FilterList";
import TuneIcon from "@mui/icons-material/Tune";
import type {
  CreditFilter, CustomerListFilters, CustomerStatusFilter, CustomerTypeFilter, YesNoFilter,
} from "../../pages/customerListFilters";

export interface CustomerFilterOption { value: string; label: string }

interface Props {
  open: boolean;
  filters: CustomerListFilters;
  cities: CustomerFilterOption[];
  producers: CustomerFilterOption[];
  activeCount: number;
  onChange: (filters: CustomerListFilters) => void;
  onClear: () => void;
  onClose: () => void;
}

const sectionSx = {
  p: 1.5, border: "1px solid", borderColor: "#C8D5E4", borderRadius: 2,
  bgcolor: "#F4F7FA", minWidth: 0,
};

function updateArray<T extends string>(values: T[], value: T, checked: boolean): T[] {
  return checked ? Array.from(new Set([...values, value])) : values.filter(item => item !== value);
}

function Checks<T extends string>({ values, options, onChange }: {
  values: T[];
  options: { value: T; label: string }[];
  onChange: (values: T[]) => void;
}) {
  return <FormGroup sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(auto-fit, minmax(120px, max-content))" }, gap: 0.25, "& .MuiFormControlLabel-root": { mr: 0.75, minWidth: 0 }, "& .MuiFormControlLabel-label": { minWidth: 0 } }}>
    {options.map(option => <FormControlLabel key={option.value}
      control={<Checkbox size="small" checked={values.includes(option.value)}
        onChange={event => onChange(updateArray(values, option.value, event.target.checked))} />}
      label={<Typography variant="body2">{option.label}</Typography>} />)}
  </FormGroup>;
}

export function CustomerMultiSelect({ label, values, options, onChange, minWidth = 190 }: {
  label: string;
  values: string[];
  options: CustomerFilterOption[];
  onChange: (values: string[]) => void;
  minWidth?: number;
}) {
  const selectedOptions = values.map(value => options.find(option => option.value === value) ?? { value, label: value });
  return <Autocomplete multiple disableCloseOnSelect size="small" options={options} value={selectedOptions}
    onChange={(_, selected) => onChange(selected.map(option => option.value))}
    isOptionEqualToValue={(option, value) => option.value === value.value}
    getOptionLabel={option => option.label}
    noOptionsText="Δεν βρέθηκαν επιλογές"
    renderOption={(props, option, state) => <li {...props} key={option.value}>
      <Checkbox size="small" checked={state.selected} sx={{ mr: 0.5 }} />
      {option.label}
    </li>}
    renderTags={selected => selected.length === 1
      ? <Chip size="small" label={selected[0].label} />
      : <Chip size="small" label={`${selected.length} επιλογές`} />}
    renderInput={params => <TextField {...params} label={label} placeholder={values.length === 0 ? "Όλα" : undefined} />}
    sx={{ minWidth: { xs: 0, sm: minWidth }, width: { xs: "100%", sm: "auto" }, flex: "1 1 190px", maxWidth: { md: 310 }, "& .MuiAutocomplete-inputRoot": { flexWrap: "nowrap", minWidth: 0 }, "& .MuiAutocomplete-input": { minWidth: "0 !important" } }} />;
}

function YesNoChecks({ values, onChange }: { values: YesNoFilter[]; onChange: (values: YesNoFilter[]) => void }) {
  return <Checks values={values} onChange={onChange} options={[{ value: "yes", label: "Ναι" }, { value: "no", label: "Όχι" }]} />;
}

function DateRange({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void }) {
  return <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
    <TextField fullWidth size="small" type="date" label="Από" value={from} onChange={event => onFrom(event.target.value)} InputLabelProps={{ shrink: true }} />
    <TextField fullWidth size="small" type="date" label="Έως" value={to} onChange={event => onTo(event.target.value)} InputLabelProps={{ shrink: true }} />
  </Stack>;
}

function NumberRange({ minimum, maximum, onMinimum, onMaximum }: { minimum: string; maximum: string; onMinimum: (value: string) => void; onMaximum: (value: string) => void }) {
  return <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
    <TextField fullWidth size="small" type="number" label="Ελάχιστο" value={minimum} inputProps={{ min: 0 }} onChange={event => onMinimum(event.target.value)} />
    <TextField fullWidth size="small" type="number" label="Μέγιστο" value={maximum} inputProps={{ min: 0 }} onChange={event => onMaximum(event.target.value)} />
  </Stack>;
}

export function CustomerDesktopFiltersDialog({ open, filters, cities, producers, activeCount, onChange, onClear, onClose }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const set = <K extends keyof CustomerListFilters>(key: K, value: CustomerListFilters[K]) => onChange({ ...filters, [key]: value });
  const presence = [
    ["hasEmail", "Email"], ["hasPhone", "Τηλέφωνο"], ["hasVat", "ΑΦΜ"],
    ["hasPolicy", "Συμβόλαιο"], ["hasProducer", "Συνεργάτης"],
  ] as const;

  return <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="lg" PaperProps={{ sx: { bgcolor: "#EDF3F9", maxHeight: fullScreen ? "100dvh" : "92dvh", m: fullScreen ? 0 : undefined } }}>
    <DialogTitle sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: { xs: 0.75, sm: 1.25 }, color: "#102C55", px: { xs: 1.25, sm: 3 }, py: { xs: 1, sm: 2 }, position: "sticky", top: 0, zIndex: 2, bgcolor: "#EDF3F9" }}>
      <TuneIcon color="primary" />
      <Box sx={{ flex: 1 }}>
        <Typography variant="h6" fontWeight={800}>Φίλτρα πελατών</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>Τα ίδια αναλυτικά φίλτρα με το KALYPSIS Desktop</Typography>
      </Box>
      {activeCount > 0 && <Chip color="primary" label={`${activeCount} ενεργά`} />}
    </DialogTitle>
    <DialogContent dividers sx={{ p: { xs: 1, sm: 1.5, md: 2 }, borderColor: "#C8D5E4", overscrollBehavior: "contain" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0,1fr))" }, gap: 1.25 }}>
        <Box sx={sectionSx}>
          <Typography fontWeight={800} color="#102C55" mb={0.5}>Βασικά</Typography>
          <Typography variant="caption" color="text.secondary">Είδος πελάτη</Typography>
          <Checks<CustomerTypeFilter> values={filters.types} onChange={value => set("types", value)} options={[
            { value: "Individual", label: "Φυσικά πρόσωπα" }, { value: "Company", label: "Νομικά πρόσωπα" }, { value: "Prospect", label: "Πιθανοί πελάτες" },
          ]} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mt={1}>
            <CustomerMultiSelect label="Πόλη" values={filters.cities} options={cities} onChange={value => set("cities", value)} />
            <CustomerMultiSelect label="Συνεργάτης" values={filters.producerIds} options={producers} onChange={value => set("producerIds", value)} />
          </Stack>
        </Box>

        <Box sx={sectionSx}>
          <Typography fontWeight={800} color="#102C55" mb={0.5}>Κατάσταση & οικονομική εικόνα</Typography>
          <Typography variant="caption" color="text.secondary">Κατάσταση πελάτη</Typography>
          <Checks<CustomerStatusFilter> values={filters.statuses} onChange={value => set("statuses", value)} options={[
            { value: "Active", label: "Ενεργοί" }, { value: "Inactive", label: "Ανενεργοί" },
            { value: "Churned", label: "Απώλεια" }, { value: "Blocked", label: "Αποκλεισμένοι" },
          ]} />
          <Typography variant="caption" color="text.secondary">Πιστωτική κατάσταση</Typography>
          <Checks<CreditFilter> values={filters.credit} onChange={value => set("credit", value)} options={[
            { value: "creditor", label: "Πιστωτικοί" }, { value: "non-creditor", label: "Μη πιστωτικοί" },
          ]} />
          <TextField fullWidth size="small" label="Κατηγορία / ετικέτες πελάτη" value={filters.category}
            onChange={event => set("category", event.target.value)} sx={{ mt: 0.75 }} />
        </Box>

        <Box sx={sectionSx}>
          <Typography fontWeight={800} color="#102C55" mb={0.75}>Ημερομηνίες</Typography>
          <Typography variant="caption" color="text.secondary">Δημιουργήθηκε</Typography>
          <DateRange from={filters.createdFrom} to={filters.createdTo} onFrom={value => set("createdFrom", value)} onTo={value => set("createdTo", value)} />
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>Τελευταία ενημέρωση</Typography>
          <DateRange from={filters.updatedFrom} to={filters.updatedTo} onFrom={value => set("updatedFrom", value)} onTo={value => set("updatedTo", value)} />
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>Ημερομηνία γέννησης</Typography>
          <DateRange from={filters.birthFrom} to={filters.birthTo} onFrom={value => set("birthFrom", value)} onTo={value => set("birthTo", value)} />
        </Box>

        <Box sx={sectionSx}>
          <Typography fontWeight={800} color="#102C55" mb={0.75}>Ηλικία & οικογένεια</Typography>
          <Typography variant="caption" color="text.secondary">Ηλικία</Typography>
          <NumberRange minimum={filters.ageMin} maximum={filters.ageMax} onMinimum={value => set("ageMin", value)} onMaximum={value => set("ageMax", value)} />
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>Αριθμός τέκνων</Typography>
          <NumberRange minimum={filters.childrenMin} maximum={filters.childrenMax} onMinimum={value => set("childrenMin", value)} onMaximum={value => set("childrenMax", value)} />
        </Box>

        <Box sx={sectionSx}>
          <Typography fontWeight={800} color="#102C55" mb={0.5}>Παρουσία στοιχείων</Typography>
          {presence.map(([key, label], index) => <Box key={key}>
            {index > 0 && <Divider sx={{ my: 0.5 }} />}
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Typography variant="body2" fontWeight={650}>{label}</Typography>
              <YesNoChecks values={filters[key]} onChange={value => set(key, value)} />
            </Stack>
          </Box>)}
        </Box>
      </Box>
    </DialogContent>
    <DialogActions sx={{ px: { xs: 1, sm: 2 }, py: 1.25, bgcolor: "#E4EBF3", gap: 0.75, flexWrap: "wrap", position: "sticky", bottom: 0, zIndex: 2 }}>
      <Button color="error" variant="contained" startIcon={<FilterAltOffIcon />} onClick={onClear} sx={{ order: { xs: 3, sm: 1 }, flex: { xs: "1 1 100%", sm: "0 0 auto" } }}>Καθαρισμός όλων</Button>
      <Box sx={{ flex: 1, display: { xs: "none", sm: "block" } }} />
      <Button onClick={onClose} sx={{ order: 2, flex: { xs: "1 1 40%", sm: "0 0 auto" } }}>Κλείσιμο</Button>
      <Button variant="contained" startIcon={<FilterListIcon />} onClick={onClose} sx={{ order: 2, flex: { xs: "1 1 55%", sm: "0 0 auto" } }}>Εφαρμογή</Button>
    </DialogActions>
  </Dialog>;
}
