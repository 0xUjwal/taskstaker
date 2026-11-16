const {test} = require('node:test');
const assert = require('node:assert/strict');
const {ethers} = require('ethers');
const {createChallenge,verifyChallenge} = require('../src/services/walletLinkProof');
const owner = ethers.Wallet.createRandom();
const stranger = ethers.Wallet.createRandom();

test('wallet control proof binds address to account and cannot be replayed',async()=>{
  const c=createChallenge('alice',owner.address);
  const sig=await owner.signMessage(c.message);
  assert.equal(verifyChallenge('bob',owner.address,c.challengeId,sig),false);
  assert.equal(verifyChallenge('alice',stranger.address,c.challengeId,sig),false);
  assert.equal(verifyChallenge('alice',owner.address,c.challengeId,sig),true);
  assert.equal(verifyChallenge('alice',owner.address,c.challengeId,sig),false);
});
test('a different wallet cannot link the owner address',async()=>{
  const c=createChallenge('alice',owner.address);
  assert.equal(verifyChallenge('alice',owner.address,c.challengeId,await stranger.signMessage(c.message)),false);
});
test('expired challenges and unsigned addresses fail closed',async()=>{
  const c=createChallenge('alice',owner.address,1000);
  assert.equal(verifyChallenge('alice',owner.address,c.challengeId,await owner.signMessage(c.message),301001),false);
  assert.equal(verifyChallenge('alice',owner.address,undefined,undefined),false);
});
test('invalid wallet address cannot create a challenge',()=>assert.throws(()=>createChallenge('alice','not-a-wallet')));

process.env.WALLET_MASTER_SECRET = 'test-signing-secret-used-only-in-tests';
const {createWalletProof,restoreWalletProof,verifiedAddress} = require('../src/services/walletLinkProof');
test('old saved wallet address is not ownership without a verified proof',()=>{
  assert.equal(verifiedAddress('legacy-account',owner.address),null);
});
test('signed verification receipt binds account and address, expires, and rejects tampering',()=>{
  const now=Date.now();
  const proof=createWalletProof('proof-account',owner.address,now);
  assert.equal(verifiedAddress('proof-account',owner.address,now),owner.address.toLowerCase());
  assert.equal(verifiedAddress('proof-account',stranger.address,now),null);
  assert.equal(restoreWalletProof('different-account',proof,now),false);
  assert.equal(restoreWalletProof('proof-account',proof+'x',now),false);
  assert.equal(restoreWalletProof('proof-account',proof,now+31*86400000),false);
  assert.equal(restoreWalletProof('proof-account',proof,now),true);
});
