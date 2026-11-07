import type { Metadata } from 'next';
import { fontVariables } from '@/theme/fonts';
import { AppProviders } from '@/components/providers/app-providers';
import { appName } from '@/config/public';
import './globals.css';

export const metadata: Metadata = {
  title: appName,
  description: 'Campus Lost & Found foundation',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={fontVariables}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
