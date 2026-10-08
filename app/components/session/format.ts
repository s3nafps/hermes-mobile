// A timestamp as a short local date and time. Accepts epoch seconds, epoch milliseconds,
// a numeric string, or an ISO date string. Returns '' when the value cannot be read.
export function formatWhen(value: unknown): string {
  let date: Date | null = null;
  let number: number | null = null;
  if (typeof value === 'number') number = value;
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) number = Number(value);
  if (number !== null && Number.isFinite(number) && number > 0) {
    date = new Date(number < 1e12 ? number * 1000 : number);
  } else if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) date = new Date(parsed);
  }
  if (!date) return '';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
