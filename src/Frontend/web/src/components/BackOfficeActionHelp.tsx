import { useCallback, useLayoutEffect, useState } from "react";
import { Box, Portal } from "@mui/material";
import { useTranslation } from "react-i18next";
import { HelpHint } from "./HelpHint";

interface HelpTarget {
  element: HTMLElement;
  label: string;
  kind: "field" | "action";
  left: number;
  top: number;
}

const interactiveSelector = [
  "input:not([type='hidden'])",
  "textarea",
  "select",
  "button",
  "[role='button']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
  "[role='combobox']",
  "[contenteditable='true']"
].join(",");

/**
 * Adds a visible contextual question-mark control to every usable field and
 * action in the agency BackOffice, including dialogs rendered through portals.
 * The copy is generated from the control's accessible label, so new screens
 * and dynamically opened forms inherit the same guidance automatically.
 */
export function BackOfficeActionHelp() {
  const { i18n } = useTranslation();
  const [targets, setTargets] = useState<HelpTarget[]>([]);
  const isGreek = i18n.language.toLowerCase().startsWith("el");

  const refresh = useCallback(() => {
    const next: HelpTarget[] = [];
    const seen = new Set<HTMLElement>();

    document.querySelectorAll<HTMLElement>(interactiveSelector).forEach((candidate) => {
      if (!belongsToBackOffice(candidate) || !isVisible(candidate)) return;

      const anchor = resolveAnchor(candidate);
      if (seen.has(anchor) || !isVisible(anchor)) return;

      const rect = anchor.getBoundingClientRect();
      if (rect.width < 12 || rect.height < 12) return;

      seen.add(anchor);
      next.push({
        element: anchor,
        label: getControlLabel(candidate, anchor),
        kind: isAction(candidate, anchor) ? "action" : "field",
        left: Math.min(window.innerWidth - 30, Math.max(4, rect.right - 10)),
        top: Math.max(4, rect.top - 10)
      });
    });

    setTargets((previous) => sameTargets(previous, next) ? previous : next);
  }, []);

  useLayoutEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refresh);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "disabled", "style", "class"]
    });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [refresh]);

  return (
    <Portal>
      <Box data-action-help-overlay sx={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: (theme) => theme.zIndex.modal + 2 }}>
        {targets.map((target) => (
          <Box
            key={targetKey(target)}
            data-action-help
            sx={{ position: "fixed", left: target.left, top: target.top, pointerEvents: "auto", lineHeight: 0 }}
          >
            <HelpHint
              size="medium"
              title={target.label}
              body={buildHelpBody(target.label, target.kind, isGreek)}
            />
          </Box>
        ))}
      </Box>
    </Portal>
  );
}

function belongsToBackOffice(element: HTMLElement) {
  return Boolean(element.closest("[data-backoffice-help-root], .MuiDialog-root"))
    && !element.closest("[data-action-help-overlay], [data-help-popover], [data-help-hint], [data-action-help-exempt]");
}

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none"
    && style.visibility !== "hidden"
    && style.pointerEvents !== "none"
    && element.getAttribute("aria-hidden") !== "true"
    && !element.hasAttribute("disabled")
    && rect.width > 0
    && rect.height > 0;
}

function resolveAnchor(element: HTMLElement) {
  if (element.matches("input, textarea, select, [role='combobox']")) {
    return element.closest<HTMLElement>(".MuiFormControlLabel-root, .MuiTextField-root, .MuiFormControl-root") ?? element;
  }

  return element.closest<HTMLElement>(".MuiFormControlLabel-root, .MuiButtonBase-root") ?? element;
}

function isAction(element: HTMLElement, anchor: HTMLElement) {
  return element.matches("button, [role='button']") || anchor.matches("button, [role='button'], .MuiButtonBase-root");
}

function getControlLabel(element: HTMLElement, anchor: HTMLElement) {
  const direct = cleanText(element.getAttribute("aria-label"))
    || cleanText(anchor.getAttribute("aria-label"))
    || cleanText(element.getAttribute("title"))
    || cleanText(anchor.getAttribute("title"))
    || labelFromAria(element)
    || labelFromFor(element)
    || cleanText(anchor.querySelector("label")?.textContent)
    || cleanText(element.getAttribute("placeholder"))
    || cleanText(anchor.textContent);

  return direct || "Στοιχείο φόρμας";
}

function labelFromAria(element: HTMLElement) {
  const ids = element.getAttribute("aria-labelledby")?.split(/\s+/).filter(Boolean) ?? [];
  return cleanText(ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" "));
}

function labelFromFor(element: HTMLElement) {
  const id = element.getAttribute("id");
  if (!id) return undefined;
  return cleanText(document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent);
}

function cleanText(value: string | null | undefined) {
  const text = value?.replace(/\s+/g, " ").trim();
  return text || undefined;
}

function buildHelpBody(label: string, kind: HelpTarget["kind"], greek: boolean) {
  if (greek) {
    return kind === "action"
      ? `Πατήστε για «${label}». Ελέγξτε τα στοιχεία της φόρμας πριν συνεχίσετε.`
      : `Συμπληρώστε ή επιλέξτε την τιμή για «${label}». Όπου υπάρχει Αποθήκευση ή Δημιουργία, η αλλαγή εφαρμόζεται αφού την πατήσετε.`;
  }

  return kind === "action"
    ? `Select this action to ${label}. Review the form details before continuing.`
    : `Enter or select the value for ${label}. Where Save or Create is available, the change is applied after you select it.`;
}

function targetKey(target: HelpTarget) {
  const id = target.element.id || target.element.getAttribute("data-testid") || target.label;
  return `${id}-${target.left}-${target.top}`;
}

function sameTargets(previous: HelpTarget[], next: HelpTarget[]) {
  return previous.length === next.length && previous.every((item, index) => {
    const candidate = next[index];
    return item.element === candidate.element
      && item.left === candidate.left
      && item.top === candidate.top
      && item.label === candidate.label
      && item.kind === candidate.kind;
  });
}
