'use client';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import { ProfileAvatar } from '@/components/shell/profile-avatar';
import { ShellIcon } from '@/components/shell/shell-icon';
import { useShellMotion } from '@/components/shell/shell-motion';
import type { ProfileEditor } from './use-profile-editor';
import styles from './profile.module.css';

export function ProfileIdentity({ editor }: { editor: ProfileEditor }) {
  const { profile, pending, photoPending, input, photo } = editor;
  const running = useShellMotion();
  return (
    <aside className={styles.identity} aria-label="รูปและข้อมูลบัญชี">
      <div className={styles.identityPerson}>
        <div className={styles.portrait} aria-busy={photoPending}>
          <ProfileAvatar
            name={profile.name}
            version={profile.avatarVersion}
            size={76}
          />
          {photoPending && (
            <div className={styles.photoProgress} aria-hidden="true">
              <Skeleton
                variant="circular"
                width={76}
                height={76}
                animation={running ? 'wave' : false}
              />
            </div>
          )}
        </div>
        <div className={styles.identityCopy}>
          <h2>{profile.name}</h2>
          <p>{profile.email}</p>
          {profile.studentId && (
            <span className={styles.studentId}>
              <ShellIcon name="user" width={13} height={13} />
              {profile.studentId}
            </span>
          )}
        </div>
      </div>
      <div className={styles.photoControls}>
        <div className={styles.photoButtons}>
          <input
            ref={input}
            className={styles.fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="เลือกรูปโปรไฟล์"
            onChange={(event) => void photo(event.target.files?.[0])}
            disabled={pending || photoPending}
          />
          <Button
            variant="outlined"
            onClick={() => input.current?.click()}
            disabled={pending || photoPending}
            startIcon={<ShellIcon name="camera" width={18} />}
            loading={photoPending}
          >
            เปลี่ยนรูปโปรไฟล์
          </Button>
          {profile.avatarVersion && (
            <button
              type="button"
              className={styles.removePhoto}
              disabled={pending || photoPending}
              onClick={() => void photo(undefined, true)}
            >
              ลบรูป
            </button>
          )}
        </div>
        <p className={styles.photoHelp}>
          {photoPending
            ? 'กำลังบันทึกรูปโปรไฟล์…'
            : 'JPG, PNG, WebP · ไม่เกิน 2 MB · บันทึกทันทีเมื่อเลือก'}
        </p>
      </div>
    </aside>
  );
}
