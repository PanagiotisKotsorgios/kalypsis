import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { money, num } from "../utils/format";

interface OfficeGoal {
  goalId: string;
  source: string;
  year: number;
  month: number | null;
  policyType: string | null;
  targetPremium: number;
  targetPolicies: number | null;
  currentPremium: number;
  currentPolicies: number;
  premiumProgressPercent: number;
  policiesProgressPercent: number | null;
  notes: string | null;
}

interface GrowthTarget {
  level: number;
  targetPremium: number;
  remainingPremium: number;
  commissionRatePercent: number;
  estimatedGrossCommission: number;
  estimatedNetCommission: number;
  targetCount?: number | null;
  remainingCount?: number | null;
}

interface ProducerGoals {
  year: number;
  month: number;
  currentPremium: number;
  currentPolicies: number;
  currentCommissionRatePercent: number;
  currentExpectedNetCommission: number;
  goalPlanEnabled: boolean;
  targetMode: "Premium" | "Policies" | "Vehicles";
  maximumCommissionPercent: number;
  currentVehicleCount: number;
  officeGoals: OfficeGoal[];
  growthTargets: GrowthTarget[];
}

const MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];

const TYPES: Record<string, string> = {
  Auto: "Αυτοκίνητο", Home: "Κατοικία", Health: "Υγείας", Life: "Ζωής",
  Business: "Επιχείρησης", Travel: "Ταξιδιού", Other: "Άλλο",
};

export function ProducerGoalsPage() {
  const goals = useQuery({
    queryKey: ["producer-production-goals"],
    queryFn: async () => (await api.get<ProducerGoals>("/producer/me/production/goals")).data,
  });
  const data = goals.data;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800}>Στόχοι παραγωγής</Typography>
        <Typography color="text.secondary">Η πορεία του μήνα και οι επόμενες βαθμίδες της δικής σας προμήθειας.</Typography>
      </Box>

      {goals.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : goals.isError ? (
        <Alert severity="error">{extractErrorMessage(goals.error, "Δεν ήταν δυνατή η φόρτωση των στόχων.")}</Alert>
      ) : data && (
        <>
          <Alert severity="info" sx={{ mb: 3 }}>
            Η κλιμάκωση είναι προσομοίωση στόχων: η πρώτη βαθμίδα δείχνει την αύξηση που έχει ορίσει το γραφείο, η δεύτερη την επόμενη βαθμίδα κ.ο.κ., με ανώτατο όριο {num(data.maximumCommissionPercent)}%. Δεν αλλάζει από μόνη της τους κανόνες ή την εκκαθάριση του γραφείου.
          </Alert>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, mb: 3 }}>
            <Kpi label={`Παραγωγή ${MONTHS[data.month - 1]}`} value={money(data.currentPremium)} />
            <Kpi label="Συμβόλαια μήνα" value={num(data.currentPolicies)} />
            <Kpi label="Τρέχον μέσο ποσοστό" value={`${num(data.currentCommissionRatePercent)}%`} emphasis />
            <Kpi label="Καθαρά αναμενόμενα" value={money(data.currentExpectedNetCommission)} emphasis />
          </Box>

          <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "1.1fr 1.9fr" }, mb: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={700} mb={1}>Στόχοι που έχει ορίσει το γραφείο</Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>Προσωπικοί ή κοινοί στόχοι για τον τρέχοντα μήνα.</Typography>
                {data.officeGoals.length === 0 ? (
                  <Typography color="text.secondary" textAlign="center" py={5}>Το γραφείο δεν έχει ορίσει στόχο για αυτόν τον μήνα ακόμη.</Typography>
                ) : (
                  <Stack spacing={2.5}>
                    {data.officeGoals.map(goal => <OfficeGoalCard key={goal.goalId} goal={goal} />)}
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={700} mb={1}>Πλάνο αύξησης προμήθειας</Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Οι βαθμίδες υπολογίζονται από την τωρινή σας παραγωγή και το μέσο ποσοστό των δικών σας συμβολαίων.
                </Typography>
                {data.growthTargets.length === 0 ? (
                  <Alert severity="warning">
                    Δεν υπάρχει ακόμη υπολογισμένη προμήθεια σε συμβόλαιό σας για τον τρέχοντα μήνα. Μόλις το γραφείο ορίσει προμήθεια σε συμβόλαιο, θα εμφανιστούν οι βαθμίδες στόχων.
                  </Alert>
                ) : (
                  <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                    {data.growthTargets.map(target => <GrowthTargetCard key={target.level} target={target} mode={data.targetMode} />)}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>

          <Alert severity="success">
            Το ανώτατο ποσοστό στις προβολές είναι {num(data.maximumCommissionPercent)}%, όπως το έχει παραμετροποιήσει το γραφείο για εσάς.
          </Alert>
        </>
      )}
    </Box>
  );
}

