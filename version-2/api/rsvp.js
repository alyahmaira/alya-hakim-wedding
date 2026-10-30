module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const side = String(req.query?.side || 'bride').toLowerCase() === 'groom' ? 'groom' : 'bride';
  const endpoint = side === 'groom'
    ? process.env.GROOM_RSVP_ENDPOINT
    : process.env.BRIDE_RSVP_ENDPOINT;

  if (!endpoint) {
    return res.status(500).json({
      ok: false,
      error: `Missing ${side.toUpperCase()}_RSVP_ENDPOINT environment variable.`
    });
  }

  let rawBody = '';

  if (typeof req.body === 'string' && req.body.length) {
    rawBody = req.body;
  } else if (req.body && typeof req.body === 'object') {
    rawBody = JSON.stringify(req.body);
  } else {
    rawBody = await readRequestBody(req);
  }

  if (!rawBody) {
    rawBody = '{}';
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'Accept': 'application/json'
      },
      body: rawBody
    });

    const text = await upstream.text();
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { ok: upstream.ok, raw: text };
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        ok: false,
        error: parsed?.error || 'Upstream RSVP request failed.',
        details: parsed?.details || text
      });
    }

    return res.status(200).json(parsed && typeof parsed === 'object' ? parsed : { ok: true });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: 'Failed to reach the Google Apps Script endpoint.',
      details: error.message || String(error)
    });
  }
};

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
