# Cloud UKO - Digital Transformation Solutions

## Version 2.0 🆕

Cloud UKO Version 2 features enhanced design, improved performance, and expanded service offerings. This version includes professional animations, optimized responsiveness, and a refined user interface for better customer engagement.

🚀 **Live Website**: [View on GitHub Pages](https://lucianozambuko-gif.github.io/cloud-uko-v3/)

## About Cloud UKO

Cloud UKO (United Knowledge Operations) provides integrated digital transformation solutions for businesses of all sizes. We specialize in:

- ☁️ **Web & System Development** - Websites, business systems and integrations
- 🧾 **ERP, Invoicing & POS Systems** - Custom-built for how the business runs
- ⚡ **Smart Automation** - Bookings, invoicing, follow-ups and reporting
- 📈 **Data-Driven Marketing** - Social, SEO, email and analytics
- 🗂️ **UKO Administration Services** - Admin and operational support

## Packages & Pricing (Growth Kit)

Most packages pair a once-off setup fee with a monthly fee. Prices are
shown on `index.html` (full cards) and `service.html` (compact cards);
update both if they change.

| Package | Who it's for | Once-off (ZAR) | Monthly (ZAR) |
| --- | --- | --- | --- |
| Brand Starter | New small businesses | R 1,200 | - |
| Starter Website | Caterers, cleaners, salons, trades | R 3,500 | R 2,200/year domain + hosting; optional R 150/mo edits & support |
| Business Website | Service businesses taking bookings | R 8,500 | R 450 |
| Invoice & Quote System | Businesses still invoicing in Word | R 4,500 | R 350 |
| School ERP | Independent schools, ECD centres, TVET colleges | R 7,500 setup + training | R 18 per learner (min R 1,500) |
| Farm ERP | Farms and agri businesses | R 10,000 | R 950 |

Terms shown on the site: 50% deposit before work starts, 50% on launch;
monthly fees by debit order or EFT on the 1st; hosting billed yearly in
advance; quotes valid 30 days.

Each pricing card's button links to `contact.html?package=<slug>`, which
preselects that package in the enquiry form.

## Website Structure

- `index.html` - Homepage with hero section and packages
- `about.html` - Company information
- `service.html` - Detailed services and pricing
- `projects.html` - Portfolio and case studies
- `demos.html` - Live demo hub: links to real projects from our GitHub
  (School ERP, Lumen booking marketplace, and live client sites). The
  cabinet screenshots are in `img/showcase/` - retake one when that
  site's homepage changes
- `contact.html` - Contact form and information

### Archived: in-browser demos + trial system (not linked)

`demo-erp.html`, `demo-invoice.html`, `demo-pos.html`, `demo-apps.css`,
`trial-*.html`, `trial-auth.js` and `server/` are kept in the repo but
**no page links to them** any more - the demos page now shows real
projects instead. Note they're still reachable by direct URL on GitHub
Pages. To bring them back, re-add cabinets for them in `demos.html`.

- `demo-erp.html`, `demo-invoice.html`, `demo-pos.html` - Interactive
  demo apps, open in preview mode with a free-account prompt (see the
  trial system below)
- `trial-signup.html`, `trial-login.html`, `trial-account.html`,
  `trial-upgrade-success.html`, `trial-upgrade-cancelled.html` - Trial
  signup/login/account/payment-return pages
- `server/` - Small Node.js backend for the trial system (PayFast
  payments + webhook) - deployed separately on Render, not part of
  the static GitHub Pages site

## Demo Trial System (archived)

The three interactive demos (`demo-erp.html`, `demo-invoice.html`,
`demo-pos.html`) open instantly in **preview mode** - no account
needed - with sample data already loaded. A visitor gets a few key
actions for free (checkout, save invoice, add item/staff -
`TRIAL_PREVIEW_FREE_ACTIONS` in `trial-auth.js`); after that, or when
they try to print / export, they're asked to create a free account,
which unlocks unlimited use of all three for 7 days.

The banner under each demo's app bar and the prompt shown once a trial
has ended both point to WhatsApp / the contact page ("Want this built
for your business?") rather than to payment. Purchasing ongoing demo
access via PayFast is still available from `trial-account.html`.

Because the demos are static pages, this prompt is lead capture, not
access control - only the trial clock and payment status are enforced
server-side.

**Why this needs more than the static site**: GitHub Pages can't run a
server, but real PayFast payments require a server-side webhook
(PayFast's ITN) that verifies payment success before anything is
unlocked - that verification can never be trusted from the browser
alone. So this feature has two parts:

| Part | What it does | Where it lives |
| --- | --- | --- |
| **Supabase** | Accounts (signup/login) + a `trial_access` table tracking each user's trial start date and status. Row Level Security means a user can read/create their own row but can never mark themselves "active" - only the backend can do that. | supabase.com (free tier) |
| **`server/`** | Builds signed PayFast payment requests, and verifies PayFast's ITN webhook (signature + source host + PayFast's own validate callback + amount check) before flipping a user's status to `active` in Supabase. | Render (separate Web Service from the static site) |

The demo pages' own data (inventory, invoices, cart) still lives only
in the visitor's browser via `localStorage` - only the trial account
itself is stored in Supabase.

### One-time setup

1. **Create the Supabase project** - supabase.com → New Project. Once
   it's ready, open the **SQL Editor** and run `supabase/schema.sql`
   from this repo (creates the `trial_access` table, its RLS policies,
   and the `trial_status` view).
2. **Get your Supabase keys** - Project Settings → API. You need the
   **Project URL** and **anon public key** (both safe to expose to the
   browser) for the frontend, and the **service_role key** (secret -
   server only) for the backend.
3. **Fill in `trial-config.js`** at the repo root with the Project URL
   and anon key, plus the Render backend's URL once you have it (step
   5). This file is safe to commit - it only contains the public key.
4. **Deploy `server/` to Render** as its own Web Service:
   - Root directory: `server`
   - Build command: `npm install`
   - Start command: `node index.js`
   - Environment variables: copy every key from `server/.env.example`
     with real values. `PAYFAST_MERCHANT_ID`/`PAYFAST_MERCHANT_KEY`
     start as PayFast's public sandbox test credentials (already in
     the example file) - switch to your real merchant ID/key and set
     `PAYFAST_MODE=live` only once you've tested a full signup → trial
     expiry → payment run in sandbox.
