import crypto from 'node:crypto';

const BASE_URL = 'https://api.cmfile.net';
const API_PREFIX = 'v2/api';

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function clean(s) {
  return typeof s === 'string' ? s.trim() : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.CREAMAILER_ACCESS_TOKEN;
  const sharedSecret = process.env.CREAMAILER_SHARED_SECRET;
  const listId = process.env.CREAMAILER_LIST_ID;

  if (!accessToken || !sharedSecret || !listId) {
    console.error('Creamailer env vars missing');
    return res.status(500).json({ error: 'Palvelin ei ole vielä määritetty. Ota yhteyttä info@kan.fi.' });
  }

  const input = readBody(req);
  const email = clean(input.email);
  const name = clean(input.name);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return res.status(400).json({ error: 'Tarkista sähköpostiosoite.' });
  }
  if (!name) {
    return res.status(400).json({ error: 'Nimi puuttuu.' });
  }

  // Build subscriber payload (only include non-empty optional fields)
  const data = { email, name, send_autoresponders: true };
  const phone = clean(input.phone);
  const address = clean(input.address);
  const zip = clean(input.zip_code);
  const city = clean(input.city);
  if (phone) data.phone = phone;
  if (address) data.address = address;
  if (zip) data.zip_code = zip;
  if (city) data.city = city;

  const fullPath = `${API_PREFIX}/lists/${listId}/subscribers`;
  const url = `${BASE_URL}/${fullPath}`;
  const bodyString = JSON.stringify(data);
  const timestamp = String(Math.floor(Date.now() / 1000));

  // Signature must match PHP SDK: baseUrl + '/' + fullPath + queryString + body + timestamp
  const signData = `${BASE_URL}/${fullPath}` + '' + bodyString + timestamp;
  const signature = crypto.createHmac('sha256', sharedSecret).update(signData).digest('hex');

  try {
    const cmRes = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Access-Token': accessToken,
        'X-Request-Signature': signature,
        'X-Request-Timestamp': timestamp,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: bodyString,
    });

    const text = await cmRes.text();
    let payload;
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { message: text }; }

    if (cmRes.ok) {
      return res.status(200).json({ ok: true });
    }

    console.error('Creamailer error', cmRes.status, text);
    const msg = (payload && payload.message) || `Creamailer-virhe (HTTP ${cmRes.status}).`;
    // 422 = validation (e.g. already subscribed) — surface friendlier text
    if (cmRes.status === 422) {
      return res.status(422).json({ error: 'Tarkista tiedot. Mahdollisesti olet jo jäsenlistalla.' });
    }
    return res.status(502).json({ error: msg });
  } catch (err) {
    console.error('Creamailer request failed', err);
    return res.status(502).json({ error: 'Yhteys jäsenrekisteriin epäonnistui. Yritä myöhemmin uudelleen.' });
  }
}
