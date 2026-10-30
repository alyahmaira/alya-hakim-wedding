const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('./rsvp.js');

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  return res;
}

test('rejects non-POST requests', async () => {
  const res = makeRes();
  await handler({ method: 'GET', query: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.ok, false);
});

test('returns 500 when the endpoint env var is missing', async () => {
  delete process.env.BRIDE_RSVP_ENDPOINT;
  const res = makeRes();
  await handler({ method: 'POST', query: { side: 'bride' }, body: '{}' }, res);
  assert.equal(res.statusCode, 500);
  assert.match(res.body.error, /BRIDE_RSVP_ENDPOINT/);
});

test('defaults to the bride endpoint when side is omitted', async () => {
  process.env.BRIDE_RSVP_ENDPOINT = 'https://script.google.com/bride-exec';
  const originalFetch = global.fetch;
  let calledUrl = null;
  global.fetch = async (url) => {
    calledUrl = url;
    return { ok: true, text: async () => JSON.stringify({ ok: true }) };
  };
  const res = makeRes();
  await handler({ method: 'POST', query: {}, body: '{"name":"Test"}' }, res);
  global.fetch = originalFetch;
  assert.equal(calledUrl, 'https://script.google.com/bride-exec');
  assert.equal(res.body.ok, true);
});

test('forwards to the groom endpoint when side=groom', async () => {
  process.env.GROOM_RSVP_ENDPOINT = 'https://script.google.com/groom-exec';
  const originalFetch = global.fetch;
  let calledUrl = null;
  global.fetch = async (url) => {
    calledUrl = url;
    return { ok: true, text: async () => JSON.stringify({ ok: true }) };
  };
  const res = makeRes();
  await handler({ method: 'POST', query: { side: 'groom' }, body: '{"name":"Test"}' }, res);
  global.fetch = originalFetch;
  assert.equal(calledUrl, 'https://script.google.com/groom-exec');
});
