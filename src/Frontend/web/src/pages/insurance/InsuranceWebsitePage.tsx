import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Dialog, DialogActions, DialogContent, DialogTitle, Button } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { theme as insuranceTheme } from "../../theme";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowRight, faArrowLeft, faChevronDown, faChevronRight, faChevronLeft, faCar,
  faHouse, faHeartPulse, faUsers, faBuilding, faShieldHalved, faHeadset,
  faPercent, faLocationDot, faCreditCard, faUser, faUserGroup, faMagnifyingGlass,
  faBars, faXmark, faPhone, faEnvelope, faCircleCheck, faFileLines,
  faComments, faSliders, faLock, faCircleQuestion, faCircleInfo,
  faRotate, faTriangleExclamation, faPaperPlane,
} from "@fortawesome/free-solid-svg-icons";
import { InsuranceRequestPage } from "../InsuranceRequestPage";
import { INSURANCE_BASE as BASE, insuranceProducts, insuranceFaqs, insuranceArticles, insuranceQuoteUrl } from "./insuranceContent";
import "./insuranceWebsite.css";

const productIcons: Record<string, IconDefinition> = { car: faCar, home: faHouse, health: faHeartPulse, life: faUsers, business: faBuilding };
const asset = (name: string) => `/images/insurance/${name}`;
const Icon = ({ icon, className = "" }: { icon: IconDefinition; className?: string }) => <FontAwesomeIcon icon={icon} className={className} aria-hidden="true" />;

function Brand({ light = false }: { light?: boolean }) {
  return <Link to={BASE} className={`ki-brand${light ? " ki-brand-light" : ""}`} aria-label="KALYPSIS — Αρχική ασφάλισης">
    <span className="ki-brand-mark"><img src="/kalypsis-logo.png" alt="" /></span>
    <span className="ki-brand-copy"><span className="ki-brand-word"><img src="/kalypsis-logo.png" alt="KALYPSIS" /></span><span className="ki-brand-tagline">Η ΚΑΛΥΨΗ ΠΟΥ ΕΜΠΙΣΤΕΥΕΣΤΕ</span></span>
  </Link>;
}

function QuoteLink({ type = "", children = "Πάρε προσφορά", className = "" }: { type?: string; children?: ReactNode; className?: string }) {
  return <Link to={insuranceQuoteUrl(type)} className={`ki-button ${className}`}>{children}<Icon icon={faChevronRight} /></Link>;
}

function InsuranceHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => { setMenu(null); setMobileOpen(false); setSearchOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => { if (!headerRef.current?.contains(event.target as Node)) setMenu(null); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenu(null); setMobileOpen(false); } };
    document.addEventListener("pointerdown", closeOutside); document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, []);
  const menus = [
    { key: "products", title: "Ασφάλειες", links: insuranceProducts.map(p => ({ text: p.name, to: `${BASE}/programs/${p.slug}`, icon: productIcons[p.slug] })) },
    { key: "services", title: "Υπηρεσίες", links: [{ text: "Ασφαλιστική συμβουλευτική", to: `${BASE}/services/advice`, icon: faComments }, { text: "Ανανέωση συμβολαίου", to: `${BASE}/services/renewal`, icon: faRotate }, { text: "Υποστήριξη σε ζημιά", to: `${BASE}/services/claims`, icon: faShieldHalved }] },
    { key: "support", title: "Εξυπηρέτηση", links: [{ text: "Επικοινωνία", to: `${BASE}/contact`, icon: faHeadset }, { text: "Συχνές ερωτήσεις", to: `${BASE}/faq`, icon: faCircleQuestion }, { text: "Οδηγοί ασφάλισης", to: `${BASE}/guides`, icon: faFileLines }, { text: "Πληρωμή συμβολαίου", to: `${BASE}/payment`, icon: faCreditCard }] },
  ];
  return <header className="ki-header" ref={headerRef}>
    <div className="ki-utility"><div className="ki-container ki-utility-inner"><Link to={`${BASE}/contact`}><Icon icon={faLocationDot} />Βρείτε Συνεργάτη</Link><div className="ki-utility-right"><Link to={`${BASE}/payment`}><Icon icon={faCreditCard} />Online πληρωμή</Link><Link to="/login"><Icon icon={faUser} />Πελάτης</Link><Link to="/insureone/partners"><Icon icon={faUserGroup} />Συνεργάτης</Link></div></div></div>
    <div className="ki-container ki-header-main"><Brand /><button type="button" className="ki-menu-toggle" onClick={() => setMobileOpen(v => !v)} aria-expanded={mobileOpen} aria-controls="ki-main-nav" aria-label={mobileOpen ? "Κλείσιμο μενού" : "Άνοιγμα μενού"}><Icon icon={mobileOpen ? faXmark : faBars} /></button>
      <nav id="ki-main-nav" aria-label="Κύρια πλοήγηση ασφαλίσεων" className={`ki-nav${mobileOpen ? " ki-nav-open" : ""}`} onClick={event => { if ((event.target as HTMLElement).closest("a")) { setMobileOpen(false); setMenu(null); } }}>
        <NavLink to={BASE} end className={({ isActive }) => `ki-nav-home${isActive ? " ki-active" : ""}`}>Αρχική</NavLink>
        {menus.map(item => <div key={item.key} className="ki-nav-group"><button type="button" className={menu === item.key ? "ki-nav-selected" : ""} aria-expanded={menu === item.key} aria-controls={`ki-menu-${item.key}`} onClick={() => setMenu(v => v === item.key ? null : item.key)}>{item.title}<Icon icon={faChevronDown} /></button>{menu === item.key && <div id={`ki-menu-${item.key}`} className="ki-nav-dropdown">{item.links.map(link => <Link key={link.to} to={link.to}><Icon icon={link.icon} />{link.text}<Icon icon={faChevronRight} /></Link>)}</div>}</div>)}
        <NavLink to={`${BASE}/about`} className={({ isActive }) => isActive ? "ki-active" : ""}>Σχετικά με εμάς</NavLink>
        <QuoteLink className="ki-header-quote">Ζητήστε προσφορά</QuoteLink>
        <button type="button" className="ki-search-trigger" onClick={() => setSearchOpen(true)}><Icon icon={faMagnifyingGlass} /><span>Αναζήτηση</span></button>
      </nav>
    </div>
    <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
  </header>;
}

