import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import { monthlyAnalytics, monthLabel, validPoints } from "./agencyAnalyticsModel.ts";
import { printGuidePdf } from "./printGuidePdf.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const fixture = {
  monthlyPremium: Array.from({length:6},(_,i)=>({label:`2026-${String(i+5).padStart(2,"0")}`,value:(i+1)*100})),
  policiesByType:[{label:"Auto",value:4},{label:"Home",value:2}],
  policiesByStatus:[{label:"Active",value:4},{label:"Cancelled",value:2}],
  claimsByStatus:[{label:"Open",value:2},{label:"Closed",value:1}],
  requestsByStatus:[{label:"Pending",value:3}],
  topCarriers:[{carrier:"Ασφαλιστική δοκιμής",premium:300,policies:2}],
};

test("monthly analytics use observed data, complete three-month windows and exact-cent accumulation",()=>{
  const points=[{label:"2026-01",value:100},{label:"2026-02",value:200},{label:"2026-03",value:300}];
  const before=structuredClone(points), result=monthlyAnalytics(points,3);
  assert.deepEqual(result.series.map(point=>point.movingAverage),[null,null,200]);
  assert.deepEqual(result.series.map(point=>point.cumulative),[100,300,600]);
  assert.equal(result.mean,200); assert.equal(result.change,200);
  assert.ok(Math.abs(result.deviation-Math.sqrt(20000/3))<.00001);
  assert.deepEqual(points,before);
  assert.equal(monthlyAnalytics(fixture.monthlyPremium,3).series.length,3);
  assert.equal(monthlyAnalytics(fixture.monthlyPremium,3).series[0].label,"2026-08");
  assert.equal(monthlyAnalytics([{label:"a",value:.1},{label:"b",value:.2}],6).series[1].cumulative,.3);
});

test("missing, zero, negative and incomplete data do not produce invented observations or infinite statistics",()=>{
  assert.deepEqual(monthlyAnalytics([],6),{series:[],mean:null,deviation:null,change:null});
  assert.deepEqual(validPoints([{label:"zero",value:0},{label:"refund",value:-2},{label:"invalid",value:NaN},{label:"missing",value:null},{label:"infinite",value:Infinity}]),[{label:"zero",value:0},{label:"refund",value:-2}]);
  const result=monthlyAnalytics([{label:"a",value:0},{label:"b",value:10}],6);
  assert.equal(result.change,null); assert.equal(result.series[1].movingAverage,null);
  assert.equal(monthlyAnalytics([{label:"a",value:5}],6).deviation,null);
  assert.equal(monthLabel("2026-13"),"2026-13");
  assert.ok(monthLabel("2026-10").includes("26"));
});

test("PDF printing targets the PDF frame and falls back safely to the native viewer",()=>{
  const calls=[];
  assert.equal(printGuidePdf({contentWindow:{focus(){calls.push("focus");},print(){calls.push("pdf-print");}}},()=>calls.push("fallback")),true);
  assert.deepEqual(calls,["focus","pdf-print"]);
  assert.equal(printGuidePdf({contentWindow:{focus(){throw new Error("cross-origin PDF viewer");},print(){throw new Error("must not reach");}}},()=>calls.push("fallback")),false);
  assert.equal(calls.at(-1),"fallback");
  assert.equal(printGuidePdf(null,()=>calls.push("no-frame")),false);
  assert.equal(calls.at(-1),"no-frame");
});

