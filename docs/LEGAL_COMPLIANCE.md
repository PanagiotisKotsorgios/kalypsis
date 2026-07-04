# Kalypsis — Legal & Compliance Roadmap

> **DISCLAIMER**: Αυτό είναι επιχειρησιακό/τεχνικό framework, ΟΧΙ νομική συμβουλή.
> Πριν το ενεργοποιήσεις με πραγματικούς πελάτες, ζήτα review από **δικηγόρο εξειδικευμένο σε GDPR + εμπορικό δίκαιο** και από ασφαλιστικό σύμβουλο cyber liability.

---

## 1. Τι έχεις ήδη

Στο `src/Frontend/web/src/pages/`:

- **TermsPage.tsx** — 11 ενότητες Όρων Χρήσης (πάροχος, συνδρομές, ευθύνη, κ.λπ.)
- **PrivacyPage.tsx** — 10 ενότητες GDPR-aware (νομικές βάσεις, δικαιώματα, διεθνείς διαβιβάσεις)
- **CookiesPage.tsx** — 5 ενότητες (τεχνικά/analytics cookies)

**Το κρίσιμο κενό:** Οι παραπάνω είναι *ενημερωτικά*. Για την επεξεργασία δεδομένων ΑΣΦΑΛΙΣΜΕΝΩΝ (των πελατών των γραφείων) — η οποία είναι η ουσιαστική δραστηριότητα της πλατφόρμας — απαιτείται **ξεχωριστή, υπογεγραμμένη Σύμβαση Επεξεργασίας Δεδομένων (DPA)** μεταξύ Kalypsis (Εκτελών) και κάθε γραφείου (Υπεύθυνος). Άρθρο 28 GDPR — δεν είναι προαιρετικό.

---

## 2. Είναι νόμιμο σήμερα να εισάγουν πραγματικά δεδομένα;

### Σύντομη απάντηση: **Ναι με προϋποθέσεις, αλλά ΟΧΙ πλήρως καλυμμένο.**

Ο κάθε ασφαλιστικός διαμεσολαβητής μπορεί να χρησιμοποιεί SaaS εργαλείο για τα data του (είναι νόμιμο). Αλλά για να **εσύ** είσαι καλυμμένος από αγωγές, χρειάζεται:

### Πράσινο ✓ (τι έχεις)
- Δεδομένα φιλοξενούνται εντός ΕΕ (Ελλάδα — coolify στο σπίτι του φίλου σου) → **όχι** international transfer issue
- Privacy Policy + Terms of Service υπάρχουν
- HTTPS/SSL μέσω Cloudflare
- Ιδιωτικό GitHub repo
- Ενσωματωμένα audit logs, GDPR export/anonymize, 2FA (TOTP + email code)

### Κόκκινο 🔴 (τι λείπει — κρίσιμα)
1. **Data Processing Agreement (DPA) — Άρθρο 28 GDPR**
2. **Register of Sub-processors** (GitHub, Cloudflare, Brevo, coolify host, κ.λπ.)
3. **Data Breach Notification διαδικασία 72 ωρών**
4. **Physical security assessment για τον server** (σπίτι φίλου = ρίσκο)
5. **Cyber liability insurance**
6. **Records of Processing Activities (Άρθρο 30)**
7. **DPIA — Data Protection Impact Assessment** (υποχρεωτικό για large-scale insurance data)
8. **Signed acceptance log** — audit trail ποιος αποδέχτηκε τι έκδοση όρων

### Πορτοκαλί ⚠️ (δουλεύει αλλά ρίσκο)
- **Coolify στο σπίτι φίλου**: fine για MVP, αλλά όταν έχεις 20+ γραφεία με ενεργά data:
  - Physical security (κάποιος μπαίνει σπίτι, κλέβει το μηχάνημα) → **breach notification υποχρεωτική**
  - Δεν έχει ΔΕΔΔΗΕ redundancy, UPS enterprise-grade, κλιματισμό server-room grade
  - Φυσικός FTS/backup διαφορετικής τοποθεσίας;
  - **Recommendation**: Move σε Hetzner Cloud / OVH Ελλάδας ή AWS Frankfurt εντός 6 μηνών

