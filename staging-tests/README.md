# Kalypsis staging templates

Self-contained directory of fillable CSV templates per staging γραφείο.
Use these to manually pre-populate Kalypsis with realistic data so the office
team can rehearse the day-to-day workflow before the live carrier bridges are
turned on.

When the bridges go live, the same column layout used here will be the target
the import job maps onto — fields are named to match the API DTOs so a CSV
saved from Excel can be imported with very little fiddling.

```
staging-tests/
├── README.md                       (this file)
├── grand-cover/                    Grand Cover / IW parametric reference
│   └── Παραμετρικά_Αρχεία_IW.xlsx  → upload via /app/platform/parametric-files
├── agency-alpha/                   Template tenant #1
│   ├── 01-customers.csv
│   ├── 02-producers.csv
│   ├── 03-policies-primary.csv
│   ├── 04-policies-renewal.csv
│   ├── 05-endorsements.csv
│   ├── 06-cancellations.csv
│   ├── 07-green-cards.csv
│   ├── 08-receipts.csv
│   ├── 09-payments.csv
│   ├── 10-commission-rules.csv
│   ├── 11-production-export.csv
│   └── 12-tasks.csv
└── agency-beta/                    Template tenant #2 — identical layout
    └── (same files)
```

## Per-file purpose

| File | Purpose |
|---|---|
| `01-customers.csv` | Customer master — feeds `POST /api/customers`. |
| `02-producers.csv` | Συνεργάτες (intermediaries). Codes here are referenced by every policy file. |
| `03-policies-primary.csv` | Πρωτοσυμβόλαια — net new business issued from scratch. |
| `04-policies-renewal.csv` | Ανανεωτήρια — renewal of an existing policy number, expects the PreviousPolicyNumber column to match. |
| `05-endorsements.csv` | Πρόσθετες πράξεις on existing policies (premium delta + reason). |
| `06-cancellations.csv` | Ακυρώσεις with refund amount + reason. |
| `07-green-cards.csv` | Πράσινες κάρτες for motor policies. |
| `08-receipts.csv` | Εισπράξεις — money coming in from customers. |
| `09-payments.csv` | Πληρωμές — money going out (to carriers, producers). |
| `10-commission-rules.csv` | Per-producer / per-carrier / per-cover commission rules. |
| `11-production-export.csv` | What the production-list export will look like after data is entered — paste back to verify. |
| `12-tasks.csv` | Day-to-day AgencyTasks for the staff. |

## Workflow

1. Open the template in Excel (UTF-8 is preserved — Greek characters render
   correctly out of the box).
2. Fill in real-looking but **non-production** data.
3. Either:
   - **Upload through the UI**: each list page has an import button when the
     bridge integration exists, or
   - **Paste through the create dialog**: most forms accept the exact field
     names below as labels.
4. Once the carrier bridges go live, re-run the same import on production —
   the column layout is identical.

## When the bridges arrive

The IW/ERGO bridge importers will land in `Kalypsis.Application/Features/Bridges`.
Each will publish a file format that's a strict superset of the columns here:
the bridge file adds carrier-specific reference codes alongside the existing
columns. Existing rows entered via these templates won't need to be re-imported.

## Notes on the Grand Cover reference file

`grand-cover/Παραμετρικά_Αρχεία_IW.xlsx` is the dictionary IW publishes to its
brokers — 8 sheets covering Εταιρίες, Κλάδοι, Πακέτα, Αντικείμενα, Καλύψεις,
Χρήσεις, Κατηγορίες εγγραφής, plus Γραμμογράφηση. It contains 100k+ package
codes so it's not seeded inline — instead upload it as a broadcast parametric
file via **/app/platform/parametric-files** (PlatformAdmin) and "install on
tenant" for every γραφείο that needs it.

This staging directory is ignored by git (see `.gitignore`) so you can keep
real names and customer details here without worrying about a leak.
