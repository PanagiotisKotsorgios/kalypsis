import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { CUSTOMER_TABLE_COLORS, customerTableRowSx, customerTableSx } from "./customerTableAppearance.ts";

test("customer table shares the monthly table's compact spacing and neutral-gray surface hierarchy", () => {
  const style = customerTableSx();
  assert.equal(style["& .MuiTableCell-head"].bgcolor, "#E9EEF4");
  assert.equal(style["& .MuiTableCell-head"].color, "#102C55");
  assert.equal(style["& .MuiTableCell-root"].borderColor, "#DFE5ED");
  assert.equal(style["& .MuiTableCell-body"].py, .45);
  assert.equal(style["& .MuiTableCell-head"].py, .7);
  assert.equal(style["& .MuiCheckbox-root, & .MuiIconButton-root"].height, 28);
  assert.equal(customerTableRowSx(0, false).bgcolor, "#F8FAFC");
  assert.equal(customerTableRowSx(1, false).bgcolor, "#F0F2F5");
});

test("prospect highlighting, readable hover and selection survive on both zebra rows and in dark mode", () => {
  for (const index of [0, 1]) {
    const normal = customerTableRowSx(index, false);
    const prospect = customerTableRowSx(index, true);
    assert.equal(normal["&:hover"].bgcolor, "#E5EDF7");
    assert.equal(prospect.bgcolor, CUSTOMER_TABLE_COLORS.prospect);
    assert.equal(prospect["&:hover"].bgcolor, "#FFE2B5");
    assert.equal(normal["&.Mui-selected, &.Mui-selected:hover"].bgcolor, "#DCEBFA");
    assert.equal(prospect["&.Mui-selected, &.Mui-selected:hover"].bgcolor, "#DCEBFA");
    assert.equal(customerTableRowSx(index, true, true)["&.Mui-selected, &.Mui-selected:hover"].bgcolor, "#264A72");
  }
  assert.notEqual(customerTableSx(true)["& .MuiTableCell-head"].color, CUSTOMER_TABLE_COLORS.navy);
  assert.notEqual(customerTableRowSx(0, false, true).bgcolor, customerTableRowSx(1, false, true).bgcolor);
});

test("real customer list rendering retains records, selection checkboxes and row actions with scoped compact styling", async () => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  try {
    const { CustomersPage } = await server.ssrLoadModule("/src/pages/CustomersPage.tsx");
    const { AuthProvider } = await server.ssrLoadModule("/src/auth/AuthContext.tsx");
    const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material");
    const records = [{ id: "C1", customerNumber: "C-001", type: "Individual", status: "Active", firstName: "Μαρία", lastName: "Δοκιμή", vatNumber: "123456789", email: "maria@example.gr", phone: "2101234567" },
      { id: "C2", customerNumber: "C-002", type: "Company", status: "Prospect", companyName: "Εταιρεία δοκιμής", email: "office@example.gr" }];
    client.setQueryData(["customers", "desktop-parity-filter-list"], records);
    client.setQueryData(["customer-accounts", "all-time"], [{ customerId: "C1", customerName: "Μαρία Δοκιμή", charges: 200, credits: 64.5,
      balance: 135.5, overdueAmount: 50, overdueCount: 1, paidInstallments: 0, latePayments: 1, onTimeRatePercent: 0, isPaymentOverdue: true }]);
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(ThemeProvider, { theme: createTheme() }, createElement(MemoryRouter, {}, createElement(AuthProvider, {}, createElement(CustomersPage))))));
    assert.ok(html.includes('aria-label="Λίστα πελατών"'));
    for (const value of ["C-001", "C-002", "Μαρία", "Εταιρεία δοκιμής", "123456789", "maria@example.gr", "2101234567"]) assert.ok(html.includes(value), value);
    for (const value of ["135,50 €", "Κακοπληρωτής", "Ληξιπρόθεσμη εξόφληση"]) assert.ok(html.includes(value), value);
    for (const value of ["Επιλογή πελάτη C-001", "Επιλογή πελάτη C-002", "Επιλογή όλων των πελατών αυτής της σελίδας", "Επεξεργασία", "Διαγραφή"]) assert.ok(html.includes(value), value);
    for (const color of ["#E9EEF4", "#F8FAFC", "#FFF0DC", "#DCEBFA"]) assert.ok(html.includes(color), color);
    assert.ok(html.includes("padding-top:3.6px")); assert.ok(html.includes("overflow-x:auto"));
    const source = await readFile(new URL("./CustomersPage.tsx", import.meta.url), "utf8");
    for (const binding of ['selected={selectedIds.has(c.id)}', 'selectCustomerPage(previous, [c.id], checked)', 'onClick={() => setSelectedCustomer({ customer: c, editMode: false })}', 'exportRows={table.filtered}', 'snapshotExport', 'onPage={table.setPage}']) assert.ok(source.includes(binding), binding);
  } finally { client.clear(); await server.close(); }
});
