'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  ClaimRequestError,
  loadReportClaims,
  reviewClaim,
  submitClaim,
  type ClaimRecord,
} from '@/modules/claims/presentation/claims-client';
import type { ReportRow } from '@/modules/item-reports/presentation/reports-client';
import { reportDate } from './report-table';
import styles from './report-detail.module.css';

const statusLabel = {
  PENDING: 'รอตรวจสอบ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ไม่อนุมัติ',
} as const;

export function ReportClaims({
  row,
  onPendingChange,
}: {
  row: ReportRow;
  onPendingChange: (pending: boolean) => void;
}) {
  const headingId = useId();
  const owner = row.isOwner === true;
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data: Awaited<ReturnType<typeof loadReportClaims>> | null;
  }>();
  const [evidence, setEvidence] = useState('');
  const [review, setReview] = useState<{ id: number; note: string } | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null);
  const key = `${page}:${revision}`;
  const current = result?.key === key ? result : null;
  const claims = current?.data?.claims ?? [];
  const claimable = row.status === 'OPEN';

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!expanded) return;
    const controller = new AbortController();
    void loadReportClaims(row.reportId, owner, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, data: null });
      });
    return () => controller.abort();
  }, [row.reportId, owner, page, key, expanded]);

  async function save(
    operation: (signal: AbortSignal) => Promise<ClaimRecord>,
    message: string,
  ) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    onPendingChange(true);
    setError('');
    setNotice('');
    try {
      await operation(controller.signal);
      if (controller.signal.aborted) return;
      setReview(null);
      setEvidence('');
      setNotice(message);
      if (!owner) setPage(0);
      setRevision((value) => value + 1);
    } catch (cause) {
      if (controller.signal.aborted) return;
      const status = cause instanceof ClaimRequestError ? cause.status : 0;
      if (status === 404 || status === 409) setRevision((value) => value + 1);
      setError(
        status === 401
          ? 'หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง'
          : status === 404 || status === 409
            ? 'คำร้องหรือสถานะประกาศเปลี่ยนแล้ว กรุณาตรวจรายการล่าสุด'
            : 'บันทึกคำร้องไม่สำเร็จ กรุณาลองอีกครั้ง',
      );
    } finally {
      request.current = null;
      if (!controller.signal.aborted) {
        setPending(false);
        onPendingChange(false);
      }
    }
  }

  return (
    <section
      className={`${styles.management} ${styles.manageForm}`}
      aria-label={owner ? 'คำร้องขอรับของ' : 'ขอรับของ'}
    >
      <div className={styles.manageActions}>
        <button
          className={styles.secondary}
          type="button"
          aria-expanded={expanded}
          aria-controls={headingId}
          disabled={pending}
          onClick={() => {
            if (!expanded) setRevision((value) => value + 1);
            setExpanded(!expanded);
          }}
        >
          {owner ? 'คำร้องขอรับของ' : 'ขอรับของและดูคำร้อง'}
        </button>
      </div>
      <div
        id={headingId}
        hidden={!expanded}
        className={expanded ? styles.manageForm : undefined}
      >
        {notice && (
          <p className={styles.saved} role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
        {expanded &&
          (!current ? (
            <p role="status">กำลังโหลดคำร้อง…</p>
          ) : !current.data ? (
            <div>
              <p role="alert">โหลดคำร้องไม่สำเร็จ</p>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setRevision((value) => value + 1)}
              >
                ลองโหลดคำร้องอีกครั้ง
              </button>
            </div>
          ) : (
            <>
              {claims.length ? (
                <ul className={styles.claimList}>
                  {claims.map((claim) => (
                    <li className={styles.claimCard} key={claim.claimId}>
                      <div className={styles.claimMeta}>
                        <span>
                          คำร้อง #{claim.claimId} ·{' '}
                          <time dateTime={claim.claimDate}>
                            {reportDate.format(new Date(claim.claimDate))}
                          </time>
                        </span>
                        <strong
                          className={styles.claimStatus}
                          data-status={claim.status}
                        >
                          {statusLabel[claim.status]}
                        </strong>
                      </div>
                      <p>{claim.evidence}</p>
                      {claim.resolutionNote && (
                        <p>ข้อความจากผู้แจ้งประกาศ · {claim.resolutionNote}</p>
                      )}
                      {owner &&
                        claim.status === 'PENDING' &&
                        (review?.id === claim.claimId ? (
                          <fieldset
                            className={styles.manageFields}
                            disabled={pending}
                          >
                            <label>
                              ข้อความถึงผู้ยื่น (ไม่บังคับ)
                              <textarea
                                rows={2}
                                maxLength={1000}
                                value={review.note}
                                onChange={(event) =>
                                  setReview({
                                    ...review,
                                    note: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <div className={styles.manageActions}>
                              <button
                                className={styles.primary}
                                type="button"
                                onClick={() =>
                                  void save(
                                    (signal) =>
                                      reviewClaim(
                                        claim.claimId,
                                        'APPROVED',
                                        review.note.trim(),
                                        signal,
                                      ),
                                    'อนุมัติคำร้องแล้ว',
                                  )
                                }
                              >
                                อนุมัติคำร้อง
                              </button>
                              <button
                                className={styles.secondary}
                                type="button"
                                onClick={() =>
                                  void save(
                                    (signal) =>
                                      reviewClaim(
                                        claim.claimId,
                                        'REJECTED',
                                        review.note.trim(),
                                        signal,
                                      ),
                                    'บันทึกผลไม่อนุมัติแล้ว',
                                  )
                                }
                              >
                                ไม่อนุมัติคำร้อง
                              </button>
                              <button
                                className={styles.secondary}
                                type="button"
                                onClick={() => setReview(null)}
                              >
                                ยกเลิกการพิจารณา
                              </button>
                            </div>
                          </fieldset>
                        ) : (
                          <div className={styles.manageActions}>
                            <button
                              type="button"
                              className={styles.secondary}
                              disabled={pending}
                              onClick={() =>
                                setReview({ id: claim.claimId, note: '' })
                              }
                            >
                              พิจารณาคำร้อง
                            </button>
                          </div>
                        ))}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {owner
                    ? 'ยังไม่มีคำร้องสำหรับประกาศนี้'
                    : 'คุณยังไม่มีคำร้องสำหรับประกาศนี้'}
                </p>
              )}
              {(page > 0 || current.data.hasNext) && (
                <div className={styles.manageActions}>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={pending || page === 0}
                    onClick={() => {
                      setReview(null);
                      setPage(page - 1);
                    }}
                  >
                    คำร้องหน้าก่อน
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={pending || !current.data.hasNext}
                    onClick={() => {
                      setReview(null);
                      setPage(page + 1);
                    }}
                  >
                    คำร้องหน้าถัดไป
                  </button>
                </div>
              )}
              {!owner && page === 0 && claimable && (
                <form
                  className={styles.manageForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!evidence.trim()) {
                      setError('กรุณาระบุหลักฐาน');
                      return;
                    }
                    void save(
                      (signal) =>
                        submitClaim(row.reportId, evidence.trim(), signal),
                      'ส่งคำร้องแล้ว',
                    );
                  }}
                >
                  <fieldset className={styles.manageFields} disabled={pending}>
                    <label>
                      หลักฐานว่าเป็นของคุณ
                      <textarea
                        rows={3}
                        required
                        maxLength={10000}
                        placeholder="เช่น รอยตำหนิหรือลักษณะที่เจ้าของจำได้"
                        value={evidence}
                        onChange={(event) => setEvidence(event.target.value)}
                      />
                    </label>
                    <p>ผู้แจ้งประกาศจะเห็นหลักฐานนี้เพื่อพิจารณาคำร้อง</p>
                    <div className={styles.manageActions}>
                      <button className={styles.primary} type="submit">
                        {pending ? 'กำลังส่ง…' : 'ส่งคำร้องขอรับของ'}
                      </button>
                    </div>
                  </fieldset>
                </form>
              )}
            </>
          ))}
      </div>
    </section>
  );
}
