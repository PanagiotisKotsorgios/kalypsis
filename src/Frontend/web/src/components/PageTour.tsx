import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { OnboardingTour, resetTour, type TourStep } from "./OnboardingTour";

/**
 * Per-page tour catalog. Each entry runs the first time the user lands on
 * that specific route. Tracked separately from the role-wide onboarding tour
 * so users get fresh contextual help when they discover a new section.
 */
const PAGE_TOURS: Record<string, TourStep[]> = {
  "/app/customers": [
    { selector: '[data-tour="customers-search"]',  titleKey: "pageTour.customers.search.title",  bodyKey: "pageTour.customers.search.body" },
    { selector: '[data-tour="customers-new"]',     titleKey: "pageTour.customers.new.title",     bodyKey: "pageTour.customers.new.body",     placement: "bottom-start" },
    { selector: '[data-tour="customers-table"]',   titleKey: "pageTour.customers.table.title",   bodyKey: "pageTour.customers.table.body",   placement: "top" },
    { selector: '[data-tour="customers-export"]',  titleKey: "pageTour.customers.export.title",  bodyKey: "pageTour.customers.export.body",  placement: "bottom" },
  ],
  "/app/policies": [
    { selector: '[data-tour="policies-search"]',  titleKey: "pageTour.policies.search.title",  bodyKey: "pageTour.policies.search.body" },
    { selector: '[data-tour="policies-new"]',     titleKey: "pageTour.policies.new.title",     bodyKey: "pageTour.policies.new.body",     placement: "bottom-start" },
    { selector: '[data-tour="policies-row"]',     titleKey: "pageTour.policies.row.title",     bodyKey: "pageTour.policies.row.body",     placement: "top" },
    { selector: '[data-tour="policies-status"]',  titleKey: "pageTour.policies.status.title",  bodyKey: "pageTour.policies.status.body",  placement: "right" },
  ],
  "/app/claims": [
    { selector: '[data-tour="claims-new"]',    titleKey: "pageTour.claims.new.title",    bodyKey: "pageTour.claims.new.body",    placement: "bottom-start" },
    { selector: '[data-tour="claims-row"]',    titleKey: "pageTour.claims.row.title",    bodyKey: "pageTour.claims.row.body",    placement: "top" },
    { selector: '[data-tour="claims-status"]', titleKey: "pageTour.claims.status.title", bodyKey: "pageTour.claims.status.body" },
  ],
  "/app/producers": [
    { selector: '[data-tour="producers-new"]', titleKey: "pageTour.producers.new.title", bodyKey: "pageTour.producers.new.body", placement: "bottom-start" },
    { selector: '[data-tour="producers-row"]', titleKey: "pageTour.producers.row.title", bodyKey: "pageTour.producers.row.body", placement: "top" },
  ],
  "/app/receipts": [
    { selector: '[data-tour="receipts-new"]', titleKey: "pageTour.receipts.new.title", bodyKey: "pageTour.receipts.new.body", placement: "bottom-start" },
    { selector: '[data-tour="receipts-row"]', titleKey: "pageTour.receipts.row.title", bodyKey: "pageTour.receipts.row.body", placement: "top" },
  ],
  "/app/commission-runs": [
    { selector: '[data-tour="commission-runs-new"]', titleKey: "pageTour.commissionRuns.new.title", bodyKey: "pageTour.commissionRuns.new.body", placement: "bottom-start" },
    { selector: '[data-tour="commission-runs-row"]', titleKey: "pageTour.commissionRuns.row.title", bodyKey: "pageTour.commissionRuns.row.body", placement: "top" },
  ],
  "/app/all-tools": [
    { selector: '[data-tour="all-tools-search"]', titleKey: "pageTour.allTools.search.title", bodyKey: "pageTour.allTools.search.body" },
    { selector: '[data-tour="all-tools-categories"]', titleKey: "pageTour.allTools.categories.title", bodyKey: "pageTour.allTools.categories.body" },
  ],
};

/** Mounted in AppLayout. Watches the route and fires the page tour once per user/page. */
export function PageTourMount() {
  const location = useLocation();
  const [delayed, setDelayed] = useState(false);

  // Give the page a moment to mount before searching for selectors.
  useEffect(() => {
    setDelayed(false);
    const t = setTimeout(() => setDelayed(true), 400);
    return () => clearTimeout(t);
  }, [location.pathname]);

  const steps = PAGE_TOURS[location.pathname];
  if (!steps || steps.length === 0) return null;
  if (!delayed) return null;

  const tourId = `page-${location.pathname.replace(/\//g, "_")}-v1`;
  return <OnboardingTour tourId={tourId} steps={steps} />;
}

/** Restart all page tours from Profile (clears the per-page seen flags). */
export function resetAllPageTours() {
  if (typeof window === "undefined") return;
  Object.keys(PAGE_TOURS).forEach(path => {
    const id = `page-${path.replace(/\//g, "_")}-v1`;
    resetTour(id);
  });
}
