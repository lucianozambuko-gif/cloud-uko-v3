/**
 * Shared trial auth/gate logic for the signup, login, and demo pages.
 * Depends on trial-config.js and the Supabase JS CDN bundle being
 * loaded first (see any page that uses this for the <script> order).
 *
 * How the demos are shown to visitors
 * -----------------------------------
 * The ERP, Invoicing and POS demos are a sales tool, so they open
 * instantly for everyone ("preview mode") instead of forcing a signup
 * first. Each visitor is in one of four modes:
 *
 *   preview  - no account (or Supabase unreachable). Full demo, but only
 *              TRIAL_PREVIEW_FREE_ACTIONS key actions before we ask them
 *              to create a free account. Print / PDF always asks.
 *   trial    - signed up, inside the 7-day free trial. No limits.
 *   active   - paid for ongoing access. No limits.
 *   expired  - trial over. They can still look around, but key actions
 *              show a "talk to us" prompt (WhatsApp / quote) instead.
 *
 * Demo pages use two functions from this file:
 *   await trialInitDemo('POS System')  - once, at the top of the page
 *   if (!trialAllow('action')) return; - before each key action
 *
 * Important: the demos are static pages, so the "free actions" limit is
 * lead capture, not security - anyone could bypass it in dev tools. The
 * things that matter (trial dates, paid status) are enforced server-side
 * by Supabase Row Level Security and the PayFast webhook in server/.
 */

// Null if the Supabase CDN bundle failed to load (ad blocker, flaky
// network) - the demo pages still open in preview mode in that case
// rather than breaking outright.
const trialSupabase = window.supabase
    ? window.supabase.createClient(TRIAL_CONFIG.SUPABASE_URL, TRIAL_CONFIG.SUPABASE_ANON_KEY)
    : null;

// Cloud UKO's WhatsApp number in international format (no + or spaces),
// as wa.me links require. Used for every "talk to us" call to action.
const TRIAL_WHATSAPP_NUMBER = '27740926666';

// How many key actions (checkout, save invoice, add item...) a visitor
// gets across the demos before being asked to create a free account.
// The count is shared by all three demos and kept in localStorage.
const TRIAL_PREVIEW_FREE_ACTIONS = 3;
const TRIAL_PREVIEW_STORAGE_KEY = 'clouduko_preview_actions';

// Set by trialInitDemo(): { mode: 'preview' | 'trial' | 'active' | 'expired', status, demoName }
// Defaults to preview so trialAllow() behaves sensibly even if it's
// somehow called before trialInitDemo() has finished.
let trialDemoState = { mode: 'preview', status: null, demoName: '' };

/** Current session's access token, or null if signed out. */
async function trialGetToken() {
    if (!trialSupabase) return null;
    const { data } = await trialSupabase.auth.getSession();
    return data?.session?.access_token || null;
}

/** Current user object, or null if signed out. */
async function trialGetUser() {
    if (!trialSupabase) return null;
    const { data } = await trialSupabase.auth.getUser();
    return data?.user || null;
}

/**
 * Looks up the signed-in user's trial status via the trial_status view
 * (see supabase/schema.sql). Returns null if there's no row yet (e.g.
 * signup succeeded but the insert into trial_access failed).
 */
async function trialGetStatus() {
    const user = await trialGetUser();
    if (!user) return null;

    const { data, error } = await trialSupabase
        .from('trial_status')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error || !data) return null;
    return data;
}

async function trialSignOut() {
    await trialSupabase.auth.signOut();
    window.location.href = 'trial-login.html';
}

/**
 * Call at the top of every demo page. Never blocks the page: visitors
 * without an account (or whose trial has ended) get the demo in preview
 * mode, and trialAllow() asks them to sign up once they try to go
 * deeper. Renders the banner under the app bar and resolves with the
 * state object ({ mode, status, demoName }).
 *
 * demoName is used in the banner's prefilled WhatsApp message, e.g.
 * "I tried the POS System demo...", so enquiries say what they saw.
 */
