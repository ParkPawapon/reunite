import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  statusCatalog,
  statusCodes,
  isStatusCode,
} from '@/components/status/status-catalog';
import { StatusExperience } from '@/components/status/status-experience';
type Props = { params: Promise<{ code: string }> };
export const dynamicParams = false;
export function generateStaticParams() {
  return statusCodes.map((code) => ({ code }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `${code} · ${isStatusCode(code) ? statusCatalog[code].title : 'ไม่พบหน้านี้'} · Reunite`,
    robots: { index: false, follow: false },
  };
}
// Explicit design previews, not fabricated HTTP failures or redirect endpoints.
export default async function StatusPreview({ params }: Props) {
  const { code } = await params;
  if (!isStatusCode(code)) notFound();
  return <StatusExperience code={code} preview />;
}
