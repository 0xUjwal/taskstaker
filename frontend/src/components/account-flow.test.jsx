// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { loadAccountProfile } from '../utils/profileLoading.mjs';
const mocks = vi.hoisted(() => ({getToken:vi.fn(async()=> 'token'), registerUser:vi.fn(),resolveUser:vi.fn()}));
vi.mock('@clerk/clerk-react',()=>({useAuth:()=>({getToken:mocks.getToken})}));
vi.mock('../utils/api',()=>({registerUser:mocks.registerUser,linkWallet:vi.fn(),resolveUser:mocks.resolveUser,getEthPrice:vi.fn(async()=>({usd:3000})),getConfig:vi.fn(async()=>({relayerAddress:'0xrelayer'})),assignValidator:vi.fn(),createTaskEmbedded:vi.fn(),getEmbeddedWalletInfo:vi.fn(async()=>({balanceEth:1}))}));
vi.mock('../utils/web3',()=>({initWeb3:vi.fn(),contract:null,parseEther:vi.fn(),getReadOnlyContract:vi.fn()}));
import UsernameSetup from './UsernameSetup';
import CreateTask from './CreateTask';
beforeEach(()=>{cleanup();vi.clearAllMocks();});
describe('profile recovery',()=>{
 const opts={delay:async()=>{}};
 it('restores an existing username',async()=>{expect((await loadAccountProfile(mocks.getToken,async()=>({user:{username:'saved_name'}}),opts)).profile.username).toBe('saved_name');});
 it('retries cold-start errors without triggering setup',async()=>{const read=vi.fn().mockRejectedValueOnce(Object.assign(new Error('offline'),{status:503})).mockResolvedValue({user:{username:'saved'}});expect((await loadAccountProfile(mocks.getToken,read,opts)).needsSetup).toBe(false);expect(read).toHaveBeenCalledTimes(2);});
 it('shows setup only for the explicit missing-profile code',async()=>{expect((await loadAccountProfile(mocks.getToken,async()=>{throw {status:404,code:'PROFILE_NOT_FOUND'}},opts)).needsSetup).toBe(true);});
 it.each([401,403,404,429,500,503])('does not create a new profile on status %s',async status=>{await expect(loadAccountProfile(mocks.getToken,async()=>{throw {status}},opts)).rejects.toMatchObject({status});});
 it('does not treat a network failure as registration',async()=>{await expect(loadAccountProfile(mocks.getToken,async()=>{throw new TypeError('Network failed')},opts)).rejects.toThrow('Network failed');});
 it('refreshes expired session tokens on retry',async()=>{const read=vi.fn().mockRejectedValueOnce({status:401}).mockResolvedValue({user:{username:'saved'}});await loadAccountProfile(mocks.getToken,read,opts);expect(mocks.getToken).toHaveBeenLastCalledWith({skipCache:true});});
 it('rejects empty successful responses',async()=>{await expect(loadAccountProfile(mocks.getToken,async()=>({user:null}),opts)).rejects.toThrow('profile could not be loaded');});
 it('cancels stale account requests',async()=>{const c=new AbortController();c.abort();await expect(loadAccountProfile(mocks.getToken,vi.fn(),{signal:c.signal})).rejects.toMatchObject({name:'AbortError'});});
});
it('new-account registration enters app without forcing mobile MetaMask',async()=>{mocks.registerUser.mockResolvedValue({user:{username:'new_user'}});const done=vi.fn();render(<UsernameSetup onComplete={done}/>);fireEvent.change(screen.getByPlaceholderText('e.g. ujwal_dev'),{target:{value:'new_user'}});fireEvent.click(screen.getByText('Create Username'));await waitFor(()=>expect(done).toHaveBeenCalledWith({username:'new_user'}));expect(screen.queryByText('Connect your wallet')).toBeNull();});
it('rejects own username including @ prefix and case changes',async()=>{mocks.resolveUser.mockResolvedValue({username:'demo_presenter',uniqueId:'12345'});render(<CreateTask userProfile={{username:'demo_presenter',unique_id:'12345'}}/>);fireEvent.change(screen.getByPlaceholderText('@username or 12345'),{target:{value:'@DEMO_PRESENTER'}});fireEvent.click(screen.getByText('Verify'));await screen.findByText('Choose someone else. You cannot validate your own task.');expect(mocks.resolveUser).toHaveBeenCalledWith('DEMO_PRESENTER');});
it('accepts an independent validator',async()=>{mocks.resolveUser.mockResolvedValue({username:'demo_validator',uniqueId:'23456'});render(<CreateTask userProfile={{username:'demo_presenter',unique_id:'12345'}}/>);fireEvent.change(screen.getByPlaceholderText('@username or 12345'),{target:{value:'@demo_validator'}});fireEvent.click(screen.getByText('Verify'));await screen.findByText(/demo_validator verified/);});

it('a stalled session token cannot leave account loading stuck forever',async()=>{await expect(loadAccountProfile(()=>new Promise(()=>{}),vi.fn(),{attempts:1,timeoutMs:5})).rejects.toMatchObject({status:408});});
it('a stalled profile response reaches recovery rather than registration',async()=>{await expect(loadAccountProfile(mocks.getToken,()=>new Promise(()=>{}),{attempts:1,timeoutMs:5})).rejects.toMatchObject({status:408});});
