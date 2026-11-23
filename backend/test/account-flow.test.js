const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-key';
process.env.RELAYER_ADDRESS = '0xRELAYER';
process.env.CONTRACT_ADDRESS = '0xCONTRACT';
const express = require('express');
const db = require('../src/services/supabase');
const access = require('../src/services/taskAccess');
const relayer = require('../src/services/relayer');
let relays = 0;
relayer.relayValidateTask = async () => { relays++; }; 
let scenario = 'existing';
const owner = { id: 'owner', username: 'owner_name', clerk_id: 'clerk-owner' };
let writes = 0;
db.from = (table) => {
  const query = { select: () => query, eq: () => query, or: () => query,
    single: async () => ({ data: table === 'users' ? owner : (scenario === 'independent' ? {validator_user_id: owner.id, owner_user_id: 'different-owner'} : null), error: null }),
    maybeSingle: async () => scenario === 'db-error' ? {data:null,error:{message:'database offline'}} : {data:scenario === 'missing' ? null : owner,error:null},
    insert: () => { writes++; throw new Error('Unexpected write'); },
    upsert: async () => { writes++; if(scenario === 'independent') return {error:null}; throw new Error('Unexpected write'); } };
  return query;
};
access.requireTaskAccess = async () => ({isOwner:scenario !== 'independent', user:owner, task:{user:'0x0000000000000000000000000000000000000001'}});
const app = express();
app.use(express.json());
app.use((req,res,next) => { req.auth = {userId: req.headers['x-test-account']}; next(); });
app.use('/api/users', require('../src/routes/users'));
app.use('/api/tasks', require('../src/routes/tasks'));
app.use('/api/wallet', require('../src/routes/wallet'));
let server, base;
test.before(async () => { server = app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r)); base=`http://127.0.0.1:${server.address().port}`; });
test.after(async () => { await new Promise(r=>server.close(r)); });
const call = (path, body) => fetch(base + path, {method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-test-account':'clerk-owner'},...(body?{body:JSON.stringify(body)}:{})});
test('existing profile is returned with no-store', async () => {scenario='existing';const r=await call('/api/users/me');assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal((await r.json()).user.username,owner.username);});
test('database failures are 503, never registration prompts',async()=>{scenario='db-error';const r=await call('/api/users/me');assert.equal(r.status,503);assert.equal((await r.json()).code,'PROFILE_UNAVAILABLE');});
test('only confirmed missing accounts get PROFILE_NOT_FOUND',async()=>{scenario='missing';const r=await call('/api/users/me');assert.equal(r.status,404);assert.equal((await r.json()).code,'PROFILE_NOT_FOUND');});
test('repeat registration returns original account, never renames it',async()=>{scenario='existing';const r=await call('/api/users/register',{username:'replacement'});assert.equal(r.status,200);assert.equal((await r.json()).user.username,'owner_name');assert.equal(writes,0);});
test('self validator rejected before embedded wallet signs or spends gas',async()=>{const r=await call('/api/wallet/create-task',{taskName:'test',hours:3,stakeEth:'0.001',validatorUsername:'owner_name'});assert.equal(r.status,400);assert.match((await r.json()).error,/cannot validate your own/);assert.equal(writes,0);});
test('self assignment rejected through direct API',async()=>{const r=await call('/api/tasks/assign-validator',{taskId:1,validatorUsername:'owner_name'});assert.equal(r.status,400);assert.equal(writes,0);});
test('legacy self-assigned tasks cannot be validated through direct API',async()=>{const r=await call('/api/tasks/validate',{taskId:8});assert.equal(r.status,403);assert.match((await r.json()).error,/cannot validate your own/);assert.equal(writes,0);});
test('anonymous profile request remains denied',async()=>{const r=await fetch(base+'/api/users/me');assert.equal(r.status,401);});

test('independent assigned validator can validate without a wallet',async()=>{scenario='independent';const r=await call('/api/tasks/validate',{taskId:9});assert.equal(r.status,200);assert.equal(relays,1);});

test('create-task rejects deadlines under 3 hours before any chain call', async()=>{writes=0;for (const hours of [1,2,'2','abc']) {const r=await call('/api/wallet/create-task',{taskName:'test',hours,stakeEth:'0.001',validatorUsername:'someone'});assert.equal(r.status,400);assert.match((await r.json()).error,/(Minimum deadline is 3 hours|whole number of hours)/);}assert.equal(writes,0);});
