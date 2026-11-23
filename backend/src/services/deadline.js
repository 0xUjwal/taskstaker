// The deployed TaskStakerV2 contract rejects deadlines under 3 hours
// ("Minimum deadline is 3 hours"). Validate here so a short deadline fails
// clearly instead of reverting on-chain after the app says "Task Deployed".
const MIN_DEADLINE_HOURS = 3;

function parseDeadlineHours(value) {
  const n = Number(value);
  if (value === "" || value === null || value === undefined || !Number.isInteger(n)) {
    return { error: `Deadline must be a whole number of hours (minimum ${MIN_DEADLINE_HOURS})` };
  }
  if (n < MIN_DEADLINE_HOURS) {
    return { error: `Minimum deadline is ${MIN_DEADLINE_HOURS} hours` };
  }
  return { hours: n };
}

module.exports = { MIN_DEADLINE_HOURS, parseDeadlineHours };
