import type { Metadata } from 'next';
import { LoginExperience } from '@/components/auth/login-experience';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ · Reunite',
  description: 'เข้าสู่ระบบ Reunite เพื่อนช่วยตามหาของหายที่ มจธ. บางมด',
  robots: { index: false, follow: false },
};
export default function LoginPage() {
  return <LoginExperience />;
}
