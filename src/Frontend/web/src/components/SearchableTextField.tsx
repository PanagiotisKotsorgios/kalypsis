import { Children, Fragment, isValidElement, useMemo } from "react";
import type { ReactNode } from "react";
import { MenuItem } from "@mui/material";
import { SearchableSelect } from "./SearchableSelect";
import type { SearchOption } from "./SearchableSelect";
import type { TextFieldProps } from "@mui/material";

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
 * array, including fragments and native option/optgroup lists.
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
  textFieldProps?: Partial<TextFieldProps>;
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
  textFieldProps,
  sx,
}: SearchableTextFieldProps) {
  const options = useMemo<SearchOption<string>[]>(() => {
    const out: SearchOption<string>[] = [];
    Children.forEach(children, (child) => {
      collectOptions(child, out);
    });
    return out;
  }, [children]);

  // Empty and disabled rows stay real options, including native <option> lists.
  return (
    <SearchableSelect
      label={typeof label === "string" ? label : ""}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(v) => onChange?.({ target: { value: v } })}
      options={options}
      autocompleteProps={{ disableClearable: !!required || !options.some(option => option.value === "" && !option.disabled) }}
      fullWidth={fullWidth}
      size={size}
      required={required}
      disabled={disabled}
      helperText={helperText}
      placeholder={placeholder}
      textFieldProps={textFieldProps}
      sx={sx as never}
    />
  );
}

/** Keep identifiers and disabled states intact; never search or submit JSX. */
export function collectOptions(node: ReactNode, out: SearchOption<string>[] = [], group?: string, disabled = false): SearchOption<string>[] {
  Children.forEach(node, child => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: unknown; children?: ReactNode; disabled?: boolean; label?: string };
    if (child.type === Fragment || child.type === "optgroup") {
      collectOptions(props.children, out, child.type === "optgroup" ? props.label : group, disabled || !!props.disabled);
    } else if (child.type === MenuItem || child.type === "option") {
      const label = collectText(props.children);
      const rawValue = props.value ?? (child.type === "option" ? label : undefined);
      if (rawValue !== undefined && rawValue !== null) out.push({ value: String(rawValue), label: label || String(rawValue), disabled: disabled || !!props.disabled, group });
    }
  });
  return out;
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
