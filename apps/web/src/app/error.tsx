'use client';
import { StatusExperience } from '@/components/status/status-experience';
export default function ApplicationError({ retry }: { retry: () => void }) {
  return <StatusExperience code="500" onRetry={retry} />;
}
