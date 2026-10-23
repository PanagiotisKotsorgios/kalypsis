import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { presetTrendRange, trendRangeError } from "./productionTrendPeriod.ts";
import { PUBLIC_NAVIGATION_Z_INDEX, PUBLIC_FLOATING_Z_INDEX } from "./publicOverlayLayers.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("trend presets span real calendar months across year boundaries, not a six-month client-side slice", () => {
  const today = new Date(2026, 0, 15, 23, 30);
  assert.deepEqual(presetTrendRange(3, today), { from: "2025-11-01", to: "2026-01-15" });
  assert.deepEqual(presetTrendRange(12, today), { from: "2025-02-01", to: "2026-01-15" });
  assert.deepEqual(presetTrendRange(24, today), { from: "2024-02-01", to: "2026-01-15" });
  assert.deepEqual(presetTrendRange(120, today), { from: "2016-02-01", to: "2026-01-15" });
  assert.equal(trendRangeError(presetTrendRange(120, today)), "");
  assert.equal(trendRangeError({ from: "2024-02-29", to: "2024-02-29" }), "");
});

test("manual periods reject missing, reversed, impossible or excessive ranges before querying", () => {
  for (const range of [
    { from: "", to: "2026-10-23" }, { from: "2026-11-01", to: "2026-10-23" },
    { from: "2026-02-29", to: "2026-10-23" }, { from: "2026-13-01", to: "2026-13-31" },
    { from: "2016-10-01", to: "2026-10-23" },
  ]) assert.ok(trendRangeError(range), JSON.stringify(range));
});

test("public navigation backdrop and drawer cover accessibility controls in both public headers", async () => {
  assert.ok(PUBLIC_NAVIGATION_Z_INDEX > 1500);
  assert.ok(PUBLIC_FLOATING_Z_INDEX < 1200);
  assert.match(await read("./AccessibilityWidget.tsx"), /zIndex: PUBLIC_FLOATING_Z_INDEX/);
  for (const path of ["./LandingNavbar.tsx", "../pages/LandingPage.tsx"]) {
    const source = await read(path);
    assert.match(source, /<Drawer\s+(?:anchor="right"\s+)?sx=\{\{ zIndex: PUBLIC_NAVIGATION_Z_INDEX \}\}/);
  }
});

test("larger periods use a bounded date-keyed API query, with live refresh and explicit error/retry UI", async () => {
  const source = await read("./AgencyAnalyticsPanel.tsx");
  for (const expected of [
    '"/reports/agency/trend", { params: range }', '["report", "agency", "trend", range.from, range.to]',
    'value="12"', 'value="24"', 'value="60"', 'value="120"', 'value="custom"',
    'disabled={Boolean(rangeError)}', 'setRange({ ...draft })', 'trend.refetch()',
    'refetchInterval: live && remote ? 60_000 : false', 'variant="contained" color="error"',
    'bgcolor: dark ? "#34465B" : "#E2E6EB"',
  ]) assert.ok(source.includes(expected), expected);
});

test("public technology credits, notice and compact pricing entry remain consistent", async context => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  try {
    const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material");
    const { PublicTechnologiesSection, PUBLIC_TECHNOLOGIES } = await server.ssrLoadModule("/src/components/PublicTechnologiesSection.tsx");
    const { InfrastructureNoticeBanner } = await server.ssrLoadModule("/src/components/InfrastructureNoticeBanner.tsx");
    const render = (child,width) => renderToStaticMarkup(h(ThemeProvider, { theme: createTheme({ components: { MuiUseMediaQuery: { defaultProps: { ssrMatchMedia: () => ({matches:width<600}) } } } }) },h(MemoryRouter,null,child)));
    await context.test("all eight online-sourced logos are real local image assets with working-shape links", async () => {
      assert.equal(PUBLIC_TECHNOLOGIES.length, 8);
      for (const technology of PUBLIC_TECHNOLOGIES) {
        const bytes = await readFile(new URL(`../../public/images/technologies/${technology.logo}`, import.meta.url));
        assert.ok(bytes.length > 500, technology.name);
        if (technology.logo.endsWith(".png")) assert.equal(bytes.subarray(1,4).toString(), "PNG");
        if (technology.logo.endsWith(".svg")) assert.ok(bytes.toString().includes("<svg"));
        assert.ok(technology.website.startsWith("https://"));
        if (technology.name !== "Microsoft") assert.ok(technology.github.startsWith("https://github.com/"));
      }
      const source = await read("./PublicTechnologiesSection.tsx");
      assert.ok(source.includes("prefers-reduced-motion"));
      assert.ok(source.includes('rel="noopener noreferrer"'));
    });
    await context.test("Greek technology credits and support notice remain accessible from mobile to desktop", () => {
      for (const width of [320,360,600,900,1280,1920]) {
        const technologies = render(h(PublicTechnologiesSection),width);
        assert.equal((technologies.match(/<img/g)??[]).length,8);
        assert.equal((technologies.match(/Πηγαίος κώδικας<\/a>/g)??[]).length,7);
        assert.ok(!technologies.includes("Η αναφορά τεχνολογιών δεν υποδηλώνει"));
        assert.ok(technologies.includes("Τα λογότυπα και τα εμπορικά σήματα ανήκουν"));
        const notice = render(h(InfrastructureNoticeBanner),width);
        for (const token of ["#E8F5ED","#FFE16A","#151515","26/10/2026"]) assert.ok(notice.includes(token));
      }
    });
    await context.test("the homepage comparison table is entirely replaced by pricing and the existing contract request flow", async () => {
      const source = await read("./PublicPricingCooperationSection.tsx");
      const page = await read("../pages/LandingPage.tsx");
      for (const expected of ['to="/pricing"', 'onClick={() => setContractOpen(true)}', '<ContractRequestDialog open={contractOpen} onClose={() => setContractOpen(false)}']) assert.ok(source.includes(expected));
      for (const removed of ["PublicPackageComparison", "PUBLIC_PACKAGE_FEATURES", "PackageDetailDialog", "PackageComparisonSection"]) assert.ok(!page.includes(removed));
      assert.ok(page.includes("<PublicPricingCooperationSection />"));
      assert.ok(page.includes("<PublicTechnologiesSection />"));
      await assert.rejects(read("./PublicPackageComparison.tsx"),{code:"ENOENT"});
    });
  } finally { await server.close(); }
});
