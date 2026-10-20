import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";

test("settlements are embedded in the producer statement, preserving workflows and old bookmarks", async () => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = i18next.createInstance(); await i18n.init({ lng: "el", resources: { el: { translation: { commissionRuns: { title: "Εκκαθαρίσεις Προμηθειών", subtitle: "MONTHLY_DESCRIPTION", create: "Νέα εκκαθάριση" } } } }, initImmediate: false });
  const render = (Component, props) => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(I18nextProvider, { i18n }, createElement(Component, props))));
  try {
    const { COMMISSION_SETTLEMENTS_URL, producerStatementTab } = await server.ssrLoadModule("/src/pages/producerStatementNavigation.ts");
    assert.equal(COMMISSION_SETTLEMENTS_URL, "/app/producer-statement?tab=settlements");
    assert.equal(producerStatementTab(new URLSearchParams()), "statement");
    assert.equal(producerStatementTab(new URLSearchParams("tab=settlements")), "settlements");
    assert.equal(producerStatementTab(new URLSearchParams("tab=unknown")), "statement");
    const { ProducerStatementWorkspace } = await server.ssrLoadModule("/src/pages/ProducerStatementPage.tsx");
    const { CommissionRunsPage } = await server.ssrLoadModule("/src/pages/CommissionRunsPage.tsx");
    const props = { tab: "statement", onChange() {}, statement: createElement("p", null, "STATEMENT"), settlements: createElement("p", null, "SETTLEMENTS") };
    const statement = render(ProducerStatementWorkspace, props);
    const settlements = render(ProducerStatementWorkspace, { ...props, tab: "settlements" });
    for (const html of [statement, settlements]) { assert.equal(html.includes("STATEMENT"), true); assert.equal(html.includes("SETTLEMENTS"), true); assert.equal(html.includes("height:36px"), true); }
    assert.match(statement, /aria-label="Εκκαθαρίσεις προμηθειών" hidden/);
    assert.match(settlements, /aria-label="Κατάσταση συνεργάτη" hidden/);
    const embedded = render(CommissionRunsPage, { embedded: true });
    assert.equal(embedded.includes("Νέα εκκαθάριση"), true); assert.equal(embedded.includes("MONTHLY_DESCRIPTION"), false);
    assert.equal(render(CommissionRunsPage, {}).includes("MONTHLY_DESCRIPTION"), true);
    const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
    assert.match(app, /path="commission-runs" element=\{<Navigate to=\{COMMISSION_SETTLEMENTS_URL\} replace/);
    const production = await readFile(new URL("./ProductionListsPage.tsx", import.meta.url), "utf8");
    assert.equal(production.includes('/app/commission-runs'), false); assert.equal(production.includes("Φόρος ασφαλίστρων"), false);
    const policy = await readFile(new URL("../components/PolicyDetailDrawer.tsx", import.meta.url), "utf8");
    assert.equal(policy.includes('label="Φόρος ασφαλίστρων"'), false); assert.equal(policy.includes('field("vatAmount"'), false);
    assert.equal(policy.includes("policyPreservedAmounts"), true);
  } finally { client.clear(); await server.close(); }
});
