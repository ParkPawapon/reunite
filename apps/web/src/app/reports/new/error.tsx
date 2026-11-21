'use client';
import { StatusExperience } from '@/components/status/status-experience';
export default function NewReportError({ retry }: { retry: () => void }) {
  return <StatusExperience code="500" onRetry={retry} />;
}
