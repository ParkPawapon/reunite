import { LoadingScreen } from '@/components/loading/loading-screen';
import { JavascriptNotice } from '@/components/loading/javascript-notice';

export default function Loading() {
  return (
    <main>
      <LoadingScreen />
      <JavascriptNotice />
    </main>
  );
}