5. **Update `trial-config.js`** with the Render service's actual URL
   once deployed, and `SERVER_URL` in Render's env vars with the same
   value (PayFast's webhook needs to know where to call back to).

### Local development (server only)

```bash
cd server
cp .env.example .env   # fill in real values, never commit this file
npm install
npm run dev
```

The static site itself needs no build step - open the HTML files
directly or serve the repo root with any static file server.

### Security notes

- `SUPABASE_SERVICE_ROLE_KEY` and `PAYFAST_PASSPHRASE` are secrets -
  they only ever belong in Render's environment variables, never in
  `trial-config.js`, never committed, never pasted into chat once
  they're real (not sandbox test) values.
- `.env` is git-ignored; `server/.env.example` has placeholders only.
- The trial clock and payment status are enforced server-side
  (Supabase RLS + the backend's service_role key) specifically so
  clearing browser storage or editing `localStorage` can't extend a
  trial or fake a purchase.

## Technology Stack

- **Frontend**: Pure HTML5, CSS3, Vanilla JavaScript
- **Styling**: Custom CSS with gradients and animations
- **Responsive**: Mobile-first design
- **Performance**: Optimized for fast loading
- **Accessibility**: Screen reader friendly

## Deployment

### Cache busting: bump `?v=` when CSS/JS changes

GitHub Pages tells browsers to cache files for 10 minutes, so after a
deploy returning visitors can see new HTML with old styles. Every page
links its local CSS/JS with a version, e.g. `styles.css?v=20261017`.
When you change `styles.css`, `demo-apps.css` or any local `.js` file,
change that version on every page to today's date (add `b`, `c`... for
more deploys on the same day) so browsers fetch the new file at once:

```bash
# example: replace the old version with a new one across all pages
sed -i 's/?v=20261017/?v=20261018/g' *.html
```

This site is optimized for **GitHub Pages** static hosting:

1. Push files to GitHub repository
2. Enable GitHub Pages in repository settings
3. Site automatically deploys to `https://yourusername.github.io/repositoryname`

## Features

✅ **Responsive Design** - Works on all devices
✅ **Modern Animations** - Smooth hover effects and transitions
✅ **Professional Layout** - Corporate-grade design
✅ **SEO Optimized** - Search engine friendly
✅ **Fast Loading** - Optimized performance
✅ **Cross-Browser** - Compatible with all modern browsers

## Contact

Transform your business with Cloud UKO's integrated digital solutions.

**Ready to get started?** [Contact us today](contact.html)

---

© 2025 Cloud UKO. Transforming businesses through integrated digital solutions.