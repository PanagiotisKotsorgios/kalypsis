import test from "node:test";
import assert from "node:assert/strict";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import { filterSearchOptions, normalizeOptionSearch } from "./searchableOptions.ts";

test("search matches Greek accents, case and final sigma, without changing identifiers or source order", () => {
  const options = [
    { value: "customer-a", label: "Παναγιώτης Κοτσόργιος", hint: "C-000042 · 012345678" },
    { value: "customer-b", label: "Μαρία Παπαδοπούλου", hint: "C-000043 · 987654321" },
    { value: "", label: "Ίδιος με τον ασφαλιζόμενο" },
  ];
  const original = structuredClone(options);
  for (const query of ["ΠΑΝΑΓΙΩΤΗΣ", "κοτσοργιοσ", "Κοτσόργιος", "000042", "012345678"]) {
    assert.equal(filterSearchOptions(options, query)[0], options[0], query);
  }
  assert.equal(normalizeOptionSearch("  ΆΪ ς  "), "αι σ");
  assert.equal(filterSearchOptions(options, "ασφαλιζομενο")[0], options[2]);
  assert.deepEqual(filterSearchOptions(options, "δενυπαρχει"), []);
  assert.deepEqual(filterSearchOptions(options, ""), options);
  assert.deepEqual(options, original);
});

test("search covers records beyond the render limit and exact matches precede fuzzy matches", () => {
  const options = Array.from({ length: 2000 }, (_, i) => ({ value: String(i), label: `Εγγραφή ${i}` }));
  assert.equal(filterSearchOptions(options, "").length, 400);
  assert.equal(filterSearchOptions(options, "1999")[0].value, "1999");
  assert.deepEqual(filterSearchOptions([{ label: "xaxbx c" }, { label: "abc" }], "abc").map(o => o.label), ["abc", "xaxbx c"]);
});

test("shared dropdowns retain empty/disabled/native options, read-only fields and pencil/save controls", async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  try {
    const { MenuItem } = await server.ssrLoadModule("@mui/material");
    const { collectOptions, SearchableTextField } = await server.ssrLoadModule("/src/components/SearchableTextField.tsx");
    const { InlineValueField } = await server.ssrLoadModule("/src/components/InlineValueField.tsx");
    const { SearchableSelect } = await server.ssrLoadModule("/src/components/SearchableSelect.tsx");
    const children = createElement(Fragment, null,
      createElement(MenuItem, { value: "" }, "Χωρίς σύνδεση"),
      createElement(MenuItem, { value: 42, disabled: true }, "Κλειδωμένος"),
      createElement("optgroup", { label: "Εταιρείες", disabled: true }, createElement("option", { value: "carrier-1" }, "Ασφαλιστική Α")),
      createElement("option", null, "Χωρίς ρητό κωδικό"));
    assert.deepEqual(collectOptions(children), [
      { value: "", label: "Χωρίς σύνδεση", disabled: false, group: undefined },
      { value: "42", label: "Κλειδωμένος", disabled: true, group: undefined },
      { value: "carrier-1", label: "Ασφαλιστική Α", disabled: true, group: "Εταιρείες" },
      { value: "Χωρίς ρητό κωδικό", label: "Χωρίς ρητό κωδικό", disabled: false, group: undefined },
    ]);
    const empty = renderToStaticMarkup(createElement(SearchableTextField, { label: "Πελάτης", value: "", children }));
    assert.match(empty, /role="combobox"/); assert.match(empty, /value="Χωρίς σύνδεση"/);
    const base = { label: "Συμβαλλόμενος", value: "C42", options: [{ value: "", label: "Ίδιος με τον ασφαλιζόμενο" }, { value: "C42", label: "Παναγιώτης", hint: "012345678" }], onCommit: async () => {}, compact: true, showActions: true };
    const view = renderToStaticMarkup(createElement(InlineValueField, base));
    assert.ok(!view.includes('role="combobox"')); assert.ok(view.includes("Επεξεργασία Συμβαλλόμενος"));
    const editing = renderToStaticMarkup(createElement(InlineValueField, { ...base, editMode: true }));
    for (const text of ['role="combobox"', 'aria-label="Συμβαλλόμενος"', 'value="Παναγιώτης"', "Αποθήκευση Συμβαλλόμενος", "Καθαρισμός επιλογής"]) assert.ok(editing.includes(text), text);
    const cleared = renderToStaticMarkup(createElement(InlineValueField, { ...base, editMode: true, draftValue: "" }));
    assert.ok(cleared.includes('value="Ίδιος με τον ασφαλιζόμενο"'));
    const unknown = renderToStaticMarkup(createElement(InlineValueField, { ...base, value: "legacy", displayValue: "Παλιός πελάτης", editMode: true }));
    assert.ok(unknown.includes('value="Παλιός πελάτης"'));
    const invalid = renderToStaticMarkup(createElement(InlineValueField, { ...base, editMode: true, validate: () => "Επιλέξτε έγκυρο πελάτη" }));
    assert.ok(invalid.includes('aria-invalid="true"')); assert.ok(invalid.includes("Επιλέξτε έγκυρο πελάτη"));
    assert.match(invalid, /<button[^>]*disabled[^>]*aria-label="Αποθήκευση Συμβαλλόμενος"/);
    const readOnly = renderToStaticMarkup(createElement(InlineValueField, { ...base, onCommit: undefined, editMode: true }));
    assert.ok(!readOnly.includes('role="combobox"'));
    let observed;
    renderToStaticMarkup(createElement(SearchableSelect, { label: "Επιλογή", value: "C42", options: base.options,
      onChange: value => { observed = value; }, autocompleteProps: { renderInput: () => null, renderOption: () => null } }));
    assert.equal(observed, undefined, "rendering never changes selection or submits a search query");
    const source = await readFile(new URL("InlineValueField.tsx", import.meta.url), "utf8");
    assert.match(source, /aria-expanded/); assert.match(source, /event\.stopPropagation\(\)/);
  } finally { await server.close(); }
});
