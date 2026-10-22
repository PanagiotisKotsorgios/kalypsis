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

test("public navigation backdrop and drawer cover installer and accessibility layers in both public headers", async () => {
  assert.ok(PUBLIC_NAVIGATION_Z_INDEX > 1500);
  assert.ok(PUBLIC_FLOATING_Z_INDEX < 1200);
  for (const path of ["./PreloginDesktopDownload.tsx", "./AccessibilityWidget.tsx"]) {
    assert.match(await read(path), /zIndex: PUBLIC_FLOATING_Z_INDEX/);
  }
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

test("public technology credits, reference-style comparison and notice render from mobile to desktop", async context => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  try {
    const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material");
    const { PublicTechnologiesSection, PUBLIC_TECHNOLOGIES } = await server.ssrLoadModule("/src/components/PublicTechnologiesSection.tsx");
    const { PublicPackageComparison } = await server.ssrLoadModule("/src/components/PublicPackageComparison.tsx");
    const { InfrastructureNoticeBanner } = await server.ssrLoadModule("/src/components/InfrastructureNoticeBanner.tsx");
    const packages = ["BackOffice", "CRM & Πύλη Πελάτη", "Αναλυτικά & Αυτοματοποίηση", "Ενσωματώσεις & Συμμόρφωση", "ERMIS"].map((name,index)=>({key:String(index),name}));
    const features = Array.from({length:18},(_,i)=>({el:`Δυνατότητα ${i}`,en:`Feature ${i}`,detailEl:`Πληροφορίες ${i}`,detailEn:`Details ${i}`,values:[true,false,true,false,false]}));
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
    await context.test("only the existing grouped table and pricing link remain, without promotional headings, package cards or extra actions", () => {
      for (const width of [320,360,600,900,1280,1920]) {
        for (const isEn of [false,true]) {
          const html = render(h(PublicPackageComparison,{packages,features,isEn}),width);
          assert.equal((html.match(/<table\b/g)??[]).length,1);
          assert.equal((html.match(/<tr\b/g)??[]).length,11);
          assert.equal((html.match(/rowspan="2"/g)??[]).length,5);
          assert.equal((html.match(/<a\b/g)??[]).length,1);
          assert.ok(html.includes('href="/pricing"'));
          assert.ok(html.includes(isEn ? "See prices" : "Δείτε τις τιμές"));
          assert.ok(html.includes('role="region" tabindex="0"'));
          assert.ok(html.includes('overflow-x:auto'));
          assert.equal((html.match(/<h[123]\b/g)??[]).length,0);
          assert.ok(!html.includes('aria-pressed='));
          for (const removed of ["ΠΑΚΕΤΑ & ΔΥΝΑΤΟΤΗΤΕΣ","Συγκρίνετε τις δυνατότητες","Μια συνοπτική εικόνα","Αναλυτική προβολή","Δείτε το πακέτο","radial-gradient","linear-gradient"]) assert.ok(!html.includes(removed),`${width}: ${removed}`);
          for (const pkg of packages) assert.ok(html.includes(pkg.name.replaceAll("&", "&amp;")));
          const included = isEn ? 'aria-label="Included"' : 'aria-label="Περιλαμβάνεται"';
          const excluded = isEn ? 'aria-label="Not included"' : 'aria-label="Δεν περιλαμβάνεται"';
          assert.equal(html.split(included).length-1,20);
          assert.equal(html.split(excluded).length-1,30);
        }
        const technologies = render(h(PublicTechnologiesSection),width);
        assert.equal((technologies.match(/<img/g)??[]).length,8);
        assert.equal((technologies.match(/Πηγαίος κώδικας<\/a>/g)??[]).length,7);
        assert.ok(!technologies.includes("Η αναφορά τεχνολογιών δεν υποδηλώνει"));
        assert.ok(technologies.includes("Τα λογότυπα και τα εμπορικά σήματα ανήκουν"));
        const notice = render(h(InfrastructureNoticeBanner),width);
        for (const token of ["#E8F5ED","#FFE16A","#151515","26/10/2026"]) assert.ok(notice.includes(token));
      }
    });
    await context.test("comparison data still comes from the existing catalogue, with unused package modals and selection state removed", async () => {
      const source = await read("./PublicPackageComparison.tsx");
      const page = await read("../pages/LandingPage.tsx");
      for (const expected of ["groups.flatMap", "features[index]", "feature.values.map", 'to="/pricing"']) assert.ok(source.includes(expected));
      for (const removed of ["useState", "<Dialog", "onPackageDetails", "setActive", "setDetailed"]) assert.ok(!source.includes(removed));
      assert.ok(page.includes("features={PUBLIC_PACKAGE_FEATURES}"));
      assert.ok(!page.includes("PackageDetailDialog"));
      assert.ok(page.includes("<PublicTechnologiesSection />"));
    });
  } finally { await server.close(); }
});
