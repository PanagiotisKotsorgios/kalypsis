import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("card-wide editing uses the existing field controls without autofocus or editable read-only values", async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  try {
    const { InlineValueField } = await server.ssrLoadModule("/src/components/InlineValueField.tsx");
    const base = { label: "Τηλέφωνο", value: "2101234567", onCommit: async () => {}, compact: true, showActions: true };
    const view = renderToStaticMarkup(createElement(InlineValueField, base));
    assert.equal(view.includes("<input"), false);
    assert.equal(view.includes("Επεξεργασία Τηλέφωνο"), true);
    const edit = renderToStaticMarkup(createElement(InlineValueField, { ...base, editMode: true, draftValue: "2610123456" }));
    assert.equal(edit.includes('<input'), true);
    assert.equal(edit.includes('value="2610123456"'), true);
    assert.equal(edit.includes("Αποθήκευση Τηλέφωνο"), true);
    assert.equal(edit.includes("autofocus"), false);
    const restored = renderToStaticMarkup(createElement(InlineValueField, { ...base, draftValue: "2610123456" }));
    assert.equal(restored.includes('value="2610123456"'), true);
    assert.equal(restored.includes("autofocus"), false);
    const readOnly = renderToStaticMarkup(createElement(InlineValueField, { ...base, onCommit: undefined, editMode: true }));
    assert.equal(readOnly.includes("<input"), false);
    assert.equal(readOnly.includes("Αντιγραφή Τηλέφωνο"), true);
    const select = renderToStaticMarkup(createElement(InlineValueField, { ...base, label: "Κατάσταση", value: "Active", editMode: true,
      options: [{ value: "Active", label: "Ενεργός" }, { value: "Prospect", label: "Πιθανός" }] }));
    assert.equal(select.includes('role="combobox"'), true);
    assert.equal(select.includes("Αποθήκευση Κατάσταση"), true);
  } finally { await server.close(); }
});
