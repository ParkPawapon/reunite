import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/app-shell';
import { CampusViewer } from '../research/kmutt-bangmod/campus-viewer';

export const metadata: Metadata = {
  title: 'แผนที่บางมด · Reunite',
  description: 'ค้นหาอาคารและวางเส้นทางเดินใน มจธ. วิทยาเขตบางมด',
};

export default function CampusMapPage() {
  return (
    <AppShell page="campus">
      <CampusViewer />
    </AppShell>
  );
}
