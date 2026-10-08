# Cloud UKO - Digital Transformation Solutions

## Version 2.0 🆕

Cloud UKO Version 2 features enhanced design, improved performance, and expanded service offerings. This version includes professional animations, optimized responsiveness, and a refined user interface for better customer engagement.

🚀 **Live Website**: [View on GitHub Pages](https://yourusername.github.io/Cloud_uko_V2)

## About Cloud UKO

Cloud UKO (United Knowledge Operations) provides integrated digital transformation solutions for businesses of all sizes. We specialize in:

- ☁️ **Cloud Infrastructure** - Secure, scalable cloud solutions
- ⚡ **Smart Automation** - Save 20+ hours weekly
- 🛡️ **Enterprise Security** - Bank-level encryption
- 📈 **Growth Analytics** - Real-time insights
- 👥 **CRM Integration** - Unified customer management
- ✅ **Proven Results** - Up to 85% cost reduction

## Digital Transformation Packages

### 🔴 Small Business - R 23,000
Perfect for freelancers, start-ups, and small shops
- Monthly upkeep: R 4,800/mo
- ROI: +773%
- Savings: R 502,500

### 🔵 Medium Business - R 45,000 ⭐ **Featured**
Ideal for growing companies and agencies
- Monthly upkeep: R 11,500/mo  
- ROI: +503%
- Savings: R 1,001,000

### 🟣 Enterprise - R 830,000
High-performance automation for large organizations
- Monthly upkeep: Contact us
- ROI: +141-381%
- Savings: R 1.17M - 3.17M

## Website Structure

- `index.html` - Homepage with hero section and packages
- `about.html` - Company information
- `service.html` - Detailed services and pricing
- `projects.html` - Portfolio and case studies
- `demos.html` - Live demo hub (ERP, Invoicing, POS, Booking)
- `contact.html` - Contact form and information
- `demo-erp.html`, `demo-invoice.html`, `demo-pos.html` - Interactive
  demo apps, gated by the trial system below
- `trial-signup.html`, `trial-login.html`, `trial-account.html`,
  `trial-upgrade-success.html`, `trial-upgrade-cancelled.html` - Trial
  signup/login/account/payment-return pages
- `server/` - Small Node.js backend for the trial system (PayFast
  payments + webhook) - deployed separately on Render, not part of
  the static GitHub Pages site

## Demo Trial System

The three interactive demos (`demo-erp.html`, `demo-invoice.html`,
`demo-pos.html`) are gated behind a 7-day free trial: visitors sign up
once to unlock all three, and after 7 days they're prompted to
purchase (via PayFast) to keep access.

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
in the visitor's browser via `localStorage`, same as before - only
*access to the page itself* is gated by a real account now.

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