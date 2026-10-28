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
  and open a pre-filled WhatsApp message. The cabinet screenshots are
  in `img/showcase/` - retake one when that site's homepage changes
- `contact.html` - Contact form and information
- `game.css` / `game.js` - The shared "game" theme (styles and
  interactivity) used by every page

The static site needs no build step - open the HTML files directly or
serve the repo root with any static file server.

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