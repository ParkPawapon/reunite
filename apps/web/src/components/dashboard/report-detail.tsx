'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import { useActionConfirmation } from '@/components/confirmation/use-action-confirmation';
import { ShellIcon } from '@/components/shell/shell-icon';
import { useShellMotion } from '@/components/shell/shell-motion';
import {
  bangkokEventFields,
  formatEventTime,
} from '@/components/item-reports/report-format';
import {
  closeReport,
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
import { ReportContact } from '@/components/item-reports/report-contact';
import { ReportMatchingStatus } from '@/components/item-reports/report-matching-status';
import { ReportDetailSkeleton } from './report-detail-skeleton';
import { ReportPhoto } from './report-photo';
import styles from './report-detail.module.css';

export function ReportDetail({
  reportId,
  onClose,
  onManaged,
  showClaims = false,
  showMatching = false,
}: {
  reportId: number;
  onClose: () => void;
  onManaged?: () => void;
  showClaims?: boolean;
  showMatching?: boolean;
}) {
  const titleId = useId();
  const editFormId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const editBtn = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<'edit' | 'title' | null>(null);
  const closeRequest = useRef<AbortController | null>(null);
  const ask = useActionConfirmation();
  const motion = useShellMotion();
  const [open, setOpen] = useState(true);
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [claimPending, setClaimPending] = useState(false);
  const [photoProgress, setPhotoProgress] = useState('');
  const [editing, setEditing] = useState(false);
  const [editCatalogReady, setEditCatalogReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [closeError, setCloseError] = useState('');
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
  const row = state.kind === 'ready' ? state.row : null;
  useEffect(() => {
    if (editing || !returnFocus.current) return;
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target === 'edit') editBtn.current?.focus({ preventScroll: true });
    else title.current?.focus({ preventScroll: true });
  }, [editing, row?.status]);
  useEffect(() => () => closeRequest.current?.abort(), [reportId]);
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
  const saving = managing || claimPending || Boolean(photoProgress);
  const close = () => {
    if (!saving) setOpen(false);
  };
  const openManagement = () => {
    setNotice('');
    setCloseError('');
    setEditCatalogReady(false);
    setEditing(true);
  };
  const cancelManagement = () => {
    if (managing) return;
    returnFocus.current = 'edit';
    setEditing(false);
  };
  function reportUpdated(next: ReportRow, message: string) {
    setState((current) =>
      current.kind === 'ready'
        ? { kind: 'ready', row: { ...current.row, ...next } }
        : current,
    );
    setRefreshing(true);
    setRevision((value) => value + 1);
    setNotice(message);
    onManaged?.();
  }
  async function confirmCloseReport() {
    if (!row || row.status !== 'OPEN' || saving || closeRequest.current) return;
    if (
      !(await ask({
        title: 'ปิดประกาศไหม?',
        description: 'รายการจะย้ายไปสถานะปิดแล้ว',
        detail: row.title,
        confirmLabel: 'ปิดประกาศ',
        icon: 'box',
        tone: 'danger',
      }))
    )
      return;
    const controller = new AbortController();
    closeRequest.current = controller;
    setManaging(true);
    setCloseError('');
    setNotice('');
    try {
      const next = await closeReport(row.reportId, controller.signal);
      if (controller.signal.aborted) return;
      returnFocus.current = 'title';
      reportUpdated({ ...row, ...next }, 'ปิดประกาศแล้ว');
    } catch (error) {
      if (controller.signal.aborted) return;
      setCloseError(
        error instanceof ReportRequestError && error.status === 401
          ? 'หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง'
          : 'ปิดประกาศไม่สำเร็จ กรุณาลองอีกครั้ง',
      );
    } finally {
      closeRequest.current = null;
      if (!controller.signal.aborted) setManaging(false);
    }
  }
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
        {closeError && (
          <p className={styles.formError} role="alert">
            {closeError}
          </p>
        )}
        {notice && !editing && (
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
          <div className={styles.viewStack} hidden={editing}>
            <div
              className={styles.overviewGrid}
              data-has-media={managedImage && photoHrefs.length > 0}
            >
              {managedImage && photoHrefs.length > 0 && (
                <div className={styles.overviewMedia}>
                  <ReportPhoto
                    key={`${reportId}:${revision}`}
                    hrefs={photoHrefs}
                    title={state.row.title}
                    motion={motion}
                  />
                </div>
              )}
              <section
                className={styles.overviewDetails}
                aria-label="ข้อมูลสิ่งของ"
              >
                <div className={styles.detailsHeading}>
                  <span
                    className={styles.detailsHeadingIcon}
                    aria-hidden="true"
                  >
                    <ShellIcon name="list" width={16} height={16} />
                  </span>
                  <h3>รายละเอียด</h3>
                </div>
                <p
                  className={styles.description}
                  data-empty={!state.row.description}
                >
                  {state.row.description || 'ไม่ได้ระบุรายละเอียดเพิ่มเติม'}
                </p>
                <dl className={styles.metaList}>
                  <div className={styles.metaRow}>
                    <dt>
                      <span className={styles.metaIcon} aria-hidden="true">
                        <ShellIcon name="pin" width={16} height={16} />
                      </span>
                      {state.row.type === 'LOST' ? 'สถานที่หาย' : 'สถานที่พบ'}
                    </dt>
                    <dd>{state.row.locationName}</dd>
                  </div>
                  <div className={styles.metaRow}>
                    <dt>
                      <span className={styles.metaIcon} aria-hidden="true">
                        <ShellIcon name="tag" width={16} height={16} />
                      </span>
                      หมวดหมู่
                    </dt>
                    <dd>{state.row.categoryName}</dd>
                  </div>
                  <div className={styles.metaRow}>
                    <dt>
                      <span className={styles.metaIcon} aria-hidden="true">
                        <ShellIcon name="clock" width={16} height={16} />
                      </span>
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
                  <div className={styles.metaRow}>
                    <dt>
                      <span className={styles.metaIcon} aria-hidden="true">
                        <ShellIcon name="calendar" width={16} height={16} />
                      </span>
                      วันที่แจ้ง
                    </dt>
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
          </div>
        )}
        {row && canManage && editing && (
          <ReportManagement
            row={row}
            formId={editFormId}
            onPendingChange={setManaging}
            onEditReadyChange={setEditCatalogReady}
            onUpdated={(next, message) => {
              returnFocus.current = 'edit';
              setEditing(false);
              reportUpdated(next, message);
            }}
          />
        )}
        <div className={styles.sectionStack} hidden={editing}>
          {showMatching && row?.isOwner && !editing && (
            <ReportMatchingStatus reportId={row.reportId} />
          )}
          <ReportImageUpload
            reportId={reportId}
            shown={state.kind === 'ready'}
            refreshing={refreshing}
            onProgress={setPhotoProgress}
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
            row.status === 'OPEN' &&
            (row.isOwner || row.type === 'FOUND') && (
              <ReportContact
                key={`${row.reportId}:${revision}`}
                reportId={row.reportId}
                owner={row.isOwner}
              />
            )}
          {row &&
            (row.isOwner === true ||
              (row.isOwner === false && row.type === 'FOUND')) && (
              <ReportClaims
                row={row}
                onPendingChange={setClaimPending}
                initiallyExpanded={showClaims}
              />
            )}
        </div>
      </div>
      <footer className={styles.footer}>
        {photoProgress && (
          <p className={styles.photoProgress} role="status">
            {photoProgress}
          </p>
        )}
        {editing ? (
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
        ) : canManage && row ? (
          <>
            <div className={styles.footerLeft}>
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
              {row.status === 'OPEN' && (
                <>
                  <span className={styles.footerSep} aria-hidden="true" />
                  <button
                    type="button"
                    className={styles.quietDangerBtn}
                    onClick={() => void confirmCloseReport()}
                    disabled={saving}
                  >
                    {managing ? 'กำลังปิด…' : 'ปิดประกาศ'}
                  </button>
                </>
              )}
            </div>
            <div className={styles.footerActions}>
              <button
                type="button"
                ref={editBtn}
                className={styles.primaryBtn}
                onClick={openManagement}
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
