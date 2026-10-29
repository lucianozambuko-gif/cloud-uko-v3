// Captures the "scrolling preview" images for the demos page cabinets:
// one tall JPEG per live site, saved as img/showcase/<name>-full.jpg.
//
// Why scroll-and-stitch instead of one full-page screenshot: most of these
// sites fade content in as you scroll, so a single tall capture comes out
// half blank. This scrolls one screen at a time (letting each section
// appear), hides fixed headers/buttons after the first screen so they don't
// repeat, then stitches the frames together on a <canvas> in the browser.
//
// No dependencies - needs Node 22+ (built-in WebSocket) and Chrome:
//   1. Start Chrome with remote debugging (Windows example):
//      "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --remote-debugging-port=9336 --user-data-dir=%TEMP%\cu-shots
//   2. node tools/capture-previews.mjs            (all sites)
//      node tools/capture-previews.mjs tea-cakes  (just one)
// When you retake an image that's already live, add ?v=<date> to its
// data-full in demos.html so browsers fetch the new one.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../img/showcase/', import.meta.url));
const PORT = process.env.CDP_PORT || 9336;
const VIEW_W = 1280, VIEW_H = 800;   // desktop viewport, same as the static screenshots
const MAX_H = 5600;                  // cap at 7 screens so files stay small
const SCALE = 0.5;                   // saved at 640px wide - plenty for a ~380px cabinet screen
const QUALITY = 0.6;

const SITES = {
    'booking':          'https://online-tutor-web.vercel.app/',
    'erp':              'https://clouduko-erp.onrender.com/',
    'mullers-delights': 'https://mullers-delights.onrender.com/',
    'vees-sparkles':    'https://vees-sparkles.onrender.com/',
    'tea-cakes':        'https://teacakes.vercel.app/',
    'lavish-bites':     'https://lucianozambuko-gif.github.io/lavish-life/',
    'sic':              'https://lucianozambuko-gif.github.io/S.I.C/',
    'unako':            'https://lucianozambuko-gif.github.io/Unako/',
};

const only = process.argv.slice(2);
const targets = Object.entries(SITES).filter(([name]) => !only.length || only.includes(name));

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise((ok, fail) => { ws.addEventListener('open', ok); ws.addEventListener('error', fail); });
let id = 0; const pending = new Map();
ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.result?.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: VIEW_W, height: VIEW_H, deviceScaleFactor: 1, mobile: false });

for (const [name, url] of targets) {
    await send('Page.navigate', { url });
    // Free-tier servers can take ~30s to wake; poll until the page has real content
    for (let i = 0; i < 40 && !(await ev(`document.readyState === 'complete' && document.body && document.body.innerText.length > 200`)); i++) await sleep(1500);
    await sleep(5000); // fonts, hero images, intro animations
    // Instant scrolling, and no scrollbar strip down the right of the image
    await ev(`document.documentElement.style.scrollBehavior = 'auto';
        document.head.insertAdjacentHTML('beforeend', '<style>html{scrollbar-width:none}::-webkit-scrollbar{display:none}</style>')`);
    // transition:none first - many sites animate their header/chat button, which would
    // otherwise still be half-faded when the frame is taken
    const hideFixed = `document.querySelectorAll('body *').forEach(el => { const p = getComputedStyle(el).position;
        if (p === 'fixed' || p === 'sticky') { el.style.setProperty('transition', 'none', 'important'); el.style.setProperty('visibility', 'hidden', 'important'); el.style.setProperty('opacity', '0', 'important'); } })`;

    const total = Math.min(MAX_H, await ev('document.documentElement.scrollHeight'));
    if (total <= VIEW_H) console.warn(`  ! ${name}: page is only one screen tall - a free-tier server may still be waking up. Re-run: node tools/capture-previews.mjs ${name}`);
    const frames = [];
    for (let y = 0; y < total; y += VIEW_H) {
        const actualY = await ev(`(window.scrollTo({ top: ${y}, behavior: 'instant' }), window.scrollY)`);
        await sleep(1100); // let this section's scroll animations finish
        // Hide fixed/sticky things (headers, chat buttons) so they appear once, at the top.
        // Done after the wait: some sites only make the header fixed once you've scrolled.
        if (y > 0) { await ev(hideFixed); await sleep(150); }
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        frames.push({ y: actualY, data: shot.result.data });
        if (actualY < y) break; // hit the bottom early
    }

    // Stitch on a canvas inside the browser, cropped to `total`, scaled down, as JPEG
    await send('Page.navigate', { url: 'about:blank' });
    await sleep(300);
    const jpeg = await ev(`(async () => {
        const frames = ${JSON.stringify(frames)};
        const c = document.createElement('canvas');
        c.width = ${VIEW_W * SCALE}; c.height = Math.round(${total} * ${SCALE});
        const g = c.getContext('2d');
        for (const f of frames) {
            const img = new Image();
            img.src = 'data:image/png;base64,' + f.data;
            await img.decode();
            g.drawImage(img, 0, Math.round(f.y * ${SCALE}), ${VIEW_W * SCALE}, ${VIEW_H * SCALE});
        }
        return c.toDataURL('image/jpeg', ${QUALITY}).split(',')[1];
    })()`);
    const buf = Buffer.from(jpeg, 'base64');
    writeFileSync(OUT + name + '-full.jpg', buf);
    console.log(`${name}-full.jpg  ${VIEW_W * SCALE}x${Math.round(total * SCALE)}  ${Math.round(buf.length / 1024)} KB`);
}
ws.close();