async function trialInitDemo(demoName) {
    let mode = 'preview';
    let status = null;

    try {
        // No session -> trialGetStatus() returns null without a network
        // call, so anonymous visitors don't wait on Supabase at all.
        status = await trialGetStatus();
        if (status) {
            // trial_status.status is 'active' once PayFast confirms payment;
            // otherwise has_access tells us if the 7-day window is still open.
            mode = status.status === 'active' ? 'active' : (status.has_access ? 'trial' : 'expired');
        }
    } catch (err) {
        // Supabase unreachable - fall back to preview rather than a dead page.
        console.error('Trial status lookup failed, showing preview mode:', err);
    }

    trialDemoState = { mode, status, demoName };
    renderTrialBanner();
    return trialDemoState;
}

/**
 * Call before a key action. Returns true if it may go ahead; otherwise
 * shows the signup / contact prompt and returns false. Pass 'export'
 * for take-away actions (print / PDF) that always need an account.
 *
 * Callers should validate the form first and call this last, so a
 * visitor doesn't use up a free action on a submit that fails anyway.
 */
function trialAllow(kind) {
    const { mode } = trialDemoState;

    // Signed-up and paying visitors are never limited.
    if (mode === 'trial' || mode === 'active') return true;

    // Preview visitors spend one free action per call until they run out.
    // Exports skip this branch, so they always fall through to the prompt.
    if (mode === 'preview' && kind !== 'export') {
        const used = trialPreviewActionsUsed();
        if (used < TRIAL_PREVIEW_FREE_ACTIONS) {
            try { localStorage.setItem(TRIAL_PREVIEW_STORAGE_KEY, String(used + 1)); } catch (e) { /* storage blocked - stay ungated */ }
            return true;
        }
    }

    // Out of free actions, an export, or an expired trial: show the prompt.
    renderTrialGate();
    return false;
}

/**
 * Number of free preview actions already used. Returns 0 if storage is
 * blocked (private browsing, strict privacy settings) - those visitors
 * simply never hit the limit, which is fine for lead capture.
 */
function trialPreviewActionsUsed() {
    try {
        return parseInt(localStorage.getItem(TRIAL_PREVIEW_STORAGE_KEY), 10) || 0;
    } catch (e) {
        return 0;
    }
}

/** Formats an ISO date the South African way, e.g. "13 Oct 2026". */
function trialFormatDate(iso) {
    return new Date(iso).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** WhatsApp link with a prefilled enquiry naming the demo being viewed. */
function trialWhatsAppUrl() {
    const text = `Hi Cloud UKO, I tried the ${trialDemoState.demoName || 'live'} demo and would like something like this built for my business.`;
    return 'https://wa.me/' + TRIAL_WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text);
}

/**
 * Signup link that brings the visitor back to the demo they were on.
 * trial-signup.html reads ?next= and redirects there after signup.
 */
function trialSignupUrl() {
    return 'trial-signup.html?next=' + encodeURIComponent(window.location.pathname);
}

/**
 * Inserts the strip under the demo's app bar. The left side tells the
 * visitor where they stand (preview / days left / active / ended); the
 * right side is always the "Want this built for your business?" WhatsApp
 * button, because turning demo visitors into project enquiries is the
 * point of the demos.
 */
function renderTrialBanner() {
    const bar = document.querySelector('.demo-app-bar');
    if (!bar) return;

    const { mode, status } = trialDemoState;
    const banner = document.createElement('div');
    banner.className = 'trial-banner';

    let message;
    if (mode === 'active') {
        message = '✓ Full access active';
    } else if (mode === 'trial') {
        // Turn the banner red for the last two days as a gentle nudge.
        if (status.days_remaining <= 2) banner.className += ' urgent';
        message = `${status.days_remaining} day${status.days_remaining === 1 ? '' : 's'} left in your free trial (ends ${trialFormatDate(status.trial_end)})`;
    } else if (mode === 'expired') {
        message = 'Your free trial has ended - you can still look around';
    } else {
        message = 'Live preview - no signup needed';
    }

    // Safe to build with innerHTML: message only contains our own text
    // plus numbers/dates from the trial_status view, never user input.
    banner.innerHTML = `<span>${message}</span>
        <a href="${trialWhatsAppUrl()}" class="demo-app-btn-ghost trial-banner-cta" target="_blank" rel="noopener noreferrer">Want this built for your business? →</a>`;
    bar.insertAdjacentElement('afterend', banner);
}

