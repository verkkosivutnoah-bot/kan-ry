import crypto from 'node:crypto';

const ORIGIN = 'https://kan-ry-lv.creamailer.fi';
const SURVEY_PAGE = ORIGIN + '/survey/answer/ugiumxcdhtxrq';
const SURVEY_ACTION = ORIGIN + '/surveys/ugiumxcdhtxrq';
const CHALLENGE_URL = ORIGIN + '/captcha/a/challenge';
const UA = 'Mozilla/5.0 (compatible; KANryForm/1.0)';

// Survey field names (from the Creamailer survey markup)
const F_NAME = 'name-2602492';
const F_EMAIL = 'email-2602489';
const F_CONTACT = 'contactData-2615038';

// Creamailer list API (to store full contact info: name, address, zip, city)
const API_BASE = 'https://api.cmfile.net';
const API_PFX = 'v2/api';
const LIST_ID = process.env.CREAMAILER_LIST_ID || '355351'; // "Uudet osoitteet listalle"

async function apiReq(method, path, bodyObj) {
  const accessToken = process.env.CREAMAILER_ACCESS_TOKEN;
  const sharedSecret = process.env.CREAMAILER_SHARED_SECRET;
  if (!accessToken || !sharedSecret) return { status: 0, skipped: true };
  const full = `${API_PFX}/${path}`;
  const body = bodyObj ? JSON.stringify(bodyObj) : '';
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', sharedSecret).update(`${API_BASE}/${full}` + '' + body + ts).digest('hex');
  const r = await fetch(`${API_BASE}/${full}`, {
    method,
    headers: {
      'X-Access-Token': accessToken,
      'X-Request-Signature': sig,
      'X-Request-Timestamp': ts,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body || undefined,
  });
  return { status: r.status, ok: r.ok };
}

// Store/refresh full contact fields on the list (survey only saves email)
async function upsertContact(fields) {
  // create first (no autoresponder — survey already handles confirmation)
  let r = await apiReq('POST', `lists/${LIST_ID}/subscribers`, { ...fields, send_autoresponders: false });
  if (r.skipped) return;
  if (r.ok) return;
  // already exists → update
  await apiReq('PUT', `lists/${LIST_ID}/subscribers`, fields);
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}
function clean(s) { return typeof s === 'string' ? s.trim() : ''; }
function cookieHeader(arr) { return (arr || []).map(c => c.split(';')[0]).join('; '); }

async function solveAltcha(cookies) {
  const r = await fetch(CHALLENGE_URL, { headers: { 'User-Agent': UA, 'Cookie': cookies } });
  if (!r.ok) throw new Error('challenge ' + r.status);
  const ch = await r.json();
  let number = -1;
  const max = ch.maxNumber ?? 1000000;
  for (let n = 0; n <= max; n++) {
    if (crypto.createHash('sha256').update(ch.salt + n).digest('hex') === ch.challenge) { number = n; break; }
  }
  if (number < 0) throw new Error('altcha unsolved');
  return Buffer.from(JSON.stringify({
    algorithm: ch.algorithm, challenge: ch.challenge, number, salt: ch.salt, signature: ch.signature,
  })).toString('base64');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const input = readBody(req);
  const name = clean(input.name);
  const email = clean(input.email);
  // Postal address: accept single 'address' or compose from parts
  let contact = clean(input.address);
  const zip = clean(input.zip_code);
  const city = clean(input.city);
  if (zip || city) contact = [contact, [zip, city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  if (!name) return res.status(400).json({ error: 'Nimi puuttuu.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Tarkista sähköpostiosoite.' });

  try {
    // 1. Load survey page → CSRF token + session cookies
    const pageRes = await fetch(SURVEY_PAGE, { headers: { 'User-Agent': UA } });
    const cookies = cookieHeader(pageRes.headers.getSetCookie());
    const html = await pageRes.text();
    const token = (html.match(/name="_token"\s+value="([^"]+)"/) || [])[1];
    if (!token || !cookies) throw new Error('no token/cookie');

    // 2. Solve ALTCHA proof-of-work
    const altcha = await solveAltcha(cookies);

    // 3. Submit survey (multipart)
    const fd = new FormData();
    fd.append('_token', token);
    fd.append('page', '1');
    fd.append(F_NAME, name);
    fd.append(F_EMAIL, email);
    fd.append(F_CONTACT, contact);
    fd.append('altcha', altcha);
    fd.append('submit', '');

    const subRes = await fetch(SURVEY_ACTION, {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Cookie': cookies, 'Referer': SURVEY_PAGE, 'Origin': ORIGIN },
      body: fd,
      redirect: 'manual',
    });

    const loc = subRes.headers.get('location') || '';
    const ok = (subRes.status === 302 && /thank-you/.test(loc)) || subRes.status === 200;
    if (ok) {
      // Store full contact info on the list (survey saves only email).
      const fields = { email, name };
      if (clean(input.address)) fields.address = clean(input.address);
      if (zip) fields.zip_code = zip;
      if (city) fields.city = city;
      try { await upsertContact(fields); } catch (e) { console.error('upsertContact failed', e); }
      return res.status(200).json({ ok: true });
    }

    const body = await subRes.text();
    console.error('Survey submit failed', subRes.status, loc, body.slice(0, 300));
    return res.status(502).json({ error: 'Lähetys epäonnistui. Yritä uudelleen tai ota yhteyttä info@kan.fi.' });
  } catch (err) {
    console.error('Survey proxy error', err);
    return res.status(502).json({ error: 'Yhteys lomakkeeseen epäonnistui. Yritä myöhemmin uudelleen.' });
  }
}
