// Matches the deployed contract, which rejects deadlines under 3 hours.
export const MIN_DEADLINE_HOURS = 3;

export function parseDeadlineHours(value) {
  const n = Number(value);
  if (value === "" || value === null || value === undefined || !Number.isInteger(n)) {
    return { error: `Deadline must be a whole number of hours (minimum ${MIN_DEADLINE_HOURS})` };
  }
  if (n < MIN_DEADLINE_HOURS) {
    return { error: `Minimum deadline is ${MIN_DEADLINE_HOURS} hours` };
  }
  return { hours: n };
}
