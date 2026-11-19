'use client';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import Skeleton from '@mui/material/Skeleton';
import { ShellIcon } from '@/components/shell/shell-icon';
import { useShellMotion } from '@/components/shell/shell-motion';
import {
  accountRequest,
  AccountRequestError,
} from '@/modules/users/presentation/profile-client';
import {
  MAX_REPORT_IMAGE_BYTES,
  MAX_REPORT_IMAGE_MIB,
} from '@/modules/item-reports/domain/report-image-policy';
import styles from './report-detail.module.css';
export function ReportImageUpload({
  reportId,
  onUpdated,
  shown = true,
  refreshing = false,
}: {
  reportId: number;
  onUpdated: (hasImage: boolean) => void;
  shown?: boolean;
  refreshing?: boolean;
}) {
  const [access, setAccess] = useState<
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | { kind: 'error' }
    | { kind: 'ready'; hasImage: boolean }
  >({ kind: 'loading' });
  const [accessRevision, setAccessRevision] = useState(0);
  const [saved, setSaved] = useState('');
  const motion = useShellMotion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void accountRequest(
      `/api/v1/item-reports/${reportId}/image/access`,
      z.object({ hasImage: z.boolean() }),
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) setAccess({ kind: 'ready', ...value });
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setAccess(
            err instanceof AccountRequestError &&
              [401, 404].includes(err.status)
              ? { kind: 'unavailable' }
              : { kind: 'error' },
          );
      });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [reportId, accessRevision]);
  async function upload(file?: File) {
    if (request.current || refreshing) return;
    setSaved('');
    if (
      file &&
      (file.size > MAX_REPORT_IMAGE_BYTES ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    ) {
      setError(
        `ใช้ JPG, PNG หรือ WebP ขนาดไม่เกิน ${MAX_REPORT_IMAGE_MIB} MiB`,
      );
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      await accountRequest(
        `/api/v1/item-reports/${reportId}/image`,
        z.object({ updated: z.literal(true) }),
        {
          method: file ? 'PUT' : 'DELETE',
          headers: file ? { 'Content-Type': file.type } : undefined,
          body: file,
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(20000),
          ]),
        },
      );
      if (!controller.signal.aborted) {
        setAccess({ kind: 'ready', hasImage: !!file });
        setSaved(file ? 'บันทึกรูปแล้ว' : 'ลบรูปแล้ว');
        onUpdated(!!file);
      }
    } catch (err) {
      if (!controller.signal.aborted)
        setError(
          err instanceof AccountRequestError && err.status === 401
            ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'
            : 'บันทึกรูปไม่สำเร็จ กรุณาลองอีกครั้ง',
        );
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  if (!shown || access.kind === 'unavailable') return null;
  if (access.kind === 'loading')
    return (
      <div
        className={styles.upload}
        role="status"
        aria-label="กำลังโหลดตัวเลือกรูป"
      >
        <Skeleton
          width="100%"
          height={44}
          animation={motion ? 'wave' : false}
        />
      </div>
    );
  if (access.kind === 'error')
    return (
      <div className={styles.upload} role="alert">
        <p className={styles.feedback}>ตรวจตัวเลือกแนบรูปไม่สำเร็จ</p>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            setAccess({ kind: 'loading' });
            setAccessRevision((value) => value + 1);
          }}
        >
          ลองอีกครั้ง
        </button>
      </div>
    );
  return (
    <div className={styles.upload}>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        aria-label="เลือกรูปสิ่งของ"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void upload(file);
        }}
      />
      <div className={styles.uploadRow}>
        <span className={styles.uploadIcon}>
          <ShellIcon name="camera" />
        </span>
        <div className={styles.uploadCopy}>
          <strong>
            {access.hasImage ? 'รูปของรายการนี้' : 'รูปช่วยให้จำง่าย'}
          </strong>
          <p>JPG, PNG หรือ WebP · ไม่เกิน {MAX_REPORT_IMAGE_MIB} MiB</p>
        </div>
        <div className={styles.uploadActions}>
          <button
            type="button"
            className={styles.primary}
            disabled={busy || refreshing}
            onClick={() => input.current?.click()}
          >
            <ShellIcon
              name={access.hasImage ? 'camera' : 'plus'}
              width={16}
              height={16}
            />
            {busy
              ? 'กำลังบันทึก…'
              : refreshing
                ? 'กำลังอัปเดต…'
                : access.hasImage
                  ? 'เปลี่ยนรูปสิ่งของ'
                  : 'แนบรูปสิ่งของ'}
          </button>
          {access.hasImage && (
            <button
              type="button"
              className={styles.secondary}
              disabled={busy || refreshing}
              onClick={() => void upload()}
            >
              ลบรูป
            </button>
          )}
        </div>
      </div>
      <p className={styles.disclosure}>
        รูปอาจส่งให้บริการ AI ภายนอกเพื่อช่วยจับคู่สิ่งของ
      </p>
      {error && (
        <p role="alert" className={styles.feedback}>
          {error}
        </p>
      )}
      <p role="status" className={`${styles.feedback} ${styles.saved}`}>
        {saved}
      </p>
    </div>
  );
}
