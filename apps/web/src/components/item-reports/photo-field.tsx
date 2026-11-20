'use client';
import { useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { ShellIcon } from '@/components/shell/shell-icon';
import { useShellMotion } from '@/components/shell/shell-motion';
import {
  PHOTO_ACCEPT,
  PHOTO_MAX_MIB,
  formatSize,
  photoTypeLabel,
} from './photo-rules';
import type { PickedPhoto } from './use-photo-drafts';
import styles from './photo-field.module.css';

export function PhotoField({
  id,
  photo,
  error,
  onPick,
  onRemove,
}: {
  id: string;
  photo: PickedPhoto | null;
  error: string | null;
  onPick: (files: File[]) => void;
  onRemove: () => void;
}) {
  const motion = useShellMotion();
  const [dragging, setDragging] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<HTMLButtonElement>(null);
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const previewTitleId = `${id}-preview-title`;
  return (
    <div className={styles.root} role="group" aria-labelledby={labelId}>
      <span id={labelId} className={styles.label}>
        รูปสิ่งของ (ไม่บังคับ)
      </span>
      <div
        className={styles.box}
        data-dragging={dragging}
        data-error={Boolean(error)}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          onPick(Array.from(event.dataTransfer.files));
        }}
      >
        {photo ? (
          // Mouse shortcut for the eye button, which is the keyboard way in.
          <button
            type="button"
            className={styles.thumbButton}
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setPreviewOpen(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img className={styles.thumb} src={photo.url} alt="" />
          </button>
        ) : null}
        <label className={styles.pick} data-attached={Boolean(photo)}>
          <input
            ref={inputRef}
            id={id}
            className={styles.input}
            type="file"
            accept={PHOTO_ACCEPT}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              onPick(Array.from(event.target.files ?? []));
              // Let the user pick the same file again after an error.
              event.target.value = '';
            }}
          />
          {photo ? null : (
            <span className={styles.icon}>
              <ShellIcon name="camera" />
            </span>
          )}
          <span className={styles.copy}>
            <strong>{photo ? photo.file.name : 'เลือกไฟล์รูป'}</strong>
            <span>
              {photo ? (
                `${photoTypeLabel(photo.file.type)} · ${formatSize(photo.file.size)} · แนบแล้ว`
              ) : (
                <>
                  <span className={styles.desktopOnly}>
                    หรือลากรูปมาวางที่นี่
                  </span>
                  <span className={styles.mobileOnly}>เลือกรูปจากเครื่อง</span>
                </>
              )}
            </span>
          </span>
        </label>
        {photo ? (
          <div className={styles.actions}>
            <Tooltip title="ดูรูป">
              <IconButton
                ref={viewRef}
                className={styles.iconButton}
                aria-label="ดูรูป"
                onClick={() => setPreviewOpen(true)}
              >
                <ShellIcon name="eye" />
              </IconButton>
            </Tooltip>
            <Tooltip title="ลบรูป">
              <IconButton
                className={styles.iconButton}
                aria-label="ลบรูป"
                onClick={() => {
                  onRemove();
                  // The button is about to disappear; keep the keyboard focus on the field.
                  inputRef.current?.focus();
                }}
              >
                <ShellIcon name="trash" />
              </IconButton>
            </Tooltip>
          </div>
        ) : null}
      </div>
      <p id={hintId} className={styles.hint}>
        1 รูป · JPG, PNG หรือ WebP · ไม่เกิน {PHOTO_MAX_MIB} MB
      </p>
      {error ? (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <Dialog
        open={previewOpen && Boolean(photo)}
        onClose={() => setPreviewOpen(false)}
        aria-labelledby={previewTitleId}
        maxWidth={false}
        disableRestoreFocus
        transitionDuration={motion ? { enter: 200, exit: 140 } : 0}
        slotProps={{
          paper: { className: styles.dialogPaper },
          transition: {
            // Always return to the eye button, even when the thumbnail opened it.
            onExited: () => viewRef.current?.focus(),
          },
        }}
      >
        <header className={styles.dialogHeader}>
          <div>
            <h2 id={previewTitleId} className={styles.dialogTitle}>
              รูปสิ่งของ
            </h2>
            {photo ? (
              <p className={styles.dialogMeta}>
                {photo.file.name} · {photoTypeLabel(photo.file.type)} ·{' '}
                {formatSize(photo.file.size)}
              </p>
            ) : null}
          </div>
          <Tooltip title="ปิดรูป">
            <IconButton
              className={styles.iconButton}
              aria-label="ปิดรูป"
              onClick={() => setPreviewOpen(false)}
            >
              <ShellIcon name="close" />
            </IconButton>
          </Tooltip>
        </header>
        {photo ? (
          <div className={styles.stage}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img
              className={styles.preview}
              src={photo.url}
              alt={`รูปสิ่งของ ${photo.file.name}`}
            />
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