function OfficeGoalCard({ goal }: { goal: OfficeGoal }) {
  const achieved = goal.premiumProgressPercent >= 100;
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} mb={0.5}>
        <Box>
          <Typography fontWeight={700}>{goal.policyType ? TYPES[goal.policyType] ?? goal.policyType : "Συνολική παραγωγή"}</Typography>
          <Typography variant="caption" color="text.secondary">{goal.source}</Typography>
        </Box>
        <Chip size="small" color={achieved ? "success" : "primary"} label={achieved ? "Επιτεύχθηκε" : `${num(goal.premiumProgressPercent)}%`} />
      </Stack>
      <LinearProgress variant="determinate" value={goal.premiumProgressPercent} color={achieved ? "success" : "primary"} sx={{ height: 8, borderRadius: 4, mb: 0.75 }} />
      <Stack direction="row" justifyContent="space-between" gap={2}>
        <Typography variant="body2">{money(goal.currentPremium)} / {money(goal.targetPremium)}</Typography>
        {goal.targetPolicies != null && <Typography variant="body2" color="text.secondary">{goal.currentPolicies} / {goal.targetPolicies} συμβόλαια</Typography>}
      </Stack>
      {goal.notes && <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>{goal.notes}</Typography>}
    </Box>
  );
}

function GrowthTargetCard({ target, mode }: { target: GrowthTarget; mode: ProducerGoals["targetMode"] }) {
  const countMode = mode !== "Premium" && target.targetCount != null;
  const unitLabel = mode === "Vehicles" ? "οχήματα" : "συμβόλαια";
  return (
    <Card variant="outlined" sx={{ borderColor: target.commissionRatePercent >= 14 ? "success.main" : "primary.light" }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography fontWeight={800}>Βαθμίδα {target.level}</Typography>
          <Chip label={`${num(target.commissionRatePercent)}%`} color={target.commissionRatePercent >= 14 ? "success" : "primary"} size="small" />
        </Stack>
        <Typography variant="overline" color="text.secondary">Στόχος παραγωγής</Typography>
        <Typography variant="h6" fontWeight={800}>{countMode ? `${num(target.targetCount!)} ${unitLabel}` : money(target.targetPremium)}</Typography>
        {countMode && <Typography variant="body2" color="text.secondary">Απομένουν {num(target.remainingCount ?? 0)} {unitLabel}</Typography>}
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          {countMode ? `Εκτίμηση παραγωγής ${money(target.targetPremium)}` : `Απομένουν ${money(target.remainingPremium)}`}
        </Typography>
        <Typography variant="overline" color="text.secondary">Εκτίμηση καθαρής προμήθειας</Typography>
        <Typography variant="h6" color="success.dark" fontWeight={800}>{money(target.estimatedNetCommission)}</Typography>
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <Card sx={emphasis ? { border: "1px solid", borderColor: "primary.light" } : undefined}>
      <CardContent>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.7 }}>{label}</Typography>
        <Typography variant="h5" fontWeight={800} color={emphasis ? "primary.main" : undefined}>{value}</Typography>
      </CardContent>
    </Card>
  );
}