---

## 3. Τι χαρτιά πρέπει να υπογράφει κάθε γραφείο ΠΡΙΝ συνεργαστείς

Ο "πακέτο υπογραφών" πρέπει να περιλαμβάνει **3 έγγραφα**:

### A. Σύμβαση Παροχής Υπηρεσιών (Master Service Agreement)
- Αντικείμενο (SaaS access στην πλατφόρμα)
- Διάρκεια, τιμολόγηση, ακύρωση
- SLA (uptime target — π.χ. 99.5%)
- Ευθύνη και αποζημίωση (limits — π.χ. 12x monthly fee)
- Δικαιοδοσία (Δικαστήρια Αθηνών, Ελληνικό δίκαιο)

### B. Data Processing Agreement (DPA) — Άρθρο 28 GDPR
**Αυτό είναι το κρίσιμο.** Περιλαμβάνει:
- Αντικείμενο και διάρκεια της επεξεργασίας
- Φύση και σκοπός της επεξεργασίας
- Είδος προσωπικών δεδομένων και κατηγορίες υποκειμένων
- Υποχρεώσεις και δικαιώματα του Υπεύθυνου Επεξεργασίας
- **Λίστα εξουσιοδοτημένων υπο-εκτελούντων** (GitHub, Cloudflare, coolify-server-hosting, Brevo, κ.λπ.)
- **Ρήτρα ενημέρωσης εντός 24 ωρών** για data breach
- **Δικαίωμα audit** από τον Υπεύθυνο
- **Επιστροφή/διαγραφή δεδομένων** μετά τη λύση
- **Οργανωτικά και τεχνικά μέτρα ασφάλειας** (ISO 27001-style checklist)

### C. Παράρτημα Copyright & Content Liability
- Δηλώνει ότι τα αρχεία που ανεβάζει το γραφείο είναι νόμιμα και έχει άδεια να τα επεξεργαστεί
- **Indemnification clause**: το γραφείο σε αποζημιώνει αν copyright holder σε μηνύσει
- Δικαίωμα σου να αφαιρέσεις παράνομο περιεχόμενο (DMCA-style takedown)

**Bonus (προαιρετικά αλλά συνιστάται):**
- **Acceptable Use Policy** — τι δεν επιτρέπεται (spam, illegal content)
- **NDA** — αν μοιράζεσαι roadmap ή business-sensitive info
- **Beta Testing Agreement** — αν είναι beta χρήστες

---

## 4. Cyber Insurance — Πρέπει;

### Σύντομη απάντηση: **ΝΑΙ, οπωσδήποτε.**

**Γιατί:**
- Ένα breach μπορεί να κοστίσει €50K-500K+ (νομικά, notifications, forensics, remediation)
- Οι κυρώσεις GDPR φτάνουν στα 4% του τζίρου ή €20M (όποιο μεγαλύτερο)
- Οι πελάτες σου (γραφεία) θα σε μηνύσουν για damages αν τα data τους χαθούν
- **Πολλά γραφεία δεν θα υπογράψουν DPA χωρίς να δουν cyber policy**

### Τι πρέπει να καλύπτει (Ελληνική αγορά):
1. **First-party**:
   - Forensics + incident response
   - Business interruption
   - Data restoration
   - Ransomware payment (αν αποφασίσεις)
2. **Third-party**:
   - GDPR fines defence (αν καλύπτεται στην Ελλάδα — έλεγξε)
   - Notification costs (πελάτες, ΑΠΔΠΧ)
   - Legal defence σε αγωγές πελατών
   - Regulatory investigations
3. **Media liability**: αν χρήστης ανεβάσει copyrighted material

### Ασφαλιστικές Ελλάδας που κάνουν cyber:
- **Interamerican** — έχει προγράμματα cyber για SaaS
- **Ergo** — cyber Fusion
- **Groupama** — cyber SME
- **Ασφαλιστικοί μεσάζοντες**: Marsh Ελλάδας, Aon Ελλάδας, Howden

