const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function zonedTimeToUtc(date: string, endExclusive: boolean, timeZone: string) {
  if (!datePattern.test(date)) throw new Error('Invalid report date.');
  const [year, month, day] = date.split('-').map(Number);
  const base = Date.UTC(year, month - 1, day + (endExclusive ? 1 : 0), 0, 0, 0, 0);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let estimate = base;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(estimate)).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    estimate += base - represented;
  }
  return new Date(estimate).toISOString();
}

export function reportDateRange(periodStart: string, periodEnd: string, timeZone = 'UTC') {
  return { start: zonedTimeToUtc(periodStart, false, timeZone), endExclusive: zonedTimeToUtc(periodEnd, true, timeZone) };
}
