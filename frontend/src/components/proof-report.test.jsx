// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ get: vi.fn(), rerun: vi.fn() }));
vi.mock('../utils/api', () => ({ getProofReport: mocks.get, rerunProofReport: mocks.rerun }));
import ProofReport from './ProofReport';
const getToken = async () => 'token';
const complete = { status: 'complete', evidence_support_score: 82, validator_summary: 'Shows a 5.2 km run.',
  criteria: [{ criterion: 'Distance is 5 km', status: 'supported', evidence: 'App shows 5.2 km' }, { criterion: 'Done in the morning', status: 'unclear', evidence: '' }],
  flags: [{ severity: 'high', reason: 'Text tries to instruct the reviewer' }], missing_evidence: ['GPS map'] };
beforeEach(() => { cleanup(); vi.clearAllMocks(); });
describe('ProofReport', () => {
  it('shows the advisory report, score, criteria, flags and missing evidence', async () => {
    mocks.get.mockResolvedValue({ report: complete });
    render(<ProofReport taskId={10} getToken={getToken} />);
    await screen.findByText('Shows a 5.2 km run.');
    expect(screen.getByText(/Advisory only/)).toBeTruthy();
    expect(screen.getAllByText(/82/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Distance is 5 km/)).toBeTruthy();
    expect(screen.getByText(/Text tries to instruct/)).toBeTruthy();
    expect(screen.getByText('GPS map')).toBeTruthy();
    expect(screen.getByText(/does not show the proof is authentic/)).toBeTruthy();
    expect(screen.queryByText(/approve/i, { selector: 'button' })).toBeNull();
  });
  it('shows a spinner while pending, then the report', async () => {
    mocks.get.mockResolvedValueOnce({ report: { status: 'pending' } }).mockResolvedValue({ report: complete });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ProofReport taskId={10} getToken={getToken} />);
    await screen.findByText(/Analyzing the proof/);
    await vi.advanceTimersByTimeAsync(4500);
    await screen.findByText('Shows a 5.2 km run.');
    vi.useRealTimers();
  });
  it('falls back to manual review for unsupported files, without a retry button', async () => {
    mocks.get.mockResolvedValue({ report: { status: 'unsupported', reason: 'File type not supported. Please review the proof manually.' } });
    render(<ProofReport taskId={10} getToken={getToken} />);
    await screen.findByText(/review the proof manually/);
    expect(screen.queryByText('Retry analysis')).toBeNull();
  });
  it('shows manual review plus retry when unavailable, and retry reruns', async () => {
    mocks.get.mockResolvedValue({ report: { status: 'unavailable', reason: 'The AI quota is used up for now. Please review the proof manually.' } });
    mocks.rerun.mockResolvedValue({ report: { status: 'pending' } });
    render(<ProofReport taskId={10} getToken={getToken} />);
    fireEvent.click(await screen.findByText('Retry analysis'));
    await waitFor(() => expect(mocks.rerun).toHaveBeenCalledWith('token', 10));
  });
  it('a failed request shows manual review instead of breaking the card', async () => {
    mocks.get.mockRejectedValue(new Error('offline'));
    render(<ProofReport taskId={10} getToken={getToken} />);
    await screen.findByText(/could not be loaded. Please review the proof manually/);
  });
  it('can be collapsed', async () => {
    mocks.get.mockResolvedValue({ report: complete });
    render(<ProofReport taskId={10} getToken={getToken} defaultOpen={false} />);
    await waitFor(() => expect(mocks.get).toHaveBeenCalled());
    expect(screen.queryByText('Shows a 5.2 km run.')).toBeNull();
    fireEvent.click(screen.getByText('AI advisory report'));
    await screen.findByText('Shows a 5.2 km run.');
  });
});
