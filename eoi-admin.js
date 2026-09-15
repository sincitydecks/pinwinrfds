const crypto = require('node:crypto');

const COOKIE = 'pin_to_win_admin';
const DEFAULT_EXPIRY_SECONDS = 60 * 60 * 8;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function clean(value, max = 1000) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

function getPassword() {
  const configured = String(process.env.PIN_TO_WIN_ADMIN_PASSWORD || '').trim();
  return configured || '1928';
}

function getSecret() {
  return process.env.PIN_TO_WIN_ADMIN_SESSION_SECRET || crypto.createHash('sha256').update(getPassword()).digest('hex');
}

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verify(token) {
  try {
    const [data, sig] = String(token || '').split('.');
    if (!data || !sig) return false;
    const expected = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    return payload && payload.exp && Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  raw.split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function authOk(req) {
  return verify(parseCookies(req)[COOKIE]);
}

module.exports = async function handler(req, res) {
  const action = clean((req.query && req.query.action) || 'list', 20).toLowerCase();

  if (action === 'login') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return json(res, 405, { ok: false, error: 'Method not allowed.' });
    }

    let body = req.body;
    try {
      if (typeof body === 'string') body = JSON.parse(body);
    } catch {
      body = null;
    }

    const password = clean(body && body.password, 200);
    if (!password || password !== getPassword()) {
      return json(res, 401, { ok: false, error: 'Incorrect password.' });
    }

    const token = sign({ exp: Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS });
    res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DEFAULT_EXPIRY_SECONDS}`);
    return json(res, 200, { ok: true });
  }

  if (action === 'logout') {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    return json(res, 200, { ok: true });
  }

  if (!authOk(req)) {
    return json(res, 401, { ok: false, error: 'Unauthorised.' });
  }

  if (action === 'list') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return json(res, 405, { ok: false, error: 'Method not allowed.' });
    }

    const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
    if (!supabaseUrl || !supabaseSecretKey) {
      return json(res, 500, { ok: false, error: 'Database service is not configured.' });
    }

    const query = encodeURIComponent('id,client_id,submitted_at,full_name,email,source_url');
    const response = await fetch(`${supabaseUrl}/rest/v1/pin_to_win_eois?select=${query}&order=submitted_at.desc`, {
      headers: {
        'Accept': 'application/json',
        'apikey': supabaseSecretKey,
        'Authorization': `Bearer ${supabaseSecretKey}`
      }
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.error('PIN TO WIN admin Supabase read failed:', response.status, details);
      return json(res, 502, { ok: false, error: 'Could not load captured entries.' });
    }

    const rows = await response.json();
    return json(res, 200, { ok: true, rows: Array.isArray(rows) ? rows : [] });
  }

  return json(res, 400, { ok: false, error: 'Unknown action.' });
};
