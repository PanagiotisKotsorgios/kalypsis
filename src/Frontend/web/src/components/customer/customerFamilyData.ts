export interface CustomerNeed {
  id: string; kind: string; title: string; hasAsset: boolean; isInsured: boolean;
  priority: number; nextContactAt: string | null; notes: string | null;
}
export interface FamilyPolicy {
  id: string; policyNumber: string; policyType: string; status: string;
  startDate: string; endDate: string; premium: number; currency: string;
}
export interface FamilyMember {
  relationshipId: string; customerId: string; displayName: string; customerType: string;
  relationshipType: string; notes: string | null; policies: FamilyPolicy[]; needs: CustomerNeed[];
}
export const NEED_KINDS = ["Home", "Vehicle", "Health", "Life", "Business", "Travel", "Pet", "Liability", "Cyber", "Other"];
export const RELATIONSHIP_TYPES = ["Spouse", "Partner", "Child", "Parent", "Grandparent", "Grandchild", "Sibling", "Dependent", "Other"];
export const NEED_LABEL: Record<string, string> = {
  Home: "Κατοικία", Vehicle: "Όχημα", Health: "Υγεία", Life: "Ζωή", Business: "Επιχείρηση",
  Travel: "Ταξίδι", Pet: "Κατοικίδιο", Liability: "Αστική ευθύνη", Cyber: "Cyber", Other: "Άλλο"
};
export const RELATION_LABEL: Record<string, string> = {
  Spouse: "Σύζυγος", Partner: "Σύντροφος", Child: "Παιδί", Parent: "Γονέας", Grandparent: "Παππούς / γιαγιά",
  Grandchild: "Εγγόνι", Sibling: "Αδελφός / αδελφή", Dependent: "Εξαρτώμενο μέλος", Other: "Άλλη σχέση"
};
export function matchesFamilySearch(value: string, query: string) {
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("el-GR");
  return normalize(value).includes(normalize(query.trim()));
}
export function filterCustomerNeeds(needs: CustomerNeed[], kind: string, coverage: string) {
  return needs.filter(need => (!kind || need.kind === kind)
    && (!coverage || (coverage === "insured" ? need.isInsured : !need.isInsured)));
}
export function filterFamilyMembers(members: FamilyMember[], relationship: string, coverage: string) {
  return members.filter(member => (!relationship || member.relationshipType === relationship)
    && (!coverage || (coverage === "policies" ? member.policies.length > 0
      : coverage === "needs" ? member.needs.length > 0
      : member.needs.some(need => !need.isInsured))));
}
