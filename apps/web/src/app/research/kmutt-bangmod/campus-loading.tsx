import { LoadingScreen } from '@/components/loading/loading-screen';

export function CampusLoading({
  message = 'กำลังโหลด…',
}: {
  message?: string;
}) {
  return <LoadingScreen embedded message={message} />;
}
