'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Popover from '@mui/material/Popover';
import Skeleton from '@mui/material/Skeleton';
import { z } from 'zod';
import {
  accountRequest,
  AccountRequestError,
} from '@/modules/users/presentation/profile-client';
import { useShellMotion } from './shell-motion';
import { ShellIcon } from './shell-icon';
import styles from './notifications.module.css';

const pageSchema = z.object({
  items: z.array(
    z.object({
      notificationId: z.number().int().positive(),
      kind: z.enum(['PROFILE_UPDATED', 'AVATAR_UPDATED']),
      createdAt: z.iso.datetime(),
      readAt: z.iso.datetime().nullable(),
    }),
  ),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.number().int().positive().nullable(),
});
type Page = z.infer<typeof pageSchema>;
const content = {
  PROFILE_UPDATED: {
    title: 'บันทึกโปรไฟล์แล้ว',
    description: 'ข้อมูลส่วนบุคคลของคุณอัปเดตเรียบร้อย',
    icon: 'user',
  },
  AVATAR_UPDATED: {
    title: 'อัปเดตรูปโปรไฟล์แล้ว',
    description: 'การเปลี่ยนรูปของคุณบันทึกเรียบร้อย',
    icon: 'camera',
  },
} as const;
const time = (value: string) =>
  new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));