### Ετήσιο κόστος ενδεικτικά (early stage):
- Cover €500K: €600–1.500/έτος
- Cover €1M: €1.500–3.000/έτος  
- Cover €2M+: €3.000–8.000/έτος

**Recommendation**: Ξεκίνα με €1M, upgrade όταν φτάσεις 20+ tenants.

---

## 5. Πώς να είσαι 100% καλυμμένος από μηνύσεις

**"100% κάλυψη" δεν υπάρχει.** Υπάρχει "εύλογη επιμέλεια" (due diligence). Ένας δικαστής θα εξετάσει αν πήρες τα **λογικά μέτρα** ενός επαγγελματία στη θέση σου.

### Layered defence — 5 επίπεδα προστασίας

#### Επίπεδο 1: Νομικά έγγραφα
- MSA + DPA + Copyright Παράρτημα (§3 παραπάνω)
- Terms κάθε version tagged + click-through acceptance με timestamp + IP → ήδη υπάρχει audit trail στο κώδικα σου
- Cookie consent banner (ήδη υπάρχει)

#### Επίπεδο 2: Τεχνικά μέτρα ασφάλειας (GDPR Άρθρο 32)
Ήδη έχεις:
- ✓ Encryption in transit (HTTPS/SSL)
- ✓ Password hashing (BCrypt)
- ✓ 2FA (TOTP + email code)
- ✓ Rate limiting στο login
- ✓ Audit logs (ποιος-έκανε-τι-πότε)
- ✓ Soft delete + recycle bin
- ✓ GDPR export + anonymize per customer
- ✓ Session lockout after failed attempts

Λείπουν:
- ⚠️ **Encryption at rest** — τα PDFs στο dosk του server rest είναι κρυπτογραφημένα;
- ⚠️ **Off-site encrypted backups** — αν καεί το σπίτι, τι έχεις;
- ⚠️ **Automated penetration testing** — τουλάχιστον 1x/έτος
- ⚠️ **WAF (Web Application Firewall)** στο Cloudflare (Free tier έχει βασικό — Pro/Business έχει bot fight mode)
- ⚠️ **Intrusion Detection** στον server

#### Επίπεδο 3: Οργανωτικά μέτρα
- **Data Breach Response Plan** — γραπτή διαδικασία 72 ωρών
- **Access Control Matrix** — ποιος έχει πρόσβαση σε τι
- **Vendor Management** — σε ποια subprocessors κοινοποιείς data
- **Regular training** — αν έχεις staff
- **Change Management** — deployment approvals

#### Επίπεδο 4: Ασφάλιση
- Cyber liability insurance (§4)
- Επαγγελματική Ευθύνη E&O (Errors & Omissions) — €500–1.500/έτος για SaaS founder
- General Liability — προαιρετικό

#### Επίπεδο 5: Εταιρική δομή
- **ΙΚΕ** ή **ΑΕ** — προσωπική ευθύνη περιορίζεται. Αν είσαι ατομική επιχείρηση, όλη σου η περιουσία στη γραμμή.
- ΓΕΜΗ registration
- Ξεχωριστός τραπεζικός για την εταιρεία
- Ξεχωριστό email domain (info@ vs personal)

### Copyrighted files που ανεβάζουν χρήστες

**Ο νόμος στην Ελλάδα (ΕU Copyright Directive + N. 2121/1993):**
- Πλατφόρμα SaaS θεωρείται συνήθως **"host provider"** → §14 e-Commerce Directive
- **Notice-and-takedown**: αν λάβεις έγκυρη ειδοποίηση και αφαιρέσεις, δεν έχεις ευθύνη
- ΑΝ γνωρίζεις ή έχεις υποχρέωση να γνωρίζεις παράβαση → ευθύνη

