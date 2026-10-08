/**
 * Cloud UKO demo trial backend.
 *
 * Two jobs only:
 *  1. POST /api/create-payment - a logged-in trial user wants to upgrade.
 *     Builds a signed PayFast payment request and hands the fields back
 *     to the frontend, which auto-submits them as a form POST to PayFast.
 *  2. POST /api/payfast-itn - PayFast's server-to-server webhook
 *     confirming a payment actually happened. Verified four ways
 *     (signature, source host, amount, and PayFast's own validate
 *     endpoint) before trial_access is ever marked "active" - nothing
 *     the browser sends is trusted on its own.
 *
 * The Supabase service_role key used here bypasses Row Level Security,
 * which is exactly why this logic has to live in a server the browser
 * can't reach into, rather than in the static site's own JS.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { buildPaymentFields, verifyItnSignature, confirmWithPayfast, verifyItnSourceHost } = require('./payfast');

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    PAYFAST_MERCHANT_ID,
    PAYFAST_MERCHANT_KEY,
    PAYFAST_PASSPHRASE,
    PAYFAST_MODE,
    SITE_URL,
    SERVER_URL,
    TRIAL_UPGRADE_AMOUNT,
    ALLOWED_ORIGIN,
    PORT
} = process.env;

const required = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, SITE_URL, SERVER_URL };
for (const [name, value] of Object.entries(required)) {
    if (!value) {
        // Fail loudly at startup rather than silently misbehaving on the
        // first real request.
        console.error(`Missing required env var: ${name}. Check server/.env against .env.example.`);
        process.exit(1);
    }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const app = express();
app.set('trust proxy', true); // Render sits behind a proxy; needed for a real req.ip

app.use(cors({ origin: ALLOWED_ORIGIN || SITE_URL }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function getUserFromAuthHeader(req) {
    const authHeader = req.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return null;
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/create-payment', async (req, res) => {
    try {
        const user = await getUserFromAuthHeader(req);
        if (!user) return res.status(401).json({ error: 'Not signed in' });

        const { data: trial, error: trialErr } = await supabase
            .from('trial_access')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (trialErr || !trial) return res.status(404).json({ error: 'No trial found for this account' });
        if (trial.status === 'active') return res.status(400).json({ error: 'Already active - no payment needed' });

        const mPaymentId = `cu-${user.id.slice(0, 8)}-${Date.now()}`;
        const amount = Number(TRIAL_UPGRADE_AMOUNT || '499.00').toFixed(2);

        const fields = buildPaymentFields(
            {
                return_url: `${SITE_URL}/trial-upgrade-success.html`,
                cancel_url: `${SITE_URL}/trial-upgrade-cancelled.html`,
                notify_url: `${SERVER_URL}/api/payfast-itn`,
                email_address: user.email,
                m_payment_id: mPaymentId,
                amount,
                item_name: 'Cloud UKO Demo Access',
                item_description: 'Continued access to the Cloud UKO ERP/Invoicing/POS demo systems',
                custom_str1: user.id // carried through untouched by PayFast - how the ITN knows who paid
            },
            { merchantId: PAYFAST_MERCHANT_ID, merchantKey: PAYFAST_MERCHANT_KEY, passphrase: PAYFAST_PASSPHRASE }
        );

        // Record the pending payment ID so it's inspectable even before
        // the ITN arrives, and so the ITN handler can cross-check it.
        await supabase.from('trial_access').update({ payfast_payment_id: mPaymentId }).eq('user_id', user.id);

        res.json({
            actionUrl: `${PAYFAST_MODE === 'live' ? 'https://www.payfast.co.za' : 'https://sandbox.payfast.co.za'}/eng/process`,
            fields
        });
    } catch (err) {
        console.error('create-payment error:', err);
        res.status(500).json({ error: 'Could not start the payment' });
    }
});

app.post('/api/payfast-itn', async (req, res) => {
    // Acknowledge immediately - PayFast expects a fast 200 regardless of
    // what the checks below find, and will retry if it doesn't get one.
    res.status(200).send('OK');

    try {
        const body = req.body || {};
        const orderedEntries = Object.entries(body);
        const postedSignature = body.signature;

        const { valid: signatureValid, paramString } = verifyItnSignature(
            orderedEntries,
            postedSignature,
            PAYFAST_PASSPHRASE
        );
        if (!signatureValid) {
            console.warn('ITN rejected: bad signature', { mPaymentId: body.m_payment_id });
            return;
        }

        const sourceOk = await verifyItnSourceHost(req.ip);
        if (!sourceOk) {
            console.warn('ITN rejected: request did not come from a known PayFast host', { ip: req.ip });
            return;
        }

        // paramString above includes the passphrase (needed for the
        // signature); PayFast's own validate endpoint wants the raw
        // posted fields only, so rebuild without it.
        const rawParamString = orderedEntries
            .filter(([k]) => k !== 'signature')
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&');
        const confirmed = await confirmWithPayfast(rawParamString, PAYFAST_MODE);
        if (!confirmed) {
            console.warn('ITN rejected: PayFast validate endpoint did not confirm', { mPaymentId: body.m_payment_id });
            return;
        }

        const userId = body.custom_str1;
        if (!userId) {
            console.warn('ITN accepted but had no custom_str1 (user id) - cannot credit anyone', body.m_payment_id);
            return;
        }

        const expectedAmount = Number(TRIAL_UPGRADE_AMOUNT || '499.00');
        const paidAmount = Number(body.amount_gross);
        if (Math.abs(paidAmount - expectedAmount) > 0.01) {
            console.warn('ITN amount mismatch', { expected: expectedAmount, got: paidAmount, userId });
            return;
        }

        if (body.payment_status === 'COMPLETE') {
            const { error } = await supabase
                .from('trial_access')
                .update({ status: 'active', payfast_payment_id: body.pf_payment_id || body.m_payment_id })
                .eq('user_id', userId);

            if (error) {
                console.error('Failed to mark trial active after verified payment:', error, { userId });
            } else {
                console.log('Trial upgraded to active for user', userId);
            }
        } else {
            console.log('ITN verified but payment_status was', body.payment_status, { userId });
        }
    } catch (err) {
        console.error('payfast-itn processing error:', err);
    }
});

const port = PORT || 3001;
app.listen(port, () => console.log(`Cloud UKO demo trial server listening on port ${port}`));