function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("el-GR");
  const results = [
    ...insuranceProducts.map(p => ({ title: p.title, text: `${p.name} ${p.description}`, to: `${BASE}/programs/${p.slug}`, icon: productIcons[p.slug] })),
    ...insuranceArticles.map(a => ({ title: a.title, text: a.intro, to: `${BASE}/guides/${a.slug}`, icon: faFileLines })),
    { title: "Επικοινωνία και υποστήριξη", text: "Τηλέφωνο email διεύθυνση συνεργάτης", to: `${BASE}/contact`, icon: faHeadset },
    { title: "Συχνές ερωτήσεις", text: "Πληρωμή ανανέωση καλύψεις βοήθεια", to: `${BASE}/faq`, icon: faCircleQuestion },
  ].filter(item => normalized(`${item.title} ${item.text}`).includes(normalized(query.trim())));
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" className="ki-dialog" aria-labelledby="ki-search-title"><DialogTitle id="ki-search-title">Τι ψάχνετε;</DialogTitle><DialogContent><label className="ki-search-field"><Icon icon={faMagnifyingGlass} /><input autoFocus type="search" placeholder="Αυτοκίνητο, κατοικία, ανανέωση…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Αναζήτηση στο ασφαλιστικό site" /></label><div className="ki-search-results">{results.map(result => <Link to={result.to} onClick={onClose} key={result.to}><Icon icon={result.icon} /><span><strong>{result.title}</strong><small>{result.text}</small></span><Icon icon={faChevronRight} /></Link>)}{results.length === 0 && <p>Δεν βρέθηκε αποτέλεσμα. Δοκιμάστε διαφορετική λέξη ή <Link to={`${BASE}/contact`} onClick={onClose}>επικοινωνήστε μαζί μας</Link>.</p>}</div></DialogContent><DialogActions><Button onClick={onClose}>Κλείσιμο</Button></DialogActions></Dialog>;
}

function Hero() {
  const slides = [insuranceProducts[1], insuranceProducts[0], insuranceProducts[2], insuranceProducts[3], insuranceProducts[4]];
  const [index, setIndex] = useState(0);
  const product = slides[index];
  return <section className="ki-hero" aria-roledescription="καρουζέλ" aria-label="Προτεινόμενα προγράμματα ασφάλισης">
    <img className={`ki-hero-image ki-hero-image-${product.slug}`} src={asset(product.image)} alt={product.alt} fetchPriority="high" key={product.image} />
    <div className="ki-hero-shade" />
    <div className="ki-container ki-hero-container"><div className="ki-hero-card" aria-live="polite"><span className="ki-eyebrow">ΑΣΦΑΛΕΙΑ ΓΙΑ Ο,ΤΙ ΕΧΕΙ ΑΞΙΑ</span><h1>{product.title}</h1><p>{product.description}</p><QuoteLink type={product.requestType} /></div></div>
    <button type="button" className="ki-slide-arrow ki-slide-prev" aria-label="Προηγούμενο πρόγραμμα" onClick={() => setIndex(v => (v + slides.length - 1) % slides.length)}><Icon icon={faChevronLeft} /></button>
    <button type="button" className="ki-slide-arrow ki-slide-next" aria-label="Επόμενο πρόγραμμα" onClick={() => setIndex(v => (v + 1) % slides.length)}><Icon icon={faChevronRight} /></button>
    <div className="ki-slide-dots">{slides.map((slide, i) => <button type="button" key={slide.slug} aria-label={`Προβολή ${slide.title}`} aria-pressed={index === i} className={index === i ? "ki-dot-active" : ""} onClick={() => setIndex(i)} />)}</div>
  </section>;
}

