const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY ||= 'test-key';
const { deriveReview } = require('../src/services/reviewState');

const at = (n) => `2026-11-25T0${n}:00:00Z`;
const attempt = (url, n) => ({ analysis: { kind: 'proof_attempt', proof_url: url }, created_at: at(n) });
const decide = (d, n) => ({ analysis: { kind: 'review_decision', decision: d }, created_at: at(n) });
const analysis = (url, n) => ({ analysis: { kind: 'proof_analysis', proof_url: url }, created_at: at(n) });

test('first proof only: under review, cannot reject yet', () => {
  const r = deriveReview('p1', [analysis('p1', 1)]);
  assert.equal(r.proofCount, 1); assert.equal(r.status, 'under_review'); assert.equal(r.canReject, false);
  assert.equal(r.currentProofUrl, 'p1');
});
test('AI report rows do not count as proofs', () => {
  assert.equal(deriveReview('p1', [analysis('p1', 1), analysis('p2', 2)]).proofCount, 1);
});
test('validator asks for a new proof; a new upload clears the request', () => {
  let r = deriveReview('p1', [decide('needs_new_proof', 1)]);
  assert.equal(r.status, 'needs_new_proof');
  r = deriveReview('p1', [decide('needs_new_proof', 1), attempt('p2', 2)]);
  assert.equal(r.status, 'under_review'); assert.equal(r.currentProofUrl, 'p2'); assert.equal(r.proofCount, 2);
});
test('reject unlocks only at 3 proofs', () => {
  assert.equal(deriveReview('p1', [attempt('p2', 1)]).canReject, false);
  const r = deriveReview('p1', [attempt('p2', 1), attempt('p3', 2)]);
  assert.equal(r.proofCount, 3); assert.equal(r.canReject, true);
});
test('rejected is final, even if the owner uploads again', () => {
  const r = deriveReview('p1', [attempt('p2', 1), attempt('p3', 2), decide('rejected', 3), attempt('p4', 4)]);
  assert.equal(r.status, 'rejected'); assert.equal(r.canReject, false);
});
test('duplicate proof urls are counted once', () => {
  assert.equal(deriveReview('p1', [attempt('p1', 1), attempt('p2', 2), attempt('p2', 3)]).proofCount, 2);
});

// Route-level: real Express routes with chain and database stubbed.
async function withApp(state, run) {
  const express = require('express');
  const service = require('../src/services/taskAccess');
  const db = require('../src/services/supabase');
  const relayer = require('../src/services/relayer');
  const reports = require('../src/services/taskReports');
  const calls = { forfeit: [], inserts: [], reports: [] };
  const roles = { alice: { isOwner: true, isValidator: false }, bob: { isOwner: false, isValidator: true }, eve: null };
  service.requireTaskAccess = async (id, taskId, ownerOnly) => {
    const r = roles[id];
    if (!r || (ownerOnly && !r.isOwner)) throw Object.assign(new Error('Task not found'), { status: 404 });
    return { ...r, user: { id }, assignment: { owner_user_id: 'alice', validator_user_id: 'bob' }, task: state.task };
  };
  relayer.relayForfeitStake = async (id) => { calls.forfeit.push(id); return { txHash: '0xabc' }; };
  reports.requestReport = async (p) => { calls.reports.push(p.proofUrl); return {}; };
  db.from = (table) => ({
    select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: state.rows, error: null }) }), maybeSingle: async () => ({ data: { username: 'alice' } }) }) }),
    insert: async (row) => { calls.inserts.push({ table, row }); if (table === 'ai_analyses') state.rows.push({ analysis: row.analysis, created_at: new Date().toISOString() }); return { error: null }; },
  });
  delete require.cache[require.resolve('../src/routes/tasks')];
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.auth = { userId: req.headers['x-test-account'] }; next(); });
  app.use('/api/tasks', require('../src/routes/tasks'));
  const server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api/tasks`;
  const call = async (path, account, body) => {
    const r = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-test-account': account }, body: body && JSON.stringify(body) });
    return { status: r.status, json: await r.json() };
  };
  try { await run(call, calls); } finally { await new Promise((r) => server.close(r)); }
}
const sb = (p) => `https://example.supabase.co/storage/v1/object/public/TaskStaker/proofs/${p}.png`;
const open = () => ({ completed: true, validated: false, claimed: false, name: 'Run', proofUrl: sb('a'), deadline: { toNumber: () => 2000000000 } });

