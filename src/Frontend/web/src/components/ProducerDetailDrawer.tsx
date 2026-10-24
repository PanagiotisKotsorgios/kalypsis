import { Box, Stack, useMediaQuery, useTheme } from "@mui/material";
import { ProfileEditableField, profileFieldGridSx, type ProfileFieldSession } from "./profile/ProfileFieldEditor";
import { PRODUCER_FIELDS, producerGeneralColumns } from "./profile/producerProfile";
import type { ProducerCategoryOption } from "./useProducerCategories";
export { ProducerUnifiedCard as ProducerDetailDrawer } from "./profile/ProducerUnifiedCard";

// Retain the reusable field renderer for existing integrations. The unified
// card itself reads all sections from the shared desktop/web definition.
export function ProducerProfileFields({ session, values, parents = [], categories = [], currentCategoryName }: { session?: ProfileFieldSession; values: Record<string, string>; parents?: {id: string; name: string}[]; categories?: ProducerCategoryOption[]; currentCategoryName?: string | null }) {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up("lg"));
  const medium = useMediaQuery(theme.breakpoints.up("md"));
  const columnCount = wide ? 3 : medium ? 2 : 1;
  const enums: Record<string, { value: string; label: string }[]> = {
    status: [{value:"Active",label:"Ενεργός"}, {value:"Prospect",label:"Πιθανός συνεργάτης"}, {value:"Suspended",label:"Σε αναστολή"}, {value:"Terminated",label:"Τερματισμένος"}],
    hasContract: [{value:"true",label:"Ναι"}, {value:"false",label:"Όχι"}],
    categoryId: [{value:"",label:"—"}, ...categories.filter(row => row.isActive || row.id === values.categoryId).map(row => ({value:row.id,label:row.name}))],
    tier: ["None", "A", "B", "C", "D", "E"].map(value => ({value,label: value === "None" ? "Χωρίς βαθμίδα" : "Βαθμίδα " + value})),
    hierarchyLevel: Object.entries({Producer:"Συνεργάτης", Manager:"Υπεύθυνος ομάδας", Unit:"Μονάδα", Assistant:"Βοηθός διοίκησης", Agency:"Γραφείο"}).map(([value,label]) => ({value,label})),
    parentProducerId: [{value:"",label:"Χωρίς προϊστάμενο"}, ...parents.map(row => ({value:row.id,label:row.name}))],
  };
  if (values.parentProducerId && !enums.parentProducerId.some(option => option.value === values.parentProducerId)) enums.parentProducerId.push({value: values.parentProducerId, label:"Τρέχων προϊστάμενος"});
  if (values.categoryId && !enums.categoryId.some(option => option.value === values.categoryId)) enums.categoryId.push({value: values.categoryId, label: currentCategoryName || "Τρέχουσα κατηγορία"});
  const fields = new Map(PRODUCER_FIELDS.map(([key, label]) => [key,
    <ProfileEditableField key={key} label={label} field={session ? key : undefined} session={session} value={values[key]} options={enums[key]}
      type={/Date$/.test(key) ? "date" : /email/i.test(key) ? "email" : "text"} multiline={key === "notes" || key === "additionalInfoJson"} />
  ]));
  return <Box data-producer-general-columns={columnCount} sx={{ ...profileFieldGridSx,
    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`, columnGap: 1, alignItems: "start" }}>
    {producerGeneralColumns(columnCount).map((keys, index) => <Stack key={index} data-producer-column={index + 1} spacing={.5} sx={{ minWidth: 0 }}>
      {keys.map(key => fields.get(key))}
    </Stack>)}
  </Box>;
}