function ProgramShowcase() {
  const [selected, setSelected] = useState(0);
  const product = insuranceProducts[selected];
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  return <section className="ki-section ki-container ki-programs" aria-labelledby="ki-programs-title">
    <div className="ki-programs-top"><div className="ki-section-heading"><span className="ki-title-line" /><div><h2 id="ki-programs-title">Για την ασφάλισή σας</h2><Link to={`${BASE}/programs`} className="ki-text-link">Όλα τα προγράμματα<Icon icon={faChevronRight} /></Link></div></div>
      <div className="ki-product-tabs" role="tablist" aria-label="Κλάδοι ασφάλισης">{insuranceProducts.map((p, i) => <button type="button" role="tab" key={p.slug} id={`ki-tab-${p.slug}`} aria-controls="ki-product-panel" aria-selected={selected === i} tabIndex={selected === i ? 0 : -1} ref={el => { tabRefs.current[i] = el; }} className={selected === i ? "ki-product-active" : ""} onClick={() => setSelected(i)} onKeyDown={e => { if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return; e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? insuranceProducts.length - 1 : (selected + (e.key === "ArrowRight" ? 1 : -1) + insuranceProducts.length) % insuranceProducts.length; setSelected(next); tabRefs.current[next]?.focus(); }}><Icon icon={productIcons[p.slug]} /><span>{p.name}</span></button>)}</div>
    </div>
    <div id="ki-product-panel" role="tabpanel" aria-labelledby={`ki-tab-${product.slug}`} className="ki-product-panel"><div className="ki-product-copy"><h3>{product.title}</h3><h4>{product.tagline}</h4><p>{product.description}</p><div className="ki-button-row"><QuoteLink type={product.requestType} /><Link className="ki-text-link" to={`${BASE}/programs/${product.slug}`}>Δείτε το πρόγραμμα<Icon icon={faChevronRight} /></Link></div></div><div className="ki-product-visual"><div className="ki-product-benefits">{product.benefits.map((benefit, i) => <div key={benefit}><Icon icon={[faShieldHalved, faHeadset, faPercent][i]} /><span>{benefit}</span></div>)}</div><img key={product.image} src={asset(product.image)} alt={product.alt} loading="lazy" /></div></div>
    <p className="ki-fine-print">Οι καλύψεις και τυχόν εκπτώσεις διαμορφώνονται ανά πρόγραμμα και επιβεβαιώνονται στην εξατομικευμένη προσφορά σας.</p>
  </section>;
}

function Steps() {
  return <section className="ki-section ki-soft-section"><div className="ki-container"><div className="ki-centered-heading"><span className="ki-eyebrow">ΑΠΛΑ. ΠΡΟΣΩΠΙΚΑ. KALYPSIS.</span><h2>Η σωστή ασφάλιση ξεκινά με μια συζήτηση.</h2><p>Εμείς φροντίζουμε τις λεπτομέρειες. Εσείς συνεχίζετε τη ζωή σας.</p></div><div className="ki-steps">{[{ icon: faSliders, title: "Πείτε μας τι χρειάζεστε", text: "Επιλέξτε ασφάλιση και συμπληρώστε λίγα βασικά στοιχεία." }, { icon: faComments, title: "Βρίσκουμε μαζί τη λύση", text: "Συζητάμε τις ανάγκες σας και εξηγούμε καθαρά τις επιλογές σας." }, { icon: faShieldHalved, title: "Είμαστε δίπλα σας", text: "Από την έκδοση μέχρι την ανανέωση και τη στιγμή μιας ζημιάς." }].map((step, i) => <div className="ki-step" key={step.title}><div className="ki-step-icon"><Icon icon={step.icon} /><span>0{i + 1}</span></div><h3>{step.title}</h3><p>{step.text}</p></div>)}</div></div></section>;
}

function AdviceBanner() {
  return <section className="ki-container ki-advice"><div className="ki-advice-image"><img src={asset("family-life.jpg")} alt="Οικογένεια μαζί σε μια φωτεινή μέρα" loading="lazy" /><span><Icon icon={faHeartPulse} />Η ζωή σας. Η προτεραιότητά μας.</span></div><div className="ki-advice-copy"><span className="ki-eyebrow">Η ΚΑΛΥΨΗ ΠΟΥ ΕΜΠΙΣΤΕΥΕΣΤΕ</span><h2>Πίσω από κάθε συμβόλαιο,<br />βλέπουμε έναν άνθρωπο.</h2><p>Το σπίτι που χτίσατε. Η διαδρομή που σχεδιάζετε. Οι άνθρωποι που αγαπάτε. Στην KALYPSIS, ξεκινάμε από αυτά που έχουν αξία για εσάς.</p><p>Σας ακούμε, εξηγούμε τις καλύψεις με απλά λόγια και παραμένουμε το σταθερό σημείο επικοινωνίας σας.</p><Link to={`${BASE}/about`} className="ki-text-link">Γνωρίστε την KALYPSIS<Icon icon={faArrowRight} /></Link></div></section>;
}

function ArticleCards() {
  return <div className="ki-article-grid">{insuranceArticles.map(article => <Link className="ki-article" key={article.slug} to={`${BASE}/guides/${article.slug}`}><div className="ki-article-image"><img src={asset(article.image)} alt="" loading="lazy" /></div><div className="ki-article-copy"><span className="ki-eyebrow">{article.category}</span><h3>{article.title}</h3><p>{article.intro}</p><span className="ki-text-link">Διαβάστε περισσότερα<Icon icon={faArrowRight} /></span></div></Link>)}</div>;
}

function FaqList({ compact = false }: { compact?: boolean }) {
  return <div className="ki-faq-list">{insuranceFaqs.slice(0, compact ? 4 : undefined).map(faq => <details key={faq.question}><summary>{faq.question}<Icon icon={faChevronDown} /></summary><p>{faq.answer}</p></details>)}</div>;
}

