'use client';
import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { ShellIcon } from '@/components/shell/shell-icon';
import { useShellMotion } from '@/components/shell/shell-motion';
import type { StudentProfile } from '@/modules/users/domain/profile';
import { useProfileEditor, type ProfileEditor } from './use-profile-editor';
import { ProfileIdentity } from './profile-identity';
import { ProfileForm } from './profile-form';
import styles from './profile.module.css';

function ProfileContent({ editor }: { editor: ProfileEditor }) {
  const running = useShellMotion();
  return (
    <div
      className={styles.root}
      data-profile
      data-motion={running ? 'running' : 'still'}
    >
      <header className={styles.intro}>
        <div>
          <p>บัญชีของคุณ</p>
          <h1>โปรไฟล์ของฉัน</h1>
          <span>ข้อมูลเล็ก ๆ ที่ช่วยให้ติดต่อกันได้ง่ายขึ้น</span>
        </div>
        <Link href="/dashboard" prefetch={false} className={styles.backLink}>
          <ShellIcon name="arrow" width={16} />
          กลับหน้าภาพรวม
        </Link>
      </header>
      <ProfileIdentity editor={editor} />
      <ProfileForm editor={editor} running={running} />
    </div>
  );
}
export function ProfileExperience({ initial }: { initial: StudentProfile }) {
  const editor = useProfileEditor(initial);
  return (
    <AppShell
      page="profile"
      user={{
        name: editor.profile.name,
        email: editor.profile.email,
        avatarVersion: editor.profile.avatarVersion,
      }}
    >
      <ProfileContent editor={editor} />
    </AppShell>
  );
}