export function NotificationBell({
  enabled,
  reducedMotion,
}: {
  enabled: boolean;
  reducedMotion: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState('');
  const [reading, setReading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const readRequest = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const running = useShellMotion();
  const load = useCallback(
    async (before?: number) => {
      if (!enabled || request.current) return;
      const controller = new AbortController();
      request.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      setLoading(true);
      setFailure('');
      try {
        const result = await accountRequest(
          `/api/v1/notifications${before ? `?before=${before}` : ''}`,
          pageSchema,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted)
          setData((previous) => ({
            ...result,
            items: before
              ? [...(previous?.items ?? []), ...result.items]
              : result.items,
          }));
      } catch (error) {
        if (!controller.signal.aborted)
          setFailure(
            error instanceof AccountRequestError && error.status === 401
              ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'
              : 'โหลดการแจ้งเตือนไม่สำเร็จ',
          );
        else if (request.current === controller)
          setFailure('โหลดนานกว่าปกติ กรุณาลองอีกครั้ง');
      } finally {
        window.clearTimeout(timeout);
        if (request.current === controller) {
          request.current = null;
          setLoading(false);
        }
      }
    },
    [enabled],
  );
  useEffect(() => {
    if (!enabled) return;
    // Fetch after the toolbar's first paint; do not block the navigation controls.
    const initialFrame = window.requestAnimationFrame(() => void load());
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    window.addEventListener('reunite:account-updated', refresh);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('reunite:account-updated', refresh);
      const active = request.current;
      request.current = null;
      active?.abort();
      readRequest.current?.abort();
    };
  }, [enabled, load]);
  async function markRead() {
    const throughId = data?.items[0]?.notificationId;
    if (!throughId || !data?.unreadCount || loading || readRequest.current)
      return;
    const controller = new AbortController();
    readRequest.current = controller;
    setReading(true);
    setFailure('');
    try {
      await accountRequest(
        '/api/v1/notifications',
        z.object({ updated: z.literal(true) }),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ throughId }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15000),
          ]),
        },
      );
      if (!controller.signal.aborted) await load();
    } catch {
      if (!controller.signal.aborted)
        setFailure('บันทึกสถานะไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      if (readRequest.current === controller) {
        readRequest.current = null;
        setReading(false);
      }
    }
  }
  return (
    <>
      <button
        type="button"
        id="notification-button"
        className={styles.bell}
        disabled={!enabled}
        aria-label={`การแจ้งเตือน${data?.unreadCount ? ` ยังไม่อ่าน ${data.unreadCount} รายการ` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? 'notification-panel' : undefined}
        onClick={(event) => {
          setAnchor(event.currentTarget);
          void load();
        }}
      >
        <ShellIcon name="bell" />
        {Boolean(data?.unreadCount) && (
          <span className={styles.badge} aria-hidden="true">
            {(data?.unreadCount ?? 0) > 99 ? '99+' : data?.unreadCount}
          </span>
        )}
      </button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        transitionDuration={reducedMotion ? 0 : 180}
        slotProps={{
          paper: {
            id: 'notification-panel',
            role: 'dialog',
            'aria-labelledby': 'notification-title',
            tabIndex: -1,
            sx: {
              mt: 1.25,
              width: 380,
              maxWidth: 'calc(100vw - 24px)',
              borderRadius: 4,
            },
          },
        }}
      >
        <section
          className={styles.panel}
          data-motion={running ? 'running' : 'still'}
        >
          <header className={styles.header}>
            <div>
              <p className={styles.eyebrow}>เพื่อนช่วยหา</p>
              <h2 id="notification-title" ref={heading} tabIndex={-1}>
                การแจ้งเตือน
              </h2>
            </div>
            <button
              type="button"
              className={styles.close}
              aria-label="ปิดการแจ้งเตือน"
              onClick={() => setAnchor(null)}
            >
              <ShellIcon name="close" />
            </button>
          </header>
          {failure && (
            <div className={styles.failure} role="alert">
              {failure}
              <button
                type="button"
                onClick={() => void load().then(() => heading.current?.focus())}
                disabled={loading}
              >
                ลองอีกครั้ง
              </button>
            </div>
          )}
          {loading && !data ? (
            <div
              className={styles.skeleton}
              role="status"
              aria-label="กำลังโหลดการแจ้งเตือน"
            >
              {[0, 1, 2].map((key) => (
                <div key={key} aria-hidden="true">
                  <Skeleton
                    variant="rounded"
                    width={40}
                    height={40}
                    animation={running ? 'wave' : false}
                  />
                  <span>
                    <Skeleton
                      width="80%"
                      animation={running ? 'wave' : false}
                    />
                    <Skeleton
                      width="55%"
                      animation={running ? 'wave' : false}
                    />
                  </span>
                </div>
              ))}
            </div>
          ) : data && data.items.length === 0 ? (
            <div className={styles.empty}>
              <Image
                src="/illustrations/agent-honk.svg"
                width={92}
                height={114}
                alt=""
              />
              <h3>ยังไม่มีข่าวใหม่</h3>
              <p>เมื่อมีการอัปเดตบัญชี เราจะแจ้งไว้ตรงนี้</p>
            </div>
          ) : data ? (
            <>
              <div className={styles.summary}>
                <span>
                  {data.unreadCount
                    ? `ยังไม่อ่าน ${data.unreadCount} รายการ`
                    : 'อ่านครบแล้ว'}
                  {loading ? ' · กำลังอัปเดต…' : ''}
                </span>
                <button
                  type="button"
                  aria-disabled={!data.unreadCount || reading || loading}
                  onClick={() => void markRead()}
                >
                  {reading ? 'กำลังบันทึก…' : 'อ่านทั้งหมด'}
                </button>
              </div>
              <ul className={styles.list} aria-busy={loading || reading}>
                {data.items.map((item) => (
                  <li key={item.notificationId} data-unread={!item.readAt}>
                    <span className={styles.itemIcon}>
                      <ShellIcon name={content[item.kind].icon} />
                    </span>
                    <div>
                      <a href="/profile" onClick={() => setAnchor(null)}>
                        {content[item.kind].title}
                      </a>
                      <p>{content[item.kind].description}</p>
                      <time dateTime={item.createdAt}>
                        {time(item.createdAt)}
                      </time>
                    </div>
                    {!item.readAt && (
                      <span
                        className={styles.dot}
                        role="img"
                        aria-label="ยังไม่อ่าน"
                      />
                    )}
                  </li>
                ))}
              </ul>
              {data.nextCursor && (
                <button
                  className={styles.more}
                  type="button"
                  disabled={loading}
                  onClick={() => void load(data.nextCursor ?? undefined)}
                >
                  แสดงก่อนหน้านี้
                </button>
              )}
            </>
          ) : null}
          <p className={styles.note}>การอัปเดตบัญชีของคุณ · แสดงเวลาไทย</p>
        </section>
      </Popover>
    </>
  );
}
