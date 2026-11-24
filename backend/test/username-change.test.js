const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY ||= 'test-key';

async function withApp(users, run) {
  const express = require('express');
  const db = require('../src/services/supabase');
  const updates = [];
  db.from = (table) => {
    const f = { eq: {}, neq: {} };
    const q = {
      select: () => q,
      eq: (c, v) => { f.eq[c] = v; return q; },
      neq: (c, v) => { f.neq[c] = v; return q; },
      limit: async () => ({ data: users.filter((u) => (!f.eq.username || u.username === f.eq.username) && (!f.neq.id || u.id !== f.neq.id)), error: null }),
      maybeSingle: async () => ({ data: users.find((u) => u.clerk_id === f.eq.clerk_id) || null, error: null }),
      single: async () => ({ data: users.find((u) => u.id === f.eq.id), error: null }),
      update: (patch) => {
        const w = { eq: (c, v) => {
          updates.push({ table, patch, col: c, val: v });
          if (table === 'users') Object.assign(users.find((u) => u.id === v), patch);
          return table === 'users' ? q.__single(f, c, v) : Promise.resolve({ error: null });
        } };
        return w;
      },
      __single: (ff, c, v) => { ff.eq[c] = v; return q; },
    };
    return q;
  };
  delete require.cache[require.resolve('../src/routes/users')];
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.auth = { userId: req.headers['x-test-account'] }; next(); });
  app.use('/api/users', require('../src/routes/users'));
  const server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
  const call = async (account, username) => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/users/username`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-test-account': account || '' }, body: JSON.stringify({ username }) });
    return { status: r.status, json: await r.json() };
  };
  try { await run(call, updates); } finally { await new Promise((r) => server.close(r)); }
}
const users = () => [{ id: 'u1', clerk_id: 'c1', username: 'ujwal' }, { id: 'u2', clerk_id: 'c2', username: 'taken_one' }];

test('changes username, lowercases it, and syncs assignment display names', async () => {
  await withApp(users(), async (call, updates) => {
    const r = await call('c1', 'New_Name');
    assert.equal(r.status, 200); assert.equal(r.json.user.username, 'new_name');
    assert.ok(updates.some((u) => u.table === 'task_validators' && u.patch.owner_username === 'new_name' && u.val === 'u1'));
    assert.ok(updates.some((u) => u.table === 'task_validators' && u.patch.validator_username === 'new_name' && u.val === 'u1'));
  });
});
test('rejects bad names, taken names and anonymous callers', async () => {
  await withApp(users(), async (call, updates) => {
    assert.equal((await call('c1', 'a!')).status, 400);
    assert.equal((await call('c1', 'x'.repeat(21))).status, 400);
    assert.equal((await call('c1', 'taken_one')).status, 409);
    assert.equal((await call('', 'fine_name')).status, 401);
    assert.equal((await call('c1', 'ujwal')).json.unchanged, true);
    assert.equal(updates.length, 0);
  });
});
