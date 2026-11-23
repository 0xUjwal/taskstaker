// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { parseDeadlineHours } from '../utils/deadline';
const mocks = vi.hoisted(() => ({ getToken: async () => 'token', create: vi.fn(), resolveUser: vi.fn() }));
vi.mock('@clerk/clerk-react', () => ({ useAuth: () => ({ getToken: mocks.getToken }) }));
vi.mock('../utils/api', () => ({ resolveUser: mocks.resolveUser, linkWallet: vi.fn(), getEthPrice: vi.fn(async () => ({ usd: 3000 })), getConfig: vi.fn(async () => ({ relayerAddress: '0xrelayer' })), assignValidator: vi.fn(), createTaskEmbedded: mocks.create, getEmbeddedWalletInfo: vi.fn(async () => ({ balanceEth: 1 })) }));
vi.mock('../utils/web3', () => ({ initWeb3: vi.fn(), contract: null, parseEther: vi.fn(), getReadOnlyContract: vi.fn() }));
import CreateTask from './CreateTask';
beforeEach(() => { cleanup(); vi.clearAllMocks(); });
describe('minimum deadline is 3 hours (matches deployed contract)', () => {
  it('helper', () => {
    for (const bad of ['', '0', '1', '2', '2.9', 'abc', '3.5', null, undefined, -5]) expect(parseDeadlineHours(bad).error, String(bad)).toBeTruthy();
    expect(parseDeadlineHours('1').error).toBe('Minimum deadline is 3 hours');
    expect(parseDeadlineHours('3').hours).toBe(3);
    expect(parseDeadlineHours('24').hours).toBe(24);
  });
  it('form rejects 2 hours before calling the backend, and shows the reason', async () => {
    mocks.resolveUser.mockResolvedValue({ username: 'demo_validator', uniqueId: '23456' });
    render(<CreateTask userProfile={{ username: 'demo_presenter', unique_id: '12345' }} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Ship landing page redesign'), { target: { value: 'Run' } });
    fireEvent.change(screen.getByPlaceholderText('Minimum 3 hours'), { target: { value: '2' } });
    fireEvent.change(screen.getByPlaceholderText('0.003'), { target: { value: '0.001' } });
    fireEvent.change(screen.getByPlaceholderText('@username or 12345'), { target: { value: '@demo_validator' } });
    fireEvent.click(screen.getByText('Verify'));
    await screen.findByText(/demo_validator verified/);
    fireEvent.submit(screen.getByPlaceholderText('Minimum 3 hours').closest('form'));
    await screen.findByText('Minimum deadline is 3 hours');
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
