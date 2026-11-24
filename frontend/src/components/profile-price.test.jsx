// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
const m = vi.hoisted(() => ({
  price: vi.fn(), info: vi.fn(), rename: vi.fn(),
  auth: { getToken: async () => 't' },
}));
vi.mock('@clerk/clerk-react', () => ({ useAuth: () => m.auth }));
vi.mock('../utils/web3', () => ({ contract: null, parseEther: (x) => x, getReadOnlyContract: () => null }));
vi.mock('../utils/api', () => ({
  getEthPrice: m.price, getConfig: async () => ({ relayerAddress: '0xr' }), getEmbeddedWalletInfo: m.info,
  changeUsername: m.rename, resolveUser: vi.fn(), assignValidator: vi.fn(), createTaskEmbedded: vi.fn(),
}));
import Profile from './Profile';
import CreateTask from './CreateTask';
beforeEach(() => { cleanup(); vi.clearAllMocks(); m.info.mockResolvedValue({ address: '0xEmbedded1234', balanceEth: 0.0523 }); });
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