function ContactCta() {
  return <section className="ki-contact-cta"><div className="ki-container"><div><span className="ki-eyebrow">ΕΔΩ ΓΙΑ ΕΣΑΣ</span><h2>Ας βρούμε τη δική σας κάλυψη.</h2><p>Μια απλή ερώτηση σήμερα. Περισσότερη σιγουριά αύριο.</p></div><div className="ki-cta-actions"><QuoteLink /> <a href="tel:+302631028971" className="ki-phone-link"><Icon icon={faPhone} />26310 28971</a></div></div></section>;
}

function InsuranceHome() {
  return <><Hero /><ProgramShowcase /><Steps /><AdviceBanner /><section className="ki-section ki-soft-section"><div className="ki-container"><div className="ki-heading-row"><div><span className="ki-eyebrow">ΧΡΗΣΙΜΑ, ΜΕ ΑΠΛΑ ΛΟΓΙΑ</span><h2>Λίγη ενημέρωση. Περισσότερη σιγουριά.</h2></div><Link className="ki-text-link" to={`${BASE}/guides`}>Όλοι οι οδηγοί<Icon icon={faArrowRight} /></Link></div><ArticleCards /></div></section><section className="ki-section ki-container ki-home-faq"><div><span className="ki-eyebrow">ΕΧΕΤΕ ΑΠΟΡΙΕΣ;</span><h2>Οι απαντήσεις,<br />πριν από την απόφαση.</h2><p>Η ασφάλιση γίνεται πιο απλή όταν ξέρετε τι να περιμένετε.</p><Link className="ki-text-link" to={`${BASE}/faq`}>Όλες οι ερωτήσεις<Icon icon={faArrowRight} /></Link></div><FaqList compact /></section><ContactCta /></>;
}

function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="ki-page-intro"><div className="ki-container"><Link to={BASE} className="ki-breadcrumb"><Icon icon={faArrowLeft} />Αρχική</Link><span className="ki-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div></div>;
}

function ProductDirectory() {
  return <><PageIntro eyebrow="ΟΙ ΑΣΦΑΛΕΙΕΣ ΜΑΣ" title="Κάλυψη για κάθε πλευρά της ζωής σας." text="Επιλέξτε αυτό που θέλετε να προστατέψετε. Είμαστε εδώ για να σας βοηθήσουμε με τα υπόλοιπα." /><section className="ki-section ki-container"><div className="ki-directory-grid">{insuranceProducts.map(product => <article className="ki-directory-card" key={product.slug}><img src={asset(product.image)} alt={product.alt} loading="lazy" /><div><Icon icon={productIcons[product.slug]} /><h2>{product.name}</h2><p>{product.tagline}</p><Link to={`${BASE}/programs/${product.slug}`} className="ki-text-link">Δείτε το πρόγραμμα<Icon icon={faArrowRight} /></Link></div></article>)}</div><div className="ki-inline-help"><Icon icon={faHeadset} /><div><h3>Ψάχνετε κάτι διαφορετικό;</h3><p>Μοτοσικλέτα, ταξίδι ή άλλη ανάγκη; Πείτε μας τι χρειάζεστε.</p></div><QuoteLink type="Άλλο">Μιλήστε μαζί μας</QuoteLink></div></section><ContactCta /></>;
}

function ProductDetail() {
  const { slug } = useParams();
  const product = insuranceProducts.find(p => p.slug === slug);
  if (!product) return <InsuranceNotFound />;
  return <><section className="ki-detail-hero"><img src={asset(product.image)} alt={product.alt} /><div className="ki-container"><div><Link to={`${BASE}/programs`} className="ki-breadcrumb"><Icon icon={faArrowLeft} />Όλα τα προγράμματα</Link><span className="ki-eyebrow">ΑΣΦΑΛΙΣΗ {product.name.toLocaleUpperCase("el-GR")}</span><h1>{product.title}</h1><h2>{product.tagline}</h2><p>{product.description}</p><QuoteLink type={product.requestType} /></div></div></section><section className="ki-section ki-container ki-coverage-layout"><div><span className="ki-eyebrow">Η ΠΡΟΣΤΑΣΙΑ ΣΑΣ, ΣΤΗΝ ΠΡΑΞΗ</span><h2>Επιλογές που αξίζει να συζητήσουμε.</h2><p>Μια πρώτη εικόνα των διαθέσιμων κατηγοριών κάλυψης. Μαζί διαμορφώνουμε την πρόταση που ταιριάζει στις δικές σας ανάγκες.</p><div className="ki-cover-grid">{product.covers.map(cover => <div key={cover}><Icon icon={faCircleCheck} /><span>{cover}</span></div>)}</div><div className="ki-note"><Icon icon={faCircleInfo} /><p>{product.note}</p></div></div><aside className="ki-preparation"><Icon icon={productIcons[product.slug]} /><h3>Για να ξεκινήσουμε</h3><p>Τα βασικά στοιχεία για το πρώτο σας αίτημα:</p><ul>{product.needs.map(need => <li key={need}>{need}</li>)}</ul><QuoteLink type={product.requestType} /><small>Η υποβολή αιτήματος είναι χωρίς δέσμευση.</small></aside></section><Steps /><ContactCta /></>;
}

