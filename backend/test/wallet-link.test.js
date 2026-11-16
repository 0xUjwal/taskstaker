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
