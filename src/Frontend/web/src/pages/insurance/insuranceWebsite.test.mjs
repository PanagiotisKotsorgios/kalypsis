import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import { insuranceProducts, insuranceArticles, insuranceQuoteUrl } from "./insuranceContent.ts";

test("insurance pages gate all direct links before rendering while public office sites stay public", async () => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const source = await readFile(new URL("../../App.tsx", import.meta.url), "utf8");
  assert.match(source, /path="\/insurance\/\*" element=\{<ProtectedRoute>/);
  assert.match(source, /path="\/insurance-request" element=\{<ProtectedRoute>/);
  assert.match(source, /path="\/site\/:slug" element=\{<OfficePublicSitePage/);
  const server = await createServer({
    plugins: [{ name: "insurance-preview-test-session", enforce: "pre", transform(_code, id) {
      if (id.replaceAll("\\", "/").endsWith("/auth/AuthContext.tsx"))
        return "export function useAuth() { return globalThis.insurancePreviewTestSession; }";
    } }],
    server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom"
  });
  try {
      const { ProtectedRoute } = await server.ssrLoadModule("/src/components/ProtectedRoute.tsx");
      let childRenders = 0;
      const PrivateContent = () => { childRenders++; return createElement("div", null, "private-insurance-preview"); };
      const paths = ["/insurance", "/insurance/", "/insurance/programs/car", "/insurance/contact", "/insurance/quote?type=car", "/insurance-request"];
      const render = path => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] },
        createElement(ProtectedRoute, null, createElement(PrivateContent))));
      for (const path of paths) {
        globalThis.insurancePreviewTestSession = { loading: true, user: null };
        assert.ok(!render(path).includes("private-insurance-preview"), path);
        globalThis.insurancePreviewTestSession = { loading: false, user: null };
        assert.ok(!render(path).includes("private-insurance-preview"), path);
      }
      assert.equal(childRenders, 0, "anonymous and restoring sessions never render insurance children");
      globalThis.insurancePreviewTestSession = { loading: false, user: { role: "AgencyUser" } };
      for (const path of paths) assert.ok(render(path).includes("private-insurance-preview"), path);
      assert.equal(childRenders, paths.length);
  } finally {
    delete globalThis.insurancePreviewTestSession;
    await server.close();
  }
});

test("product quote links preserve the actual Greek request type and subject", () => {
  for (const product of insuranceProducts) {
    const url = new URL(insuranceQuoteUrl(product.requestType, "ΙΒΧ 1234"), "http://localhost");
    assert.equal(url.pathname, "/insurance/quote");
    assert.equal(url.searchParams.get("type"), product.requestType);
    assert.equal(url.searchParams.get("subject"), "ΙΒΧ 1234");
  }
  assert.equal(insuranceQuoteUrl(), "/insurance/quote");
});

test("every referenced product and guide photo is available as a local asset", async () => {
  for (const name of new Set([...insuranceProducts, ...insuranceArticles].map(item => item.image))) {
    const file = new URL(`../../../public/images/insurance/${name}`, import.meta.url);
    assert.ok((await stat(file)).size > 10_000, name);
    const bytes = await readFile(file);
    if (name.endsWith(".jpg")) assert.equal(bytes[0], 0xff);
    else assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
  }
});

test("all insurance routes render the shared site and category-prefilled real intake", async () => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const { InsuranceWebsitePage } = await server.ssrLoadModule("/src/pages/insurance/InsuranceWebsitePage.tsx");
    const render = path => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [path] }, createElement(Routes, null, createElement(Route, { path: "/insurance/*", element: createElement(InsuranceWebsitePage) })))));
    const pages = ["", "/programs", ...insuranceProducts.map(p => `/programs/${p.slug}`), "/services/advice", "/services/renewal", "/services/claims", "/about", "/contact", "/faq", "/guides", ...insuranceArticles.map(a => `/guides/${a.slug}`), "/payment", "/privacy", "/quote"];
    for (const page of pages) {
      const html = render(`/insurance${page}`);
      assert.ok(html.includes("Κύρια πλοήγηση ασφαλίσεων"), page);
      assert.ok(html.includes('id="ki-main-content"'), page);
      assert.ok(html.includes("info@mykalypsis.gr"), page);
      assert.ok(!html.includes("Αυτή η σελίδα δεν βρέθηκε"), page);
      assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, `one page heading: ${page}`);
    }
    const quote = render(insuranceQuoteUrl("Κατοικία", "Αθήνα"));
    assert.ok(quote.includes('value="Κατοικία"'));
    assert.ok(quote.includes('value="Αθήνα"'));
    assert.ok(quote.includes("Αποστολή αιτήματος ασφάλισης"));
    assert.ok(quote.includes("Πόλη ή διεύθυνση ακινήτου"));
    const unknownType = render(insuranceQuoteUrl("not-an-insurance-type"));
    assert.ok(!unknownType.includes('value="not-an-insurance-type"'));
    assert.ok(render("/insurance/unknown").includes("Αυτή η σελίδα δεν βρέθηκε"));
  } finally {
    client.clear();
    await server.close();
  }
});
