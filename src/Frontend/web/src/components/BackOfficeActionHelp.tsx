import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Box, Tooltip, useMediaQuery, useTheme } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface HelpDecoration {
  anchor: HTMLElement;
  host: HTMLElement;
  tip: string;
}

const fieldSelector = [
  "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='button']):not([type='submit']):not([type='reset'])",
  "textarea",
  "select",
  "[role='combobox']"
].join(",");

let hostCounter = 0;

/**
 * Adds a single gray ⓘ affordance to every form field on agency pages. The
 * icon is absolute-positioned at the top-right corner OUTSIDE the field so
 * it never collides with the field's label, adornments, or content. Hovering
 * reveals a tooltip — either the developer-authored text (via `data-field-tip`
 * on the field, typically stamped by <FilterHelp> or <FilterFieldWrap>) or a
 * generic "{label}" message when none was provided.
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

      const tip = resolveTip(candidate, anchor, isGreek);
      const host = ensureHost(anchor, hostsRef.current);
      seen.add(anchor);
      next.push({ anchor, host, tip });
    });

    for (const [anchor, host] of hostsRef.current) {
      if (!seen.has(anchor) || !document.body.contains(anchor)) {
        host.remove();
        if (anchor.dataset.actionHelpPositioned === "true") {
          anchor.style.position = "";
          delete anchor.dataset.actionHelpPositioned;
        }
        hostsRef.current.delete(anchor);
      }
    }

    setDecorations((previous) => sameDecorations(previous, next) ? previous : next);
  }, [isGreek]);

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
      attributeFilter: ["aria-hidden", "disabled", "style", "class", "data-field-tip"]
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
        createPortal(<GrayTip tip={decoration.tip} />, decoration.host, decorationKey(decoration))
      )}
    </>
  );
}

// ─────────────────────────── Icon component ────────────────────────────────

function GrayTip({ tip }: { tip: string }) {
  return (
    <Tooltip title={tip} arrow placement="top">
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "help",
          bgcolor: "#ffffff",
          borderRadius: "50%",
          lineHeight: 0
        }}
      >
        <InfoOutlinedIcon
          sx={{
            fontSize: 16,
            color: "text.disabled",
            opacity: 0.7,
            transition: "color 120ms ease, opacity 120ms ease",
            "&:hover": { color: "primary.main", opacity: 1 }
          }}
        />
      </Box>
    </Tooltip>
  );
}

// ─────────────────────────── DOM helpers ───────────────────────────────────

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

  // The tip is absolute-positioned relative to the anchor. If the anchor is
  // still statically positioned (rare for MUI wrappers, but possible), promote
  // it to `relative` so top/right coordinates resolve as expected. Track the
  // mutation via a data flag so we can undo it on cleanup.
  const computedPos = window.getComputedStyle(anchor).position;
  if (computedPos === "static") {
    anchor.style.position = "relative";
    anchor.dataset.actionHelpPositioned = "true";
  }

  const host = document.createElement("span");
  host.dataset.actionHelpHost = "true";
  host.dataset.actionHelpId = String(++hostCounter);
  host.style.position = "absolute";
  host.style.top = "-8px";
  host.style.right = "-8px";
  host.style.zIndex = "2";
  host.style.pointerEvents = "auto";
  host.style.lineHeight = "0";

  anchor.appendChild(host);
  hosts.set(anchor, host);
  return host;
}

function removeAllHosts(hosts: Map<HTMLElement, HTMLElement>) {
  for (const [anchor, host] of hosts) {
    host.remove();
    if (anchor.dataset.actionHelpPositioned === "true") {
      anchor.style.position = "";
      delete anchor.dataset.actionHelpPositioned;
    }
  }
  hosts.clear();
}

function resolveTip(element: HTMLElement, anchor: HTMLElement, greek: boolean) {
  // Developer-authored tip beats the generic fallback. FilterHelp /
  // FilterFieldWrap stamp `data-field-tip` on the anchor at mount; pages can
  // also set the attribute directly on any field wrapper.
  const withTip = anchor.closest<HTMLElement>("[data-field-tip]")
    ?? element.closest<HTMLElement>("[data-field-tip]");
  const declared = withTip?.dataset.fieldTip;
  if (declared) return declared;
  const label = getControlLabel(element, anchor);
  return buildHelpBody(label, greek);
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
    return `Συμπληρώστε ή επιλέξτε την τιμή για «${label}».`;
  }
  return `Enter or select the value for ${label}.`;
}

function decorationKey(decoration: HelpDecoration) {
  return decoration.host.dataset.actionHelpId ?? decoration.tip;
}

function sameDecorations(previous: HelpDecoration[], next: HelpDecoration[]) {
  return previous.length === next.length && previous.every((item, index) => {
    const candidate = next[index];
    return item.anchor === candidate.anchor
      && item.host === candidate.host
      && item.tip === candidate.tip;
  });
}
