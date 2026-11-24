'use client';
import { useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { ShellIcon } from '@/components/shell/shell-icon';
import { useShellMotion } from '@/components/shell/shell-motion';
import {
  PHOTO_ACCEPT,
  PHOTO_MAX_COUNT,
  PHOTO_MAX_MIB,
  formatSize,
  photoTypeLabel,
} from './photo-rules';
import type { PickedPhoto } from './use-photo-drafts';
import styles from './photo-field.module.css';

export function PhotoField({
  id,
  photos,
  error,
  onPick,
  onRemove,
}: {
  id: string;
  photos: PickedPhoto[];
  error: string | null;
  onPick: (files: File[]) => void;
  onRemove: (photoId: string) => void;
}) {
  const motion = useShellMotion();
  const [dragging, setDragging] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const previewTitleId = `${id}-preview-title`;
  const full = photos.length >= PHOTO_MAX_COUNT;
  const activePreview =
    previewIndex !== null ? (photos[previewIndex] ?? null) : null;

  return (
    <div className={styles.root} role="group" aria-labelledby={labelId}>
      <span id={labelId} className={styles.label}>
        รูปสิ่งของ (ไม่บังคับ · สูงสุด {PHOTO_MAX_COUNT} รูป)
      </span>
      <div
        className={styles.box}
        data-attached={full}
        data-dragging={dragging}
        data-error={Boolean(error)}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!full) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!full) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!full) onPick(Array.from(event.dataTransfer.files));
        }}
      >
        <label
          className={styles.pick}
          data-attached={false}
          data-disabled={full}
        >
          <input
            ref={inputRef}
            id={id}
            className={styles.input}
            type="file"
            multiple
            disabled={full}
            accept={PHOTO_ACCEPT}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              onPick(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
          <span className={styles.icon}>
            <ShellIcon name={photos.length ? 'plus' : 'camera'} />
          </span>
          <span className={styles.copy}>
            <strong>
              {full
                ? `แนบครบ ${PHOTO_MAX_COUNT} รูปแล้ว`
                : photos.length
                  ? `เพิ่มรูปเพิ่มเติม (${photos.length}/${PHOTO_MAX_COUNT})`
                  : 'เลือกไฟล์รูป'}
            </strong>
            <span>
              {full ? (
                'ลบออกบางรูปได้หากต้องการเปลี่ยนมุมใหม่'
              ) : (
                <>
                  <span className={styles.desktopOnly}>
                    หรือลากรูปมาวางที่นี่ (หลายมุมหรือจุดตำหนิ)
                  </span>
                  <span className={styles.mobileOnly}>เลือกรูปจากเครื่อง</span>
                </>
              )}
            </span>
          </span>
        </label>
      </div>
      {photos.length > 0 && (
        <ul className={styles.list} aria-label="รูปสิ่งของที่แนบ">
          {photos.map((photo, index) => (
            <li key={photo.id} className={styles.item}>
              <button
                type="button"
                className={styles.thumbButton}
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => setPreviewIndex(index)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img className={styles.thumb} src={photo.url} alt="" />
              </button>
              <span className={styles.copy}>
                <strong>{photo.file.name}</strong>
                <span>
                  รูปที่ {index + 1} · {photoTypeLabel(photo.file.type)} ·{' '}
                  {formatSize(photo.file.size)}
                </span>
              </span>
              <div className={styles.actions}>
                <Tooltip title={`ดูรูปที่ ${index + 1}`}>
                  <IconButton
                    ref={(el) => {
                      viewRefs.current[index] = el;
                    }}
                    className={styles.iconButton}
                    aria-label={
                      photos.length === 1 ? 'ดูรูป' : `ดูรูปที่ ${index + 1}`
                    }
                    onClick={() => setPreviewIndex(index)}
                  >
                    <ShellIcon name="eye" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`ลบรูปที่ ${index + 1}`}>
                  <IconButton
                    className={styles.iconButton}
                    aria-label={
                      photos.length === 1 ? 'ลบรูป' : `ลบรูปที่ ${index + 1}`
                    }
                    onClick={() => {
                      onRemove(photo.id);
                      inputRef.current?.focus();
                    }}
                  >
                    <ShellIcon name="trash" />
                  </IconButton>
                </Tooltip>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p id={hintId} className={styles.hint}>
        สูงสุด {PHOTO_MAX_COUNT} รูป · JPG, PNG หรือ WebP · ไม่เกิน{' '}
        {PHOTO_MAX_MIB} MB ต่อรูป
      </p>
      {error ? (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <Dialog
        open={Boolean(activePreview)}
        onClose={() => setPreviewIndex(null)}
        aria-labelledby={previewTitleId}
        maxWidth={false}
        disableRestoreFocus
        transitionDuration={motion ? { enter: 200, exit: 140 } : 0}
        slotProps={{
          paper: { className: styles.dialogPaper },
          transition: {
            onExited: () => {
              const target =
                previewIndex !== null ? viewRefs.current[previewIndex] : null;
              (target ?? inputRef.current)?.focus();
            },
          },
        }}
      >
        <header className={styles.dialogHeader}>
          <div>
            <h2 id={previewTitleId} className={styles.dialogTitle}>
              รูปสิ่งของ
              {photos.length > 1 && previewIndex !== null
                ? ` (${previewIndex + 1}/${photos.length})`
                : ''}
            </h2>
            {activePreview ? (
              <p className={styles.dialogMeta}>
                {activePreview.file.name} ·{' '}
                {photoTypeLabel(activePreview.file.type)} ·{' '}
                {formatSize(activePreview.file.size)}
              </p>
            ) : null}
          </div>
          <Tooltip title="ปิดรูป">
            <IconButton
              className={styles.iconButton}
              aria-label="ปิดรูป"
              onClick={() => setPreviewIndex(null)}
            >
              <ShellIcon name="close" />
            </IconButton>
          </Tooltip>
        </header>
        {activePreview ? (
          <div className={styles.stage}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img
              className={styles.preview}
              src={activePreview.url}
              alt={`รูปสิ่งของ ${activePreview.file.name}`}
            />
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
