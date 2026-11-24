'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import { ShellIcon } from '@/components/shell/shell-icon';
import { useShellMotion } from '@/components/shell/shell-motion';
import {
  bangkokEventFields,
  formatEventTime,
} from '@/components/item-reports/report-format';
import {
  loadReportDetail,
  loadReportImages,
  ReportRequestError,
  reportImageHref,
  type ReportRow,
} from '@/modules/item-reports/presentation/reports-client';
import { reportDate, ReportStatus } from './report-table';
import { ReportImageUpload } from './report-image-upload';
import { ReportManagement } from './report-management';
import { ReportClaims } from './report-claims';
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
  const editFormId = useId();
  const closeFormId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const editBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<'edit' | 'close' | 'title' | null>(null);
  const motion = useShellMotion();
  const [open, setOpen] = useState(true);
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [claimPending, setClaimPending] = useState(false);
  const [mode, setMode] = useState<'edit' | 'close' | null>(null);
  const [editCatalogReady, setEditCatalogReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [gallery, setGallery] = useState<{
    reportId: number;
    revision: number;
    hrefs: string[];
  } | null>(null);
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; missing: boolean }
    | { kind: 'ready'; row: ReportRow }
  >({ kind: 'loading' });
  useEffect(() => {
    if (mode !== null || !returnFocus.current) return;
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target === 'edit') editBtn.current?.focus({ preventScroll: true });
    else if (target === 'close')
      closeBtn.current?.focus({ preventScroll: true });
    else title.current?.focus({ preventScroll: true });
  }, [mode]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void loadReportDetail(reportId, controller.signal)
      .then((row) => {
        if (active) setState({ kind: 'ready', row });
      })
      .catch((error: unknown) => {
        if (
          active &&
          error instanceof ReportRequestError &&
          error.status === 401
        ) {
          window.location.replace('/login');
          return;
        }
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
  useEffect(() => {
    if (!managedImage) return;
    const controller = new AbortController();
    let active = true;
    void loadReportImages(reportId, controller.signal)
      .then((hrefs) => {
        if (active && hrefs.length) setGallery({ reportId, revision, hrefs });
      })
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
    };
  }, [reportId, managedImage, revision]);
  const photoHrefs = !managedImage
    ? []
    : gallery && gallery.reportId === reportId && gallery.revision === revision
      ? gallery.hrefs
      : imageHref
        ? [imageHref]
        : [];
  const canManage = Boolean(row && onManaged);
  const saving = managing || claimPending;
  const close = () => {
    if (!saving) setOpen(false);
  };
  const openManagement = (next: 'edit' | 'close') => {
    setNotice('');
    setEditCatalogReady(false);
    setMode(next);
  };
  const cancelManagement = () => {
    if (managing) return;
    returnFocus.current = mode ?? 'title';
    setMode(null);
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
                <span className={styles.typePill} data-type={row.type}>
                  {row.type === 'LOST' ? 'ของหาย' : 'ของที่พบ'}
                </span>
                <ReportStatus status={row.status} />
              </>
            ) : state.kind === 'loading' ? (
              <Skeleton
                width={140}
                height={24}
                variant="rounded"
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
          disabled={saving}
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
        aria-busy={state.kind === 'loading' || refreshing || saving}
      >
        {notice && mode === null && (
          <div className={styles.noticeBanner} role="status">
            <ShellIcon name="check" width={16} height={16} />
            <span>{notice}</span>
          </div>
        )}
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
                className={styles.primaryBtn}
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
          <div className={styles.viewStack} hidden={mode !== null}>
            {managedImage && photoHrefs.length > 0 && (
              <ReportPhoto
                key={`${reportId}:${revision}`}
                hrefs={photoHrefs}
                title={state.row.title}
                motion={motion}
              />
            )}
            <section className={styles.overviewCard} aria-label="ข้อมูลสิ่งของ">
              <p
                className={styles.description}
                data-empty={!state.row.description}
              >
                {state.row.description || 'ไม่ได้ระบุรายละเอียดเพิ่มเติม'}
              </p>
              <dl className={styles.details}>
                <div className={styles.location}>
                  <span className={styles.locationBadge} aria-hidden="true">
                    <ShellIcon name="pin" width={18} height={18} />
                  </span>
                  <div className={styles.locationCopy}>
                    <dt>
                      {state.row.type === 'LOST' ? 'สถานที่หาย' : 'สถานที่พบ'}
                    </dt>
                    <dd>{state.row.locationName}</dd>
                  </div>
                </div>
                <div className={`${styles.metaTile} ${styles.category}`}>
                  <dt>หมวดหมู่</dt>
                  <dd>{state.row.categoryName}</dd>
                </div>
                <div className={styles.metaTile}>
                  <dt>
                    {state.row.type === 'LOST' ? 'วันที่หาย' : 'วันที่พบ'}
                  </dt>
                  <dd>
                    <time dateTime={state.row.eventDatetime}>
                      {reportDate.format(new Date(state.row.eventDatetime))}
                      {' · '}
                      {formatEventTime(
                        bangkokEventFields(state.row.eventDatetime).time,
                      )}
                    </time>
                  </dd>
                </div>
                <div className={styles.metaTile}>
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
            </section>
          </div>
        )}
        {row && canManage && mode !== null && (
          <ReportManagement
            key={mode}
            row={row}
            mode={mode}
            formId={mode === 'edit' ? editFormId : closeFormId}
            onPendingChange={setManaging}
            onEditReadyChange={setEditCatalogReady}
            onUpdated={(next, message) => {
              const previousMode = mode;
              setState((current) =>
                current.kind === 'ready'
                  ? { kind: 'ready', row: { ...current.row, ...next } }
                  : current,
              );
              setRefreshing(true);
              setRevision((value) => value + 1);
              setNotice(message);
              returnFocus.current = previousMode === 'edit' ? 'edit' : 'title';
              setMode(null);
              onManaged?.();
            }}
          />
        )}
        <div hidden={mode !== null}>
          <ReportImageUpload
            reportId={reportId}
            shown={state.kind === 'ready'}
            refreshing={refreshing}
            onUpdated={({ hasImage, hrefs }) => {
              // The mutation has committed: update gallery immediately before revalidating the row.
              const nextRevision = revision + 1;
              setNotice('');
              setGallery({ reportId, revision: nextRevision, hrefs });
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
              setRevision(nextRevision);
            }}
          />
          {row &&
            (row.isOwner === true ||
              (row.isOwner === false && row.type === 'FOUND')) && (
              <ReportClaims row={row} onPendingChange={setClaimPending} />
            )}
        </div>
      </div>
      <footer className={styles.footer}>
        {mode === 'edit' ? (
          <>
            <p className={styles.footerMeta}>แก้ไขข้อมูลรายการ</p>
            <div className={styles.footerActions}>
              <button
                type="button"
                className={styles.outlineBtn}
                onClick={cancelManagement}
                disabled={managing}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form={editFormId}
                className={styles.primaryBtn}
                disabled={managing || !editCatalogReady}
              >
                {managing ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </>
        ) : mode === 'close' ? (
          <>
            <p className={styles.footerMeta}>
              ปิดประกาศแล้วจะไม่แสดงในการค้นหา
            </p>
            <div className={styles.footerActions}>
              <button
                type="button"
                className={styles.outlineBtn}
                onClick={cancelManagement}
                disabled={managing}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form={closeFormId}
                className={styles.dangerBtn}
                disabled={managing}
              >
                {managing ? 'กำลังปิด…' : 'ยืนยันปิดประกาศ'}
              </button>
            </div>
          </>
        ) : canManage && row ? (
          <>
            <button
              type="button"
              className={styles.backBtn}
              onClick={close}
              disabled={saving}
            >
              <ShellIcon
                name="arrow"
                width={14}
                height={14}
                className={styles.backIcon}
              />
              กลับไปดูรายการ
            </button>
            <div className={styles.footerActions}>
              {row.status === 'OPEN' && (
                <button
                  type="button"
                  ref={closeBtn}
                  className={styles.quietDangerBtn}
                  onClick={() => openManagement('close')}
                  disabled={saving}
                >
                  ปิดประกาศ
                </button>
              )}
              <button
                type="button"
                ref={editBtn}
                className={styles.primaryBtn}
                onClick={() => openManagement('edit')}
                disabled={saving}
              >
                <ShellIcon name="edit" width={16} height={16} />
                แก้ไขรายการ
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.footerMeta}>ของสำคัญ มีเจ้าของ</p>
            <button
              type="button"
              className={styles.backBtn}
              onClick={close}
              disabled={saving}
            >
              <ShellIcon
                name="arrow"
                width={14}
                height={14}
                className={styles.backIcon}
              />
              กลับไปดูรายการ
            </button>
          </>
        )}
      </footer>
    </Dialog>
  );
}