const serviceContent: Record<string, { title: string; icon: IconDefinition; intro: string; steps: { title: string; text: string }[] }> = {
  advice: { title: "Ασφαλιστική συμβουλευτική", icon: faComments, intro: "Πριν επιλέξουμε πρόγραμμα, γνωρίζουμε εσάς. Με απλά λόγια, καθαρή εικόνα και χρόνο για τις ερωτήσεις σας.", steps: [{ title: "Καταγράφουμε τις ανάγκες", text: "Συζητάμε τι θέλετε να προστατέψετε, ποιες είναι οι προτεραιότητές σας και τι προϋπολογισμό θέλετε να διαθέσετε." }, { title: "Εξηγούμε τις επιλογές", text: "Εξετάζουμε καλύψεις, όρια, απαλλαγές και εξαιρέσεις. Η πρόταση πρέπει να είναι κατανοητή πριν αποφασίσετε." }, { title: "Σας βοηθάμε να προχωρήσετε", text: "Συγκεντρώνουμε τα απαραίτητα στοιχεία και σας καθοδηγούμε στα βήματα έκδοσης, με σαφή ενημέρωση." }] },
  renewal: { title: "Ανανέωση συμβολαίου", icon: faRotate, intro: "Κρατάμε την προστασία σας επίκαιρη. Ελέγχουμε μαζί τι έχει αλλάξει πριν από την επόμενη ανανέωση.", steps: [{ title: "Βρείτε το συμβόλαιό σας", text: "Έχετε διαθέσιμο τον αριθμό συμβολαίου, την ασφαλιστική εταιρεία και την ημερομηνία λήξης." }, { title: "Ενημερώστε μας για αλλαγές", text: "Νέα διεύθυνση, αλλαγή χρήσης οχήματος ή διαφορετικές ανάγκες; Αναφέρετέ τις για να αξιολογηθούν σωστά." }, { title: "Ελέγξτε τη νέα πρόταση", text: "Θα συζητήσουμε τις καλύψεις, το ασφάλιστρο και τις οδηγίες πληρωμής πριν προχωρήσετε." }] },
  claims: { title: "Υποστήριξη σε ζημιά", icon: faShieldHalved, intro: "Όταν προκύψει κάτι απρόοπτο, χρειάζεστε ένα ξεκάθαρο επόμενο βήμα. Είμαστε το σημείο επικοινωνίας σας με την ασφαλιστική.", steps: [{ title: "Φροντίστε πρώτα την ασφάλεια", text: "Αν υπάρχει άμεσος κίνδυνος ή τραυματισμός, καλέστε τις υπηρεσίες έκτακτης ανάγκης στο 112." }, { title: "Καλέστε την προβλεπόμενη βοήθεια", text: "Χρησιμοποιήστε τον αριθμό φροντίδας ατυχήματος ή βοήθειας που αναγράφεται στο ασφαλιστήριό σας." }, { title: "Ενημερώστε το γραφείο", text: "Κρατήστε τον αριθμό συμβολαίου, την ημερομηνία και τα στοιχεία του συμβάντος. Σας καθοδηγούμε για τα δικαιολογητικά και την παρακολούθηση του αιτήματος." }] },
};

function ServicePage() {
  const { slug } = useParams();
  const service = serviceContent[slug ?? ""];
  if (!service) return <InsuranceNotFound />;
  return <><PageIntro eyebrow="ΥΠΗΡΕΣΙΕΣ KALYPSIS" title={service.title} text={service.intro} /><section className="ki-section ki-container ki-service-layout"><div className="ki-service-steps">{service.steps.map((step, i) => <article key={step.title}><span>0{i + 1}</span><div><h2>{step.title}</h2><p>{step.text}</p></div></article>)}</div><aside className="ki-preparation"><Icon icon={service.icon} /><h3>Μιλήστε με την ομάδα μας</h3><p>Θα σας βοηθήσουμε με τα επόμενα βήματα.</p><a href="tel:+302631028971" className="ki-button"><Icon icon={faPhone} />26310 28971</a><a className="ki-text-link" href="mailto:info@mykalypsis.gr">info@mykalypsis.gr</a><Link to={insuranceQuoteUrl("Άλλο", service.title)} className="ki-text-link">Στείλτε αίτημα επικοινωνίας<Icon icon={faArrowRight} /></Link></aside></section><ContactCta /></>;
}

function AboutPage() {
  return <><PageIntro eyebrow="ΣΧΕΤΙΚΑ ΜΕ ΕΜΑΣ" title="Η κάλυψη που εμπιστεύεστε." text="Προσωπική ασφαλιστική εξυπηρέτηση, με την απλότητα και την οργάνωση της KALYPSIS." /><AdviceBanner /><section className="ki-section ki-soft-section"><div className="ki-container"><div className="ki-centered-heading"><span className="ki-eyebrow">Ο ΤΡΟΠΟΣ ΠΟΥ ΔΟΥΛΕΥΟΥΜΕ</span><h2>Καθαρά λόγια. Σταθερή παρουσία.</h2></div><div className="ki-value-grid">{[{ icon: faUserGroup, title: "Προσωπική σχέση", text: "Γνωρίζουμε ποιος είστε και τι έχει σημασία για εσάς. Η επικοινωνία σας έχει συνέχεια." }, { icon: faFileLines, title: "Κατανοητές επιλογές", text: "Εξηγούμε τους όρους και τις διαφορές των προγραμμάτων, για να γνωρίζετε τι επιλέγετε." }, { icon: faHeadset, title: "Δίπλα σας στην πράξη", text: "Συνεχίζουμε την υποστήριξη στην ανανέωση, στην αλλαγή των αναγκών και στη διαχείριση ζημιάς." }].map(value => <article key={value.title}><Icon icon={value.icon} /><h3>{value.title}</h3><p>{value.text}</p></article>)}</div></div></section><ContactCta /></>;
}

