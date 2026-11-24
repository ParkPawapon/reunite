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
  MAX_REPORT_IMAGES,
  MAX_REPORT_IMAGE_BYTES,
  MAX_REPORT_IMAGE_MIB,
  reportImageSlotHref,
} from '@/modules/item-reports/domain/report-image-policy';
import styles from './report-detail.module.css';

const accessSchema = z.object({
  hasImage: z.boolean(),
  imageCount: z.number().int().min(0).max(MAX_REPORT_IMAGES).optional(),
  maxImages: z.number().int().min(1).optional(),
  slots: z.array(z.number().int().min(1).max(MAX_REPORT_IMAGES)).optional(),
});

const mutationSchema = z.object({
  updated: z.literal(true),
  hasImage: z.boolean().optional(),
  imageCount: z.number().int().min(0).max(MAX_REPORT_IMAGES).optional(),
  slots: z.array(z.number().int().min(1).max(MAX_REPORT_IMAGES)).optional(),
});

export type ReportImageUpdate = {
  hasImage: boolean;
  hrefs: string[];
};

type ReadyAccess = {
  kind: 'ready';
  hasImage: boolean;
  slots: number[];
  maxImages: number;
};

const toSlots = (data: { hasImage: boolean; slots?: number[] }) =>
  data.slots ?? (data.hasImage ? [1] : []);

