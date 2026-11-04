import type { Metadata } from 'next';
import { Outfit, Noto_Sans_Thai } from 'next/font/google';
import { AppProviders } from '@/components/providers/app-providers';
import { appName } from '@/config/public';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-outfit',
});
const thai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-noto-sans-thai',
});
export const metadata: Metadata = {
  title: appName,
  description: 'Campus Lost & Found foundation',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${outfit.variable} ${thai.variable}`}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