function ContactPage() {
  return <><PageIntro eyebrow="ΕΠΙΚΟΙΝΩΝΙΑ" title="Ας μιλήσουμε για όσα έχουν αξία." text="Για μια νέα προσφορά, μια απορία ή υποστήριξη στο συμβόλαιό σας, διαλέξτε τον τρόπο που σας εξυπηρετεί." /><section className="ki-section ki-container"><div className="ki-contact-grid"><a href="tel:+302631028971"><Icon icon={faPhone} /><span>Καλέστε μας</span><strong>26310 28971</strong><small>Προσωπική επικοινωνία με το γραφείο</small></a><a href="mailto:info@mykalypsis.gr"><Icon icon={faEnvelope} /><span>Στείλτε μας email</span><strong>info@mykalypsis.gr</strong><small>Για πληροφορίες και αιτήματα υποστήριξης</small></a><Link to={insuranceQuoteUrl()}><Icon icon={faPaperPlane} /><span>Ζητήστε προσφορά</span><strong>Ξεκινήστε online</strong><small>Λίγα στοιχεία, χωρίς δέσμευση</small></Link></div><div className="ki-contact-panel"><div><span className="ki-eyebrow">ΒΡΕΙΤΕ ΣΥΝΕΡΓΑΤΗ</span><h2>Το πρώτο σας σημείο επικοινωνίας.</h2><p>ΚΟΤΣΟΡΓΙΟΣ ΠΑΝΑΓΙΩΤΗΣ</p><p>Επικοινωνήστε με την KALYPSIS για να συζητήσουμε το αίτημά σας και να οργανώσουμε τηλεφωνική ή προσωπική εξυπηρέτηση.</p><Link to={insuranceQuoteUrl("Άλλο", "Αίτημα επικοινωνίας με συνεργάτη")} className="ki-button">Ζητήστε να σας καλέσουμε<Icon icon={faArrowRight} /></Link></div><div className="ki-contact-aside"><Icon icon={faHeadset} /><h3>Έχετε ήδη συμβόλαιο;</h3><p>Έχετε μαζί σας τον αριθμό συμβολαίου και την ασφαλιστική εταιρεία, για να σας εξυπηρετήσουμε πιο εύκολα.</p><Link to="/login" className="ki-text-link">Είσοδος πελάτη<Icon icon={faArrowRight} /></Link></div></div><div className="ki-note"><Icon icon={faTriangleExclamation} /><p>Για επείγον περιστατικό, καλέστε τον αριθμό βοήθειας που αναγράφεται στο ασφαλιστήριό σας. Σε άμεσο κίνδυνο καλέστε το 112.</p></div></section></>;
}

function PaymentPage() {
  return <><PageIntro eyebrow="ΕΞΥΠΗΡΕΤΗΣΗ ΣΥΜΒΟΛΑΙΟΥ" title="Η πληρωμή σας, με ασφαλή βήματα." text="Χρησιμοποιήστε τις επίσημες οδηγίες της ασφαλιστικής εταιρείας για το δικό σας συμβόλαιο." /><section className="ki-section ki-container ki-service-layout"><div className="ki-service-steps">{[{ title: "Ελέγξτε το ειδοποιητήριο", text: "Επιβεβαιώστε αριθμό συμβολαίου, ποσό και ημερομηνία λήξης πληρωμής." }, { title: "Ακολουθήστε τον προσωπικό σύνδεσμο", text: "Ο επίσημος σύνδεσμος ή κωδικός πληρωμής παρέχεται μαζί με την προσφορά ή το ειδοποιητήριό σας. Η πληρωμή ολοκληρώνεται στο ασφαλές περιβάλλον του παρόχου." }, { title: "Κρατήστε το αποδεικτικό", text: "Αποθηκεύστε την επιβεβαίωση και επικοινωνήστε μαζί μας αν χρειάζεστε βοήθεια με την έκδοση ή την ανανέωση." }].map((step, i) => <article key={step.title}><span>0{i + 1}</span><div><h2>{step.title}</h2><p>{step.text}</p></div></article>)}<div className="ki-note"><Icon icon={faLock} /><p>Δεν συλλέγουμε στοιχεία κάρτας από αυτή τη σελίδα. Μην αποστέλλετε αριθμό κάρτας, CVV ή κωδικούς μιας χρήσης μέσω email.</p></div></div><aside className="ki-preparation"><Icon icon={faCreditCard} /><h3>Χρειάζεστε σύνδεσμο πληρωμής;</h3><p>Ζητήστε τις οδηγίες για το συμβόλαιό σας από το γραφείο μας.</p><Link to={insuranceQuoteUrl("Άλλο", "Οδηγίες πληρωμής συμβολαίου")} className="ki-button">Ζητήστε οδηγίες<Icon icon={faArrowRight} /></Link><a href="tel:+302631028971" className="ki-text-link"><Icon icon={faPhone} />26310 28971</a></aside></section></>;
}

