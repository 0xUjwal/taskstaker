// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
const m = vi.hoisted(() => ({
  getMyTasks: vi.fn(), getReview: vi.fn(), requestNewProof: vi.fn(), rejectTask: vi.fn(),
  forfeit: vi.fn(), resubmit: vi.fn(), upload: vi.fn(), submit: vi.fn(), validate: vi.fn(), claim: vi.fn(),
}));
vi.mock('../utils/web3', () => ({ contract: null }));
vi.mock('../utils/storage', () => ({ uploadFile: m.upload }));
const stable = vi.hoisted(() => { const getToken = async () => 't'; return { auth: { getToken } }; });
vi.mock('@clerk/clerk-react', () => ({ useAuth: () => stable.auth }));
vi.mock('./AIChatbot', () => ({ default: () => null }));
vi.mock('./ProofReport', () => ({ default: () => <div>report</div> }));
vi.mock('../utils/api', () => ({
  getMyTasks: m.getMyTasks, getReview: m.getReview, requestNewProof: m.requestNewProof,
  rejectTask: m.rejectTask, forfeitTaskOffChain: m.forfeit, resubmitProof: m.resubmit,
  submitProofOffChain: m.submit, validateTaskOffChain: m.validate, claimFundsEmbedded: m.claim,
  getEthPrice: async () => ({ usd: 3000 }), getEmbeddedWalletInfo: async () => ({ address: '0xabc' }),
}));
import TaskList from './TaskList';
const base = { id: 7, user: '0xabc', validator: '0xdef', name: 'Run 5 km', stake: '0.001', deadline: Date.now() + 3600e3,
  completed: true, validated: false, claimed: false, proofUrl: 'https://x/p1.png', isOwner: false, isValidator: true };
const review = (o) => ({ proofCount: 1, rejectAfter: 3, status: 'under_review', currentProofUrl: 'https://x/p1.png',
  canResubmit: false, canRequestProof: true, canReject: false, ...o });