**Πώς προστατεύεσαι:**
1. **DMCA-style takedown notice διαδικασία** στο site (dedicated email: dmca@mykalypsis.gr)
2. **Terms clause**: χρήστης δηλώνει ότι έχει άδεια για ό,τι ανεβάζει
3. **Indemnification**: χρήστης σε αποζημιώνει αν copyright holder σε μηνύσει
4. **Audit log**: ποιο user ανέβασε ποιο file πότε — ήδη το έχεις
5. **Delete option**: μπορείς πάντα να αφαιρέσεις — ήδη το έχεις

---

## 6. Immediate action items (ταξινομημένα)

### Εβδομάδα 1
1. **Ραντεβού με δικηγόρο** εξειδικευμένο GDPR + SaaS (~€800-1.500 για initial setup)
2. Ζήτα να συντάξει **MSA + DPA + Copyright Παράρτημα** templates (ή review + adapt αυτά που θα φτιάξω παρακάτω)
3. Παράλληλα, ξεκίνα **cyber liability quote** από 3-4 ασφαλιστικές

### Εβδομάδες 2-4
4. Σύσταση **ΙΚΕ ή ΑΕ** αν είσαι ακόμα ατομική
5. Register **DPO (Data Protection Officer)** — για μικρή επιχείρηση μπορείς να είσαι εσύ, αλλά training-certified
6. Καταχώρηση στην **ΑΠΔΠΧ** αν δεν το έχεις κάνει
7. **Records of Processing Activities** — Word doc, ετοιμάζεται σε 1 μέρα με templates ΑΠΔΠΧ

### Μήνας 2-3
8. **Data Protection Impact Assessment (DPIA)** — για high-risk processing (Ins. data → high-risk)
9. **Migration από home server** σε Hetzner/OVH — €10-40/μήνα, εκθετικά καλύτερη ασφάλεια
10. **Automated backups off-site** (S3-compatible bucket σε άλλο provider — Backblaze B2 €0.005/GB/μήνα)
11. **Penetration testing** — Ελλάδα ~€1.500-3.000 basic

### Ongoing
12. **Version-controlled Terms/Privacy** — κάθε version έχει timestamp, users click-through re-accept
13. **Quarterly security review**
14. **Annual DPO/legal review** αν αλλάζει νομοθεσία

---

## 7. Templates που θα ετοιμάσω για σένα

Θα δημιουργήσω σε επόμενο βήμα (αν το θέλεις):

- `docs/legal/DPA_Template_Greek.docx` — Σύμβαση Επεξεργασίας Δεδομένων, draft
- `docs/legal/MSA_Template_Greek.docx` — Master Service Agreement, draft  
- `docs/legal/Copyright_Addendum_Greek.docx` — Παράρτημα Δικαιωμάτων Πνευματικής Ιδιοκτησίας
- `docs/legal/Data_Breach_Response_Plan.md` — 72-hour procedure
- `docs/legal/Sub_Processors_Register.md` — Trackable list με τι μοιράζεσαι με ποιον
- `docs/legal/Records_of_Processing_Template.docx` — Άρθρο 30 template

**ΞΑΝΑ**: Όλα draft. Δικηγόρος πρέπει να τα προσαρμόσει στην επιχείρησή σου πριν τα υπογράψεις με πελάτη.

---

## 8. Bottom line

**Είσαι έτοιμος να ανοίξεις σε παραγωγή σήμερα;**  
Τεχνικά ναι, νομικά **όχι πλήρως**. Η μεγαλύτερη έκθεση είναι:
- Απουσία DPA (Άρθρο 28 GDPR — κύρωση €10M ή 2% τζίρου)
- Home server (physical security risk)
- Χωρίς cyber insurance (single incident = end of business)

**Ελάχιστα βήματα πριν πρώτο paying customer:**
1. Δικηγόρος + DPA template ✍️
2. Cyber liability policy €1M 🛡️
3. Migration σε cloud provider EU 🌐
4. ΙΚΕ σύσταση (αν είσαι ατομική) 🏢

Χρόνος: 3-6 εβδομάδες
Κόστος: €2.500-5.000 setup + €150-300/μήνα recurring