export function ReportImageUpload({
  reportId,
  onUpdated,
  shown = true,
  refreshing = false,
}: {
  reportId: number;
  onUpdated: (update: ReportImageUpdate) => void;
  shown?: boolean;
  refreshing?: boolean;
}) {
  const [access, setAccess] = useState<
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | { kind: 'error' }
    | ReadyAccess
  >({ kind: 'loading' });
  const [accessRevision, setAccessRevision] = useState(0);
  const [saved, setSaved] = useState('');
  const motion = useShellMotion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const targetRef = useRef<
    { mode: 'add' } | { mode: 'replace'; slot: 1 | 2 | 3 }
  >({ mode: 'add' });

  useEffect(() => {
    const controller = new AbortController();
    void accountRequest(
      `/api/v1/item-reports/${reportId}/image/access`,
      accessSchema,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setAccess({
            kind: 'ready',
            hasImage: value.hasImage,
            slots: toSlots(value),
            maxImages: value.maxImages ?? MAX_REPORT_IMAGES,
          });
        }
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

  const emitUpdated = (slots: number[]) => {
    onUpdated({
      hasImage: slots.length > 0,
      hrefs: slots.map((slot) => reportImageSlotHref(reportId, slot)),
    });
  };

  async function uploadFiles(files: File[], replaceSlot?: 1 | 2 | 3) {
    if (request.current || refreshing || access.kind !== 'ready') return;
    if (!files.length) return;
    setSaved('');
    const maxAllowed = access.maxImages;
    if (!replaceSlot && access.slots.length + files.length > maxAllowed) {
      setError(`แนบได้สูงสุด ${maxAllowed} รูปต่อรายการ`);
      return;
    }
    const queueFiles = replaceSlot ? [files[0]] : files;
    for (const file of queueFiles) {
      if (
        !file ||
        file.size === 0 ||
        file.size > MAX_REPORT_IMAGE_BYTES ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      ) {
        setError(
          `ใช้ JPG, PNG หรือ WebP ขนาดไม่เกิน ${MAX_REPORT_IMAGE_MIB} MiB`,
        );
        return;
      }
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    let currentSlots = access.slots;
    try {
      for (const file of queueFiles) {
        if (!file) continue;
        const slotParam = replaceSlot
          ? `?slot=${replaceSlot}`
          : currentSlots.length === 0
            ? ''
            : '?slot=next';
        const result = await accountRequest(
          `/api/v1/item-reports/${reportId}/image${slotParam}`,
          mutationSchema,
          {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(20000),
            ]),
          },
        );
        currentSlots = toSlots({
          hasImage: result.hasImage ?? true,
          slots: result.slots,
        });
      }
      if (!controller.signal.aborted) {
        setAccess({
          kind: 'ready',
          hasImage: currentSlots.length > 0,
          slots: currentSlots,
          maxImages: access.maxImages,
        });
        setSaved('บันทึกรูปแล้ว');
        emitUpdated(currentSlots);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        if (currentSlots.length !== access.slots.length) {
          setAccess({
            kind: 'ready',
            hasImage: currentSlots.length > 0,
            slots: currentSlots,
            maxImages: access.maxImages,
          });
          emitUpdated(currentSlots);
        }
        setError(
          err instanceof AccountRequestError && err.status === 401
            ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'
            : 'บันทึกรูปไม่สำเร็จ กรุณาลองอีกครั้ง',
        );
      }
    } finally {
      request.current = null;
      targetRef.current = { mode: 'add' };
      if (!controller.signal.aborted) setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function removeSlot(slot: 1 | 2 | 3) {
    if (request.current || refreshing || access.kind !== 'ready') return;
    setSaved('');
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const slotQuery =
        slot === 1 && access.slots.length <= 1 ? '' : `?slot=${slot}`;
      const result = await accountRequest(
        `/api/v1/item-reports/${reportId}/image${slotQuery}`,
        mutationSchema,
        {
          method: 'DELETE',
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(20000),
          ]),
        },
      );
      if (!controller.signal.aborted) {
        const nextSlots = toSlots({
          hasImage: result.hasImage ?? false,
          slots: result.slots,
        });
        setAccess({
          kind: 'ready',
          hasImage: nextSlots.length > 0,
          slots: nextSlots,
          maxImages: access.maxImages,
        });
        setSaved('ลบรูปแล้ว');
        emitUpdated(nextSlots);
      }
    } catch (err) {
      if (!controller.signal.aborted)
        setError(
          err instanceof AccountRequestError && err.status === 401
            ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'
            : 'ลบรูปไม่สำเร็จ กรุณาลองอีกครั้ง',
        );
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  if (!shown || access.kind === 'unavailable') return null;
  if (access.kind === 'loading')
    return (
      <section
        className={styles.sectionCard}
        role="status"
        aria-label="กำลังโหลดตัวเลือกรูป"
      >
        <Skeleton
          width="100%"
          height={44}
          animation={motion ? 'wave' : false}
        />
      </section>
    );
  if (access.kind === 'error')
    return (
      <section className={styles.sectionCard} role="alert">
        <div className={styles.sectionHeader}>
          <p className={styles.feedback}>ตรวจตัวเลือกแนบรูปไม่สำเร็จ</p>
          <button
            type="button"
            className={styles.outlineBtn}
            onClick={() => {
              setAccess({ kind: 'loading' });
              setAccessRevision((value) => value + 1);
            }}
          >
            ลองอีกครั้ง
          </button>
        </div>
      </section>
    );

  const count = access.slots.length;
  const maxImages = access.maxImages;
  const canAddMore = count < maxImages;

  return (
    <section className={styles.sectionCard} aria-label="รูปของรายการนี้">
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        hidden
        aria-label="เลือกรูปสิ่งของ"
        onChange={(event) => {
          const picked = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          const target = targetRef.current;
          targetRef.current = { mode: 'add' };
          if (picked.length) {
            void uploadFiles(
              picked,
              target.mode === 'replace' ? target.slot : undefined,
            );
          }
        }}
      />
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>
          <ShellIcon name="camera" />
        </span>
        <div className={styles.sectionCopy}>
          <strong>
            {count > 0
              ? `รูปของรายการนี้ (${count}/${maxImages} รูป)`
              : 'รูปช่วยให้จำง่าย'}
          </strong>
          <p>
            สูงสุด {maxImages} รูป · JPG, PNG หรือ WebP · ไม่เกิน{' '}
            {MAX_REPORT_IMAGE_MIB} MiB ต่อรูป
          </p>
        </div>
        {canAddMore && (
          <div className={styles.sectionHeaderAction}>
            <button
              type="button"
              className={styles.tonalBtn}
              disabled={busy || refreshing}
              onClick={() => {
                targetRef.current = { mode: 'add' };
                input.current?.click();
              }}
            >
              <ShellIcon name="plus" width={16} height={16} />
              {busy
                ? 'กำลังบันทึก…'
                : refreshing
                  ? 'กำลังอัปเดต…'
                  : count === 0
                    ? 'แนบรูปสิ่งของ'
                    : `เพิ่มรูป (${count}/${maxImages})`}
            </button>
          </div>
        )}
      </div>
      {count > 0 && (
        <ul className={styles.slotList} aria-label="จัดการรูปที่แนบ">
          {access.slots.map((slot) => {
            const single = count === 1;
            const slotNumber = slot === 2 ? 2 : slot === 3 ? 3 : 1;
            return (
              <li key={slot} className={styles.slotItem}>
                <span className={styles.slotIdentity}>
                  <span className={styles.slotIndex} aria-hidden="true">
                    {slot}
                  </span>
                  <span className={styles.slotLabel}>รูปที่ {slot}</span>
                </span>
                <div className={styles.slotActions}>
                  <button
                    type="button"
                    className={styles.outlineBtn}
                    disabled={busy || refreshing}
                    onClick={() => {
                      targetRef.current = { mode: 'replace', slot: slotNumber };
                      input.current?.click();
                    }}
                  >
                    <ShellIcon name="edit" width={15} height={15} />
                    {single ? 'เปลี่ยนรูปสิ่งของ' : `เปลี่ยนรูปที่ ${slot}`}
                  </button>
                  <button
                    type="button"
                    className={styles.dangerOutlineBtn}
                    disabled={busy || refreshing}
                    onClick={() => void removeSlot(slotNumber)}
                  >
                    <ShellIcon name="trash" width={15} height={15} />
                    {single ? 'ลบรูป' : `ลบรูปที่ ${slot}`}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
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
    </section>
  );
}