function FaqPage() {
  const [query, setQuery] = useState("");
  const needle = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("el-GR");
  return <><PageIntro eyebrow="ΣΥΧΝΕΣ ΕΡΩΤΗΣΕΙΣ" title="Απαντήσεις χωρίς ψιλά γράμματα." text="Όσα χρειάζεται να γνωρίζετε για το πρώτο αίτημα, την προσφορά και την εξυπηρέτησή σας." /><section className="ki-section ki-container ki-reading-width"><label className="ki-search-field"><Icon icon={faMagnifyingGlass} /><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Αναζήτηση στις ερωτήσεις…" aria-label="Αναζήτηση συχνών ερωτήσεων" /></label><div className="ki-faq-list">{insuranceFaqs.filter(faq => `${faq.question} ${faq.answer}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("el-GR").includes(needle)).map(faq => <details key={faq.question}><summary>{faq.question}<Icon icon={faChevronDown} /></summary><p>{faq.answer}</p></details>)}</div><p>Δεν βρήκατε αυτό που ψάχνετε; <Link className="ki-text-link" to={`${BASE}/contact`}>Μιλήστε μαζί μας<Icon icon={faArrowRight} /></Link></p></section><ContactCta /></>;
}

function GuidesPage() { return <><PageIntro eyebrow="ΟΔΗΓΟΙ ΑΣΦΑΛΙΣΗΣ" title="Η ενημέρωση είναι μέρος της προστασίας." text="Χρήσιμες σκέψεις και πρακτικά σημεία για να κάνετε τις σωστές ερωτήσεις πριν επιλέξετε." /><section className="ki-section ki-container"><ArticleCards /></section><ContactCta /></>; }

function ArticlePage() {
  const { slug } = useParams();
  const article = insuranceArticles.find(item => item.slug === slug);
  if (!article) return <InsuranceNotFound />;
  return <><PageIntro eyebrow={article.category} title={article.title} text={article.intro} /><article className="ki-section ki-container ki-reading-width ki-article-body"><img src={asset(article.image)} alt={article.title} /><div>{article.paragraphs.map((paragraph, i) => <section key={paragraph}><h2>{["Ξεκινήστε από τα βασικά", "Δείτε τις λεπτομέρειες", "Συζητήστε πριν αποφασίσετε"][i]}</h2><p>{paragraph}</p></section>)}</div><p className="ki-fine-print">Γενικές πληροφορίες ενημερωτικού χαρακτήρα. Οι καλύψεις και οι όροι καθορίζονται στο ασφαλιστήριό σας.</p><Link to={`${BASE}/guides`} className="ki-text-link"><Icon icon={faArrowLeft} />Όλοι οι οδηγοί</Link></article><ContactCta /></>;
}

function QuotePage() {
  const [params] = useSearchParams();
  return <><PageIntro eyebrow="ΑΙΤΗΜΑ ΑΣΦΑΛΙΣΗΣ" title="Το πρώτο βήμα για τη δική σας κάλυψη." text="Πείτε μας λίγα πράγματα για εσάς. Θα επικοινωνήσουμε μαζί σας για την πρόταση που σας ταιριάζει." /><section className="ki-quote-section"><InsuranceRequestPage key={params.toString()} embedded initialInsuranceType={params.get("type") ?? ""} initialInsuranceSubject={params.get("subject") ?? ""} /></section></>;
}

function InsurancePrivacy() {
  return <><PageIntro eyebrow="ΤΑ ΣΤΟΙΧΕΙΑ ΣΑΣ" title="Ιδιωτικότητα και επικοινωνία." text="Καθαρή ενημέρωση για την αρχική φόρμα αιτήματος ασφάλισης." /><section className="ki-section ki-container ki-reading-width ki-policy-copy"><h2>Τι υποβάλλετε</h2><p>Η φόρμα περιλαμβάνει ονοματεπώνυμο, κλάδο ασφάλισης, ένα βασικό στοιχείο του αντικειμένου ασφάλισης, email, τηλέφωνο, προτιμώμενο τρόπο επικοινωνίας και προαιρετικές σημειώσεις.</p><h2>Γιατί χρειαζόμαστε τα στοιχεία</h2><p>Χρησιμοποιούμε τα στοιχεία για να καταχωρήσουμε το αίτημά σας, να επικοινωνήσουμε μαζί σας και να οργανώσουμε την αρχική ασφαλιστική εξυπηρέτηση. Η αποστολή προϋποθέτει τη συγκατάθεσή σας για τη σχετική επικοινωνία.</p><h2>Τι δεν πρέπει να στείλετε εδώ</h2><p>Μην εισάγετε δεδομένα υγείας, κωδικούς πρόσβασης, στοιχεία κάρτας ή αντίγραφα ταυτότητας στην αρχική φόρμα. Αν χρειαστούν επιπλέον στοιχεία, θα λάβετε κατάλληλες οδηγίες.</p><h2>Επικοινωνία και δικαιώματα</h2><p>Για ερωτήσεις ή αίτημα σχετικά με τα δεδομένα σας, επικοινωνήστε στο <a href="mailto:info@mykalypsis.gr">info@mykalypsis.gr</a>. Διαβάστε επίσης την <Link to="/privacy">Πολιτική Απορρήτου KALYPSIS</Link> και τους <Link to="/terms">Όρους χρήσης</Link>.</p><h2>Ασφαλιστική κάλυψη</h2><p>Οι πληροφορίες του site είναι ενημερωτικές. Η υποβολή αιτήματος δεν αποτελεί αποδοχή κινδύνου, έκδοση ασφαλιστηρίου ή ενεργοποίηση κάλυψης. Η εξατομικευμένη προσφορά και οι όροι της ασφαλιστικής εταιρείας καθορίζουν τις τελικές παροχές.</p></section></>;
}

