import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SIDEBAR_VISIBILITY_SECTIONS, sidebarItemKey } from "./sidebarVisibility.ts";

test("affiliate sidebar button is an optional common item for every office", () => {
  const rows = SIDEBAR_VISIBILITY_SECTIONS.flatMap(section => section.items.filter(item => item.path === "/affiliate-program").map(item => ({ section, item })));
  assert.equal(rows.length, 1);
  const {section,item} = rows[0];
  assert.equal(item.label, "Πρόγραμμα συνεργατών");
  assert.equal(item.alwaysVisible, undefined);
  assert.notEqual(item.available, false);
  assert.equal(section.packages, undefined);
  assert.equal(item.packages, undefined);
  const hidden = new Set();
  assert.ok(!hidden.has(sidebarItemKey(item.path)));
  hidden.add(sidebarItemKey(item.path));
  assert.ok(hidden.has("item:/affiliate-program"));
  hidden.delete(sidebarItemKey(item.path));
  assert.equal(hidden.size, 0);
});

test("editor, preview and actual blue-button rendering use the same per-office visibility key", async () => {
  const [editor,layout,app,controller] = await Promise.all([
    readFile(new URL("../components/TenantSidebarVisibilityTab.tsx",import.meta.url),"utf8"),
    readFile(new URL("../components/AppLayout.tsx",import.meta.url),"utf8"),
    readFile(new URL("../App.tsx",import.meta.url),"utf8"),
    readFile(new URL("../../../../Backend/Kalypsis.Api/Controllers/TenantSidebarVisibilityController.cs",import.meta.url),"utf8"),
  ]);
  assert.match(editor,/onChange\(sidebarItemKey\(item.path\), !checked\)/);
  assert.match(editor,/hiddenItems.has\(sidebarItemKey\(item.to\)\)/);
  assert.match(editor,/hiddenItems: \[\.\.\.current\]/);
  assert.match(layout,/hiddenSidebarItems.has\(sidebarItemKey\(item.to\)\)/);
  assert.ok(layout.indexOf("hiddenSidebarItems.has(sidebarItemKey(item.to))") < layout.indexOf('const affiliateItem = visible.find'));
  assert.match(layout,/affiliateItem && renderItem\(affiliateItem\)/);
  const links=app.match(/\{ to: "\/affiliate-program"[^\n]+/g)??[];
  assert.equal(links.length,3);
  for(const link of links) assert.ok(!link.includes("alwaysVisible"));
  assert.match(controller,/Authorize\(Policy = "PlatformAdmin"\)/);
});
