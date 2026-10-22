import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { createServer } from "vite";
import { emptyContractRequest, contractRequestError, contractRequestPayload } from "./contractRequestModel.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const valid = () => ({ ...emptyContractRequest(), firstName: " Άννα ", lastName: " Δοκιμή ", email: "anna@example.test", phone: "+30 210 1234567", companyName: " Γραφείο δοκιμών ", consent: true });

test("contract request has exactly the necessary public contact payload; optional message and region may be empty", () => {
  assert.equal(contractRequestError(valid()), "");
  const result = contractRequestPayload(valid());
  assert.equal(result.inquiryType, "contract"); assert.equal(result.firstName, "Άννα");
  assert.equal(result.companyName, "Γραφείο δοκιμών"); assert.equal(result.agencyOrCity, null);
  assert.equal(result.consent, true); assert.equal(result.website, "");
  assert.ok(result.message.length >= 10); assert.ok(result.message.includes("Χωρίς επιπλέον μήνυμα."));
  const filled = contractRequestPayload({ ...valid(), region: " Πάτρα ", message: "Επικοινωνία μετά τις 16:00" });
  assert.equal(filled.agencyOrCity, "Πάτρα"); assert.ok(filled.message.includes("Επικοινωνία μετά τις 16:00"));
});

test("required contact, phone, length and consent guards match the server, without hiding a disabled submit button", () => {
  for (const patch of [
    {firstName:""},{lastName:""},{email:"invalid"},{phone:"123"},{phone:"abcdefghij"},
    {phone:"1234567890123456"},{phone:"210+1234567"},{companyName:""},{consent:false},
    {companyName:"x".repeat(201)},{region:"x".repeat(121)},{message:"x".repeat(2001)},
  ]) assert.ok(contractRequestError({...valid(),...patch}),JSON.stringify(patch));
});

test("calculator is modal-only, pricing comparison is removed and all pricing inputs still use the existing calculation API", async () => {
  const source = await read("../pages/PricingPage.tsx");
  assert.ok(!source.includes("Σύγκριση δυνατοτήτων"));
  for (const text of ['<Dialog open={calculatorOpen}', 'setCalculatorOpen(true)', 'calculatorOpen && catalog', '"/platform/pricing/calculate"', 'addonCodes: selectedCodes', 'serviceCodes: selectedServiceCodes', 'extraOffices, extraUsers', '<ContractRequestSection />', 'calculation.data.lines.map']) assert.ok(source.includes(text), text);
});

test("contract submit is wired to the real protected contact flow and accurately reports delivered vs registered", async () => {
  const source = await read("./ContractRequestDialog.tsx");
  for (const text of ['"/public/contact", contractRequestPayload(form)', 'if (submitting) return', 'contractRequestError(form)', 'setResult(response.data)', 'result.delivered', 'Η ειδοποίηση email δεν επιβεβαιώθηκε', 'name="website"', 'setOpen(true)', 'disabled={submitting}']) assert.ok(source.includes(text),text);
  assert.ok(!source.includes("mailto:"));
  assert.ok(!source.includes("Η σύμβαση θα αποσταλεί άμεσα"));
});

