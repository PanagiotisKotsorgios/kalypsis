import test from "node:test";
import assert from "node:assert/strict";
import { createElement, Children, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";

test("renewal initializes and submits separate editable gross/net premiums", async context => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  try {
    const { PolicyRenewalPremiumFields, renewalPremiumDefaults, renewalPremiumPayload } = await server.ssrLoadModule("/src/components/PolicyRenewalPremiumFields.tsx");
    await context.test("prefill preserves distinct amounts, decimals, zero and unrecorded net", () => {
      for (const [source, expected] of [
        [{ premium: 120.5, netPremium: 90.25 }, { gross: "120.5", net: "90.25" }],
        [{ premium: 0, netPremium: 0 }, { gross: "0", net: "0" }],
        [{ premium: 100, netPremium: null }, { gross: "100", net: "" }],
        [{ premium: 100 }, { gross: "100", net: "" }],
        [null, { gross: "", net: "" }],
      ]) assert.deepEqual(renewalPremiumDefaults(source), expected);
    });
    await context.test("both real numeric fields are editable and carry the source currency", () => {
      let value = renewalPremiumDefaults({ premium: 120.5, netPremium: 90.25 });
      const props = () => ({ value, onChange(next) { value = next; }, currency: "USD" });
      const html = renderToStaticMarkup(createElement(PolicyRenewalPremiumFields, props()));
      assert.ok(html.includes("Μικτά ασφάλιστρα")); assert.ok(html.includes("Καθαρά ασφάλιστρα"));
      assert.ok(html.includes('value="120.5"')); assert.ok(html.includes('value="90.25"'));
      assert.equal((html.match(/type="number"/g) ?? []).length, 2);
      assert.equal((html.match(/>USD</g) ?? []).length, 2);
      assert.ok(html.includes("flex-direction:column")); assert.ok(html.includes("flex-direction:row"));
      const fields = () => Children.toArray(PolicyRenewalPremiumFields(props()).props.children).filter(isValidElement);
      fields()[0].props.onChange({ target: { value: "150.75" } });
      fields()[1].props.onChange({ target: { value: "99.25" } });
      assert.deepEqual(renewalPremiumPayload(value), { premium: 150.75, netPremium: 99.25 });
      fields()[1].props.onChange({ target: { value: "0" } });
      assert.deepEqual(renewalPremiumPayload(value), { premium: 150.75, netPremium: 0 });
    });
    await context.test("invalid values cannot become zero, NaN or null accidentally", () => {
      for (const gross of ["", " ", "-1", "NaN", "Infinity", "text"]) assert.throws(() => renewalPremiumPayload({ gross, net: "50" }));
      for (const net of ["-1", "NaN", "Infinity", "text"]) assert.throws(() => renewalPremiumPayload({ gross: "100", net }));
      assert.deepEqual(renewalPremiumPayload({ gross: "0", net: "0" }), { premium: 0, netPremium: 0 });
      assert.deepEqual(renewalPremiumPayload({ gross: "100", net: "" }), { premium: 100, netPremium: null });
    });
    await context.test("renewal dialog resets from each policy and posts both amounts in the existing renewal request", async () => {
      const source = await readFile(new URL("../pages/PoliciesPage.tsx", import.meta.url), "utf8");
      const dialog = source.slice(source.indexOf("function RenewDialog("));
      assert.ok(dialog.includes("setRenewalPremiums(renewalPremiumDefaults(policy))"));
      assert.ok(dialog.includes("policy?.netPremium"));
      assert.ok(dialog.includes("startDate, endDate, ...renewalPremiumPayload(renewalPremiums)"));
      assert.ok(dialog.includes("<PolicyRenewalPremiumFields"));
      assert.ok(!dialog.includes('label={t("policies.form.premium")}'));
    });
  } finally { await server.close(); }
});
