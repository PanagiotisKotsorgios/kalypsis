import { Children, isValidElement, useMemo } from "react";
import type { ReactNode } from "react";
import { MenuItem } from "@mui/material";
import { SearchableSelect } from "./SearchableSelect";
import type { SearchOption } from "./SearchableSelect";

/**
 * Drop-in replacement for `<TextField select ...>` that surfaces the
 * fuzzy-search Autocomplete-based picker from SearchableSelect while
 * accepting the exact same call-site shape — i.e.:
 *
 *   <SearchableTextField label="..." value={v} onChange={e => set(e.target.value)}>
 *     <MenuItem value="foo">Foo</MenuItem>
 *     <MenuItem value="bar">Bar</MenuItem>
 *   </SearchableTextField>
 *
 * The wrapper extracts `<MenuItem value=... />` children into an options
 * array so mechanical sweeps across the codebase don't have to touch the
 * option-list authoring shape. Any non-MenuItem children are ignored.
 * `onChange` is emitted with a synthetic event so existing handlers of the
 * form `e => set(e.target.value)` keep working unchanged.
 */
export interface SearchableTextFieldProps {
  label?: ReactNode;
  value: string | number | undefined | null;
  onChange?: (e: { target: { value: string } }) => void;
  children?: ReactNode;
  fullWidth?: boolean;
  size?: "small" | "medium";
  required?: boolean;
  disabled?: boolean;
  helperText?: ReactNode;
  placeholder?: string;
  sx?: unknown;
  // TextField props we accept-and-ignore so mechanical swaps don't
  // regress: `select`, `SelectProps`, `InputLabelProps`, `variant`, etc.
  select?: boolean;
  SelectProps?: unknown;
  InputLabelProps?: unknown;
  variant?: unknown;
}

export function SearchableTextField({
  label,
  value,
  onChange,
  children,
  fullWidth,
  size = "small",
  required,
  disabled,
  helperText,
  placeholder,
  sx,
}: SearchableTextFieldProps) {
  const options = useMemo<SearchOption<string>[]>(() => {
    const out: SearchOption<string>[] = [];
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      // Only real MenuItem entries — <Divider/> and friends get skipped.
      if (child.type !== MenuItem) return;
      const props = child.props as { value?: unknown; children?: ReactNode };
      const rawValue = props.value;
      if (rawValue === undefined || rawValue === null) return;
      const stringValue = String(rawValue);
      const label = collectText(props.children);
      out.push({ value: stringValue, label: label || stringValue });
    });
    return out;
  }, [children]);

  // Preserve the "empty first row" pattern (`<MenuItem value="">—</MenuItem>`)
  // by promoting it to SearchableSelect's `emptyLabel`, then dropping it from
  // the options list so it doesn't appear twice.
  const emptyIx = options.findIndex((o) => o.value === "");
  const emptyLabel = emptyIx >= 0 ? options[emptyIx].label : undefined;
  const cleanOptions = emptyIx >= 0
    ? options.filter((_, i) => i !== emptyIx)
    : options;

  return (
    <SearchableSelect
      label={typeof label === "string" ? label : ""}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(v) => onChange?.({ target: { value: v } })}
      options={cleanOptions}
      emptyLabel={emptyLabel}
      fullWidth={fullWidth}
      size={size}
      required={required}
      disabled={disabled}
      helperText={helperText}
      placeholder={placeholder}
      sx={sx as never}
    />
  );
}

/** Turn a MenuItem's children (which may be a mix of strings and elements
 *  like `<Chip>`) into a searchable plain-text label. */
function collectText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (isValidElement(node)) {
    const child = (node.props as { children?: ReactNode }).children;
    return collectText(child);
  }
  return "";
}
