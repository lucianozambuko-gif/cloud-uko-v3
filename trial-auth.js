/**
 * Shared trial auth/gate logic for the signup, login, and demo pages.
 * Depends on trial-config.js and the Supabase JS CDN bundle being
 * loaded first (see any page that uses this for the <script> order).
 */

const trialSupabase = window.supabase.createClient(TRIAL_CONFIG.SUPABASE_URL, TRIAL_CONFIG.SUPABASE_ANON_KEY);

/** Current session's access token, or null if signed out. */
async function trialGetToken() {
    const { data } = await trialSupabase.auth.getSession();
    return data?.session?.access_token || null;
}

/** Current user object, or null if signed out. */
async function trialGetUser() {
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
 * Call at the top of every gated demo page. Redirects to signup if
 * there's no session, renders a trial banner / paywall as needed, and
 * resolves with the status object only when the visitor actually has
 * access (so the caller can safely render the real demo).
 */
async function trialRequireAccess() {
    const user = await trialGetUser();
    if (!user) {
        window.location.href = 'trial-signup.html?next=' + encodeURIComponent(window.location.pathname);
        return null;
    }

    const status = await trialGetStatus();
    if (!status) {
        // Signed in but no trial row (shouldn't normally happen) - send
        // them back through signup to create one rather than get stuck.
        window.location.href = 'trial-signup.html';
        return null;
    }

    if (!status.has_access) {
        renderTrialGate(status);
        return null;
    }

    renderTrialBanner(status);
    return status;
}

function trialFormatDate(iso) {
    return new Date(iso).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderTrialBanner(status) {
    const bar = document.querySelector('.demo-app-bar');
    if (!bar) return;

    const banner = document.createElement('div');
    banner.className = 'trial-banner';
    if (status.status === 'active') {
        banner.innerHTML = `<span>✓ Full access active</span>`;
    } else {
        const urgent = status.days_remaining <= 2;
        banner.className += urgent ? ' urgent' : '';
        banner.innerHTML = `<span>${status.days_remaining} day${status.days_remaining === 1 ? '' : 's'} left in your trial (ends ${trialFormatDate(status.trial_end)})</span>
            <a href="trial-account.html" class="demo-app-btn-ghost">Upgrade Now</a>`;
    }
    bar.insertAdjacentElement('afterend', banner);
}

function renderTrialGate(status) {
    document.body.innerHTML = `
        <div class="trial-gate">
            <div class="trial-gate-card">
                <div class="demo-app-badge" style="margin-bottom:1rem;">Trial Ended</div>
                <h1>Your 7-day trial has ended</h1>
                <p>Your trial ran from ${trialFormatDate(status.trial_start)} to ${trialFormatDate(status.trial_end)}. Purchase now to keep full access to the ERP, Invoicing, and POS demos.</p>
                <div class="demo-form-actions" style="justify-content:center;">
                    <button type="button" class="btn btn-primary" id="trialUpgradeBtn">Purchase Access →</button>
                    <a href="index.html" class="demo-app-btn-ghost">Back to Cloud UKO</a>
                </div>
                <p class="trial-gate-note" id="trialUpgradeMsg"></p>
            </div>
        </div>
    `;
    document.getElementById('trialUpgradeBtn').addEventListener('click', trialStartUpgrade);
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