test("cleanup preserves filters and data while removing old copy, period-lock UI and KPI boxes",async()=>{
  const [multi,agency,app,hub,dashboard,docs,notice] = await Promise.all([
    read("./SearchableMultiSelect.tsx"),read("../pages/AgencyAndProfilePage.tsx"),read("../App.tsx"),read("../pages/WorkspaceHubPage.tsx"),
    read("../pages/dashboards/AgencyAdminDashboard.tsx"),read("../pages/DocumentationPage.tsx"),read("./InfrastructureNoticeBanner.tsx"),
  ]);
  assert.ok(!multi.includes("Χωρίς περιορισμό στο συγκεκριμένο πεδίο"));
  assert.match(multi,/label: "Επιλογή όλων"/); assert.match(multi,/onChange\(\[\]\)/);
  assert.ok(!agency.includes("PeriodLocksPanel")); assert.ok(!agency.includes('value="period-locks"'));
  assert.match(app,/path="period-locks" element=\{<Navigate to="\/app\/agency-and-profile" replace/);
  for(const source of [hub,dashboard]){
    assert.ok(!source.includes("AnimatedKpiCard")); assert.ok(source.includes("AgencyAnalyticsPanel"));
  }
  assert.ok(!hub.includes("SummaryMetric"));
  assert.ok(!docs.includes("/documentation/sections")); assert.ok(!docs.includes("dangerouslySetInnerHTML"));
  assert.ok(!docs.includes("window.print()")); assert.ok(docs.includes("printGuidePdf(frame.current"));
  assert.ok(notice.includes('severity="info"')); assert.ok(notice.includes("26/10/2026"));
  assert.ok(!notice.includes("15:30")); assert.ok(!notice.includes("#b71c1c"));
  const pdf=await readFile(new URL("../../public/docs/kalypsis-backoffice-guide.pdf",import.meta.url));
  assert.equal(pdf.subarray(0,5).toString(),"%PDF-");
});

test("dashboard and PDF preview render at mobile through desktop widths, including dark mode",async context=>{
  globalThis.sessionStorage??={getItem:()=>null,setItem(){},removeItem(){}};
  globalThis.localStorage??={getItem:()=>null,setItem(){},removeItem(){}};
  const server=await createServer({server:{middlewareMode:true,hmr:false},ssr:{noExternal:[/@mui\//,"recharts"]},appType:"custom"});
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  try{
    const {ThemeProvider,createTheme}=await server.ssrLoadModule("@mui/material");
    const {ResponsiveContainer}=await server.ssrLoadModule("recharts");
    const {AgencyAnalyticsView,AgencyAnalyticsPanel}=await server.ssrLoadModule("/src/components/AgencyAnalyticsPanel.tsx");
    const {DocumentationPage}=await server.ssrLoadModule("/src/pages/DocumentationPage.tsx");
    const {InfrastructureNoticeBanner}=await server.ssrLoadModule("/src/components/InfrastructureNoticeBanner.tsx");
    const render=(child,width,mode="light")=>{
      const theme=createTheme({palette:{mode},components:{MuiUseMediaQuery:{defaultProps:{ssrMatchMedia:query=>{
        const max=query.match(/max-width:\s*([\d.]+)px/),min=query.match(/min-width:\s*([\d.]+)px/);
        return{matches:(!max||width<=Number(max[1]))&&(!min||width>=Number(min[1]))};
      }}}}});
      // Supply a real Recharts size context: SSR has no browser ResizeObserver.
      return renderToStaticMarkup(h(QueryClientProvider,{client},h(ThemeProvider,{theme},h(MemoryRouter,null,h(ResponsiveContainer,{width:Math.max(272,width>1200?width/2:width-48),height:300},child)))));
    };
    await context.test("six analysis panels, no KPI strip, accessible controls and a native PDF toolbar",()=>{
      for(const width of [320,360,768,1024,1366,1920]){
        const html=render(h(AgencyAnalyticsView,{report:fixture}),width);
        assert.equal((html.match(/data-analytics-chart=/g)??[]).length,6);
        // Recharts 3 registers axes/size in effects: SSR can verify its chart
        // wrapper, not the post-mount SVG or pixel geometry (needs a browser).
        assert.ok(html.includes("recharts-wrapper"));
        for(const label of ["Πορεία παραγωγής","Κινητός μέσος 3 μηνών","Τυπική απόκλιση","Μεγέθυνση","Δεδομένα","Περίοδος τάσης","Τρέχουσα εικόνα χαρτοφυλακίου"])assert.ok(html.includes(label),`${width}: ${label}`);
        assert.ok(!html.includes("Ασφάλιστρα μήνα"));
        const docs=render(h(DocumentationPage),width);
        assert.equal((docs.match(/<iframe/g)??[]).length,1);
        assert.ok(docs.includes("toolbar=1")); assert.ok(docs.includes("Εκτύπωση PDF"));
        assert.ok(!docs.includes("Αναζήτηση στον οδηγό"));
      }
      assert.ok(render(h(AgencyAnalyticsView,{report:fixture}),1024,"dark").includes("#15263A"));
      const notice=render(h(InfrastructureNoticeBanner),360);
      assert.ok(notice.includes("26/10/2026")); assert.ok(notice.includes("MuiAlert-standardInfo"));
    });
    await context.test("real report cache drives polling UI; collapsed hub has no hidden duplicate charts",()=>{
      client.setQueryData(["report","agency"],fixture);
      const html=render(h(AgencyAnalyticsPanel),1920);
      assert.ok(html.includes("Ανανέωση ανά 60")); assert.ok(html.includes("Ενημερώθηκε"));
      assert.equal((html.match(/data-analytics-chart=/g)??[]).length,6);
      const collapsed=render(h(AgencyAnalyticsPanel,{collapsible:true}),360);
      assert.ok(collapsed.includes("Προβολή αναλύσεων")); assert.ok(!collapsed.includes("data-analytics-chart"));
    });
    await context.test("interactions, reduced-motion, bounded foreground polling and explicit plot scales stay wired",async()=>{
      const source=await read("./AgencyAnalyticsPanel.tsx");
      for(const expected of ['refetchInterval: live && expanded ? 60_000 : false','refetchIntervalInBackground: false','prefers-reduced-motion','<Brush','<Legend','setFull(true)','setTable(value => !value)','orientation="right"','setHidden(previous','setSelected(value','query.refetch()'])assert.ok(source.includes(expected),expected);
      assert.ok(!source.includes("Math.random")); assert.ok(!source.includes("AnimatedKpiCard"));
    });
  }finally{client.clear();await server.close();}
});
