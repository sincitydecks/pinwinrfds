const crypto = require('node:crypto');

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function clean(value, max = 1000) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

function validEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    if (!body || typeof body !== 'object') {
      return json(res, 400, { ok: false, error: 'Invalid request.' });
    }

    const website = clean(body.website, 200);
    if (website) return json(res, 200, { ok: true });

    const clientId = clean(body.clientId, 120);
    const fullName = clean(body.fullName || body.name, 120);
    const email = clean(body.email, 320).toLowerCase();
    const sourceUrl = clean(body.sourceUrl, 1000);

    if (!clientId || !fullName || !validEmail(email)) {
      return json(res, 400, { ok: false, error: 'Please provide a valid name and email address.' });
    }

    const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';

    if (!supabaseUrl || !supabaseSecretKey) {
      console.error('PIN TO WIN EOI backend is missing SUPABASE_URL or SUPABASE_SECRET_KEY');
      return json(res, 500, { ok: false, error: 'Submission service is not configured.' });
    }

    const record = {
      client_id: clientId,
      full_name: fullName,
      email: email || null,
      source_url: sourceUrl || null,
      user_agent: clean(req.headers['user-agent'], 1000) || null
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/pin_to_win_eois`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apikey': supabaseSecretKey,
        'Prefer': 'return=minimal,resolution=ignore-duplicates'
      },
      body: JSON.stringify(record)
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.error('PIN TO WIN Supabase insert failed:', response.status, details);
      return json(res, 502, { ok: false, error: 'We could not save your details.' });
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('PIN TO WIN EOI backend error:', error);
    return json(res, 500, { ok: false, error: 'We could not save your details.' });
  }
};