const show = async (task, rev, label) => {
  m.getMyTasks.mockResolvedValue({ tasks: [task], assignments: {} });
  m.getReview.mockResolvedValue({ review: rev });
  render(<TaskList userProfile={{ id: 'u' }} walletReady={false} taskCreateTick={0} />);
  await screen.findByText('Run 5 km');
  if (label) await screen.findByText(label);
};
beforeEach(() => { cleanup(); vi.clearAllMocks(); });
describe('proof review flow', () => {
  it('validator sees Validate and Ask for New Proof, but no Reject before 3 proofs', async () => {
    await show(base, review(), 'Ask for New Proof');
    expect(screen.getByText('Validate Task')).toBeTruthy();
    expect(screen.queryByText(/Reject Task/)).toBeNull();
  });
  it('Ask for New Proof calls the backend', async () => {
    m.requestNewProof.mockResolvedValue({ success: true });
    await show(base, review(), 'Ask for New Proof');
    fireEvent.click(screen.getByText('Ask for New Proof'));
    await waitFor(() => expect(m.requestNewProof).toHaveBeenCalledWith('t', { taskId: 7 }));
  });
  it('Reject appears after 3 proofs, asks to confirm, then calls the backend', async () => {
    m.rejectTask.mockResolvedValue({ success: true });
    window.confirm = vi.fn(() => true);
    await show(base, review({ proofCount: 3, canReject: true }), 'Reject Task (after 3 proofs)');
    fireEvent.click(screen.getByText(/Reject Task/));
    await waitFor(() => expect(m.rejectTask).toHaveBeenCalledWith('t', { taskId: 7 }));
    expect(window.confirm).toHaveBeenCalled();
  });
  it('declining the confirm does not reject', async () => {
    window.confirm = vi.fn(() => false);
    await show(base, review({ proofCount: 3, canReject: true }), 'Reject Task (after 3 proofs)');
    fireEvent.click(screen.getByText(/Reject Task/));
    expect(m.rejectTask).not.toHaveBeenCalled();
  });
  it('rejected task hides the validator buttons and shows Rejected', async () => {
    await show(base, review({ status: 'rejected', canRequestProof: false }), 'You rejected this task after 1 proofs.');
    expect(screen.queryByText('Validate Task')).toBeNull();
    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);
  });
  it('owner sees the validator request and can upload another proof', async () => {
    m.upload.mockResolvedValue({ url: 'https://x/p2.png' }); m.resubmit.mockResolvedValue({ success: true });
    await show({ ...base, isOwner: true, isValidator: false }, review({ status: 'needs_new_proof', canResubmit: true, canRequestProof: false }), 'Submit Another Proof');
    expect(screen.getByText(/not enough/)).toBeTruthy();
    fireEvent.click(screen.getByText('Submit Another Proof'));
    const input = await screen.findByLabelText('Upload new proof for task 7');
    fireEvent.change(input, { target: { files: [new File(['x'], 'p2.png', { type: 'image/png' })] } });
    await waitFor(() => expect(m.resubmit).toHaveBeenCalledWith('t', { taskId: 7, proofUrl: 'https://x/p2.png' }));
  });
  it('Acknowledge Penalty works with no wallet connected', async () => {
    m.forfeit.mockResolvedValue({ success: true });
    await show({ ...base, isOwner: true, isValidator: false, completed: false, proofUrl: '', deadline: Date.now() - 1000 }, review(), 'Acknowledge Penalty');
    fireEvent.click(screen.getByText('Acknowledge Penalty'));
    await waitFor(() => expect(m.forfeit).toHaveBeenCalledWith('t', { taskId: 7 }));
    expect(screen.queryByText(/Connect your wallet/)).toBeNull();
  });
  it('if the review lookup fails the normal Validate button still shows', async () => {
    m.getMyTasks.mockResolvedValue({ tasks: [base], assignments: {} });
    m.getReview.mockRejectedValue(new Error('down'));
    render(<TaskList userProfile={{ id: 'u' }} walletReady={false} taskCreateTick={0} />);
    await screen.findByText('Validate Task');
  });

  it('after Submit Proof succeeds the button is replaced at once, even though the chain still says no proof', async () => {
    m.upload.mockResolvedValue({ url: 'https://x/p1.png' }); m.submit.mockResolvedValue({ success: true });
    await show({ ...base, isOwner: true, isValidator: false, completed: false, proofUrl: '' }, review(), 'Submit Proof');
    fireEvent.click(screen.getByText('Submit Proof'));
    const input = await screen.findByLabelText('Upload proof for task 7');
    fireEvent.change(input, { target: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } });
    await screen.findByText('Proof uploaded. Waiting for the validator.');
    expect(screen.queryByText('Submit Proof')).toBeNull();
    expect(screen.getByText('Proof Submitted')).toBeTruthy();
  });
  it('after Validate succeeds the validator sees Validated at once, not the Validate button', async () => {
    m.validate.mockResolvedValue({ success: true });
    await show(base, review(), 'Validate Task');
    fireEvent.click(screen.getByText('Validate Task'));
    await screen.findByText('Validated. The owner can now claim the stake.');
    expect(screen.queryByText('Validate Task')).toBeNull();
  });
  it('after Claim succeeds the owner sees Stake settled at once, not the Claim button', async () => {
    m.claim.mockResolvedValue({ success: true });
    await show({ ...base, isOwner: true, isValidator: false, validated: true }, review({ canResubmit: false }), 'Claim Stake');
    fireEvent.click(screen.getByText('Claim Stake'));
    await screen.findByText('Stake settled');
    expect(screen.queryByText('Claim Stake')).toBeNull();
    expect(screen.getByText('Completed')).toBeTruthy();
  });
  it('a failed action keeps the button and shows the error', async () => {
    m.validate.mockRejectedValue(new Error('boom'));
    await show(base, review(), 'Validate Task');
    fireEvent.click(screen.getByText('Validate Task'));
    await screen.findByText('boom');
    expect(screen.getByText('Validate Task')).toBeTruthy();
  });
});