test('owner resubmits, validator asks for new proof, then rejects only after 3 proofs', async () => {
  const state = { task: open(), rows: [] };
  await withApp(state, async (call, calls) => {
    let r = await call('/review/1', 'alice');
    assert.equal(r.json.review.canResubmit, true); assert.equal(r.json.review.canReject, false);
    r = await call('/request-proof', 'bob', { taskId: 1, note: 'show distance' });
    assert.equal(r.status, 200);
    r = await call('/review/1', 'alice'); assert.equal(r.json.review.status, 'needs_new_proof');
    assert.equal((await call('/reject', 'bob', { taskId: 1 })).status, 400);
    assert.equal((await call('/resubmit-proof', 'alice', { taskId: 1, proofUrl: sb('b') })).status, 200);
    assert.equal((await call('/review/1', 'bob')).json.review.status, 'under_review');
    assert.equal((await call('/reject', 'bob', { taskId: 1 })).status, 400);
    assert.equal((await call('/resubmit-proof', 'alice', { taskId: 1, proofUrl: sb('c') })).status, 200);
    assert.deepEqual(calls.reports, [sb('b'), sb('c')]);
    r = await call('/review/1', 'bob'); assert.equal(r.json.review.canReject, true); assert.equal(r.json.review.currentProofUrl, sb('c'));
    assert.equal((await call('/reject', 'alice', { taskId: 1 })).status, 403);
    assert.equal((await call('/reject', 'bob', { taskId: 1 })).status, 200);
    r = await call('/review/1', 'alice');
    assert.equal(r.json.review.status, 'rejected'); assert.equal(r.json.review.canResubmit, false);
    assert.equal((await call('/resubmit-proof', 'alice', { taskId: 1, proofUrl: sb('d') })).status, 409);
    assert.equal((await call('/request-proof', 'bob', { taskId: 1 })).status, 409);
  });
});

test('access rules: strangers, foreign proof urls, owner cannot ask for proof', async () => {
  const state = { task: open(), rows: [] };
  await withApp(state, async (call) => {
    assert.equal((await call('/review/1', 'eve')).status, 404);
    assert.equal((await call('/resubmit-proof', 'bob', { taskId: 1, proofUrl: sb('x') })).status, 404);
    assert.equal((await call('/resubmit-proof', 'alice', { taskId: 1, proofUrl: 'https://evil.example/x.png' })).status, 400);
    assert.equal((await call('/request-proof', 'alice', { taskId: 1 })).status, 403);
  });
});

test('no review actions once the task is validated', async () => {
  const state = { task: { ...open(), validated: true }, rows: [] };
  await withApp(state, async (call) => {
    const r = await call('/review/1', 'bob');
    assert.equal(r.json.review.canRequestProof, false); assert.equal(r.json.review.canReject, false);
    assert.equal((await call('/resubmit-proof', 'alice', { taskId: 1, proofUrl: sb('z') })).status, 400);
  });
});

test('penalty goes through the relayer, only after deadline and only without proof', async () => {
  const past = { toNumber: () => 1000 };
  await withApp({ task: { ...open(), completed: false, deadline: past }, rows: [] }, async (call, calls) => {
    assert.equal((await call('/forfeit', 'bob', { taskId: 1 })).status, 404);
    const r = await call('/forfeit', 'alice', { taskId: 1 });
    assert.equal(r.status, 200); assert.deepEqual(calls.forfeit, [1]);
  });
  await withApp({ task: { ...open(), completed: false }, rows: [] }, async (call, calls) => {
    assert.equal((await call('/forfeit', 'alice', { taskId: 1 })).status, 400); assert.equal(calls.forfeit.length, 0);
  });
  await withApp({ task: { ...open(), deadline: past }, rows: [] }, async (call, calls) => {
    assert.equal((await call('/forfeit', 'alice', { taskId: 1 })).status, 400); assert.equal(calls.forfeit.length, 0);
  });
});