/**
 * Dismissible prompt shown by trialAllow() when an action needs an account.
 * It's an overlay on top of the demo (not a page replacement), so closing
 * it drops the visitor back exactly where they were - e.g. their cart is
 * still there. Two versions:
 *   - expired trial: contact-first (WhatsApp / quote), with a small link
 *     to the account page where paid access can still be bought
 *   - preview: "create a free account" first, WhatsApp as the alternative
 */
function renderTrialGate() {
    // Only ever one prompt on screen, even if several actions fire quickly.
    if (document.querySelector('.trial-gate')) return;

    const { mode } = trialDemoState;
    const gate = document.createElement('div');
    gate.className = 'trial-gate';

    if (mode === 'expired') {
        gate.innerHTML = `
            <div class="trial-gate-card" role="dialog" aria-modal="true" aria-labelledby="trialGateTitle">
                <div class="demo-app-badge" style="margin-bottom:1rem;">Trial Ended</div>
                <h1 id="trialGateTitle">Your 7-day trial has ended</h1>
                <p>You can still look around the demos. Ready for a system like this, tailored to how your business runs?</p>
                <div class="demo-form-actions" style="justify-content:center;">
                    <a href="${trialWhatsAppUrl()}" class="btn btn-primary" target="_blank" rel="noopener noreferrer">Chat on WhatsApp →</a>
                    <a href="contact.html" class="demo-app-btn-ghost">Request a Quote</a>
                </div>
                <button type="button" class="trial-gate-dismiss" data-trial-gate-close>Keep looking around</button>
                <p class="trial-gate-alt">Just want to keep using the demos? <a href="trial-account.html">Manage your account</a></p>
            </div>
        `;
    } else {
        // Log In also carries ?next= so returning users land back on this demo.
        gate.innerHTML = `
            <div class="trial-gate-card" role="dialog" aria-modal="true" aria-labelledby="trialGateTitle">
                <div class="demo-app-badge" style="margin-bottom:1rem;">Free Account</div>
                <h1 id="trialGateTitle">Like what you see?</h1>
                <p>Create a free account to keep going - 7 days of unlimited use of the ERP, Invoicing, and POS demos, including printing and PDF export. No credit card needed.</p>
                <div class="demo-form-actions" style="justify-content:center;">
                    <a href="${trialSignupUrl()}" class="btn btn-primary">Create Free Account →</a>
                    <a href="trial-login.html?next=${encodeURIComponent(window.location.pathname)}" class="demo-app-btn-ghost">Log In</a>
                </div>
                <button type="button" class="trial-gate-dismiss" data-trial-gate-close>Keep looking around</button>
                <p class="trial-gate-alt">Rather talk to a person? <a href="${trialWhatsAppUrl()}" target="_blank" rel="noopener noreferrer">Chat to us on WhatsApp</a></p>
            </div>
        `;
    }

    // Close on the dismiss button or a click on the backdrop itself.
    // (e.target === gate means the click landed outside the card.)
    gate.addEventListener('click', (e) => {
        if (e.target === gate || e.target.closest('[data-trial-gate-close]')) gate.remove();
    });
    document.body.appendChild(gate);
}

/** Calls the backend to create a signed PayFast payment, then submits it. */
async function trialStartUpgrade() {
    const msg = document.getElementById('trialUpgradeMsg');
    const btn = document.getElementById('trialUpgradeBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Preparing payment…'; }

    try {
        const token = await trialGetToken();
        const res = await fetch(TRIAL_CONFIG.BACKEND_URL + '/api/create-payment', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token }
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'Could not start payment');

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = payload.actionUrl;
        Object.entries(payload.fields).forEach(([name, value]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            input.value = value;
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
    } catch (err) {
        if (msg) msg.textContent = err.message || 'Something went wrong starting the payment. Please try again.';
        if (btn) { btn.disabled = false; btn.textContent = 'Purchase Access →'; }
    }
}
