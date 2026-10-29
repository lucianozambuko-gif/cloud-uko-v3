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
- `demos.html` - Live demo hub: real projects we built. The Lumen
  booking marketplace and the client sites open live; the School ERP
  and POS sit behind staff logins, so their cards are "demo on request"
  and open a pre-filled WhatsApp message. Filter buttons narrow it to
  live apps / on request / client sites, and each card's "built with"
  tags come from that project's repo
- `contact.html` - Contact form and information
- `game.css` / `game.js` - The shared "game" theme (styles and
  interactivity) used by every page
- `tools/capture-previews.mjs` - Retakes the demos page's scrolling
  previews (dev tool, not part of the site - see below)

The static site needs no build step - open the HTML files directly or
serve the repo root with any static file server.

### Light / dark mode

Every page has a sun/moon button in the HUD. The theme is stored as
`data-theme="light|dark"` on `<html>`:

- A tiny inline `<script>` at the top of each page's `<head>` picks the
  theme **before the page is drawn** (the visitor's saved choice, else
  their device's light/dark setting), so light-mode visitors never see
  a flash of the dark theme. Keep it above the `game.css` link on any
  new page.
- `game.js` ("THEME TOGGLE") switches it, remembers the choice in
  `localStorage` (`cu_theme`), and keeps following the device setting
  until the visitor picks one.
- `game.css` section 22 is the whole light theme: it overrides the
  colour tokens from section 1 plus a handful of rules. When you add a
  colour, make it a token (or use an existing one) so both themes pick
  it up.

### Demos page screenshots and scrolling previews

Each cabinet on `demos.html` has two images in `img/showcase/`:

- `src` - a 1280x800 screenshot of the site's homepage
- `data-full` - a tall capture of the whole site (`<name>-full.jpg`),
  panned from top to bottom when you hover the cabinet (or, on phones,
  while it's in the middle of the screen). It's only downloaded at that
  point, to save mobile data.

Retake the tall captures when a site changes (needs Node 22+ and Chrome,
no installs):

```bash
# 1. start Chrome with remote debugging (Windows example)
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --remote-debugging-port=9336 --user-data-dir=%TEMP%\cu-shots
# 2. all sites, or name the ones you want
node tools/capture-previews.mjs
node tools/capture-previews.mjs tea-cakes sic
```

Free-tier Render sites can still be waking up on the first try - the
script warns you if a capture comes out one screen tall; just re-run it
for that site. When replacing an image that's already live, add
`?v=<date>` to its `src`/`data-full` so browsers fetch the new one.

### Fonts

Loaded from Google Fonts in each page's `<head>` and set as tokens at
the top of `game.css`: **Oxanium** (`--font-display`, headings and
buttons), **Share Tech Mono** (`--font-mono`, small HUD labels and
tags - see section 21 of `game.css`) and **Inter** (`--font-body`).
If you change a font, update the Google Fonts link on every page.

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
When you change `game.css` or any local `.js` file,
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
✅ **Light & Dark Mode** - Follows the visitor's device, with a toggle on every page
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