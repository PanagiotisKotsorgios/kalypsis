# Unlisted KALYPSIS insurance-office website

Entry point: `/insurance`. The existing `/insurance-request` remains available.

The insurance site is not linked from the public software website and is not in
the sitemap. All routes receive an explicit `noindex, nofollow, noarchive`
treatment in the SEO controller and are disallowed in `robots.txt`. This is an unlisted
preview, not password protection: anyone with the URL can open it.

## Routes

- `/insurance`: reference-inspired homepage, manual hero carousel, insurance tabs.
- `/insurance/programs`: all insurance categories.
- `/insurance/programs/car`, `/home`, `/health`, `/life`, `/business`: product pages.
- `/insurance/services/advice`, `/renewal`, `/claims`: service guidance.
- `/insurance/about`, `/contact`, `/faq`: information, real telephone/email links,
  searchable FAQs.
- `/insurance/guides` and `/insurance/guides/:slug`: readable insurance guides.
- `/insurance/quote?type=Κατοικία`: existing validated intake form, preselected type.
- `/insurance/payment`: instructions for using an insurer-issued payment link;
  it does not collect card data or simulate a payment.
- `/insurance/privacy`: information about the intake and links to platform policies.

All quote submissions use the existing rate-limited
`POST /api/public/office-sites/kalypsis/insurance-request` endpoint. It stores
OfficeWebsiteRequest records under the PLATFORM tenant and sends notifications
and an email, returning an actual request reference. No demo quotes, prices,
payment results or insurer integrations were added.

The product copy is centralized in `insuranceContent.ts`. Coverage descriptions
are illustrative categories and explicitly subject to the insurer's terms.
The reference's home discount text is retained and qualified by the product note;
the office should confirm commercial availability before public launch.

## Images

The reference is a design guide, never a full-page image in the implementation.
The official existing `/kalypsis-logo.png` is reused with CSS viewports for the
horizontal lockup. Photo files are served locally for reliable loading.

Online photo source URLs (downloaded 2026-10-22; verify usage rights before public launch):

- `home-family.jpg`: https://atruvia.scene7.com/is/image/atruvia/20250327_Ratgeber-Tipps-Hauskauf_1800x900px_iStock?wid=1800&hei=900&fit=crop&qlt=90
- `coastal-drive.jpg`: https://bonoboss.cl/cdn/shop/files/P15_hombre_driving_V2_8b58add1-610b-4d25-8ae3-a3d581b99710.webp?width=1600 (source response is JPEG)
- `health.jpg`: https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=85
- `business.jpg`: https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1600&q=85
- `family-life.jpg`: https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1600&q=85

No third-party tracking scripts or newsletter collection are activated.

## Local preview

The running preview is `http://127.0.0.1:4188/insurance`. Its Vite process uses
`KALYPSIS_DEV_API_TARGET=https://mykalypsis.gr` so the public intake can reach the
existing deployed API without starting a second database. Submitting the form
from that preview creates a real request in the platform inbox. The normal dev
proxy still defaults to `http://localhost:5134` when this variable is unset.
