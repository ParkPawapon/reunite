'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import { submitLogout } from '@/modules/auth/presentation/logout-client';
import { ShellIcon } from './shell-icon';
import { NotificationBell } from './notification-bell';
import { ProfileAvatar } from './profile-avatar';
import styles from './shell.module.css';

export type ShellUser = {
  name: string;
  email: string;
  avatarVersion?: string | null;
};

export function Topbar({
  user,
  menuExpanded,
  menuId,
  onMenu,
  paused,
  onPause,
  menuLabel,
  reducedMotion,
  title = 'ภาพรวม',
}: {
  user?: ShellUser;
  menuExpanded: boolean;
  menuId: string;
  onMenu: () => void;
  paused: boolean;
  onPause: () => void;
  menuLabel: string;
  reducedMotion: boolean;
  title?: string;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [],
  );

  async function logout() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setFailure('');
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    try {
      await submitLogout(controller.signal);
      if (controller.signal.aborted) throw new Error('Logout timed out');
      window.location.replace('/login');
    } catch {
      if (request.current === controller)
        setFailure('ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  }
  return (
    <header className={styles.topbar} data-topbar>
      <div className={styles.topbarStart}>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.topbarMenu}`}
          onClick={onMenu}
          aria-expanded={menuExpanded}
          aria-controls={menuId}
          aria-label={menuLabel}
        >
          <ShellIcon name="menu" />
        </button>
        <p className={styles.pageTitle}>{title}</p>
      </div>
      <div className={styles.topbarActions}>
        <NotificationBell
          enabled={Boolean(user)}
          reducedMotion={reducedMotion}
        />
        <button
          type="button"
          className={styles.motionButton}
          onClick={onPause}
          aria-label={paused ? 'เล่นภาพเคลื่อนไหว' : 'หยุดภาพเคลื่อนไหว'}
          aria-pressed={paused || reducedMotion}
          disabled={reducedMotion}
          title={
            reducedMotion ? 'อุปกรณ์เปิดการลดภาพเคลื่อนไหวอยู่' : undefined
          }
        >
          <ShellIcon
            name={paused || reducedMotion ? 'play' : 'pause'}
            width={16}
            height={16}
          />
        </button>
        {user ? (
          <button
            id="account-button"
            className={styles.accountButton}
            type="button"
            aria-label="บัญชีของคุณ"
            aria-haspopup="menu"
            aria-expanded={Boolean(anchor)}
            aria-controls={anchor ? 'account-menu' : undefined}
            aria-busy={pending}
            onClick={(event) => setAnchor(event.currentTarget)}
          >
            <ProfileAvatar name={user.name} version={user.avatarVersion} />
            <span className={styles.accountName}>{user.name}</span>
            <ShellIcon
              name="chevron"
              width={14}
              height={14}
              className={styles.chevron}
            />
          </button>
        ) : (
          <div className={styles.accountPlaceholder} aria-hidden="true">
            <Skeleton
              variant="circular"
              width={32}
              height={32}
              animation="wave"
            />
            <Skeleton
              className={styles.accountNamePlaceholder}
              variant="rounded"
              height={14}
              animation="wave"
            />
            <span className={styles.chevron}>
              <Skeleton
                variant="rounded"
                width={14}
                height={8}
                animation="wave"
              />
            </span>
          </div>
        )}
      </div>
      <Menu
        id="account-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        transitionDuration={reducedMotion ? 0 : 150}
        slotProps={{
          list: { 'aria-labelledby': 'account-button' },
          paper: {
            sx: {
              minWidth: 240,
              maxWidth: 'calc(100vw - 32px)',
              borderRadius: 3,
              mt: 1,
            },
          },
        }}
      >
        <div className={styles.accountDetails}>
          <strong>{user?.name}</strong>
          <span>{user?.email}</span>
        </div>
        {failure && (
          <p className={styles.logoutError} role="alert">
            {failure}
          </p>
        )}
        <MenuItem
          component={Link}
          prefetch={false}
          href="/profile"
          onClick={() => setAnchor(null)}
        >
          <ShellIcon name="user" />
          <span className={styles.logoutLabel}>โปรไฟล์ของฉัน</span>
        </MenuItem>
        <MenuItem onClick={() => void logout()} disabled={pending}>
          <ShellIcon name="logout" />
          <span className={styles.logoutLabel}>
            {pending ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
          </span>
        </MenuItem>
      </Menu>
    </header>
  );
}
