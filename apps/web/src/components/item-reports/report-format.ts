const MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

// "2026-11-16T10:30:00+07:00" -> "16 พ.ย. 2569 · 10:30 น."
// The value is already Thai time, so read the parts instead of converting zones.
export function formatEventDatetime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day, hour, minute] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return value;
  return `${Number(day)} ${monthName} ${Number(year) + 543} · ${hour}:${minute} น.`;
}

// "2026-11-16" -> "16 พ.ย. 2569"
export function formatEventDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const monthName = match ? MONTHS[Number(match[2]) - 1] : undefined;
  if (!match || !monthName) return value;
  return `${Number(match[3])} ${monthName} ${Number(match[1]) + 543}`;
}

// "10:30" -> "10:30 น."
export const formatEventTime = (value: string) =>
  /^\d{2}:\d{2}/.test(value) ? `${value.slice(0, 5)} น.` : value;

const bangkokDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function bangkokEventFields(value: string) {
  const parts = Object.fromEntries(
    bangkokDateTime
      .formatToParts(new Date(value))
      .map(({ type, value }) => [type, value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}
