'use client';
import { useState } from 'react';
import { ShellIcon } from '@/components/shell/shell-icon';
import { PHOTO_ACCEPT, PHOTO_MAX_MIB, formatSize } from './photo-rules';
import type { PickedPhoto } from './use-photo-drafts';
import styles from './photo-field.module.css';

export function PhotoField({
  id,
  photo,
  error,
  onPick,
}: {
  id: string;
  photo: PickedPhoto | null;
  error: string | null;
  onPick: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={styles.root} role="group" aria-labelledby={labelId}>
      <span id={labelId} className={styles.label}>
        รูปสิ่งของ (ไม่บังคับ)
      </span>
      <label
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
        <input
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
        <span className={styles.icon}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img className={styles.thumb} src={photo.url} alt="" />
          ) : (
            <ShellIcon name="camera" />
          )}
        </span>
        <span className={styles.copy}>
          <strong>{photo ? 'แนบรูปแล้ว' : 'เลือกไฟล์รูป'}</strong>
          <span>
            {photo ? (
              `${photo.file.name} · ${formatSize(photo.file.size)} · เลือกรูปใหม่เพื่อเปลี่ยน`
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
      <p id={hintId} className={styles.hint}>
        1 รูป · JPG, PNG หรือ WebP · ไม่เกิน {PHOTO_MAX_MIB} MB
      </p>
      {error ? (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
