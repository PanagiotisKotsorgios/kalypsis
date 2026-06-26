import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";

type ActivityEvent = {
  category: "Navigation" | "Click" | "Search" | "Form";
  action: string;
  pagePath: string;
  target: string;
};

const RECENT_EVENT_WINDOW_MS = 250;
const recentEvents = new Map<string, number>();

/**
 * Collects employee interactions centrally instead of depending on every page
 * to remember an audit call. Only labels, routes and control types are sent —
 * never typed values, passwords, uploaded content or search text.
 */
export function EmployeeActivityTracker() {
  const location = useLocation();
  const queueRef = useRef<ActivityEvent[]>([]);
  const timerRef = useRef<number | null>(null);
  const searchTimersRef = useRef(new WeakMap<HTMLInputElement | HTMLTextAreaElement, number>());
  const pagePathRef = useRef("/app");

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const events = queueRef.current.splice(0, 50);
    if (events.length === 0) return;
    void api.post("/audit-logs/activity", { events }).catch(() => {
      // Activity collection must never interrupt an employee's work. A later
      // interaction starts a fresh batch if the connection becomes available.
    });
  }, []);

  const enqueue = useCallback((event: ActivityEvent) => {
    const key = `${event.category}|${event.action}|${event.pagePath}|${event.target}`;
    const now = Date.now();
    const previous = recentEvents.get(key);
    if (previous !== undefined && now - previous < RECENT_EVENT_WINDOW_MS) return;
    recentEvents.set(key, now);
    if (recentEvents.size > 500) {
      for (const [recentKey, timestamp] of recentEvents) {
        if (now - timestamp > 60_000) recentEvents.delete(recentKey);
      }
    }

    queueRef.current.push(event);
    if (queueRef.current.length >= 20) {
      flush();
      return;
    }
    if (timerRef.current === null) {
      timerRef.current = window.setTimeout(flush, 1_500);
    }
  }, [flush]);

  useEffect(() => {
    // Query-string values can contain customer or search data, so only retain
    // the route itself in the audit event.
    pagePathRef.current = location.pathname;
    enqueue({
      category: "Navigation",
      action: "Άνοιγμα σελίδας",
      pagePath: pagePathRef.current,
      target: "Πλοήγηση εφαρμογής"
    });
  }, [location.pathname, location.search, enqueue]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      const element = findInteractiveElement(event.target);
      if (!element || element.closest("[data-audit-ignore]")) return;
      enqueue({
        category: "Click",
        action: "Κλικ",
        pagePath: pagePathRef.current,
        target: describeElement(element)
      });
    };

    const onChange = (event: Event) => {
      if (!event.isTrusted) return;
      const element = event.target;
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return;
      if (element.closest("[data-audit-ignore]") || isPrivateInput(element) || isSearchInput(element)) return;
      enqueue({
        category: "Form",
        action: "Αλλαγή πεδίου",
        pagePath: pagePathRef.current,
        target: describeElement(element)
      });
    };

    const onInput = (event: Event) => {
      if (!event.isTrusted) return;
      const element = event.target;
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return;
      if (element.closest("[data-audit-ignore]") || !isSearchInput(element)) return;

      const priorTimer = searchTimersRef.current.get(element);
      if (priorTimer !== undefined) window.clearTimeout(priorTimer);
      const nextTimer = window.setTimeout(() => {
        enqueue({
          category: "Search",
          action: "Αναζήτηση",
          pagePath: pagePathRef.current,
          target: describeElement(element)
        });
      }, 700);
      searchTimersRef.current.set(element, nextTimer);
    };

    const onSubmit = (event: SubmitEvent) => {
      if (!event.isTrusted || !(event.target instanceof HTMLFormElement)) return;
      if (event.target.closest("[data-audit-ignore]")) return;
      enqueue({
        category: "Form",
        action: "Υποβολή φόρμας",
        pagePath: pagePathRef.current,
        target: describeForm(event.target)
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
      flush();
    };
  }, [enqueue, flush]);

  return null;
}

function findInteractiveElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(
    "button, a[href], [role='button'], [role='menuitem'], [role='option'], [role='combobox'], input, select, textarea, [data-audit-label]"
  );
}

function describeElement(element: HTMLElement): string {
  const input = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
    ? element
    : null;
  const explicit = element.getAttribute("data-audit-label")
    ?? element.getAttribute("aria-label")
    ?? element.getAttribute("title")
    ?? input?.getAttribute("name")
    ?? input?.getAttribute("placeholder")
    ?? element.getAttribute("id");
  const buttonText = element.matches("button, [role='button'], [role='menuitem']")
    ? element.textContent?.replace(/\s+/g, " ").trim()
    : null;
  const linkPath = element instanceof HTMLAnchorElement ? element.pathname : null;
  const label = explicit || buttonText || linkPath || element.tagName.toLowerCase();
  return `${controlType(element)}: ${label}`.slice(0, 256);
}

function describeForm(form: HTMLFormElement): string {
  const label = form.getAttribute("aria-label") || form.getAttribute("name") || form.id || "Φόρμα εφαρμογής";
  return `Φόρμα: ${label}`.slice(0, 256);
}

function controlType(element: HTMLElement): string {
  if (element instanceof HTMLInputElement) return element.type === "checkbox" ? "Επιλογή" : "Πεδίο";
  if (element instanceof HTMLTextAreaElement) return "Πεδίο κειμένου";
  if (element instanceof HTMLSelectElement) return "Λίστα επιλογής";
  if (element instanceof HTMLAnchorElement) return "Σύνδεσμος";
  return "Κουμπί";
}

function isPrivateInput(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
  return element instanceof HTMLInputElement && ["password", "file", "hidden"].includes(element.type);
}

function isSearchInput(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return false;
  if (element.hasAttribute("data-audit-search")) return true;
  const hint = [element.type, element.name, element.placeholder, element.getAttribute("aria-label")]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
  return element.type === "search" || hint.includes("αναζήτη") || hint.includes("search") || hint.includes("εύρεση");
}
