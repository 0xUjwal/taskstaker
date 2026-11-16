const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY ||= 'test-key';
const { taskRoles, accountContext } = require('../src/services/taskAccess');
const alice = { id: 'account-a', wallet_address: '0xALICE' };
const bob = { id: 'account-b', wallet_address: '0xBOB' };
const fresh = { id: 'new-account', wallet_address: null };
const task = { user: '0xALICE', validator: '0xRELAYER' };
const assignment = { owner_user_id: alice.id, validator_user_id: bob.id };
const roles = (t, a, u, embedded='0xEMBEDDED') => taskRoles(t, a, u, embedded, '0xRELAYER');

test('existing owner retains their task', () => assert.equal(roles(task, assignment, alice).isOwner, true));
test('unrelated new account cannot see old tasks', () => {
  const r = roles(task, assignment, fresh); assert.equal(r.isOwner || r.isValidator, false);
});
test('explicit validator can still see their assignment, not as owner', () => {
  const r = roles(task, assignment, bob); assert.equal(r.isValidator, true); assert.equal(r.isOwner, false);
});
test('a shared wallet cannot override another account assignment', () => {
  const r = roles(task, assignment, {...fresh, wallet_address: '0xALICE'}, '0xALICE');
  assert.equal(r.isOwner || r.isValidator, false);
});
test('legacy task without assignment is kept for its verified wallet owner', () => assert.equal(roles(task, null, alice).isOwner, true));
test('legacy unrelated task without assignment stays hidden', () => {
  const r=roles(task, null, fresh); assert.equal(r.isOwner || r.isValidator, false);
});
test('embedded-wallet task appears only for its account', () => {
  assert.equal(roles(task, null, fresh, '0xALICE').isOwner, true);
  assert.equal(roles(task, null, fresh, '0xOTHER').isOwner, false);
});
test('relayer is never treated as a personal validator', () => assert.equal(roles(task, null, {...fresh, wallet_address:'0xRELAYER'}).isValidator, false));
test('legacy wallet validator can see assigned on-chain task', () => assert.equal(roles({...task,validator:'0xBOB'}, null, bob).isValidator, true));
test('assignment overrides an old on-chain validator wallet', () => assert.equal(roles({...task,validator:'0xBOB'}, {...assignment,validator_user_id:'someone-else'}, bob).isValidator, false));
test('wallet address matching is case insensitive', () => assert.equal(roles({...task,user:'0xalice'}, null, alice).isOwner,true));
test('an empty wallet is not an ownership wildcard', () => assert.equal(roles(task, null, fresh, '').isOwner,false));

test('existing saved address cannot establish ownership without proof', async () => {
  const db = require('../src/services/supabase');
  const original = db.from;
  db.from = () => ({select:()=>({eq:()=>({single:async()=>({data:{id:'legacy',wallet_address:'0xALICE'},error:null})})})});
  try {
    const {user,embeddedAddress}=await accountContext('legacy-unverified');
    assert.equal(user.wallet_address,null);
    assert.equal(taskRoles(task,null,user,embeddedAddress,'0xRELAYER').isOwner,false);
  } finally { db.from=original; }
});

test('authenticated feed applies roles before returning data, and denies anonymous requests', async () => {
  const express = require('express');
  const auth = require('../src/middleware/auth');
  const service = require('../src/services/taskAccess');
  const db = require('../src/services/supabase');
  // Inject only data sources. The actual Express route and privacy predicate run.
  service.accountContext = async id => ({user: id==='alice'?alice:id==='bob'?bob:fresh, embeddedAddress:'0xEMBEDDED'});
  const chain = [task,{user:'0xSTRANGER',validator:'0xRELAYER'},task].map(t=>({...t,name:'test',stake:require('ethers').ethers.BigNumber.from(1), deadline:{toNumber:()=>2000000000},completed:false,validated:false,claimed:false,proofUrl:'',token:'0x0'}));
  service.readContract = () => ({getTaskCount:async()=>({toNumber:()=>3}),getTask:async id=>chain[id]});
  db.from = () => ({select:()=>Promise.resolve({data:[{...assignment,task_id:0,owner_username:'alice',validator_username:'bob'},{task_id:2,owner_user_id:null,validator_user_id:'stranger'}],error:null})});
  const app=express();
  app.use((req,res,next)=>{req.auth={userId:req.headers['x-test-account']};next();});
  app.use('/api/tasks',require('../src/routes/tasks'));
  const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}/api/tasks`;
  try {
    for(const [account,expected] of [['alice',[2,0]],['bob',[0]],['new',[]]]) {
      const r=await fetch(base+'/mine',{headers:{'x-test-account':account}}); assert.equal(r.status,200);
      assert.match(r.headers.get('cache-control'),/no-store/);
      const data=await r.json();assert.deepEqual(data.tasks.map(t=>t.id),expected);
      assert.deepEqual(Object.keys(data.assignments).sort(),expected.map(String).sort());
    }
    assert.equal((await fetch(base+'/mine')).status,401);
    assert.equal((await fetch(base+'/assignments?taskIds=0')).status,401);
  } finally { await new Promise(r=>server.close(r)); }
});
