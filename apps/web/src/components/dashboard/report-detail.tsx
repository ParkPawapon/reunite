'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import { ShellIcon } from '@/components/shell/shell-icon';
import { useShellMotion } from '@/components/shell/shell-motion';
import {
  loadReportDetail,
  ReportRequestError,
  reportImageHref,
  type ReportRow,
} from '@/modules/item-reports/presentation/reports-client';
import { reportDate, ReportStatus } from './report-table';
import { ReportImageUpload } from './report-image-upload';
import { ReportManagement } from './report-management';
import { ReportDetailSkeleton } from './report-detail-skeleton';
import { ReportPhoto } from './report-photo';
import styles from './report-detail.module.css';

export function ReportDetail({
  reportId,
  onClose,
  onManaged,
}: {
  reportId: number;
  onClose: () => void;
  onManaged?: () => void;
}) {
  const titleId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const motion = useShellMotion();
  const [open, setOpen] = useState(true);
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; missing: boolean }
    | { kind: 'ready'; row: ReportRow }
  >({ kind: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void loadReportDetail(reportId, controller.signal)
      .then((row) => {
        if (active) setState({ kind: 'ready', row });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            kind: 'error',
            missing:
              error instanceof ReportRequestError && error.status === 404,
          });
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [reportId, revision]);
  const row = state.kind === 'ready' ? state.row : null;
  const imageHref = reportImageHref(row?.image ?? null);
  const managedImage = imageHref === `/api/v1/item-reports/${reportId}/image`;
  const close = () => {
    if (!managing) setOpen(false);
  };
  return (
    <Dialog
      className={styles.root}
      data-motion={motion ? 'running' : 'still'}
      open={open}
      onClose={close}
      fullWidth
      maxWidth={false}
      aria-labelledby={titleId}
      transitionDuration={motion ? { enter: 200, exit: 140 } : 0}
      slotProps={{
        paper: {
          className: styles.paper,
        },
        backdrop: { className: styles.backdrop },
        transition: {
          onEntered: () => title.current?.focus({ preventScroll: true }),
          onExited: onClose,
        },
      }}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.meta}>
            {row ? (
              <>
                <span className={styles.type}>
                  {row.type === 'LOST' ? 'ของหาย' : 'ของที่พบ'}
                </span>
                <span className={styles.separator} aria-hidden="true" />
                <ReportStatus status={row.status} />
              </>
            ) : state.kind === 'loading' ? (
              <Skeleton
                width={110}
                height={20}
                animation={motion ? 'wave' : false}
              />
            ) : null}
          </div>
          <h2 id={titleId} ref={title} tabIndex={-1}>
            {row?.title ?? 'รายละเอียดสิ่งของ'}
          </h2>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={close}
          disabled={managing}
          aria-label="ปิดรายละเอียด"
          title="ปิดรายละเอียด"
        >
          <ShellIcon name="close" />
        </button>
      </header>
      <div
        className={styles.body}
        role="region"
        aria-label="รายละเอียดรายการ"
        tabIndex={0}
        aria-busy={state.kind === 'loading' || refreshing || managing}
      >
        {state.kind === 'loading' ? (
          <ReportDetailSkeleton motion={motion} />
        ) : state.kind === 'error' ? (
          <div role="alert" className={styles.error}>
            <ShellIcon
              name={state.missing ? 'box' : 'alert'}
              width={28}
              height={28}
            />
            <h3>
              {state.missing ? 'ไม่พบรายการนี้แล้ว' : 'เปิดรายละเอียดไม่สำเร็จ'}
            </h3>
            <p>
              {state.missing
                ? 'รายการอาจถูกนำออกจากระบบแล้ว'
                : 'ลองอีกครั้งเมื่อการเชื่อมต่อพร้อม'}
            </p>
            {!state.missing && (
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  setState({ kind: 'loading' });
                  setRevision((value) => value + 1);
                }}
              >
                ลองอีกครั้ง <ShellIcon name="refresh" width={16} height={16} />
              </button>
            )}
          </div>
        ) : (
          <>
            {managedImage && imageHref && (
              <ReportPhoto
                key={`${reportId}:${revision}`}
                href={imageHref}
                title={state.row.title}
                motion={motion}
              />
            )}
            <p className={styles.description}>
              {state.row.description || 'ไม่ได้ระบุรายละเอียดเพิ่มเติม'}
            </p>
            <dl className={styles.details}>
              <div className={styles.location}>
                <dt>
                  <ShellIcon name="pin" />
                  {state.row.type === 'LOST' ? 'สถานที่หาย' : 'สถานที่พบ'}
                </dt>
                <dd>{state.row.locationName}</dd>
              </div>
              <div className={styles.category}>
                <dt>หมวดหมู่</dt>
                <dd>{state.row.categoryName}</dd>
              </div>
              <div>
                <dt>{state.row.type === 'LOST' ? 'วันที่หาย' : 'วันที่พบ'}</dt>
                <dd>
                  <time dateTime={state.row.eventDatetime}>
                    {reportDate.format(new Date(state.row.eventDatetime))}
                  </time>
                </dd>
              </div>
              <div>
                <dt>วันที่แจ้ง</dt>
                <dd>
                  <time dateTime={state.row.createdAt}>
                    {reportDate.format(new Date(state.row.createdAt))}
                  </time>
                </dd>
              </div>
            </dl>
            {imageHref && !managedImage && (
              <a
                href={imageHref}
                className={styles.imageLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                เปิดรูปประกอบ{' '}
                <ShellIcon name="external" width={14} height={14} />
                <span className={styles.srOnly}>ในแท็บใหม่</span>
              </a>
            )}
          </>
        )}
        {row && onManaged && (
          <ReportManagement
            row={row}
            onPendingChange={setManaging}
            onUpdated={(next) => {
              setState((current) =>
                current.kind === 'ready'
                  ? { kind: 'ready', row: next }
                  : current,
              );
              setRefreshing(true);
              setRevision((value) => value + 1);
              onManaged();
            }}
          />
        )}
        <ReportImageUpload
          reportId={reportId}
          shown={state.kind === 'ready'}
          refreshing={refreshing}
          onUpdated={(hasImage) => {
            // The mutation has committed: hide deleted media before revalidating the row.
            setState((current) =>
              current.kind === 'ready'
                ? {
                    ...current,
                    row: {
                      ...current.row,
                      image: hasImage
                        ? `/api/v1/item-reports/${reportId}/image`
                        : null,
                    },
                  }
                : current,
            );
            setRefreshing(true);
            setRevision((value) => value + 1);
          }}
        />
      </div>
      <footer className={styles.footer}>
        <p>ของสำคัญ มีเจ้าของ</p>
        <button
          type="button"
          className={styles.back}
          onClick={close}
          disabled={managing}
        >
          กลับไปดูรายการ <ShellIcon name="arrow" width={14} height={14} />
        </button>
      </footer>
    </Dialog>
  );
}
