// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
const m = vi.hoisted(() => ({
  price: vi.fn(), info: vi.fn(), mine: vi.fn(), resolve: vi.fn(), rename: vi.fn(),
  auth: { getToken: async () => 't' },
}));
vi.mock('@clerk/clerk-react', () => ({ useAuth: () => m.auth }));
vi.mock('../utils/web3', () => ({ contract: null, parseEther: (x) => x, getReadOnlyContract: () => null }));
vi.mock('../utils/api', () => ({
  getEthPrice: m.price, getConfig: async () => ({ relayerAddress: '0xr' }), getEmbeddedWalletInfo: m.info,
  changeUsername: m.rename, resolveUser: m.resolve, getMyTasks: m.mine, assignValidator: vi.fn(), createTaskEmbedded: vi.fn(),
}));
import Profile from './Profile';
import CreateTask from './CreateTask';
beforeEach(() => { cleanup(); vi.clearAllMocks(); global.fetch = vi.fn(async () => ({ json: async () => ({ rates: { INR: 90 } }) })); m.info.mockResolvedValue({ address: '0xEmbedded1234', balanceEth: 0.0523 }); });
afterEach(() => vi.useRealTimers());

describe('Profile', () => {
  it('shows the embedded wallet and its balance, not "Not connected"', async () => {
    render(<Profile userProfile={{ username: 'ujwal', unique_id: '1' }} walletState={{ connected: false }} />);
    await screen.findByText('0xEmbedded1234');
    expect(screen.getByText('0.0523 ETH')).toBeTruthy();
    expect(screen.queryByText('Not connected')).toBeNull();
  });
  it('changes the username and reports the new profile', async () => {
    m.rename.mockResolvedValue({ user: { username: 'new_name', unique_id: '1' } });
    const onChange = vi.fn();
    render(<Profile userProfile={{ username: 'ujwal', unique_id: '1' }} walletState={{ connected: false }} onProfileChange={onChange} />);
    fireEvent.click(screen.getByText('Change'));
    fireEvent.change(screen.getByLabelText('New username'), { target: { value: '@New_Name' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(m.rename).toHaveBeenCalledWith('t', 'new_name'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ username: 'new_name', unique_id: '1' }));
  });
  it('rejects an invalid name without calling the backend and shows a taken-name error', async () => {
    render(<Profile userProfile={{ username: 'ujwal', unique_id: '1' }} walletState={{ connected: false }} />);
    fireEvent.click(screen.getByText('Change'));
    fireEvent.change(screen.getByLabelText('New username'), { target: { value: 'a!' } });
    fireEvent.click(screen.getByText('Save'));
    await screen.findByText(/3-20 letters/);
    expect(m.rename).not.toHaveBeenCalled();
    m.rename.mockRejectedValue(new Error('Username already taken'));
    fireEvent.change(screen.getByLabelText('New username'), { target: { value: 'taken_one' } });
    fireEvent.click(screen.getByText('Save'));
    await screen.findByText('Username already taken');
  });
});

describe('stake amount conversion', () => {
  const usd = () => screen.getByPlaceholderText('10.00');
  const eth = () => screen.getByPlaceholderText('0.003');
  it('USD to ETH and ETH to USD, both ways', async () => {
    m.price.mockResolvedValue({ usd: 2000 });
    render(<CreateTask userProfile={{ username: 'a' }} />);
    await screen.findByText(/1 ETH ≈/);
    fireEvent.change(usd(), { target: { value: '10' } });
    expect(eth().value).toBe('0.005000');
    fireEvent.change(eth(), { target: { value: '0.01' } });
    expect(usd().value).toBe('20.00');
  });
  it('validator dropdown lists only validators from my own tasks and resolves on pick', async () => {
    m.price.mockResolvedValue({ usd: 2000 });
    m.mine.mockResolvedValue({
      tasks: [{ id: 1, isOwner: true }, { id: 2, isOwner: true }, { id: 3, isOwner: false }, { id: 4, isOwner: true }],
      assignments: { 1: { validatorUsername: 'demo_validator' }, 2: { validatorUsername: 'demo_validator' }, 3: { validatorUsername: 'someone_else' }, 4: { validatorUsername: '0xabc' } },
    });
    m.resolve.mockResolvedValue({ username: 'demo_validator', uniqueId: 5, walletAddress: null });
    render(<CreateTask userProfile={{ username: 'a' }} />);
    const sel = await screen.findByLabelText('Pick a validator you used before');
    expect(Array.from(sel.querySelectorAll('option')).map((o) => o.textContent)).toEqual(['Pick a validator you used before...', '@demo_validator']);
    fireEvent.change(sel, { target: { value: 'demo_validator' } });
    await screen.findByText(/verified — no wallet required/);
    expect(m.resolve).toHaveBeenCalledWith('demo_validator');
    expect(screen.getByPlaceholderText('@username or 12345').value).toBe('@demo_validator');
  });
  it('INR box links to USD and ETH both ways', async () => {
    m.price.mockResolvedValue({ usd: 2000 });
    render(<CreateTask userProfile={{ username: 'a' }} />);
    await screen.findByText(/1 ETH ≈/);
    const inr = () => screen.getByPlaceholderText('INR');
    await waitFor(() => expect(inr().disabled).toBe(false));
    fireEvent.change(inr(), { target: { value: '900' } });
    expect(usd().value).toBe('10.00');
    expect(eth().value).toBe('0.005000');
    fireEvent.change(usd(), { target: { value: '20' } });
    expect(inr().value).toBe('1800.00');
    fireEvent.change(eth(), { target: { value: '0.01' } });
    expect(inr().value).toBe('1800.00');
    expect(usd().value).toBe('20.00');
  });
  it('price that loads late fills the other box, and a price move updates it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    m.price.mockRejectedValueOnce(new Error('cold')).mockResolvedValueOnce({ usd: 2000 }).mockResolvedValue({ usd: 4000 });
    render(<CreateTask userProfile={{ username: 'a' }} />);
    await screen.findByText(/Live ETH price unavailable/);
    fireEvent.change(usd(), { target: { value: '10' } });
    expect(eth().value).toBe('');
    await act(async () => { await vi.advanceTimersByTimeAsync(5500); });
    await waitFor(() => expect(eth().value).toBe('0.005000'));
    await act(async () => { await vi.advanceTimersByTimeAsync(31000); });
    await waitFor(() => expect(eth().value).toBe('0.002500'));
  });
});