test("public pricing, contract form, disclosure and bilingual CLI links render with real components", async context => {
  globalThis.sessionStorage ??= {getItem:()=>null,setItem(){},removeItem(){}};
  globalThis.localStorage ??= {getItem:()=>null,setItem(){},removeItem(){}};
  const server = await createServer({server:{middlewareMode:true,hmr:false},ssr:{noExternal:[/@mui\//,"recharts"]},appType:"custom"});
  const client = new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  const i18n = createInstance(); await i18n.init({lng:"el",fallbackLng:"el",resources:{el:{translation:{test:"Δοκιμή"}},en:{translation:{test:"Test"}}},initImmediate:false});
  try {
    const {ThemeProvider,createTheme} = await server.ssrLoadModule("@mui/material");
    const {ContractRequestDialog,ContractRequestSection} = await server.ssrLoadModule("/src/components/ContractRequestDialog.tsx");
    const {PublicFooter} = await server.ssrLoadModule("/src/components/PublicFooter.tsx");
    const {CliProjectLink,CLI_REPOSITORY,cliContributionUrl} = await server.ssrLoadModule("/src/components/CliProjectLink.tsx");
    const {AgencyAnalyticsPanel} = await server.ssrLoadModule("/src/components/AgencyAnalyticsPanel.tsx");
    const {PricingPage} = await server.ssrLoadModule("/src/pages/PricingPage.tsx");
    const {LandingNavbar} = await server.ssrLoadModule("/src/components/LandingNavbar.tsx");
    const {PublicNav} = await server.ssrLoadModule("/src/components/PublicNav.tsx");
    const {LandingPage} = await server.ssrLoadModule("/src/pages/LandingPage.tsx");
    client.setQueryData(["public-pricing"], {version:1,plans:[{code:"test",name:"Πλάνο δοκιμής",description:"Δοκιμή",tagline:"",pricePerYear:100,includedOffices:1,includedUsers:1,includedPackages:1,extraOfficePerYear:20,extraUserPerYear:10,packages:["core"],isFeatured:true,isActive:true,sortOrder:1,buttonText:"Επιλογή",buttonUrl:"/register"}],addons:[],services:[],features:[{key:"core",label:"Πελάτες",sortOrder:1,isActive:true}],settings:{currency:"EUR",pricesIncludeVat:false,vatRate:24,publicTitle:"Τιμές",publicSubtitle:"",vatLabel:"ΦΠΑ"}});
    const render = (child,width,mountDrawers=false) => renderToStaticMarkup(h(QueryClientProvider,{client},h(I18nextProvider,{i18n},h(ThemeProvider,{theme:createTheme({components:{MuiDialog:{defaultProps:{disablePortal:true}},...(mountDrawers ? {MuiModal:{defaultProps:{keepMounted:true,disablePortal:true}},MuiDrawer:{defaultProps:{ModalProps:{keepMounted:true,disablePortal:true}}}} : {}),MuiUseMediaQuery:{defaultProps:{ssrMatchMedia:()=>({matches:width<600})}}}})},h(MemoryRouter,null,child)))));
    await context.test("contract modal has all screenshot fields, optional region/message, consent and accessible controls at six widths", () => {
      for (const width of [320,360,600,900,1280,1920]) {
        const html = render(h(ContractRequestDialog,{open:true,onClose(){}}),width);
        for (const label of ["Στοιχεία επικοινωνίας","Όνομα","Επώνυμο","Email","Τηλέφωνο","Επωνυμία γραφείου / εταιρείας","Περιοχή","Σύντομο μήνυμα","Ακύρωση","Αποστολή αιτήματος σύμβασης"]) assert.ok(html.includes(label),`${width}: ${label}`);
        assert.ok(html.includes('type="email"')); assert.ok(html.includes('type="tel"'));
        assert.ok(html.includes('name="website"')); assert.ok(html.includes('href="/privacy"'));
        assert.ok(render(h(ContractRequestSection),width).includes("Ζητήστε σύμβαση συνεργασίας"));
        const pricing = render(h(PricingPage),width);
        assert.ok(pricing.includes("Υπολόγισε το δικό σου σύνολο"));
        assert.ok(pricing.includes("Ζητήστε σύμβαση συνεργασίας"));
        assert.ok(!pricing.includes("Σύγκριση δυνατοτήτων"));
        assert.ok(!pricing.includes('id="pricing-calculator-title"'));
      }
    });
    await context.test("analytics launcher has a right disclosure arrow, darker border and expanded-state metadata", () => {
      const html = render(h(AgencyAnalyticsPanel,{collapsible:true}),360);
      for (const token of ['aria-expanded="false"','aria-controls="agency-analytics-content"','ExpandMoreIcon','border:2px solid','#7890AC']) assert.ok(html.includes(token),token);
    });
    await context.test("Greek and English links point to the matching contribution documents; all public headers include the GitHub launcher", async () => {
      for (const [language,contributor,file] of [["el","Γίνετε συντελεστής","CONTRIBUTING.el.md"],["en","Become a contributor","CONTRIBUTING.md"]]) {
        await i18n.changeLanguage(language);
        const html = render(h(PublicFooter),360);
        assert.ok(html.includes(contributor)); assert.ok(html.includes(`${CLI_REPOSITORY}/blob/main/${file}`));
        assert.ok(render(h(CliProjectLink),360).includes(`href="${CLI_REPOSITORY}"`));
      }
      assert.ok(cliContributionUrl(false).endsWith("CONTRIBUTING.el.md"));
      assert.ok(cliContributionUrl(true).endsWith("CONTRIBUTING.md"));
      for (const path of ["./LandingNavbar.tsx","./PublicNav.tsx","../pages/LandingPage.tsx"]) assert.ok((await read(path)).includes("<CliProjectLink />"),path);
    });
    await context.test("GitHub is grouped immediately after registration in every public desktop header and mobile drawer, not beside the contact/language controls", () => {
      for (const Component of [LandingNavbar,PublicNav,LandingPage]) {
        const html = render(h(Component),360,true);
        for (const slot of ["registration","mobile-registration"]) {
          const group = html.match(new RegExp(`<div[^>]*data-nav-slot="${slot}"[^>]*>([\\s\\S]*?)</div>`))?.[1];
          assert.ok(group,`${Component.name}: ${slot} exists`);
          const anchors = [...group.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(match=>match[1]);
          assert.deepEqual(anchors,["/register",CLI_REPOSITORY],`${Component.name}: ${slot} links stay adjacent`);
          assert.ok(group.includes("GitHubIcon"));
          assert.ok(group.includes('target="_blank"')); assert.ok(group.includes('rel="noopener noreferrer"'));
        }
      }
    });
  } finally {client.clear();await server.close();}
});
