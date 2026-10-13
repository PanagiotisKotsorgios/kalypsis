-- KALYPSIS Desktop sandbox demo data
-- This script is intentionally scoped to the local demo database only.
-- It is safe to run once against kalypsis_desktop_sandbox on the isolated desktop sandbox.

CREATE TABLE IF NOT EXISTS demo_seed_meta (
    SeedKey varchar(100) NOT NULL PRIMARY KEY,
    SeededAt datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @demo_seeded = (SELECT COUNT(*) FROM demo_seed_meta WHERE SeedKey = 'full-demo-2026-10');
SET @now = NOW(6);
SET @today = CURDATE();
START TRANSACTION;
SET FOREIGN_KEY_CHECKS = 0;

-- Users and offices
SELECT Id INTO @admin_id FROM users WHERE Email = 'admin' LIMIT 1;
SELECT PasswordHash INTO @admin_hash FROM users WHERE Email = 'admin' LIMIT 1;
SET @demo_hash = '$2a$11$o63.u2rxwVxnnjySqsPTfudO6Er11gzDEzaxqGWdR8wblrqbjjr.i';
UPDATE users SET PasswordHash = @demo_hash, MustChangePassword = 0 WHERE Email = 'admin' AND @demo_seeded = 0;
SET @admin_hash = @demo_hash;
SET @demo_user_id = UUID();
INSERT INTO users (Id, Email, PasswordHash, FirstName, LastName, Role, IsActive, MustChangePassword, CreatedAt)
SELECT @demo_user_id, 'demo@kalypsis.local', @admin_hash, 'Μαρία', 'Δημητρίου', 'AgencyAdmin', 1, 0, @now
WHERE @demo_seeded = 0;
SELECT Id INTO @demo_user_id FROM users WHERE Email = 'demo@kalypsis.local' LIMIT 1;

SET @office_id = UUID();
INSERT INTO agency_offices (Id, Code, Name, Address, City, PostalCode, Phone, Email, ManagerUserId, IsHeadOffice, IsActive, Notes, CreatedAt)
SELECT @office_id, 'DEMO-CENTRAL', 'Γραφείο Demo KALYPSIS', 'Λεωφόρος Κηφισίας 120', 'Αθήνα', '11526', '210 555 0100', 'demo@kalypsis.local', @demo_user_id, 1, 1, 'Πλήρες περιβάλλον επίδειξης με ενδεικτικά δεδομένα.', @now
WHERE @demo_seeded = 0;
SELECT Id INTO @office_id FROM agency_offices WHERE Code = 'DEMO-CENTRAL' LIMIT 1;
SET @office2_id = UUID();
INSERT INTO agency_offices (Id, Code, Name, Address, City, PostalCode, Phone, Email, ManagerUserId, IsHeadOffice, IsActive, Notes, CreatedAt)
SELECT @office2_id, 'DEMO-NORTH', 'Υποκατάστημα Demo Βορείων', 'Αγίου Δημητρίου 18', 'Θεσσαλονίκη', '54634', '2310 555 0200', 'north.demo@kalypsis.local', @demo_user_id, 0, 1, 'Δεύτερο γραφείο επίδειξης για πολλαπλά γραφεία.', @now
WHERE @demo_seeded = 0;
SELECT Id INTO @office2_id FROM agency_offices WHERE Code = 'DEMO-NORTH' LIMIT 1;

-- Roles, groups and permissions
SELECT Id INTO @role_admin FROM roles WHERE Name = 'AgencyAdmin' LIMIT 1;
SELECT Id INTO @role_producer FROM roles WHERE Name = 'Producer' LIMIT 1;
SET @role_demo = UUID();
INSERT INTO roles (Id, Name, IsBuiltIn, CreatedAt) SELECT @role_demo, 'Υποδιαχειριστής Demo', 0, @now WHERE @demo_seeded = 0;
SELECT Id INTO @role_demo FROM roles WHERE Name = 'Υποδιαχειριστής Demo' LIMIT 1;
INSERT INTO role_permissions (Id, RoleId, PermissionKey, CreatedAt)
SELECT UUID(), @role_demo, p.PermissionKey, @now FROM (SELECT 'customers.read' PermissionKey UNION ALL SELECT 'policies.read' UNION ALL SELECT 'claims.read' UNION ALL SELECT 'reports.read' UNION ALL SELECT 'crm.read') p WHERE @demo_seeded = 0;
SET @group_id = UUID();
INSERT INTO `groups` (Id, Name, Description, CreatedAt) SELECT @group_id, 'Ομάδα Demo Πωλήσεων', 'Ενδεικτική ομάδα συνεργατών για δοκιμές CRM.', @now WHERE @demo_seeded = 0;
SELECT Id INTO @group_id FROM `groups` WHERE Name = 'Ομάδα Demo Πωλήσεων' LIMIT 1;
INSERT INTO group_roles (Id, GroupId, RoleId, CreatedAt) SELECT UUID(), @group_id, @role_producer, @now WHERE @demo_seeded = 0;
INSERT INTO user_roles (Id, UserId, RoleId, CreatedAt) SELECT UUID(), @demo_user_id, @role_demo, @now WHERE @demo_seeded = 0;
INSERT INTO user_permission_grants (Id, UserId, PermissionKey, IsGranted, CreatedAt)
SELECT UUID(), @demo_user_id, p.PermissionKey, 1, @now FROM (SELECT 'customers.write' PermissionKey UNION ALL SELECT 'policies.write' UNION ALL SELECT 'crm.write' UNION ALL SELECT 'reports.export') p WHERE @demo_seeded = 0;
INSERT INTO user_groups (Id, UserId, GroupId, CreatedAt) SELECT UUID(), @demo_user_id, @group_id, @now WHERE @demo_seeded = 0;

-- Producers / collaborators
SET @producer1 = UUID(); SET @producer2 = UUID(); SET @producer3 = UUID();
INSERT INTO producers (Id, Code, Name, Email, Phone, AfmVat, HierarchyLevel, OverCommissionCategory, IsActive, Title, ResponsiblePerson, ActivityCode, ActivityLabel, Grade, GradeLabel, PersonKind, WithholdsTaxOnInsurances, PremiumPaidByProducer, HasSignedContract, HoldsInsurerShareOver10Pct, InsurerHoldsProducerOver10Pct, ProvidesImpartialAnalysis, HasExclusiveContract, NonExclusiveNoImpartial, CanDistributeInvestmentProducts, HasKalypsisWebAccess, ReceivesCustomerGdprCopy, CreatedAt)
SELECT @producer1, 'DEMO-P001', 'Αλέξανδρος Μιχαηλίδης', 'alex.michailidis@demo.local', '6944 111 222', '099123456', 1, 'A', 1, 'Συνεργάτης', 'Αλέξανδρος Μιχαηλίδης', '6622', 'Ασφαλιστικός διαμεσολαβητής', 1, 'Κατηγορία Α', 'Φυσικό πρόσωπο', 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, @now WHERE @demo_seeded = 0;
INSERT INTO producers (Id, Code, Name, Email, Phone, AfmVat, HierarchyLevel, OverCommissionCategory, IsActive, Title, ResponsiblePerson, ActivityCode, ActivityLabel, Grade, GradeLabel, PersonKind, WithholdsTaxOnInsurances, PremiumPaidByProducer, HasSignedContract, HoldsInsurerShareOver10Pct, InsurerHoldsProducerOver10Pct, ProvidesImpartialAnalysis, HasExclusiveContract, NonExclusiveNoImpartial, CanDistributeInvestmentProducts, HasKalypsisWebAccess, ReceivesCustomerGdprCopy, CreatedAt)
SELECT @producer2, 'DEMO-P002', 'Ελένη Παπαδοπούλου', 'eleni.papadopoulou@demo.local', '6933 222 333', '088765432', 1, 'B', 1, 'Συνεργάτης', 'Ελένη Παπαδοπούλου', '6622', 'Ασφαλιστικός διαμεσολαβητής', 2, 'Κατηγορία Β', 'Φυσικό πρόσωπο', 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, @now WHERE @demo_seeded = 0;
INSERT INTO producers (Id, Code, Name, Email, Phone, AfmVat, HierarchyLevel, OverCommissionCategory, IsActive, Title, ResponsiblePerson, ActivityCode, ActivityLabel, Grade, GradeLabel, PersonKind, WithholdsTaxOnInsurances, PremiumPaidByProducer, HasSignedContract, HoldsInsurerShareOver10Pct, InsurerHoldsProducerOver10Pct, ProvidesImpartialAnalysis, HasExclusiveContract, NonExclusiveNoImpartial, CanDistributeInvestmentProducts, HasKalypsisWebAccess, ReceivesCustomerGdprCopy, CreatedAt)
SELECT @producer3, 'DEMO-P003', 'Νίκος Αντωνίου & ΣΙΑ ΕΕ', 'partners@antoniou.demo', '210 555 0300', '077654321', 2, 'C', 1, 'Πρακτορείο', 'Νίκος Αντωνίου', '6622', 'Πρακτορείο ασφαλίσεων', 3, 'Κατηγορία Γ', 'Νομικό πρόσωπο', 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 1, @now WHERE @demo_seeded = 0;

-- Insurance carriers and branches
SET @carrier1 = UUID(); SET @carrier2 = UUID(); SET @carrier3 = UUID(); SET @carrier4 = UUID();
INSERT INTO insurance_companies (Id, Code, Name, Country, Website, ContactName, ContactEmail, ContactPhone, AfmVat, IsActive, Notes, Title, Address, City, PostalCode, Phones, TaxOffice, LedgerCode, LogoUrl, PremiumRemitMode, RemitPeriodMode, RemitPeriodLabel, HeadOfficeTaxWithheld, IsTaxSplit, IsOnKalypsisWeb, PortalCarrierCode, CreatedAt)
SELECT @carrier1, 'DEMO-NP', 'Νέος Ποσειδώνας', 'Ελλάδα', 'https://demo.neosposeidonas.example', 'Γραμμή συνεργατών', 'partners@neosposeidonas.demo', '210 555 1001', '099111111', 1, 'Demo ασφαλιστική εταιρεία.', 'ΝΕΟΣ ΠΟΣΕΙΔΩΝΑΣ', 'Λεωφ. Συγγρού 100', 'Αθήνα', '11741', '210 555 1001', 'ΔΟΥ Καλλιθέας', 'NP-DEMO', NULL, 'Μηνιαία', 'Μηνιαία', '30 ημέρες', 0, 0, 1, 'DEMO-NP', @now WHERE @demo_seeded = 0;
INSERT INTO insurance_companies (Id, Code, Name, Country, Website, ContactName, ContactEmail, ContactPhone, AfmVat, IsActive, Notes, Title, Address, City, PostalCode, Phones, TaxOffice, LedgerCode, LogoUrl, PremiumRemitMode, RemitPeriodMode, RemitPeriodLabel, HeadOfficeTaxWithheld, IsTaxSplit, IsOnKalypsisWeb, PortalCarrierCode, CreatedAt)
SELECT @carrier2, 'DEMO-MIN', 'Μινέττα', 'Ελλάδα', 'https://demo.minetta.example', 'Κέντρο παραγωγής', 'partners@minetta.demo', '210 555 1002', '099222222', 1, 'Demo ασφαλιστική εταιρεία.', 'ΜΙΝΕΤΤΑ', 'Κηφισίας 80', 'Αθήνα', '11526', '210 555 1002', 'ΔΟΥ Αμαρουσίου', 'MIN-DEMO', NULL, 'Μηνιαία', 'Μηνιαία', '45 ημέρες', 0, 1, 1, 'DEMO-MIN', @now WHERE @demo_seeded = 0;
INSERT INTO insurance_companies (Id, Code, Name, Country, Website, ContactName, ContactEmail, ContactPhone, AfmVat, IsActive, Notes, Title, Address, City, PostalCode, Phones, TaxOffice, LedgerCode, LogoUrl, PremiumRemitMode, RemitPeriodMode, RemitPeriodLabel, HeadOfficeTaxWithheld, IsTaxSplit, IsOnKalypsisWeb, PortalCarrierCode, CreatedAt)
SELECT @carrier3, 'DEMO-ERGO', 'ERGO Ασφαλιστική', 'Ελλάδα', 'https://demo.ergo.example', 'Ομάδα συνεργατών', 'partners@ergo.demo', '210 555 1003', '099333333', 1, 'Demo ασφαλιστική εταιρεία.', 'ERGO', 'Μιχαλακοπούλου 20', 'Αθήνα', '11528', '210 555 1003', 'ΔΟΥ ΙΖ Αθηνών', 'ERGO-DEMO', NULL, 'Μηνιαία', 'Τριμηνιαία', '60 ημέρες', 0, 0, 1, 'DEMO-ERGO', @now WHERE @demo_seeded = 0;
INSERT INTO insurance_companies (Id, Code, Name, Country, Website, ContactName, ContactEmail, ContactPhone, AfmVat, IsActive, Notes, Title, Address, City, PostalCode, Phones, TaxOffice, LedgerCode, LogoUrl, PremiumRemitMode, RemitPeriodMode, RemitPeriodLabel, HeadOfficeTaxWithheld, IsTaxSplit, IsOnKalypsisWeb, PortalCarrierCode, CreatedAt)
SELECT @carrier4, 'DEMO-INTER', 'Interlife', 'Ελλάδα', 'https://demo.interlife.example', 'Κέντρο πρακτόρων', 'partners@interlife.demo', '2310 555 1004', '099444444', 1, 'Demo ασφαλιστική εταιρεία.', 'INTERLIFE', '26ης Οκτωβρίου 10', 'Θεσσαλονίκη', '54627', '2310 555 1004', 'ΔΟΥ Θεσσαλονίκης', 'INT-DEMO', NULL, 'Μηνιαία', 'Μηνιαία', '30 ημέρες', 0, 0, 1, 'DEMO-INTER', @now WHERE @demo_seeded = 0;
SELECT Id INTO @carrier1 FROM insurance_companies WHERE Code='DEMO-NP' LIMIT 1; SELECT Id INTO @carrier2 FROM insurance_companies WHERE Code='DEMO-MIN' LIMIT 1; SELECT Id INTO @carrier3 FROM insurance_companies WHERE Code='DEMO-ERGO' LIMIT 1; SELECT Id INTO @carrier4 FROM insurance_companies WHERE Code='DEMO-INTER' LIMIT 1;
INSERT INTO insurance_company_contacts (Id, InsuranceCompanyId, LineOfBusiness, ContactName, CreatedAt)
SELECT UUID(), @carrier1, 'Αυτοκίνητο', 'Τμήμα εκδόσεων Demo', @now WHERE @demo_seeded = 0;
INSERT INTO insurance_company_contacts (Id, InsuranceCompanyId, LineOfBusiness, ContactName, CreatedAt)
SELECT UUID(), @carrier2, 'Κατοικία', 'Τμήμα περιουσίας Demo', @now WHERE @demo_seeded = 0;
INSERT INTO company_parameter_items (Id, InsuranceCompanyId, Kind, Code, Name, IsActive, DisplayOrder, Source, CreatedAt)
SELECT UUID(), @carrier1, 1, 'AUTO-COMP', 'Πλήρης κάλυψη αυτοκινήτου', 1, 1, 'Demo seed', @now WHERE @demo_seeded = 0;
INSERT INTO company_parameter_items (Id, InsuranceCompanyId, Kind, Code, Name, IsActive, DisplayOrder, Source, CreatedAt)
SELECT UUID(), @carrier1, 2, 'GLASS', 'Θραύση κρυστάλλων', 1, 2, 'Demo seed', @now WHERE @demo_seeded = 0;
INSERT INTO carrier_bridge_configs (Id, InsuranceCompanyId, FileType, RecordType, ConfigJson, Version, Enabled, CreatedAt)
SELECT UUID(), @carrier1, 'CSV', 'Παραγωγή', '{"delimiter":";","encoding":"UTF-8"}', 1, 1, @now WHERE @demo_seeded = 0;
INSERT INTO carrier_parametric_files (Id, InsuranceCompanyCode, InsuranceCompanyName, Kind, Version, IsActive, CreatedAt)
SELECT UUID(), 'DEMO-NP', 'Νέος Ποσειδώνας', 'Κλάδοι και καλύψεις', '2026.10-demo', 1, @now WHERE @demo_seeded = 0;

SET @branch_auto = UUID(); SET @branch_home = UUID(); SET @branch_health = UUID(); SET @branch_boat = UUID();
INSERT INTO branches (Id, Code, Name, Description, FieldsJson, CoveragesJson, IsActive, DisplayOrder, CreatedAt)
SELECT @branch_auto, 'AUTO', 'Αυτοκίνητο', 'Ασφάλιση οχημάτων', '{"plate":true,"brand":true,"model":true}', '["Αστική ευθύνη","Θραύση κρυστάλλων","Οδική βοήθεια"]', 1, 1, @now WHERE @demo_seeded = 0;
INSERT INTO branches (Id, Code, Name, Description, FieldsJson, CoveragesJson, IsActive, DisplayOrder, CreatedAt)
SELECT @branch_home, 'HOME', 'Κατοικία', 'Ασφάλιση κατοικίας και περιουσίας', '{"address":true,"area":true}', '["Πυρός","Κλοπή","Σεισμός"]', 1, 2, @now WHERE @demo_seeded = 0;
INSERT INTO branches (Id, Code, Name, Description, FieldsJson, CoveragesJson, IsActive, DisplayOrder, CreatedAt)
SELECT @branch_health, 'HEALTH', 'Υγεία', 'Ατομική και οικογενειακή υγεία', '{"birthDate":true}', '["Νοσοκομειακή περίθαλψη","Εξωνοσοκομειακή περίθαλψη"]', 1, 3, @now WHERE @demo_seeded = 0;
INSERT INTO branches (Id, Code, Name, Description, FieldsJson, CoveragesJson, IsActive, DisplayOrder, CreatedAt)
SELECT @branch_boat, 'BOAT', 'Σκάφη', 'Ασφάλιση σκαφών', '{"vesselType":true}', '["Αστική ευθύνη","Ίδιες ζημιές"]', 1, 4, @now WHERE @demo_seeded = 0;

-- Customers, contacts, family and assets
SET @customer1 = UUID(); SET @customer2 = UUID(); SET @customer3 = UUID(); SET @customer4 = UUID(); SET @customer5 = UUID();
INSERT INTO customers (Id, Kind, CustomerCode, CustomerCategory, IsInactive, FirstName, LastName, LegalName, DistinctiveTitle, AfmVat, TaxOffice, LegalForm, Occupation, Gender, MaritalStatus, ChildrenCount, IdNumber, Email, Phone, MobilePhone, PreferredContactMethod, SendSms, SendEmail, DoNotContact, IsInfluenceCenter, Address, City, PostalCode, Region, Country, BirthDate, Notes, ProducerId, AgencyProducerId, WebsiteUrl, Email2, FacebookUrl, MobilePhone2, GdprConsentOk, GdprMarketingOk, HasNeedsForm, HasProvidedCandidates, InformedAboutOtherPrograms, CreatedAt)
SELECT @customer1, 'Φυσικό πρόσωπο', 'DEMO-C001', 'Λιανική', 0, 'Χάρης', 'Μπερτσιάς', NULL, NULL, '123456789', 'ΔΟΥ Νέας Σμύρνης', NULL, 'Μηχανικός', 'Άνδρας', 'Έγγαμος', 2, 'ΑΖ123456', 'charis.bertsias@demo.local', '210 555 1101', '6986 788 178', 'Email', 1, 1, 0, 0, 'Ακτής 12', 'Νέος Ποσειδώνας', '17562', 'Αττική', 'Ελλάδα', '1984-05-18', 'Demo πελάτης με πλήρες προφίλ και όχημα.', @producer1, @producer3, 'https://charis-demo.example', 'charis.alt@demo.local', NULL, '6986 788 179', 1, 1, 1, 1, 1, @now WHERE @demo_seeded = 0;
INSERT INTO customers (Id, Kind, CustomerCode, CustomerCategory, IsInactive, FirstName, LastName, AfmVat, TaxOffice, Occupation, Gender, MaritalStatus, ChildrenCount, IdNumber, Email, Phone, MobilePhone, PreferredContactMethod, SendSms, SendEmail, DoNotContact, IsInfluenceCenter, Address, City, PostalCode, Region, Country, BirthDate, Notes, ProducerId, GdprConsentOk, GdprMarketingOk, HasNeedsForm, HasProvidedCandidates, InformedAboutOtherPrograms, CreatedAt)
SELECT @customer2, 'Φυσικό πρόσωπο', 'DEMO-C002', 'Λιανική', 0, 'Μαρία', 'Παπαδοπούλου', '234567890', 'ΔΟΥ Αμαρουσίου', 'Λογίστρια', 'Γυναίκα', 'Άγαμη', 0, 'ΑΒ234567', 'maria.papadopoulou@demo.local', '210 555 1102', '6977 222 333', 'Τηλέφωνο', 1, 1, 0, 0, 'Ερμού 45', 'Αθήνα', '10563', 'Αττική', 'Ελλάδα', '1990-11-02', 'Demo πελάτης κατοικίας.', @producer2, 1, 1, 1, 0, 1, @now WHERE @demo_seeded = 0;
INSERT INTO customers (Id, Kind, CustomerCode, CustomerCategory, IsInactive, FirstName, LastName, AfmVat, Occupation, Gender, MaritalStatus, IdNumber, Email, Phone, MobilePhone, PreferredContactMethod, SendSms, SendEmail, DoNotContact, IsInfluenceCenter, Address, City, PostalCode, Region, Country, BirthDate, Notes, ProducerId, GdprConsentOk, GdprMarketingOk, HasNeedsForm, HasProvidedCandidates, InformedAboutOtherPrograms, CreatedAt)
SELECT @customer3, 'Φυσικό πρόσωπο', 'DEMO-C003', 'Επαγγελματίας', 0, 'Γιώργος', 'Αντωνίου', '345678901', 'Έμπορος', 'Άνδρας', 'Έγγαμος', 'ΑΓ345678', 'giorgos.antoniou@demo.local', '2310 555 1103', '6944 333 444', 'Email', 1, 1, 0, 0, 'Τσιμισκή 88', 'Θεσσαλονίκη', '54621', 'Κεντρική Μακεδονία', 'Ελλάδα', '1978-02-14', 'Demo πελάτης υγείας.', @producer3, 1, 0, 1, 1, 1, @now WHERE @demo_seeded = 0;
INSERT INTO customers (Id, Kind, CustomerCode, CustomerCategory, IsInactive, FirstName, LastName, AfmVat, Occupation, Gender, IdNumber, Email, Phone, MobilePhone, PreferredContactMethod, SendSms, SendEmail, DoNotContact, IsInfluenceCenter, Address, City, PostalCode, Region, Country, BirthDate, Notes, ProducerId, GdprConsentOk, GdprMarketingOk, HasNeedsForm, HasProvidedCandidates, InformedAboutOtherPrograms, CreatedAt)
SELECT @customer4, 'Φυσικό πρόσωπο', 'DEMO-C004', 'Λιανική', 0, 'Σοφία', 'Γεωργίου', '456789012', 'Εκπαιδευτικός', 'Γυναίκα', 'ΑΔ456789', 'sofia.georgiou@demo.local', '210 555 1104', '6955 444 555', 'SMS', 1, 1, 0, 0, 'Πατησίων 60', 'Αθήνα', '10434', 'Αττική', 'Ελλάδα', '1987-07-21', 'Demo πελάτης με ανοιχτή ζημιά.', @producer1, 1, 1, 1, 0, 1, @now WHERE @demo_seeded = 0;
INSERT INTO customers (Id, Kind, CustomerCode, CustomerCategory, IsInactive, LegalName, DistinctiveTitle, AfmVat, TaxOffice, LegalForm, BusinessActivity, ActivityCode, Email, Phone, MobilePhone, PreferredContactMethod, SendSms, SendEmail, DoNotContact, IsInfluenceCenter, Address, City, PostalCode, Region, Country, Notes, ProducerId, GdprConsentOk, GdprMarketingOk, HasNeedsForm, HasProvidedCandidates, InformedAboutOtherPrograms, CreatedAt)
SELECT @customer5, 'Νομικό πρόσωπο', 'DEMO-C005', 'Επιχείρηση', 0, 'Τεχνική Δομή Α.Ε.', 'Τεχνική Δομή', '567890123', 'ΔΟΥ ΦΑΕ Αθηνών', 'ΑΕ', 'Τεχνικά έργα', '4120', 'info@techniki-domi.demo', '210 555 1105', '6977 555 666', 'Email', 1, 1, 0, 0, 'Βουλιαγμένης 220', 'Άλιμος', '17456', 'Αττική', 'Ελλάδα', 'Demo εταιρικός πελάτης.', @producer3, 1, 1, 1, 1, 1, @now WHERE @demo_seeded = 0;
SELECT Id INTO @customer1 FROM customers WHERE CustomerCode='DEMO-C001' LIMIT 1; SELECT Id INTO @customer2 FROM customers WHERE CustomerCode='DEMO-C002' LIMIT 1; SELECT Id INTO @customer3 FROM customers WHERE CustomerCode='DEMO-C003' LIMIT 1; SELECT Id INTO @customer4 FROM customers WHERE CustomerCode='DEMO-C004' LIMIT 1; SELECT Id INTO @customer5 FROM customers WHERE CustomerCode='DEMO-C005' LIMIT 1;
INSERT INTO customer_contacts (Id, CustomerId, Kind, Label, FullName, Email, Phone, MobilePhone, IsPrimary, Notes, CreatedAt)
SELECT UUID(), @customer1, 'Σύζυγος', 'Επικοινωνία οικογένειας', 'Άννα Μπερτσιά', 'anna.bertsias@demo.local', '210 555 1106', '6988 111 222', 0, 'Εναλλακτική επικοινωνία.', @now WHERE @demo_seeded = 0;
INSERT INTO customer_contacts (Id, CustomerId, Kind, Label, FullName, Email, Phone, MobilePhone, IsPrimary, Notes, CreatedAt)
SELECT UUID(), @customer5, 'Λογιστήριο', 'Εταιρική επικοινωνία', 'Κώστας Λαμπρόπουλος', 'accounting@techniki-domi.demo', '210 555 1107', '6977 666 777', 1, 'Υπεύθυνος λογιστηρίου.', @now WHERE @demo_seeded = 0;
INSERT INTO customer_family (Id, CustomerId, Relation, FullName, BirthDate, Gender, Amka, IsBeneficiary, BeneficiarySharePercent, Notes, AfmVat, Occupation, Email, MobilePhone, CanReceiveMarketing, CreatedAt)
SELECT UUID(), @customer1, 'Σύζυγος', 'Άννα Μπερτσιά', '1985-08-30', 'Γυναίκα', '01018512345', 1, 50, 'Demo μέλος οικογένειας.', '111222333', 'Αρχιτέκτονας', 'anna.bertsias@demo.local', '6988 111 222', 1, @now WHERE @demo_seeded = 0;
INSERT INTO customer_family (Id, CustomerId, Relation, FullName, BirthDate, Gender, IsBeneficiary, BeneficiarySharePercent, Notes, Occupation, CanReceiveMarketing, CreatedAt)
SELECT UUID(), @customer1, 'Τέκνο', 'Νικόλαος Μπερτσιάς', '2014-03-12', 'Άνδρας', 1, 25, 'Demo παιδί.', 'Μαθητής', 0, @now WHERE @demo_seeded = 0;
SET @asset1 = UUID(); SET @asset2 = UUID(); SET @asset3 = UUID(); SET @asset4 = UUID();
INSERT INTO customer_assets (Id, CustomerId, AssetKind, Description, Address, City, PostalCode, Country, Plate, Brand, Model, YearOfConstruction, EngineCc, Value, AreaSquareMeters, IsInsuredWithUs, CurrentCarrierName, CurrentPolicyExpiresOn, InterestScore, Notes, CreatedAt)
SELECT @asset1, @customer1, 'Όχημα', 'Toyota Yaris 1.5 Hybrid', NULL, 'Νέος Ποσειδώνας', '17562', 'Ελλάδα', 'ΜΕΒ8677', 'Toyota', 'Yaris', 2022, 1490, 18500, NULL, 1, 'Νέος Ποσειδώνας', '2027-01-15', 90, 'Κύριο όχημα demo.', @now WHERE @demo_seeded = 0;
INSERT INTO customer_assets (Id, CustomerId, AssetKind, Description, Address, City, PostalCode, Country, Plate, Brand, Model, YearOfConstruction, EngineCc, Value, IsInsuredWithUs, CurrentCarrierName, CurrentPolicyExpiresOn, InterestScore, Notes, CreatedAt)
SELECT @asset2, @customer2, 'Όχημα', 'Peugeot 208', NULL, 'Αθήνα', '10563', 'Ελλάδα', 'ΚΖΑ2080', 'Peugeot', '208', 2021, 1199, 14500, 1, 'Μινέττα', '2026-12-20', 72, 'Δεύτερο όχημα demo.', @now WHERE @demo_seeded = 0;
INSERT INTO customer_assets (Id, CustomerId, AssetKind, Description, Address, City, PostalCode, Country, Plate, Brand, Model, YearOfConstruction, EngineCc, Value, AreaSquareMeters, IsInsuredWithUs, CurrentCarrierName, CurrentPolicyExpiresOn, InterestScore, Notes, CreatedAt)
SELECT @asset3, @customer3, 'Κατοικία', 'Διαμέρισμα 3ου ορόφου', 'Τσιμισκή 88', 'Θεσσαλονίκη', '54621', 'Ελλάδα', NULL, NULL, NULL, 2008, NULL, 185000, 120, 1, 'ERGO Ασφαλιστική', '2027-02-01', 64, 'Περιουσιακό στοιχείο demo.', @now WHERE @demo_seeded = 0;
INSERT INTO customer_assets (Id, CustomerId, AssetKind, Description, Address, City, PostalCode, Country, Value, AreaSquareMeters, ConstructionYear, ConstructionType, BusinessActivity, IsInsuredWithUs, CurrentCarrierName, CurrentPolicyExpiresOn, InterestScore, Notes, CreatedAt)
SELECT @asset4, @customer5, 'Επιχείρηση', 'Κτίριο και εξοπλισμός τεχνικής εταιρείας', 'Βουλιαγμένης 220', 'Άλιμος', '17456', 'Ελλάδα', 640000, 980, 2010, 'Σκυρόδεμα', 'Τεχνικά έργα', 0, NULL, '2026-11-30', 84, 'Εταιρικό περιουσιακό στοιχείο.', @now WHERE @demo_seeded = 0;

-- Policies and related insurance activity
SET @policy1 = UUID(); SET @policy2 = UUID(); SET @policy3 = UUID(); SET @policy4 = UUID();
INSERT INTO policies (Id, PolicyNumber, ApplicationNumber, InsuranceCompanyId, CustomerId, ContractPartyCustomerId, ProducerId, BranchId, CreatedByUserId, LineOfBusiness, CoverCode, Plate, Brand, Model, YearOfConstruction, EngineCc, EffectiveFrom, EffectiveTo, IssuedAt, Status, GrossPremium, NetPremium, VatAmount, StampDutyAmount, InsuranceContributionAmount, OtherChargesAmount, PremiumIncludesVat, Commission, Currency, PaymentFrequency, PaymentCollectionMethod, SpecialCommissionPercent, SpecialLevelPercentsJson, SpecsJson, NextRenewalDate, DeliveredAt, DeliveredTo, DeliveryMethod, Characteristic, RemainingPremium, RetainCommissionsOnRenewal, RetainDocumentNumberOnRenewal, RetainSpecialCommissionsOnRenewal, PaidDirectlyToCarrier, Notes, CreatedAt)
SELECT @policy1, 'DEMO-POL-0001', 'DEMO-APP-0001', @carrier1, @customer1, @customer1, @producer1, @branch_auto, @demo_user_id, 'Αυτοκίνητο', 'AUTO-FULL', 'ΜΕΒ8677', 'Toyota', 'Yaris', 2022, 1490, DATE_SUB(@today, INTERVAL 9 MONTH), DATE_ADD(@today, INTERVAL 3 MONTH), DATE_SUB(@today, INTERVAL 9 MONTH), 'Ενεργό', 640.00, 520.33, 119.67, 0.00, 0.00, 0.00, 1, 96.00, 'EUR', 12, 'Πάγια εντολή', 18.00, '{"agency":15,"producer":18}', '{"driver":"Χάρης Μπερτσιάς","use":"Ιδιωτική χρήση"}', DATE_ADD(@today, INTERVAL 3 MONTH), DATE_SUB(@today, INTERVAL 9 MONTH), 'Χάρης Μπερτσιάς', 'Ηλεκτρονικό ταχυδρομείο', 'Ανανέωση', 160.00, 1, 1, 1, 0, 'Ενεργό demo συμβόλαιο αυτοκινήτου.', @now WHERE @demo_seeded = 0;
INSERT INTO policies (Id, PolicyNumber, ApplicationNumber, InsuranceCompanyId, CustomerId, ContractPartyCustomerId, ProducerId, BranchId, CreatedByUserId, LineOfBusiness, CoverCode, Plate, Brand, Model, YearOfConstruction, EngineCc, EffectiveFrom, EffectiveTo, IssuedAt, Status, GrossPremium, NetPremium, VatAmount, PremiumIncludesVat, Commission, Currency, PaymentFrequency, PaymentCollectionMethod, NextRenewalDate, DeliveredAt, DeliveredTo, DeliveryMethod, Characteristic, RemainingPremium, RetainCommissionsOnRenewal, RetainDocumentNumberOnRenewal, RetainSpecialCommissionsOnRenewal, PaidDirectlyToCarrier, Notes, CreatedAt)
SELECT @policy2, 'DEMO-POL-0002', 'DEMO-APP-0002', @carrier2, @customer2, @customer2, @producer2, @branch_auto, @demo_user_id, 'Αυτοκίνητο', 'AUTO-BASIC', 'ΚΖΑ2080', 'Peugeot', '208', 2021, 1199, DATE_SUB(@today, INTERVAL 2 MONTH), DATE_ADD(@today, INTERVAL 10 MONTH), DATE_SUB(@today, INTERVAL 2 MONTH), 'Ενεργό', 420.00, 341.46, 78.54, 1, 63.00, 'EUR', 4, 'Χρεωστική κάρτα', DATE_ADD(@today, INTERVAL 10 MONTH), DATE_SUB(@today, INTERVAL 2 MONTH), 'Μαρία Παπαδοπούλου', 'Email', 'Νέο', 315.00, 1, 1, 1, 0, 'Συμβόλαιο με τριμηνιαίες δόσεις.', @now WHERE @demo_seeded = 0;
INSERT INTO policies (Id, PolicyNumber, ApplicationNumber, InsuranceCompanyId, CustomerId, ContractPartyCustomerId, ProducerId, BranchId, CreatedByUserId, LineOfBusiness, CoverCode, EffectiveFrom, EffectiveTo, IssuedAt, Status, GrossPremium, NetPremium, VatAmount, PremiumIncludesVat, Commission, Currency, PaymentFrequency, PaymentCollectionMethod, NextRenewalDate, DeliveredAt, DeliveredTo, DeliveryMethod, Characteristic, RemainingPremium, RetainCommissionsOnRenewal, RetainDocumentNumberOnRenewal, RetainSpecialCommissionsOnRenewal, PaidDirectlyToCarrier, Notes, CreatedAt)
SELECT @policy3, 'DEMO-POL-0003', 'DEMO-APP-0003', @carrier3, @customer3, @customer3, @producer3, @branch_home, @demo_user_id, 'Κατοικία', 'HOME-COMP', DATE_SUB(@today, INTERVAL 5 MONTH), DATE_ADD(@today, INTERVAL 7 MONTH), DATE_SUB(@today, INTERVAL 5 MONTH), 'Ενεργό', 980.00, 790.32, 189.68, 1, 147.00, 'EUR', 1, 'Τραπεζική μεταφορά', DATE_ADD(@today, INTERVAL 7 MONTH), DATE_SUB(@today, INTERVAL 5 MONTH), 'Γιώργος Αντωνίου', 'Email', 'Νέο', 490.00, 1, 1, 1, 1, 'Πλήρες συμβόλαιο κατοικίας.', @now WHERE @demo_seeded = 0;
INSERT INTO policies (Id, PolicyNumber, ApplicationNumber, InsuranceCompanyId, CustomerId, ContractPartyCustomerId, ProducerId, BranchId, CreatedByUserId, LineOfBusiness, CoverCode, EffectiveFrom, EffectiveTo, IssuedAt, Status, GrossPremium, NetPremium, VatAmount, PremiumIncludesVat, Commission, Currency, PaymentFrequency, PaymentCollectionMethod, NextRenewalDate, DeliveredAt, DeliveredTo, DeliveryMethod, Characteristic, RemainingPremium, RetainCommissionsOnRenewal, RetainDocumentNumberOnRenewal, RetainSpecialCommissionsOnRenewal, PaidDirectlyToCarrier, Notes, CreatedAt)
SELECT @policy4, 'DEMO-POL-0004', 'DEMO-APP-0004', @carrier4, @customer4, @customer4, @producer1, @branch_health, @demo_user_id, 'Υγεία', 'HEALTH-FAMILY', DATE_SUB(@today, INTERVAL 1 MONTH), DATE_ADD(@today, INTERVAL 11 MONTH), DATE_SUB(@today, INTERVAL 1 MONTH), 'Σε αναμονή', 1250.00, 1008.06, 241.94, 1, 187.50, 'EUR', 1, 'Εκκρεμεί πληρωμή', DATE_ADD(@today, INTERVAL 11 MONTH), NULL, NULL, NULL, 'Προσφορά', 1250.00, 1, 1, 1, 0, 'Εκκρεμής έκδοση demo.', @now WHERE @demo_seeded = 0;
SELECT Id INTO @policy1 FROM policies WHERE PolicyNumber='DEMO-POL-0001' LIMIT 1; SELECT Id INTO @policy2 FROM policies WHERE PolicyNumber='DEMO-POL-0002' LIMIT 1; SELECT Id INTO @policy3 FROM policies WHERE PolicyNumber='DEMO-POL-0003' LIMIT 1; SELECT Id INTO @policy4 FROM policies WHERE PolicyNumber='DEMO-POL-0004' LIMIT 1;
INSERT INTO policy_covers (Id, PolicyId, CoverCode, CoverName, SumInsured, Deductible, Premium, NetPremium, CommissionPercent, CommissionAmount, DisplayOrder, IsActive, Notes, CreatedAt)
SELECT UUID(), @policy1, 'LIABILITY', 'Αστική ευθύνη', 1000000, 0, 240, 195, 18, 43.20, 1, 1, 'Υποχρεωτική κάλυψη.', @now WHERE @demo_seeded = 0;
INSERT INTO policy_covers (Id, PolicyId, CoverCode, CoverName, SumInsured, Deductible, Premium, NetPremium, CommissionPercent, CommissionAmount, DisplayOrder, IsActive, Notes, CreatedAt)
SELECT UUID(), @policy1, 'GLASS', 'Θραύση κρυστάλλων', 2000, 0, 85, 69, 18, 15.30, 2, 1, NULL, @now WHERE @demo_seeded = 0;
INSERT INTO policy_covers (Id, PolicyId, CoverCode, CoverName, SumInsured, Deductible, Premium, NetPremium, CommissionPercent, CommissionAmount, DisplayOrder, IsActive, Notes, CreatedAt)
SELECT UUID(), @policy1, 'ROAD', 'Οδική βοήθεια', 0, 0, 55, 44, 18, 9.90, 3, 1, NULL, @now WHERE @demo_seeded = 0;
INSERT INTO policy_covers (Id, PolicyId, CoverCode, CoverName, SumInsured, Deductible, Premium, NetPremium, CommissionPercent, CommissionAmount, DisplayOrder, IsActive, Notes, CreatedAt)
SELECT UUID(), @policy3, 'FIRE', 'Πυρός και σεισμού', 185000, 500, 650, 524, 15, 97.50, 1, 1, 'Κάλυψη κατοικίας.', @now WHERE @demo_seeded = 0;
INSERT INTO policy_covers (Id, PolicyId, CoverCode, CoverName, SumInsured, Deductible, Premium, NetPremium, CommissionPercent, CommissionAmount, DisplayOrder, IsActive, Notes, CreatedAt)
SELECT UUID(), @policy3, 'THEFT', 'Κλοπή περιεχομένου', 25000, 250, 330, 266, 15, 49.50, 2, 1, NULL, @now WHERE @demo_seeded = 0;
INSERT INTO policy_objects (Id, PolicyId, ObjectKind, Reference, Description, Value, SpecsJson, DisplayOrder, CreatedAt)
SELECT UUID(), @policy1, 'Όχημα', 'ΜΕΒ8677', 'Toyota Yaris 1.5 Hybrid', 18500, '{"brand":"Toyota","model":"Yaris","year":2022}', 1, @now WHERE @demo_seeded = 0;
INSERT INTO policy_objects (Id, PolicyId, ObjectKind, Reference, Description, Value, SpecsJson, DisplayOrder, CreatedAt)
SELECT UUID(), @policy3, 'Κατοικία', 'HOME-DEMO-001', 'Διαμέρισμα Νέα Παραλία', 185000, '{"area":120,"floor":3}', 1, @now WHERE @demo_seeded = 0;
INSERT INTO policy_installments (Id, PolicyId, InstallmentNumber, DueDate, Amount, PaidAmount, PaidOn, Status, Reference, Notes, CreatedAt)
SELECT UUID(), @policy1, 1, DATE_SUB(@today, INTERVAL 8 MONTH), 160, 160, DATE_SUB(@today, INTERVAL 8 MONTH), 'Πληρωμένη', 'DEMO-RCPT-0001', 'Πρώτη δόση.', @now WHERE @demo_seeded = 0;
INSERT INTO policy_installments (Id, PolicyId, InstallmentNumber, DueDate, Amount, PaidAmount, PaidOn, Status, Reference, Notes, CreatedAt)
SELECT UUID(), @policy1, 2, DATE_SUB(@today, INTERVAL 5 MONTH), 160, 160, DATE_SUB(@today, INTERVAL 5 MONTH), 'Πληρωμένη', 'DEMO-RCPT-0002', 'Δεύτερη δόση.', @now WHERE @demo_seeded = 0;
INSERT INTO policy_installments (Id, PolicyId, InstallmentNumber, DueDate, Amount, PaidAmount, PaidOn, Status, Reference, Notes, CreatedAt)
SELECT UUID(), @policy1, 3, DATE_SUB(@today, INTERVAL 2 MONTH), 160, 0, NULL, 'Εκκρεμής', 'DEMO-DUE-0003', 'Εκκρεμής δόση για demo.', @now WHERE @demo_seeded = 0;
INSERT INTO policy_installments (Id, PolicyId, InstallmentNumber, DueDate, Amount, PaidAmount, PaidOn, Status, Reference, Notes, CreatedAt)
SELECT UUID(), @policy2, 1, DATE_SUB(@today, INTERVAL 1 MONTH), 105, 105, DATE_SUB(@today, INTERVAL 1 MONTH), 'Πληρωμένη', 'DEMO-RCPT-0003', NULL, @now WHERE @demo_seeded = 0;
INSERT INTO policy_commission_splits (Id, PolicyId, ProducerId, SharePercent, Amount, Notes, CreatedAt)
SELECT UUID(), @policy1, @producer1, 60, 57.60, 'Άμεση προμήθεια συνεργάτη.', @now WHERE @demo_seeded = 0;
INSERT INTO policy_commission_splits (Id, PolicyId, ProducerId, SharePercent, Amount, Notes, CreatedAt)
SELECT UUID(), @policy2, @producer2, 55, 34.65, 'Άμεση προμήθεια συνεργάτη.', @now WHERE @demo_seeded = 0;
INSERT INTO policy_cover_adjustments (Id, PolicyId, AdjustmentKind, EffectiveFrom, Description, PremiumChange, CreatedAt)
SELECT UUID(), @policy1, 'Πρόσθετη πράξη', DATE_SUB(@today, INTERVAL 4 MONTH), 'Προσθήκη οδικής βοήθειας.', 55, @now WHERE @demo_seeded = 0;
INSERT INTO policy_documents (Id, PolicyId, DocumentKind, Title, StoredFileName, OriginalFileName, ContentType, SizeBytes, UploadedByUserId, CreatedAt)
SELECT UUID(), @policy1, 'Ασφαλιστήριο', 'Ασφαλιστήριο DEMO-POL-0001', 'DEMO-POL-0001.pdf', 'DEMO-POL-0001.pdf', 'application/pdf', 184320, @demo_user_id, @now WHERE @demo_seeded = 0;
INSERT INTO policy_attachments (Id, PolicyId, OriginalFileName, StoredFileName, ContentType, SizeBytes, UploadedByEmail, CreatedAt)
SELECT UUID(), @policy1, 'ασφαλιστήριο-demo.pdf', 'demo-policy-0001.pdf', 'application/pdf', 184320, 'demo@kalypsis.local', @now WHERE @demo_seeded = 0;
INSERT INTO endorsements (Id, EndorsementNumber, PolicyId, EffectiveFrom, Kind, PremiumChange, Description, Status, CreatedAt)
SELECT UUID(), 'DEMO-END-0001', @policy1, DATE_SUB(@today, INTERVAL 4 MONTH), 'Προσθήκη κάλυψης', 55, 'Προσθήκη οδικής βοήθειας.', 'Ολοκληρωμένη', @now WHERE @demo_seeded = 0;
INSERT INTO cancellations (Id, CancellationNumber, PolicyId, EffectiveFrom, Reason, RefundAmount, RequestedBy, Notes, CreatedAt)
SELECT UUID(), 'DEMO-CAN-0001', @policy2, DATE_ADD(@today, INTERVAL 20 DAY), 'Ακύρωση λόγω αλλαγής εταιρείας', 80, 'Μαρία Παπαδοπούλου', 'Ενδεικτική μελλοντική ακύρωση.', @now WHERE @demo_seeded = 0;

-- Offers, cover notes and groups
INSERT INTO insurance_offers (Id, OfferNumber, Label, CustomerId, ContractPartyCustomerId, AssetId, InsuranceCompanyId, ProducerId, BranchId, LineOfBusiness, CoverCode, Plate, Characteristic, IssuedAt, ValidUntil, EffectiveFrom, EffectiveTo, GrossPremium, NetPremium, Commission, Currency, Status, SpecsJson, Notes, CreatedAt)
SELECT UUID(), 'DEMO-OFF-0001', 'Πλήρης προστασία Toyota Yaris', @customer1, @customer1, @asset1, @carrier1, @producer1, @branch_auto, 'Αυτοκίνητο', 'AUTO-FULL', 'ΜΕΒ8677', 'Προτεινόμενη', DATE_SUB(@today, INTERVAL 2 DAY), DATE_ADD(@today, INTERVAL 28 DAY), DATE_ADD(@today, INTERVAL 4 DAY), DATE_ADD(@today, INTERVAL 1 YEAR), 720, 585, 108, 'EUR', 'Ενεργή', '{"covers":["Αστική ευθύνη","Κρύσταλλα","Οδική"]}', 'Demo προσφορά προς επιλογή.', @now WHERE @demo_seeded = 0;
INSERT INTO insurance_offers (Id, OfferNumber, Label, CustomerId, ContractPartyCustomerId, AssetId, InsuranceCompanyId, ProducerId, BranchId, LineOfBusiness, CoverCode, Plate, Characteristic, IssuedAt, ValidUntil, EffectiveFrom, EffectiveTo, GrossPremium, NetPremium, Commission, Currency, Status, SpecsJson, Notes, CreatedAt)
SELECT UUID(), 'DEMO-OFF-0002', 'Βασική προστασία Toyota Yaris', @customer1, @customer1, @asset1, @carrier2, @producer1, @branch_auto, 'Αυτοκίνητο', 'AUTO-BASIC', 'ΜΕΒ8677', 'Οικονομική', DATE_SUB(@today, INTERVAL 1 DAY), DATE_ADD(@today, INTERVAL 29 DAY), DATE_ADD(@today, INTERVAL 4 DAY), DATE_ADD(@today, INTERVAL 1 YEAR), 480, 390, 72, 'EUR', 'Ενεργή', '{"covers":["Αστική ευθύνη","Οδική"]}', 'Demo οικονομική προσφορά.', @now WHERE @demo_seeded = 0;
INSERT INTO cover_notes (Id, Number, CustomerId, InsuranceCompanyId, ProducerId, PolicyType, ValidFrom, ValidUntil, EstimatedPremium, Currency, Status, ConvertedToPolicyId, Subject, Notes, CreatedAt)
SELECT UUID(), 'DEMO-CN-0001', @customer4, @carrier3, @producer1, 3, DATE_SUB(@today, INTERVAL 3 DAY), DATE_ADD(@today, INTERVAL 27 DAY), 1250, 'EUR', 'Ενεργό', NULL, 'Προσωρινό σημείωμα κάλυψης', 'Αναμένεται τελική έκδοση.', @now WHERE @demo_seeded = 0;
SET @group_policy = UUID();
INSERT INTO group_policies (Id, GroupNumber, Name, InsuranceCompanyId, LineOfBusiness, EffectiveFrom, EffectiveTo, Status, TotalPremium, Commission, Currency, AutoRecomputeMemberPremium, ExpectedMemberCount, CreatedAt)
SELECT @group_policy, 'DEMO-GRP-001', 'Ομαδικό πρόγραμμα Τεχνική Δομή', @carrier3, 'Υγεία', DATE_SUB(@today, INTERVAL 1 MONTH), DATE_ADD(@today, INTERVAL 11 MONTH), 'Ενεργό', 8400, 1260, 'EUR', 1, 12, @now WHERE @demo_seeded = 0;
SELECT Id INTO @group_policy FROM group_policies WHERE GroupNumber='DEMO-GRP-001' LIMIT 1;
INSERT INTO group_policy_members (Id, GroupPolicyId, CustomerId, Role, CreatedAt) SELECT UUID(), @group_policy, @customer5, 'Κύριος ασφαλιζόμενος', @now WHERE @demo_seeded = 0;

-- Claims and service activity
SET @claim1 = UUID(); SET @claim2 = UUID();
INSERT INTO claims (Id, ClaimNumber, PolicyId, CustomerId, InsuranceCompanyId, IncidentDate, ReportedDate, Kind, EstimatedAmount, SettledAmount, Status, Notes, CreatedAt)
SELECT @claim1, 'DEMO-CLM-0001', @policy1, @customer1, @carrier1, DATE_SUB(@today, INTERVAL 12 DAY), DATE_SUB(@today, INTERVAL 10 DAY), 'Ζημιά οχήματος', 1850, 0, 'Ανοιχτή', 'Μικρή σύγκρουση στην πόλη. Αναμονή πραγματογνώμονα.', @now WHERE @demo_seeded = 0;
INSERT INTO claims (Id, ClaimNumber, PolicyId, CustomerId, InsuranceCompanyId, IncidentDate, ReportedDate, Kind, EstimatedAmount, SettledAmount, Status, Notes, CreatedAt)
SELECT @claim2, 'DEMO-CLM-0002', @policy3, @customer3, @carrier3, DATE_SUB(@today, INTERVAL 90 DAY), DATE_SUB(@today, INTERVAL 88 DAY), 'Ζημιά κατοικίας', 4200, 3900, 'Ολοκληρωμένη', 'Ζημιά από διαρροή. Καταβλήθηκε αποζημίωση.', @now WHERE @demo_seeded = 0;
SELECT Id INTO @claim1 FROM claims WHERE ClaimNumber='DEMO-CLM-0001' LIMIT 1; SELECT Id INTO @claim2 FROM claims WHERE ClaimNumber='DEMO-CLM-0002' LIMIT 1;
INSERT INTO claim_involved_parties (Id, ClaimId, Kind, FullName, AtFault, CreatedAt) SELECT UUID(), @claim1, 'Ασφαλισμένος', 'Χάρης Μπερτσιάς', 0, @now WHERE @demo_seeded = 0;
INSERT INTO claim_involved_parties (Id, ClaimId, Kind, FullName, AtFault, CreatedAt) SELECT UUID(), @claim1, 'Τρίτος', 'Δημήτρης Κωνσταντίνου', 1, @now WHERE @demo_seeded = 0;
INSERT INTO claim_involved_parties (Id, ClaimId, Kind, FullName, AtFault, CreatedAt) SELECT UUID(), @claim2, 'Ασφαλισμένος', 'Γιώργος Αντωνίου', 0, @now WHERE @demo_seeded = 0;
INSERT INTO service_requests (Id, TicketNumber, CustomerId, PolicyId, Category, Subject, Body, Status, Priority, OpenedAt, ClosedAt, AssignedToUserId, Resolution, CreatedAt)
SELECT UUID(), 'DEMO-REQ-0001', @customer1, @policy1, 'Ανανέωση', 'Ερώτηση για την επόμενη ανανέωση', 'Ο πελάτης ζήτησε ενημέρωση για τη νέα τιμή.', 'Ανοιχτό', 'Κανονική', DATE_SUB(@today, INTERVAL 2 DAY), NULL, @demo_user_id, NULL, @now WHERE @demo_seeded = 0;
INSERT INTO service_requests (Id, TicketNumber, CustomerId, PolicyId, Category, Subject, Body, Status, Priority, OpenedAt, ClosedAt, AssignedToUserId, Resolution, CreatedAt)
SELECT UUID(), 'DEMO-REQ-0002', @customer2, @policy2, 'Έγγραφα', 'Αποστολή αντιγράφου συμβολαίου', 'Ο πελάτης ζήτησε PDF.', 'Ολοκληρωμένο', 'Υψηλή', DATE_SUB(@today, INTERVAL 6 DAY), DATE_SUB(@today, INTERVAL 5 DAY), @demo_user_id, 'Απεστάλη το PDF με email.', @now WHERE @demo_seeded = 0;

-- CRM: communications, appointments, tasks, instructions, campaigns, templates
INSERT INTO communication_logs (Id, Channel, Direction, CustomerId, PolicyId, ClaimId, Subject, Body, RecipientAddress, SenderAddress, OccurredAt, Status, ProviderReference, UserId, ErrorMessage, CreatedAt)
SELECT UUID(), 'Email', 'Εξερχόμενη', @customer1, @policy1, NULL, 'Ανανέωση συμβολαίου', 'Υπενθύμιση ανανέωσης και διαθέσιμων καλύψεων.', 'charis.bertsias@demo.local', 'demo@kalypsis.local', DATE_SUB(@today, INTERVAL 3 DAY), 'Παραδόθηκε', 'DEMO-EMAIL-001', @demo_user_id, NULL, @now WHERE @demo_seeded = 0;
INSERT INTO communication_logs (Id, Channel, Direction, CustomerId, PolicyId, ClaimId, Subject, Body, RecipientAddress, SenderAddress, OccurredAt, Status, ProviderReference, UserId, ErrorMessage, CreatedAt)
SELECT UUID(), 'Τηλέφωνο', 'Εισερχόμενη', @customer2, @policy2, NULL, 'Αλλαγή οχήματος', 'Συζήτηση για αλλαγή οχήματος.', '6977 222 333', NULL, DATE_SUB(@today, INTERVAL 1 DAY), 'Ολοκληρώθηκε', NULL, @demo_user_id, NULL, @now WHERE @demo_seeded = 0;
INSERT INTO communication_logs (Id, Channel, Direction, CustomerId, PolicyId, ClaimId, Subject, Body, RecipientAddress, SenderAddress, OccurredAt, Status, ProviderReference, UserId, ErrorMessage, CreatedAt)
SELECT UUID(), 'Email', 'Εισερχόμενη', @customer4, NULL, @claim1, 'Νέα φωτογραφία ζημιάς', 'Παραλήφθηκαν φωτογραφίες για τη ζημιά.', 'sofia.georgiou@demo.local', NULL, DATE_SUB(@today, INTERVAL 1 DAY), 'Παραλήφθηκε', NULL, @demo_user_id, NULL, @now WHERE @demo_seeded = 0;
INSERT INTO appointments (Id, Title, Description, StartsAt, EndsAt, Location, CustomerId, PolicyId, OwnerUserId, ColorHex, Status, ReminderSent, Notes, CreatedAt)
SELECT UUID(), 'Ραντεβού ανανέωσης Χάρη Μπερτσιά', 'Παρουσίαση νέων καλύψεων.', DATE_ADD(@today, INTERVAL 2 DAY) + INTERVAL 10 HOUR, DATE_ADD(@today, INTERVAL 2 DAY) + INTERVAL 11 HOUR, 'Γραφείο Demo', @customer1, @policy1, @demo_user_id, '#0B78E3', 'Προγραμματισμένο', 0, 'Αποστολή υπενθύμισης μία ημέρα πριν.', @now WHERE @demo_seeded = 0;
INSERT INTO appointments (Id, Title, Description, StartsAt, EndsAt, Location, CustomerId, PolicyId, OwnerUserId, ColorHex, Status, ReminderSent, Notes, CreatedAt)
SELECT UUID(), 'Έλεγχος ζημιάς', 'Συνάντηση για εκτίμηση ζημιάς.', DATE_ADD(@today, INTERVAL 4 DAY) + INTERVAL 12 HOUR, DATE_ADD(@today, INTERVAL 4 DAY) + INTERVAL 13 HOUR, 'Συνεργείο Demo', @customer1, @policy1, @demo_user_id, '#14A77A', 'Προγραμματισμένο', 0, NULL, @now WHERE @demo_seeded = 0;
INSERT INTO agency_tasks (Id, Title, Description, AssignedToUserId, RelatedCustomerId, RelatedPolicyId, RelatedClaimId, DueDate, Priority, Status, CompletedAt, CreatedAt)
SELECT UUID(), 'Έλεγχος εκκρεμούς δόσης', 'Επικοινωνία με τον πελάτη για την τρίτη δόση.', @demo_user_id, @customer1, @policy1, NULL, DATE_ADD(@today, INTERVAL 1 DAY), 'Υψηλή', 'Ανοιχτή', NULL, @now WHERE @demo_seeded = 0;
INSERT INTO agency_tasks (Id, Title, Description, AssignedToUserId, RelatedCustomerId, RelatedPolicyId, RelatedClaimId, DueDate, Priority, Status, CompletedAt, CreatedAt)
SELECT UUID(), 'Αποστολή φακέλου ζημιάς', 'Συγκέντρωση εγγράφων και φωτογραφιών.', @demo_user_id, @customer4, NULL, @claim1, DATE_SUB(@today, INTERVAL 1 DAY), 'Κανονική', 'Ολοκληρωμένη', DATE_SUB(@today, INTERVAL 1 DAY), @now WHERE @demo_seeded = 0;
INSERT INTO agency_instructions (Id, Title, Body, CustomerId, PolicyId, ClaimId, ForProducerId, ForUserId, ValidUntil, IsAcknowledged, AcknowledgedAt, AuthorUserId, CreatedAt)
SELECT UUID(), 'Οδηγία ανανέωσης', 'Ελέγξτε τις εναλλακτικές προσφορές πριν την επικοινωνία.', @customer1, @policy1, NULL, @producer1, @demo_user_id, DATE_ADD(@today, INTERVAL 10 DAY), 0, NULL, @demo_user_id, @now WHERE @demo_seeded = 0;
INSERT INTO marketing_campaigns (Id, Name, Kind, Description, FilterJson, EmailSubjectTemplate, EmailBodyTemplate, SmsTemplate, LastRunAt, RecipientsLastRun, IsActive, CreatedAt)
SELECT UUID(), 'Υπενθύμιση ανανεώσεων Demo', 'Email', 'Επικοινωνία με πελάτες που λήγουν σε 30 ημέρες.', '{"renewalDays":30}', 'Η ανανέωσή σας πλησιάζει', '<p>Καλέστε μας για τις επιλογές σας.</p>', 'Η ανανέωσή σας πλησιάζει. Επικοινωνήστε μαζί μας.', DATE_SUB(@today, INTERVAL 2 DAY), 12, 1, @now WHERE @demo_seeded = 0;
INSERT INTO email_templates (Id, Code, Name, Subject, BodyHtml, PlaceholdersJson, Language, IsActive, Notes, CreatedAt)
SELECT UUID(), 'DEMO-RENEWAL', 'Υπενθύμιση ανανέωσης', 'Η ανανέωση του συμβολαίου σας', '<p>Αγαπητέ/ή {{customerName}}, το συμβόλαιό σας λήγει στις {{expiryDate}}.</p>', '["customerName","expiryDate"]', 'el-GR', 1, 'Demo template.', @now WHERE @demo_seeded = 0;

-- Accounting, commissions and reconciliation
INSERT INTO receipts (Id, ReceiptNumber, ReceiptDate, PolicyId, CustomerId, Kind, Amount, Currency, PaymentMethod, Reference, Notes, CreatedAt)
SELECT UUID(), 'DEMO-RCPT-0001', DATE_SUB(@today, INTERVAL 8 MONTH), @policy1, @customer1, 'Είσπραξη ασφαλίστρου', 160, 'EUR', 'Τραπεζική μεταφορά', 'DEMO-BANK-001', 'Πρώτη δόση.', @now WHERE @demo_seeded = 0;
INSERT INTO receipts (Id, ReceiptNumber, ReceiptDate, PolicyId, CustomerId, Kind, Amount, Currency, PaymentMethod, Reference, Notes, CreatedAt)
SELECT UUID(), 'DEMO-RCPT-0002', DATE_SUB(@today, INTERVAL 5 MONTH), @policy1, @customer1, 'Είσπραξη ασφαλίστρου', 160, 'EUR', 'Κάρτα', 'DEMO-CARD-002', 'Δεύτερη δόση.', @now WHERE @demo_seeded = 0;
INSERT INTO receipts (Id, ReceiptNumber, ReceiptDate, PolicyId, CustomerId, Kind, Amount, Currency, PaymentMethod, Reference, Notes, CreatedAt)
SELECT UUID(), 'DEMO-RCPT-0003', DATE_SUB(@today, INTERVAL 1 MONTH), @policy2, @customer2, 'Είσπραξη ασφαλίστρου', 105, 'EUR', 'Χρεωστική κάρτα', 'DEMO-CARD-003', NULL, @now WHERE @demo_seeded = 0;
INSERT INTO payments (Id, PaymentNumber, PaymentDate, RecipientKind, RecipientAfm, RecipientName, Amount, Currency, PaymentMethod, Reference, Notes, CreatedAt)
SELECT UUID(), 'DEMO-PAY-0001', DATE_SUB(@today, INTERVAL 6 MONTH), 'Ασφαλιστική εταιρεία', '099111111', 'Νέος Ποσειδώνας', 320, 'EUR', 'Τραπεζική μεταφορά', 'DEMO-TRANSFER-001', 'Απόδοση ασφαλίστρων.', @now WHERE @demo_seeded = 0;
INSERT INTO payments (Id, PaymentNumber, PaymentDate, RecipientKind, RecipientAfm, RecipientName, Amount, Currency, PaymentMethod, Reference, Notes, CreatedAt)
SELECT UUID(), 'DEMO-PAY-0002', DATE_SUB(@today, INTERVAL 3 MONTH), 'Συνεργάτης', '123123123', 'Αλέξανδρος Μιχαηλίδης', 57.60, 'EUR', 'Τραπεζική μεταφορά', 'DEMO-TRANSFER-002', 'Απόδοση προμήθειας.', @now WHERE @demo_seeded = 0;
INSERT INTO general_financial_entries (Id, EntryDate, Direction, Category, Description, Amount, VatAmount, Currency, PaymentMethod, DocumentNumber, CounterpartyName, CounterpartyAfm, Notes, CreatedAt)
SELECT UUID(), DATE_SUB(@today, INTERVAL 5 DAY), 'Έσοδο', 'Προμήθειες', 'Προμήθεια συμβολαίου DEMO-POL-0001', 96, 0, 'EUR', 'Λογιστική εγγραφή', 'DEMO-FIN-001', 'Νέος Ποσειδώνας', '099111111', NULL, @now WHERE @demo_seeded = 0;
INSERT INTO general_financial_entries (Id, EntryDate, Direction, Category, Description, Amount, VatAmount, Currency, PaymentMethod, DocumentNumber, CounterpartyName, CounterpartyAfm, Notes, CreatedAt)
SELECT UUID(), DATE_SUB(@today, INTERVAL 2 DAY), 'Έξοδο', 'Λειτουργικά', 'Υπηρεσίες υποστήριξης demo', 80, 19.20, 'EUR', 'Τραπεζική μεταφορά', 'DEMO-FIN-002', 'Πάροχος υπηρεσιών', '012345678', NULL, @now WHERE @demo_seeded = 0;
INSERT INTO credit_notes (Id, Number, Date, Amount, Currency, Reason, CustomerId, PolicyId, CreatedAt)
SELECT UUID(), 'DEMO-CN-ACC-0001', DATE_SUB(@today, INTERVAL 20 DAY), 35, 'EUR', 'Πιστωτικό λόγω ακύρωσης πρόσθετης πράξης', @customer2, @policy2, @now WHERE @demo_seeded = 0;
INSERT INTO advance_payments (Id, Number, ReceivedOn, PartyKind, PartyAfm, PartyName, Amount, SettledAmount, Currency, Method, Notes, CreatedAt)
SELECT UUID(), 'DEMO-ADV-0001', DATE_SUB(@today, INTERVAL 7 DAY), 'Πελάτης', '123456789', 'Χάρης Μπερτσιάς', 200, 160, 'EUR', 'Τραπεζική μεταφορά', 'Προκαταβολή για ανανέωση.', @now WHERE @demo_seeded = 0;
INSERT INTO commission_rules (Id, InsuranceCompanyId, LineOfBusiness, CoverCode, AgencyPercent, ProducerPercent, OverCommissionPercent, EffectiveFrom, Priority, Notes, IsActive, CreatedAt)
SELECT UUID(), @carrier1, 'Αυτοκίνητο', 'AUTO-FULL', 15, 18, 3, DATE_SUB(@today, INTERVAL 1 YEAR), 1, 'Demo κανόνας προμηθειών.', 1, @now WHERE @demo_seeded = 0;
INSERT INTO commission_rules (Id, InsuranceCompanyId, LineOfBusiness, CoverCode, AgencyPercent, ProducerPercent, OverCommissionPercent, EffectiveFrom, Priority, Notes, IsActive, CreatedAt)
SELECT UUID(), @carrier3, 'Κατοικία', 'HOME-COMP', 15, 12, 2, DATE_SUB(@today, INTERVAL 1 YEAR), 1, 'Demo κανόνας κατοικίας.', 1, @now WHERE @demo_seeded = 0;
SET @commission_run = UUID();
INSERT INTO commission_runs (Id, Year, Month, StartedAt, FinishedAt, Status, PolicyCount, TransactionCount, AgencyTotal, ProducerTotal, OverCommissionTotal, StartedByUserId, Notes, CreatedAt)
SELECT @commission_run, YEAR(@today), MONTH(@today), DATE_SUB(@now, INTERVAL 1 DAY), DATE_SUB(@now, INTERVAL 1 DAY) + INTERVAL 3 MINUTE, 'Ολοκληρωμένη', 3, 6, 171.00, 189.75, 24.00, @demo_user_id, 'Demo εκκαθάριση μήνα.', @now WHERE @demo_seeded = 0;
SELECT Id INTO @commission_run FROM commission_runs WHERE Year=YEAR(@today) AND Month=MONTH(@today) LIMIT 1;
INSERT INTO commission_transactions (Id, CommissionRunId, PolicyId, ProducerId, BucketKind, GrossPremium, PercentApplied, Amount, Currency, Notes, CreatedAt)
SELECT UUID(), @commission_run, @policy1, @producer1, 'Παραγωγός', 640, 18, 115.20, 'EUR', 'Demo συναλλαγή.', @now WHERE @demo_seeded = 0;
INSERT INTO commission_transactions (Id, CommissionRunId, PolicyId, ProducerId, BucketKind, GrossPremium, PercentApplied, Amount, Currency, Notes, CreatedAt)
SELECT UUID(), @commission_run, @policy1, @producer1, 'Γραφείο', 640, 15, 96.00, 'EUR', 'Demo συναλλαγή.', @now WHERE @demo_seeded = 0;
INSERT INTO over_commission_rules (Id, InsuranceCompanyId, ProducerId, Category, Percent, Notes, IsActive, CreatedAt)
SELECT UUID(), @carrier1, @producer1, 'A', 3, 'Demo υπερπρομήθεια.', 1, @now WHERE @demo_seeded = 0;
INSERT INTO over_commission_statements (Id, InsuranceCompanyId, ProducerId, Year, Month, GrossAmount, NetAmount, ProducerCommissionAmount, OfficeOverCommissionAmount, Currency, Reference, Notes, PaidOn, ProducerSharePercent, CreatedAt)
SELECT UUID(), @carrier1, @producer1, YEAR(@today), MONTH(@today), 640, 520.33, 19.20, 19.20, 'EUR', 'DEMO-OVER-0001', 'Demo κατάσταση υπερπρομήθειας.', DATE_SUB(@today, INTERVAL 2 DAY), 50, @now WHERE @demo_seeded = 0;
INSERT INTO producer_expected_rates (Id, ProducerId, InsuranceCompanyId, LineOfBusiness, ExpectedPercent, EffectiveFrom, Notes, CreatedAt)
SELECT UUID(), @producer1, @carrier1, 'Αυτοκίνητο', 18, DATE_SUB(@today, INTERVAL 1 YEAR), 'Demo αναμενόμενη προμήθεια.', @now WHERE @demo_seeded = 0;
INSERT INTO producer_commission_declarations (Id, ProducerId, Year, Month, DeclaredAmount, Currency, Status, ReviewedAt, ReviewedByUserId, Notes, CreatedAt)
SELECT UUID(), @producer1, YEAR(@today), MONTH(@today), 115.20, 'EUR', 'Ελεγμένη', DATE_SUB(@today, INTERVAL 1 DAY), @demo_user_id, 'Demo δήλωση συνεργάτη.', @now WHERE @demo_seeded = 0;
INSERT INTO commission_adjustments (Id, ProducerId, Kind, Amount, Currency, EffectiveOn, Notes, CreatedAt)
SELECT UUID(), @producer1, 'Διόρθωση προμήθειας', 12.50, 'EUR', DATE_SUB(@today, INTERVAL 3 DAY), 'Demo προσαρμογή.', @now WHERE @demo_seeded = 0;

-- Import bridges, tariffs, reconciliation, backups and settings
INSERT INTO bridge_configs (Id, InsuranceCompanyId, Name, Delimiter, HeaderRow, MappingJson, Notes, CreatedAt)
SELECT UUID(), @carrier1, 'Demo CSV παραγωγής', ';', 1, '{"policyNumber":"Αρ. Συμβολαίου","customer":"Πελάτης","grossPremium":"Μικτά"}', 'Demo bridge configuration.', @now WHERE @demo_seeded = 0;
INSERT INTO bridge_import_batches (Id, InsuranceCompanyId, OriginalFileName, FileSizeBytes, RecordType, RowsRead, RowsImported, RowsSkipped, RowsFailed, Status, StartedAt, FinishedAt, ExecutedByUserId, ErrorMessage, SummaryJson, ImportedIdsJson, CreatedAt)
SELECT UUID(), @carrier1, 'demo-production-october.csv', 48210, 'Παραγωγή', 25, 23, 1, 1, 'Ολοκληρώθηκε με παρατηρήσεις', DATE_SUB(@now, INTERVAL 2 DAY), DATE_SUB(@now, INTERVAL 2 DAY) + INTERVAL 2 MINUTE, @demo_user_id, 'Μία γραμμή χρειάζεται αντιστοίχιση.', '{"new":23,"updated":0,"failed":1}', '["DEMO-POL-0001","DEMO-POL-0002"]', @now WHERE @demo_seeded = 0;
INSERT INTO bridge_runs (Id, InsuranceCompanyId, FileName, StartedAt, FinishedAt, RowsRead, PoliciesCreated, PoliciesUpdated, PoliciesSkipped, Errors, Status, Notes, CreatedAt)
SELECT UUID(), @carrier1, 'demo-renewals-october.xlsx', DATE_SUB(@now, INTERVAL 3 DAY), DATE_SUB(@now, INTERVAL 3 DAY) + INTERVAL 4 MINUTE, 18, 4, 12, 1, 1, 'Ολοκληρώθηκε', 'Demo εκτέλεση γέφυρας.', @now WHERE @demo_seeded = 0;
INSERT INTO bridge_code_mappings (Id, Kind, SourceCarrier, RawCode, RawLabel, TargetInsuranceCompanyId, TargetBranchId, Notes, ConfirmedByUserId, ConfirmedAt, CreatedAt)
SELECT UUID(), 1, 'DEMO-NP', 'AUTO-COMP', 'Πλήρης κάλυψη αυτοκινήτου', @carrier1, @branch_auto, 'Demo αντιστοίχιση κωδικού.', @demo_user_id, @now, @now WHERE @demo_seeded = 0;
INSERT INTO tariffs (Id, Name, PolicyType, InsuranceCompanyId, BasePremium, Currency, CommissionPercent, FactorsJson, Notes, IsActive, EffectiveFrom, EffectiveTo, CreatedAt)
SELECT UUID(), 'Demo τιμολόγιο αυτοκινήτου', 1, @carrier1, 420, 'EUR', 18, '{"ageFactor":1.0,"engineFactor":1.05}', 'Ενδεικτικό τιμολόγιο.', 1, DATE_SUB(@today, INTERVAL 1 YEAR), DATE_ADD(@today, INTERVAL 1 YEAR), @now WHERE @demo_seeded = 0;
SET @recon = UUID();
INSERT INTO reconciliation_runs (Id, InsuranceCompanyId, FromDate, ToDate, LinesTotal, LinesMatched, LinesUnmatched, MatchedAmount, UnmatchedAmount, Status, StartedAt, FinishedAt, StartedByUserId, Notes, CreatedAt)
SELECT @recon, @carrier1, DATE_SUB(@today, INTERVAL 1 MONTH), @today, 12, 10, 2, 4860, 320, 'Ολοκληρώθηκε με εκκρεμότητες', DATE_SUB(@now, INTERVAL 1 DAY), DATE_SUB(@now, INTERVAL 1 DAY) + INTERVAL 5 MINUTE, @demo_user_id, 'Demo συμφωνία κίνησης.', @now WHERE @demo_seeded = 0;
SELECT Id INTO @recon FROM reconciliation_runs ORDER BY CreatedAt DESC LIMIT 1;
INSERT INTO reconciliation_lines (Id, ReconciliationRunId, StatementDate, Description, Amount, Reference, Status, CreatedAt)
SELECT UUID(), @recon, DATE_SUB(@today, INTERVAL 5 DAY), 'Έμβασμα DEMO-POL-0001', 640, 'DEMO-RCPT-0001', 'Ταυτοποιημένη', @now WHERE @demo_seeded = 0;
INSERT INTO reconciliation_lines (Id, ReconciliationRunId, StatementDate, Description, Amount, Reference, Status, CreatedAt)
SELECT UUID(), @recon, DATE_SUB(@today, INTERVAL 4 DAY), 'Άγνωστη πίστωση', 320, NULL, 'Εκκρεμής', @now WHERE @demo_seeded = 0;
INSERT INTO backup_history (Id, BackupAt, FilePath, SizeBytes, Status, Notes, CreatedAt)
SELECT UUID(), DATE_SUB(@now, INTERVAL 1 DAY), 'demo/backups/kalypsis-demo-2026-10-10.zip', 18432000, 'Ολοκληρώθηκε', 'Demo αντίγραφο ασφαλείας.', @now WHERE @demo_seeded = 0;
INSERT INTO fx_rates (Id, BaseCurrency, QuoteCurrency, RateDate, Rate, Source, CreatedAt)
SELECT UUID(), 'EUR', 'USD', @today, 1.1025, 'ECB demo', @now WHERE @demo_seeded = 0;
INSERT INTO number_sequences (Series, Year, NextValue) SELECT 'DEMO-POL', YEAR(@today), 5 WHERE @demo_seeded = 0;
INSERT INTO number_sequences (Series, Year, NextValue) SELECT 'DEMO-CLM', YEAR(@today), 3 WHERE @demo_seeded = 0;
INSERT INTO saved_views (Id, Page, Name, FiltersJson, IsShared, UseCount, CreatedAt)
SELECT UUID(), '/policies', 'Ενεργά συμβόλαια Demo', '{"status":"Ενεργό","lineOfBusiness":"Αυτοκίνητο"}', 1, 8, @now WHERE @demo_seeded = 0;
INSERT INTO saved_views (Id, Page, Name, FiltersJson, IsShared, UseCount, CreatedAt)
SELECT UUID(), '/claims', 'Ανοιχτές ζημιές', '{"status":"Ανοιχτή"}', 1, 5, @now WHERE @demo_seeded = 0;

-- Notifications and audit trail
INSERT INTO notifications (Id, UserId, Severity, Title, Body, LinkTarget, IsRead, ReadAt, CreatedAt)
SELECT UUID(), @demo_user_id, 'info', 'Καλώς ήρθατε στο Demo', 'Το περιβάλλον περιέχει πλήρη ενδεικτικά δεδομένα για δοκιμή.', '/app', 0, NULL, @now WHERE @demo_seeded = 0;
INSERT INTO notifications (Id, UserId, Severity, Title, Body, LinkTarget, IsRead, ReadAt, CreatedAt)
SELECT UUID(), @demo_user_id, 'warning', 'Εκκρεμής δόση', 'Υπάρχει ανεξόφλητη δόση στο DEMO-POL-0001.', '/policies/DEMO-POL-0001', 0, NULL, @now WHERE @demo_seeded = 0;
INSERT INTO audit_logs (Id, UserId, UserEmail, Action, EntityName, EntityId, Details, OccurredAt, CreatedAt)
SELECT UUID(), @demo_user_id, 'demo@kalypsis.local', 'DemoSeedCreated', 'DemoDataset', NULL, '{"version":"2026-10","records":"full"}', @now, @now WHERE @demo_seeded = 0;

-- Mark successful completion only after all inserts succeed.
INSERT INTO demo_seed_meta (SeedKey, SeededAt) SELECT 'full-demo-2026-10', @now WHERE @demo_seeded = 0;
SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

