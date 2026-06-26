import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useMediaQuery, useTheme } from "@mui/material";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { HelpHint } from "./HelpHint";

interface HelpDecoration {
  anchor: HTMLElement;
  host: HTMLElement;
  label: string;
}

const fieldSelector = [
  "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='button']):not([type='submit']):not([type='reset'])",
  "textarea",
  "select",
  "[role='combobox']"
].join(",");

let hostCounter = 0;

/**
 * Adds contextual help to real form fields only. Earlier this was a fixed
 * overlay positioned from viewport coordinates; that made the icons float over
 * the top bar, dialogs and pagination. The decorator is now static DOM inside
 * each field container, so it scrolls with the page and stays below modals.
 */
export function BackOfficeActionHelp() {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const hostsRef = useRef<Map<HTMLElement, HTMLElement>>(new Map());
  const [decorations, setDecorations] = useState<HelpDecoration[]>([]);
  const isGreek = i18n.language.toLowerCase().startsWith("el");

  const refresh = useCallback(() => {
    const next: HelpDecoration[] = [];
    const seen = new Set<HTMLElement>();

    document.querySelectorAll<HTMLElement>(fieldSelector).forEach((candidate) => {
      if (!belongsToBackOffice(candidate) || isExcludedControl(candidate) || !isVisible(candidate)) return;

      const anchor = resolveAnchor(candidate);
      if (seen.has(anchor) || isExcludedContainer(anchor) || !isVisible(anchor)) return;

      const rect = anchor.getBoundingClientRect();
      if (rect.width < 24 || rect.height < 16) return;

      const label = getControlLabel(candidate, anchor);
      const host = ensureHost(anchor, hostsRef.current);
      seen.add(anchor);
      next.push({ anchor, host, label });
    });

    for (const [anchor, host] of hostsRef.current) {
      if (!seen.has(anchor) || !document.body.contains(anchor)) {
        host.remove();
        hostsRef.current.delete(anchor);
      }
    }

    setDecorations((previous) => sameDecorations(previous, next) ? previous : next);
  }, []);

  useLayoutEffect(() => {
    if (isMobile) {
      removeAllHosts(hostsRef.current);
      setDecorations([]);
      return;
    }

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

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      removeAllHosts(hostsRef.current);
    };
  }, [isMobile, refresh]);

  if (isMobile) return null;

  return (
    <>
      {decorations.map((decoration) =>
        createPortal(
          <HelpHint
            size="small"
            title={decoration.label}
            body={buildHelpBody(decoration.label, isGreek)}
            sx={{ position: "static", zIndex: "auto" }}
          />,
          decoration.host,
          decorationKey(decoration)
        )
      )}
    </>
  );
}

function belongsToBackOffice(element: HTMLElement) {
  return Boolean(element.closest("[data-backoffice-help-root], .MuiDialog-root, .MuiDrawer-root"))
    && !element.closest("[data-action-help-host], [data-help-popover], [data-help-hint], [data-action-help-exempt]");
}

function isExcludedControl(element: HTMLElement) {
  const inputType = element instanceof HTMLInputElement ? element.type.toLowerCase() : "";
  if (["checkbox", "radio", "button", "submit", "reset", "hidden"].includes(inputType)) return true;

  return Boolean(element.closest([
    "[data-action-help-exempt]",
    "[data-action-help-host]",
    "[data-help-popover]",
    "[data-help-hint]",
    ".MuiTablePagination-root",
    ".MuiPagination-root",
    ".MuiDialogActions-root",
    ".MuiMenu-root",
    ".MuiAutocomplete-popper",
    ".MuiSnackbar-root",
    "nav",
    "header"
  ].join(",")));
}

function isExcludedContainer(element: HTMLElement) {
  return Boolean(element.closest([
    "[data-action-help-exempt]",
    "[data-action-help-host]",
    ".MuiTablePagination-root",
    ".MuiPagination-root",
    ".MuiDialogActions-root",
    ".MuiMenu-root",
    ".MuiAutocomplete-popper",
    "nav",
    "header"
  ].join(",")));
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
  return element.closest<HTMLElement>(".MuiTextField-root, .MuiFormControl-root")
    ?? element.closest<HTMLElement>(".MuiInputBase-root")
    ?? element;
}

function ensureHost(anchor: HTMLElement, hosts: Map<HTMLElement, HTMLElement>) {
  const existing = hosts.get(anchor);
  if (existing?.isConnected) return existing;

  const host = document.createElement("span");
  host.dataset.actionHelpHost = "true";
  host.dataset.actionHelpId = String(++hostCounter);
  host.style.display = "inline-flex";
  host.style.alignItems = "center";
  host.style.alignSelf = "flex-start";
  host.style.flex = "0 0 auto";
  host.style.lineHeight = "0";
  host.style.marginTop = "3px";
  host.style.marginLeft = "4px";
  host.style.pointerEvents = "auto";
  host.style.position = "static";
  host.style.zIndex = "auto";

  if (anchor.matches(".MuiTextField-root, .MuiFormControl-root")) {
    anchor.appendChild(host);
  } else {
    anchor.insertAdjacentElement("afterend", host);
  }

  hosts.set(anchor, host);
  return host;
}

function removeAllHosts(hosts: Map<HTMLElement, HTMLElement>) {
  for (const host of hosts.values()) host.remove();
  hosts.clear();
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
  if (!text) return undefined;
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

function buildHelpBody(label: string, greek: boolean) {
  if (greek) {
    return `Συμπληρώστε ή επιλέξτε την τιμή για «${label}». Αν υπάρχει Αποθήκευση ή Δημιουργία, η αλλαγή εφαρμόζεται αφού πατήσετε το αντίστοιχο κουμπί.`;
  }

  return `Enter or select the value for ${label}. Where Save or Create is available, the change is applied after you select it.`;
}

function decorationKey(decoration: HelpDecoration) {
  return decoration.host.dataset.actionHelpId ?? decoration.label;
}

function sameDecorations(previous: HelpDecoration[], next: HelpDecoration[]) {
  return previous.length === next.length && previous.every((item, index) => {
    const candidate = next[index];
    return item.anchor === candidate.anchor
      && item.host === candidate.host
      && item.label === candidate.label;
  });
}
