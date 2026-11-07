'use client';
import { StatusExperience } from '@/components/status/status-experience';
import { fontVariables } from '@/theme/fonts';
import './globals.css';

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="th" className={fontVariables}>
      <head>
        <title>ระบบสะดุดชั่วคราว · Reunite</title>
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <body>
        <StatusExperience code="500" onRetry={retry} />
      </body>
    </html>
  );
}
