/**
 * Shared trial auth/gate logic for the signup, login, and demo pages.
 * Depends on trial-config.js and the Supabase JS CDN bundle being
 * loaded first (see any page that uses this for the <script> order).
 */

// Null if the Supabase CDN bundle failed to load - the demo pages still
// open in preview mode in that case rather than breaking outright.
const trialSupabase = window.supabase
    ? window.supabase.createClient(TRIAL_CONFIG.SUPABASE_URL, TRIAL_CONFIG.SUPABASE_ANON_KEY)
    : null;

const TRIAL_WHATSAPP_NUMBER = '27740926666';

// How many key actions (checkout, save invoice, add item...) a visitor
// gets across the demos before being asked to create a free account.
const TRIAL_PREVIEW_FREE_ACTIONS = 3;
const TRIAL_PREVIEW_STORAGE_KEY = 'clouduko_preview_actions';

// Set by trialInitDemo(): { mode: 'preview' | 'trial' | 'active' | 'expired', status, demoName }
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
 */
async function trialInitDemo(demoName) {
    let mode = 'preview';
    let status = null;

    try {
        status = await trialGetStatus();
        if (status) {
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
 */
function trialAllow(kind) {
    const { mode } = trialDemoState;
    if (mode === 'trial' || mode === 'active') return true;

    if (mode === 'preview' && kind !== 'export') {
        const used = trialPreviewActionsUsed();
        if (used < TRIAL_PREVIEW_FREE_ACTIONS) {
            try { localStorage.setItem(TRIAL_PREVIEW_STORAGE_KEY, String(used + 1)); } catch (e) { /* storage blocked - stay ungated */ }
            return true;
        }
    }

    renderTrialGate();
    return false;
}

function trialPreviewActionsUsed() {
    try {
        return parseInt(localStorage.getItem(TRIAL_PREVIEW_STORAGE_KEY), 10) || 0;
    } catch (e) {
        return 0;
    }
}

function trialFormatDate(iso) {
    return new Date(iso).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** WhatsApp link with a prefilled enquiry naming the demo being viewed. */
function trialWhatsAppUrl() {
    const text = `Hi Cloud UKO, I tried the ${trialDemoState.demoName || 'live'} demo and would like something like this built for my business.`;
    return 'https://wa.me/' + TRIAL_WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text);
}

function trialSignupUrl() {
    return 'trial-signup.html?next=' + encodeURIComponent(window.location.pathname);
}

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
        if (status.days_remaining <= 2) banner.className += ' urgent';
        message = `${status.days_remaining} day${status.days_remaining === 1 ? '' : 's'} left in your free trial (ends ${trialFormatDate(status.trial_end)})`;
    } else if (mode === 'expired') {
        message = 'Your free trial has ended - you can still look around';
    } else {
        message = 'Live preview - no signup needed';
    }

    banner.innerHTML = `<span>${message}</span>
        <a href="${trialWhatsAppUrl()}" class="demo-app-btn-ghost trial-banner-cta" target="_blank" rel="noopener noreferrer">Want this built for your business? →</a>`;
    bar.insertAdjacentElement('afterend', banner);
}

/** Dismissible prompt shown by trialAllow() when an action needs an account. */
function renderTrialGate() {
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