function InsuranceNotFound() { return <><PageIntro eyebrow="KALYPSIS" title="Αυτή η σελίδα δεν βρέθηκε." text="Βρείτε το πρόγραμμα που σας ενδιαφέρει ή μιλήστε μαζί μας." /><section className="ki-section ki-container"><Link to={`${BASE}/programs`} className="ki-button">Όλα τα προγράμματα<Icon icon={faArrowRight} /></Link></section></>; }

function InsuranceFooter() {
  const [cookieOpen, setCookieOpen] = useState(false);
  return <footer className="ki-footer"><div className="ki-container ki-footer-grid"><div className="ki-footer-brand"><Brand light /><p>Για τη ζωή που σχεδιάζετε.<br />Για όσα θέλετε να προστατέψετε.</p><a href="tel:+302631028971"><Icon icon={faPhone} />26310 28971</a><a href="mailto:info@mykalypsis.gr"><Icon icon={faEnvelope} />info@mykalypsis.gr</a></div><div><h3>Η ασφάλισή σας</h3>{insuranceProducts.map(product => <Link key={product.slug} to={`${BASE}/programs/${product.slug}`}>{product.name}</Link>)}<Link to={insuranceQuoteUrl("Μοτοσικλέτα")}>Μοτοσικλέτα</Link><Link to={insuranceQuoteUrl("Ταξιδιωτική ασφάλιση")}>Ταξιδιωτική ασφάλιση</Link></div><div><h3>Δίπλα σας</h3><Link to={`${BASE}/services/advice`}>Ασφαλιστική συμβουλευτική</Link><Link to={`${BASE}/services/renewal`}>Ανανέωση συμβολαίου</Link><Link to={`${BASE}/services/claims`}>Υποστήριξη σε ζημιά</Link><Link to={`${BASE}/payment`}>Πληρωμή συμβολαίου</Link><Link to={`${BASE}/faq`}>Συχνές ερωτήσεις</Link><Link to={`${BASE}/guides`}>Οδηγοί ασφάλισης</Link></div><div><h3>Η KALYPSIS</h3><Link to={`${BASE}/about`}>Σχετικά με εμάς</Link><Link to={`${BASE}/contact`}>Επικοινωνία</Link><Link to={`${BASE}/contact`}>Βρείτε συνεργάτη</Link><Link to={insuranceQuoteUrl("Άλλο", "Ενδιαφέρον για συνεργασία")}>Γίνετε συνεργάτης</Link><Link to="/login">Είσοδος πελάτη</Link><Link to="/insureone/partners">Πύλη συνεργατών</Link></div></div><div className="ki-footer-legal ki-container"><span>© {new Date().getFullYear()} KALYPSIS. Με επιφύλαξη παντός δικαιώματος.</span><div><Link to={`${BASE}/privacy`}>Απόρρητο & όροι</Link><button type="button" onClick={() => setCookieOpen(true)}>Cookies</button><a href="mailto:info@mykalypsis.gr?subject=Παράπονο%20ασφαλιστικής%20εξυπηρέτησης">Υποβολή παραπόνου</a></div></div><Dialog open={cookieOpen} onClose={() => setCookieOpen(false)} className="ki-dialog" fullWidth maxWidth="sm"><DialogTitle>Cookies και ιδιωτικότητα</DialogTitle><DialogContent><p>Το ασφαλιστικό site δεν ενεργοποιεί διαφημιστικά cookies ή εργαλεία παρακολούθησης επισκεπτών. Η υπάρχουσα πλατφόρμα χρησιμοποιεί τεχνική αποθήκευση για τη σύνδεση και τις ρυθμίσεις λειτουργίας.</p><Link to="/cookies">Αναλυτική πολιτική cookies KALYPSIS</Link></DialogContent><DialogActions><Button onClick={() => setCookieOpen(false)}>Κλείσιμο</Button></DialogActions></Dialog></footer>;
}

export function InsuranceWebsitePage() {
  return <ThemeProvider theme={insuranceTheme}><div className="ki-site"><a href="#ki-main-content" className="ki-skip-link">Μετάβαση στο περιεχόμενο</a><InsuranceHeader /><main id="ki-main-content"><Routes><Route index element={<InsuranceHome />} /><Route path="programs" element={<ProductDirectory />} /><Route path="programs/:slug" element={<ProductDetail />} /><Route path="services/:slug" element={<ServicePage />} /><Route path="about" element={<AboutPage />} /><Route path="contact" element={<ContactPage />} /><Route path="faq" element={<FaqPage />} /><Route path="guides" element={<GuidesPage />} /><Route path="guides/:slug" element={<ArticlePage />} /><Route path="quote" element={<QuotePage />} /><Route path="payment" element={<PaymentPage />} /><Route path="privacy" element={<InsurancePrivacy />} /><Route path="*" element={<InsuranceNotFound />} /></Routes></main><InsuranceFooter /></div></ThemeProvider>;
}
