import { useState } from "react";
import { OnboardingTour, resetTour, type TourStep } from "./OnboardingTour";
import { useAuth } from "../auth/AuthContext";

/**
 * Per-role tour catalog. Each tour points at `data-tour="X"` markers on the
 * actual UI. If a selector can't be found, the step is skipped automatically.
 */
const TOURS: Record<string, TourStep[]> = {
  AgencyAdmin: [
    { selector: '[data-tour="sidebar-dashboard"]', titleKey: "tour.admin.dashboard.title", bodyKey: "tour.admin.dashboard.body", placement: "right" },
    { selector: '[data-tour="topbar-workspace-pills"]', titleKey: "tour.admin.workspaces.title", bodyKey: "tour.admin.workspaces.body", placement: "bottom" },
    { selector: '[data-tour="sidebar-customers"]', titleKey: "tour.admin.customers.title", bodyKey: "tour.admin.customers.body", placement: "right" },
    { selector: '[data-tour="sidebar-policies"]', titleKey: "tour.admin.policies.title", bodyKey: "tour.admin.policies.body", placement: "right" },
    { selector: '[data-tour="sidebar-claims"]', titleKey: "tour.admin.claims.title", bodyKey: "tour.admin.claims.body", placement: "right" },
    { selector: '[data-tour="sidebar-receipts"]', titleKey: "tour.admin.receipts.title", bodyKey: "tour.admin.receipts.body", placement: "right" },
    { selector: '[data-tour="sidebar-gl"]', titleKey: "tour.admin.gl.title", bodyKey: "tour.admin.gl.body", placement: "right" },
    { selector: '[data-tour="sidebar-users"]', titleKey: "tour.admin.users.title", bodyKey: "tour.admin.users.body", placement: "right" },
    { selector: '[data-tour="sidebar-all-tools"]', titleKey: "tour.admin.allTools.title", bodyKey: "tour.admin.allTools.body", placement: "right" },
    { selector: '[data-tour="topbar-bell"]', titleKey: "tour.admin.bell.title", bodyKey: "tour.admin.bell.body", placement: "bottom" },
    { selector: '[data-tour="topbar-language"]', titleKey: "tour.admin.language.title", bodyKey: "tour.admin.language.body", placement: "bottom" },
    { selector: '[data-tour="topbar-logout"]', titleKey: "tour.admin.profile.title", bodyKey: "tour.admin.profile.body", placement: "bottom" },
  ],
  AgencyUser: [
    { selector: '[data-tour="sidebar-dashboard"]', titleKey: "tour.user.dashboard.title", bodyKey: "tour.user.dashboard.body", placement: "right" },
    { selector: '[data-tour="sidebar-customers"]', titleKey: "tour.user.customers.title", bodyKey: "tour.user.customers.body", placement: "right" },
    { selector: '[data-tour="sidebar-policies"]', titleKey: "tour.user.policies.title", bodyKey: "tour.user.policies.body", placement: "right" },
    { selector: '[data-tour="sidebar-tasks"]', titleKey: "tour.user.tasks.title", bodyKey: "tour.user.tasks.body", placement: "right" },
    { selector: '[data-tour="topbar-bell"]', titleKey: "tour.user.bell.title", bodyKey: "tour.user.bell.body", placement: "bottom" },
  ],
  Producer: [
    { selector: '[data-tour="sidebar-dashboard"]', titleKey: "tour.producer.dashboard.title", bodyKey: "tour.producer.dashboard.body", placement: "right" },
    { selector: '[data-tour="sidebar-policies"]', titleKey: "tour.producer.policies.title", bodyKey: "tour.producer.policies.body", placement: "right" },
    { selector: '[data-tour="sidebar-customers"]', titleKey: "tour.producer.customers.title", bodyKey: "tour.producer.customers.body", placement: "right" },
  ],
  Customer: [
    { selector: '[data-tour="sidebar-dashboard"]', titleKey: "tour.customer.dashboard.title", bodyKey: "tour.customer.dashboard.body", placement: "right" },
    { selector: '[data-tour="sidebar-policies"]', titleKey: "tour.customer.policies.title", bodyKey: "tour.customer.policies.body", placement: "right" },
    { selector: '[data-tour="sidebar-requests"]', titleKey: "tour.customer.requests.title", bodyKey: "tour.customer.requests.body", placement: "right" },
  ],
  PlatformAdmin: [
    { selector: '[data-tour="sidebar-dashboard"]', titleKey: "tour.platform.dashboard.title", bodyKey: "tour.platform.dashboard.body", placement: "right" },
    { selector: '[data-tour="sidebar-tenants"]', titleKey: "tour.platform.tenants.title", bodyKey: "tour.platform.tenants.body", placement: "right" },
    { selector: '[data-tour="sidebar-all-users"]', titleKey: "tour.platform.users.title", bodyKey: "tour.platform.users.body", placement: "right" },
  ],
};

/** Tour id is per-role so different roles get different tutorials. */
export function tourIdFor(role: string) { return `role-${role}-v1`; }

export function resetTourForRole(role: string) {
  resetTour(tourIdFor(role));
}

/** Mounted once in AppLayout. Reads role, picks the right tour, runs on first visit. */
export function KalypsisOnboarding({ forceOpen, onDismiss }: { forceOpen?: boolean; onDismiss?: () => void }) {
  const { user } = useAuth();
  const [running, setRunning] = useState(true);
  if (!user) return null;
  const steps = TOURS[user.role] ?? [];
  if (steps.length === 0) return null;
  if (!running && !forceOpen) return null;
  return (
    <OnboardingTour
      tourId={tourIdFor(user.role)}
      steps={steps}
      forceOpen={forceOpen}
      onDismiss={() => { setRunning(false); onDismiss?.(); }}
    />
  );
}
