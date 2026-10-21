import { Box, TextField, Typography } from "@mui/material";
import { ProfileEditableField, profileFieldGridSx, type ProfileFieldSession } from "./ProfileFieldEditor";
import { ownershipFieldValues, vehicleCoOwners, vehicleOwnerCount } from "./vehicleOwnership";

/** Creation forms use the same co-owner slots before an editable card session exists. */
export function VehicleOwnershipInputs({ count: rawCount, values, onChange, primaryName = "" }: {
  count: string; values: Record<string, string>; onChange: (values: Record<string, string>) => void; primaryName?: string;
}) {
  let count = 1;
  try { count = vehicleOwnerCount(rawCount); } catch { return null; }
  if (count <= 1) return null;
  const displayed = { ...ownershipFieldValues(vehicleCoOwners(JSON.stringify({ ownerCount: count }), primaryName)), ...values };
  return <Box>
    <Typography variant="subtitle2" fontWeight={800} mb={1}>Συνιδιοκτησία · {count} ιδιοκτήτες</Typography>
    {Array.from({ length: count }, (_, index) => <Box key={index} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr 1fr" }, gap: 1, mb: 1 }}>
      {(["name", "vatNumber", "percentage"] as const).map(key => {
        const field = `owner:${index}:${key}`;
        return <TextField key={field} size="small" fullWidth
          label={key === "name" ? `Ιδιοκτήτης ${index + 1}` : key === "vatNumber" ? "ΑΦΜ συνιδιοκτήτη" : "Ποσοστό ιδιοκτησίας (%)"}
          placeholder={index === 0 && key === "name" ? "Πελάτης συμβολαίου (αυτόματα)" : undefined}
          type={key === "percentage" ? "number" : "text"} value={displayed[field] ?? ""}
          inputProps={key === "percentage" ? { min: .01, max: 100, step: .01 } : key === "vatNumber" ? { maxLength: 9, inputMode: "numeric" } : undefined}
          onChange={event => onChange({ ...values, [field]: event.target.value })} />;
      })}
    </Box>)}
    <Typography variant="caption" color="text.secondary">Συμπληρώστε τα πραγματικά ποσοστά. Όταν συμπληρωθούν όλα, το άθροισμα πρέπει να είναι 100%.</Typography>
  </Box>;
}

export function VehicleOwnershipFields({ values, session }: { values: Record<string, string>; session?: ProfileFieldSession }) {
  let count = 1;
  try { count = vehicleOwnerCount(session?.drafts["spec:ownerCount"] ?? values["spec:ownerCount"]); } catch { return null; }
  if (count <= 1) return null;
  const current = { ...values, ...session?.drafts };
  const percentages = Array.from({ length: count }, (_, index) => current[`owner:${index}:percentage`] ?? "");
  const total = percentages.reduce((sum, value) => sum + (Number(value.replace(",", ".")) || 0), 0);
  return <Box sx={{ gridColumn: "1 / -1", minWidth: 0 }}>
    <Typography variant="subtitle2" fontWeight={800} sx={{ px: .75, pt: .75 }}>Συνιδιοκτησία · {count} ιδιοκτήτες</Typography>
    <Typography variant="caption" color="text.secondary" sx={{ px: .75 }}>Τρέχοντες συνιδιοκτήτες, όχι προηγούμενοι ιδιοκτήτες από το ιστορικό. Συμπληρώστε το πραγματικό ποσοστό του καθενός.</Typography>
    {Array.from({ length: count }, (_, index) => <Box key={index} sx={{ ...profileFieldGridSx, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", mt: .5 }}>
      {(["name", "vatNumber", "percentage"] as const).map(key => {
        const field = `owner:${index}:${key}`;
        const label = key === "name" ? `Ιδιοκτήτης ${index + 1}` : key === "vatNumber" ? "ΑΦΜ συνιδιοκτήτη" : "Ποσοστό ιδιοκτησίας (%)";
        return <ProfileEditableField key={field} field={session ? field : undefined} session={session} label={label}
          value={values[field] ?? ""} type={key === "percentage" ? "number" : "text"} mono={key !== "name"} />;
      })}
    </Box>)}
    <Typography variant="caption" color={Math.abs(total - 100) < .001 && percentages.every(Boolean) ? "success.dark" : "text.secondary"} sx={{ display: "block", px: .75, py: .5 }}>
      Καταχωρημένο σύνολο: {total.toLocaleString("el-GR", { maximumFractionDigits: 2 })}% · {percentages.every(Boolean) ? "Στόχος 100%." : "Υπάρχουν ποσοστά που δεν έχουν συμπληρωθεί."}
    </Typography>
  </Box>;
}
