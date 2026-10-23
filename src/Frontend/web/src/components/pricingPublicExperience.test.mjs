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
    const {PublicProductShowcase,WEB_SCREENSHOTS} = await server.ssrLoadModule("/src/components/PublicProductShowcase.tsx");
    const {PublicRemoteAccessSection,REMOTE_ACCESS_TOOLS} = await server.ssrLoadModule("/src/components/PublicRemoteAccessSection.tsx");
    const {DESKTOP_SCREENSHOTS,CLI_SCREENSHOTS} = await server.ssrLoadModule("/src/components/DownloadShowcase.tsx");
    const {PublicOfferingsSection} = await server.ssrLoadModule("/src/components/PublicOfferingsSection.tsx");
    const {PublicPricingCooperationSection} = await server.ssrLoadModule("/src/components/PublicPricingCooperationSection.tsx");
    client.setQueryData(["public-pricing"], {version:1,plans:[{code:"test",name:"Πλάνο δοκιμής",description:"Δοκιμή",tagline:"",pricePerYear:100,includedOffices:1,includedUsers:1,includedPackages:1,extraOfficePerYear:20,extraUserPerYear:10,packages:["core"],isFeatured:true,isActive:true,sortOrder:1,buttonText:"Επιλογή",buttonUrl:"/register"}],addons:[],services:[],features:[{key:"core",label:"Πελάτες",sortOrder:1,isActive:true}],settings:{currency:"EUR",pricesIncludeVat:false,vatRate:24,publicTitle:"Τιμές",publicSubtitle:"",vatLabel:"ΦΠΑ"}});
    const render = (child,width,mountDrawers=false) => renderToStaticMarkup(h(QueryClientProvider,{client},h(I18nextProvider,{i18n},h(ThemeProvider,{theme:createTheme({components:{MuiDialog:{defaultProps:{disablePortal:true}},...(mountDrawers ? {MuiModal:{defaultProps:{keepMounted:true,disablePortal:true}},MuiDrawer:{defaultProps:{ModalProps:{keepMounted:true,disablePortal:true}}}} : {}),MuiUseMediaQuery:{defaultProps:{ssrMatchMedia:()=>({matches:width<600})}}}})},h(MemoryRouter,null,child)))));
    await context.test("contract modal has all screenshot fields, optional region/message, consent and accessible controls at six widths", () => {
      for (const width of [320,360,600,900,1280,1920]) {
        const html = render(h(ContractRequestDialog,{open:true,onClose(){}}),width);
        for (const label of ["Στοιχεία επικοινωνίας","Όνομα","Επώνυμο","Email","Τηλέφωνο","Επωνυμία γραφείου / εταιρείας","Περιοχή","Σύντομο μήνυμα","Ακύρωση","Αποστολή αιτήματος σύμβασης"]) assert.ok(html.includes(label),`${width}: ${label}`);
        assert.ok(html.includes('type="email"')); assert.ok(html.includes('type="tel"'));
        assert.ok(html.includes('autoComplete="address-level2"') || html.includes('autocomplete="address-level2"'));
        assert.ok(!html.includes('role="combobox"'), "city is free text rather than a predefined dropdown");
        assert.ok(html.includes('form="'), "fixed footer submits the actual form");
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
        assert.ok(html.includes(language === "el" ? "Δωρεάν πρόσβαση στο αποθετήριο για όλους" : "Free repository access for everyone"));
        assert.ok(!html.includes("Υπό προετοιμασία")); assert.ok(!html.includes("In preparation"));
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
    await context.test("product showcases and remote access tools have real images and bilingual links to their downloads", async () => {
      assert.equal(WEB_SCREENSHOTS.length,6);
      assert.equal(DESKTOP_SCREENSHOTS.length,4);
      assert.equal(CLI_SCREENSHOTS.length,5);
      for (const image of [...WEB_SCREENSHOTS,...DESKTOP_SCREENSHOTS,...CLI_SCREENSHOTS]) {
        const bytes = await readFile(new URL(`../../public/images/download/${image.file}`,import.meta.url));
        assert.equal(bytes.readUInt16BE(0),0xffd8,image.file);
        assert.ok(bytes.length > 1000,image.file);
      }
      assert.deepEqual(REMOTE_ACCESS_TOOLS.map(tool=>tool.website),['https://rustdesk.com/','https://www.anyviewer.com/','https://anydesk.com/en','https://www.teamviewer.com/']);
      for (const tool of REMOTE_ACCESS_TOOLS) {
        const logo = await readFile(new URL(`../../public/images/remote-access/${tool.logo}`,import.meta.url));
        assert.ok(logo.length > 500,tool.name);
        if(tool.logo.endsWith('.svg')) assert.match(logo.toString(),/<svg[\s>]/);
        else assert.equal(logo.subarray(1,4).toString(),'PNG');
      }
      for (const language of ["el","en"]) {
        await i18n.changeLanguage(language);
        for (const width of [320,360,600,900,1280,1920]) {
          const html = render(h(PublicProductShowcase),width);
          assert.equal((html.match(/<section\b/g)??[]).length,3);
          assert.ok(html.includes('aria-labelledby="public-web-title"'));
          assert.ok(html.includes('aria-labelledby="public-desktop-title"'));
          assert.ok(html.includes('aria-labelledby="public-cli-title"'));
          assert.ok(html.indexOf('id="public-web-title"') < html.indexOf('id="public-desktop-title"'));
          assert.ok(html.indexOf('id="public-desktop-title"') < html.indexOf('id="public-cli-title"'));
          assert.ok(html.includes('href="/register"')); assert.ok(html.includes('href="/download"'));
          assert.ok(html.includes('/releases/latest/download/kalypsis-desktop-win-Setup.exe'));
          assert.ok(html.includes(`${CLI_REPOSITORY}/releases/latest`));
          for (const image of [...WEB_SCREENSHOTS,...DESKTOP_SCREENSHOTS,...CLI_SCREENSHOTS]) assert.ok(html.includes(`/images/download/${image.file}`),image.file);
          assert.ok(html.includes(language === "el" ? "Το γραφείο σας, οργανωμένο από τον browser." : "Your agency, organised in your browser."));
          assert.ok(html.includes(language === "el" ? "Η καθημερινή σας εργασία, σε εφαρμογή Windows." : "Everyday work, in a Windows application."));
          assert.ok(html.includes(language === "el" ? "Δωρεάν backoffice στο τερματικό σας." : "Free backoffice in your terminal."));
          assert.ok(html.includes(language === "el" ? "Μεγέθυνση" : "Enlarge"));
          for (const token of ["#F1F7FD","#0B2B54","minmax(0, 1fr)","900px"]) assert.ok(html.includes(token),token);
          assert.ok(!html.includes('public-workflow-title'));
          const remote = render(h(PublicRemoteAccessSection),width);
          assert.equal((remote.match(/<article\b/g)??[]).length,4);
          assert.ok(remote.includes(language === 'el' ? 'Προγράμματα απομακρυσμένης πρόσβασης' : 'Remote access software'));
          for (const tool of REMOTE_ACCESS_TOOLS) {
            assert.ok(remote.includes(`src="/images/remote-access/${tool.logo}"`));
            assert.ok(remote.includes(`href="${tool.website}"`));
            assert.ok(remote.includes(`href="${tool.download}"`));
          }
          assert.ok(remote.includes('target="_blank"')); assert.ok(remote.includes('rel="noopener noreferrer"'));
          assert.ok(remote.includes('prefers-reduced-motion'));
        }
      }
      await assert.rejects(read("./PublicWorkflowSection.tsx"),{code:"ENOENT"});
      assert.ok((await read("../pages/LandingPage.tsx")).includes("<PublicProductShowcase />"));
      const tooltip = await read("./CliProjectLink.tsx");
      for (const obsolete of ["υπό προετοιμασία","not available yet","planned Windows"]) assert.ok(!tooltip.includes(obsolete));
    });
    await context.test("offerings match the reference hierarchy with six readable cards, a schematic and six accessible contact links", async () => {
      for (const language of ["el","en"]) {
        i18n.addResourceBundle(language,"translation",JSON.parse(await read(`../i18n/locales/${language}.json`)),true,true);
        await i18n.changeLanguage(language);
        for (const width of [320,360,600,900,1280,1920]) {
          const html = render(h(PublicOfferingsSection),width);
          assert.equal((html.match(/<article\b/g)??[]).length,6);
          assert.equal((html.match(/<h3\b/g)??[]).length,6);
          assert.equal((html.match(/href="\/contact"/g)??[]).length,6);
          assert.ok(html.includes('id="features"')); assert.ok(html.includes('aria-labelledby="public-offerings-title"'));
          assert.ok(html.includes("/images/kalypsis-hero-bg.png")); assert.ok(html.includes("rotate(180deg)"));
          for(const key of ["bridges","prod","network","cash","access","portal"]) {
            assert.ok(html.includes(`id="offering-${key}-title"`));
            const title=i18n.t(`landing.v2.feat.${key}T`);
            assert.ok(html.includes(title.replaceAll("&","&amp;")),title);
          }
          assert.ok(html.includes('viewBox="0 0 420 255"'));
          for(const token of ["AIG","INTERAMERICAN","Groupama","KALYPSIS","minmax(0,1fr)","1200px","1536px","prefers-reduced-motion"]) assert.ok(html.includes(token),token);
          assert.ok(!html.includes('opacity:0;'));
        }
      }
      const page = await read("../pages/LandingPage.tsx");
      assert.ok(page.includes("<PublicOfferingsSection />"));
      assert.ok(!page.includes("<FeatureGrid />"));
    });
    await context.test("the table is replaced with exactly two clear next steps, preserving the actual pricing page and contract form", async () => {
      for (const language of ["el","en"]) {
        await i18n.changeLanguage(language);
        for(const width of [320,360,600,900,1280,1920]) {
          const html=render(h(PublicPricingCooperationSection),width);
          assert.ok(!html.includes("<table"));
          assert.equal((html.match(/href="\/pricing"/g)??[]).length,1);
          assert.equal((html.match(/<button\b/g)??[]).length,1);
          assert.ok(html.includes('aria-haspopup="dialog"')); assert.ok(html.includes('aria-expanded="false"'));
          for (const text of language === "el" ? ["Αναλυτική τιμολόγηση","Αίτημα σύμβασης συνεργασίας"] : ["Detailed pricing","Request a cooperation agreement"]) assert.ok(html.includes(text));
          for(const token of ['#EDF3F9','#0B305C','flex-direction:column','900px']) assert.ok(html.includes(token),token);
        }
      }
      const landing=render(h(LandingPage),1920);
      assert.ok(!landing.includes('<table'));
      assert.ok(landing.includes('public-pricing-cooperation-title'));
      assert.equal((landing.match(/id="offering-[a-z]+-title"/g)??[]).length,6);
      assert.ok(landing.indexOf('id="remote-access-title"') > landing.indexOf('id="public-cli-title"'));
      assert.ok(landing.includes('data-desktop-download-action'));
      assert.ok(!render(h(PublicNav,{modern:true}),1920).includes('data-desktop-download-action'));
      assert.ok(!(await read('../App.tsx')).includes('PreloginDesktopDownload'));
      assert.ok(!(await read('./PublicShell.tsx')).includes('PreloginDesktopDownload'));
    });
  } finally {client.clear();await server.close();}
});
