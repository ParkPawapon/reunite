import 'server-only';

export function logRequest(entry: {
  requestId: string;
  method: string;
  status: number;
  durationMs: number;
}) {
  // Deliberately omit URL/query, headers, request body and exception details.
  const level = process.env.LOG_LEVEL ?? 'info';
  if (level === 'silent' || (level === 'error' && entry.status < 500)) return;
  const message = JSON.stringify({
    level: entry.status >= 500 ? 'error' : 'info',
    event: 'http_request',
    ...entry,
  });
  if (entry.status >= 500) console.error(message);
  else console.info(message);
}
