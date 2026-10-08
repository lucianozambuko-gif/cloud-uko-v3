/**
 * PayFast integration helpers.
 *
 * Implements PayFast's documented "Custom Integration" protocol:
 *  - generatePaymentSignature(): builds the signature for an outgoing
 *    payment request, using PayFast's fixed field order.
 *  - verifyItnSignature(): builds the signature for an incoming ITN
 *    (Instant Transaction Notification) webhook, using the order the
 *    fields were actually posted in.
 *  - verifyItnSourceHost(): confirms the request actually came from a
 *    PayFast domain.
 *  - confirmWithPayfast(): the mandatory server-to-server "is this
 *    notification genuine" callback to PayFast itself.
 *
 * Field order and the urlencode/MD5 approach below are taken from
 * PayFast's own public PHP SDK (github.com/Payfast/payfast-php-sdk,
 * lib/Auth.php and lib/PaymentIntegrations/Notification.php) so the
 * signature this produces matches what PayFast expects byte-for-byte.
 * This file is an original Node.js implementation of that documented
 * protocol, not a port of their code.
 */

const crypto = require('crypto');
const dns = require('dns').promises;

// Fixed field order PayFast requires for the OUTGOING payment signature.
// Passphrase has a specific slot in this order - it is NOT just appended
// at the end.
const PAYMENT_SIGNATURE_FIELDS = [
    'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
    'notify_method', 'name_first', 'name_last', 'email_address', 'cell_number',
    'm_payment_id', 'amount', 'item_name', 'item_description',
    'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
    'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
    'email_confirmation', 'confirmation_address', 'currency', 'payment_method',
    'subscription_type', 'passphrase', 'billing_date', 'recurring_amount',
    'frequency', 'cycles', 'subscription_notify_email',
    'subscription_notify_webhook', 'subscription_notify_buyer'
];

const VALID_PAYFAST_HOSTS = [
    'www.payfast.co.za',
    'sandbox.payfast.co.za',
    'w1w.payfast.co.za',
    'w2w.payfast.co.za'
];

/**
 * PHP's urlencode() differs from JS encodeURIComponent(): it encodes
 * spaces as "+" (not %20) and additionally encodes ! ' ( ) * - all of
 * which PayFast's own signature generation relies on. Getting this
 * wrong silently breaks every signature, so it's reproduced carefully.
 */
function phpUrlEncode(value) {
    return encodeURIComponent(String(value))
        .replace(/%20/g, '+')
        .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function baseUrl(mode) {
    return mode === 'live' ? 'https://www.payfast.co.za' : 'https://sandbox.payfast.co.za';
}

/**
 * Builds the signed field set for a new payment request. Returns the
 * full set of fields (including merchant_id/merchant_key/signature)
 * ready to be posted as a hidden form to PayFast's /eng/process URL.
 */
function buildPaymentFields(data, { merchantId, merchantKey, passphrase }) {
    const payload = { merchant_id: merchantId, merchant_key: merchantKey, ...data };

    let paramString = '';
    for (const field of PAYMENT_SIGNATURE_FIELDS) {
        if (field === 'passphrase') {
            if (passphrase) {
                paramString += `passphrase=${phpUrlEncode(passphrase.trim())}&`;
            }
            continue;
        }
        const value = payload[field];
        if (value !== undefined && value !== null && String(value) !== '') {
            paramString += `${field}=${phpUrlEncode(String(value).trim())}&`;
        }
    }
    paramString = paramString.slice(0, -1);

    const signature = crypto.createHash('md5').update(paramString).digest('hex');
    return { ...payload, signature };
}

/**
 * Verifies the signature on an incoming ITN payload. `orderedEntries`
 * must be the POST body's fields in the order PayFast actually sent
 * them (an Express req.body object preserves insertion/arrival order
 * for string keys, which is what we need here).
 */
function verifyItnSignature(orderedEntries, postedSignature, passphrase) {
    let paramString = '';
    for (const [key, value] of orderedEntries) {
        if (key === 'signature') break; // PayFast always sends signature last
        paramString += `${key}=${phpUrlEncode(value)}&`;
    }
    paramString = paramString.slice(0, -1);

    if (passphrase) {
        paramString += `&passphrase=${phpUrlEncode(passphrase)}`;
    }

    const signature = crypto.createHash('md5').update(paramString).digest('hex');
    return { valid: signature === postedSignature, paramString };
}

/** Confirms the notification is genuine via PayFast's own validate endpoint. */
async function confirmWithPayfast(paramStringWithoutPassphrase, mode) {
    const res = await fetch(`${baseUrl(mode)}/eng/query/validate`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: paramStringWithoutPassphrase
    });
    const text = (await res.text()).trim();
    return text === 'VALID';
}

/** Confirms the request genuinely originated from a PayFast host. */
async function verifyItnSourceHost(candidateIp) {
    for (const host of VALID_PAYFAST_HOSTS) {
        try {
            const ips = await dns.resolve4(host);
            if (ips.includes(candidateIp)) return true;
        } catch (e) {
            // DNS lookup failing for one host shouldn't block the others
        }
    }
    return false;
}

module.exports = {
    phpUrlEncode,
    baseUrl,
    buildPaymentFields,
    verifyItnSignature,
    confirmWithPayfast,
    verifyItnSourceHost
};
