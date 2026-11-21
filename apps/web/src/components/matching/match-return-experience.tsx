'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import { ShellIcon } from '@/components/shell/shell-icon';
import { useShellMotion } from '@/components/shell/shell-motion';
import {
  accountRequest,
  AccountRequestError,
} from '@/modules/users/presentation/profile-client';
import { matchReturnSchema } from '@/modules/matching/presentation/match-return-client';
import type {
  MatchItem,
  MatchReturn,
} from '@/modules/matching/domain/match-return';
import { MatchReveal } from './match-reveal';
import styles from './match-return.module.css';

const date = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
});
const formatDate = (iso: string) => date.format(new Date(iso));

function ItemCard({
  item,
  label,
  own,
}: {
  item: MatchItem;
  label: string;
  own: boolean;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <article className={styles.item}>
      <div className={styles.itemMeta}>
        <span>{label}</span>
        {own && <span>ของคุณ</span>}
      </div>
      <div className={styles.photo} data-match-photo>
        {item.hasPhoto && !photoFailed ? (
          <Image
            src={`/api/v1/item-reports/${item.reportId}/image`}
            alt={`รูป${item.title}`}
            width={640}
            height={400}
            unoptimized
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <span className={styles.photoEmpty}>
            <ShellIcon name={photoFailed ? 'camera' : 'box'} />
            {photoFailed ? 'เปิดรูปไม่สำเร็จ' : 'ไม่มีรูปแนบ'}
          </span>
        )}
      </div>
      <div className={styles.itemContent}>
        <h3>{item.title}</h3>
        <p className={styles.place}>
          <ShellIcon name="pin" /> {item.location}
        </p>
        <time dateTime={item.occurredAt}>{formatDate(item.occurredAt)}</time>
        {item.description && (
          <p className={styles.description}>{item.description}</p>
        )}
      </div>
    </article>
  );
}

export function MatchReturnExperience({
  matchId,
  onDismiss,
}: {
  matchId: number;
  onDismiss?: () => void;
}) {
  const motion = useShellMotion();
  const router = useRouter();
  const titleId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(true);
  const [pair, setPair] = useState<MatchReturn | null>(null);
  const [unavailable, setUnavailable] = useState<'missing' | 'session' | null>(
    null,
  );
  const [notice, setNotice] = useState('');
  const [reviewedRevision, setReviewedRevision] = useState<string | null>(null);
  const [confirmingRevision, setConfirmingRevision] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const read = useRef<AbortController | null>(null);
  const write = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const url = `/api/v1/matches/${matchId}`;

  const refresh = useCallback(async () => {
    if (read.current || write.current) return;
    const request = new AbortController();
    read.current = request;
    try {
      const result = await accountRequest(url, matchReturnSchema, {
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      });
      if (!request.signal.aborted) {
        setPair(result);
        setUnavailable(null);
        setNotice('');
      }
    } catch (error) {
      if (request.signal.aborted) return;
      if (
        error instanceof AccountRequestError &&
        (error.status === 404 || error.status === 401)
      ) {
        setPair(null);
        setUnavailable(error.status === 404 ? 'missing' : 'session');
      } else {
        setNotice('ตรวจสอบสถานะล่าสุดไม่ได้ กรุณาลองอีกครั้ง');
      }
    } finally {
      if (read.current === request) read.current = null;
    }
  }, [url]);

  const returned = Boolean(pair?.returnedAt);
  useEffect(() => {
    if (!open || returned) return;
    const first = window.requestAnimationFrame(() => void refresh());
    const whenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const poll = window.setInterval(whenVisible, 10000);
    window.addEventListener('focus', whenVisible);
    document.addEventListener('visibilitychange', whenVisible);
    return () => {
      window.cancelAnimationFrame(first);
      window.clearInterval(poll);
      window.removeEventListener('focus', whenVisible);
      document.removeEventListener('visibilitychange', whenVisible);
      read.current?.abort();
      read.current = null;
    };
  }, [open, refresh, returned]);

  useEffect(
    () => () => {
      write.current?.abort();
      write.current = null;
    },
    [],
  );

  const ownConfirmed =
    pair?.role === 'LOST' ? pair.lostConfirmedAt : pair?.foundConfirmedAt;
  const currentRevision = pair
    ? `${pair.lostRevision}:${pair.foundRevision}`
    : null;
  const showingProgress = Boolean(
    ownConfirmed || (currentRevision && reviewedRevision === currentRevision),
  );
  const confirming = Boolean(
    currentRevision &&
    confirmingRevision === currentRevision &&
    reviewedRevision === currentRevision &&
    !ownConfirmed,
  );
  const stage = !pair
    ? unavailable || notice
      ? 'unavailable'
      : 'loading'
    : returned
      ? 'complete'
      : confirming
        ? 'confirm'
        : showingProgress
          ? 'progress'
          : 'review';
  useEffect(() => {
    if (!open) return;
    if (body.current) body.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [open, stage]);

  async function confirm() {
    if (!pair || !confirming || write.current) return;
    read.current?.abort();
    read.current = null;
    const request = new AbortController();
    write.current = request;
    setSaving(true);
    setNotice('');
    let shouldRefresh = false;
    try {
      const result = await accountRequest(url, matchReturnSchema, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lostRevision: pair.lostRevision,
          foundRevision: pair.foundRevision,
        }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      });
      if (!request.signal.aborted) {
        setPair(result);
        setConfirmingRevision(null);
      }
    } catch (error) {
      if (request.signal.aborted) return;
      if (
        error instanceof AccountRequestError &&
        (error.status === 409 || error.status === 404 || error.status === 401)
      ) {
        setReviewedRevision(null);
        shouldRefresh = true;
      } else {
        setNotice('บันทึกไม่สำเร็จ ลองยืนยันอีกครั้งได้');
      }
      setConfirmingRevision(null);
    } finally {
      if (write.current === request) {
        write.current = null;
        setSaving(false);
        if (shouldRefresh) void refresh();
      }
    }
  }

  const close = () => {
    if (!write.current) setOpen(false);
  };
  const action = pair?.role === 'FOUND' ? 'คืนของแล้ว' : 'ได้รับของแล้ว';
  const title = {
    loading: 'กำลังเปิดประกาศ',
    unavailable:
      unavailable === 'missing' ? 'รายการนี้เปิดดูไม่ได้แล้ว' : 'จับคู่สิ่งของ',
    review: 'ของสองชิ้นนี้อาจตรงกัน',
    progress: 'ยืนยันการคืนของ',
    confirm: 'ยืนยันว่า' + action + '?',
    complete: 'ของกลับถึงมือเจ้าของแล้ว',
  }[stage];
  const description = {
    loading: 'กำลังโหลดรายละเอียดของทั้งสองประกาศ',
    unavailable:
      unavailable === 'session'
        ? 'เซสชันหมดอายุ'
        : unavailable === 'missing'
          ? 'คู่นี้อาจหมดอายุหรือถูกแก้ไข'
          : 'โหลดรายละเอียดไม่สำเร็จ',
    review: 'เทียบรูป สถานที่ และลักษณะ ก่อนนัดรับของ',
    progress: 'กดยืนยันเมื่อส่งมอบของกันแล้ว',
    confirm: 'เมื่อทั้งสองฝ่ายยืนยัน ระบบจะปิดประกาศทั้งสองรายการ',
    complete: 'ทั้งสองฝ่ายยืนยันแล้ว และระบบปิดประกาศให้เรียบร้อย',
  }[stage];
  const reveal = stage === 'review' || stage === 'complete';

  return (
    <Dialog
      className={styles.root}
      data-motion={motion ? 'on' : 'off'}
      data-stage={stage}
      open={open}
      onClose={close}
      disableRestoreFocus={Boolean(onDismiss)}
      maxWidth={false}
      fullWidth
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      transitionDuration={motion ? { enter: 230, exit: 150 } : 0}
      slotProps={{
        paper: { className: styles.paper, id: 'match-return-dialog' },
        backdrop: { className: styles.backdrop },
        transition: {
          onEntered: () => heading.current?.focus({ preventScroll: true }),
          onExited:
            onDismiss ?? (() => router.replace('/matches', { scroll: false })),
        },
      }}
    >
      <header className={styles.hero} data-reveal={reveal}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>
            {stage === 'complete'
              ? 'คืนของสำเร็จ'
              : stage === 'review'
                ? 'พบเบาะแส'
                : 'จับคู่สิ่งของ'}
          </p>
          <h2 id={titleId} ref={heading} tabIndex={-1}>
            {title}
          </h2>
          <p id={descriptionId}>{description}</p>
        </div>
        {reveal && <MatchReveal returned={returned} motion={motion} />}
        <button
          type="button"
          className={styles.close}
          onClick={close}
          disabled={saving}
          aria-label="ปิดหน้าต่างจับคู่สิ่งของ"
        >
          <ShellIcon name="close" />
        </button>
      </header>
      {pair && !returned && (
        <ol className={styles.steps} aria-label="ขั้นตอนการคืนของ">
          <li aria-current={stage === 'review' ? 'step' : undefined}>
            <span aria-hidden="true">
              {stage === 'review' ? '1' : <ShellIcon name="check" />}
            </span>
            เทียบประกาศ
          </li>
          <li aria-current={stage !== 'review' ? 'step' : undefined}>
            <span aria-hidden="true">2</span>
            ยืนยันการคืนของ
          </li>
        </ol>
      )}
      <div
        className={styles.body}
        ref={body}
        role="region"
        aria-label="รายละเอียดการจับคู่"
        aria-busy={stage === 'loading' || saving}
        tabIndex={0}
      >
        <div className={styles.stage} key={stage}>
          {stage === 'loading' && (
            <div
              className={styles.cards}
              role="status"
              aria-label="กำลังโหลดประกาศทั้งสอง"
            >
              <Skeleton
                variant="rounded"
                height={220}
                animation={motion ? 'wave' : false}
              />
              <Skeleton
                variant="rounded"
                height={220}
                animation={motion ? 'wave' : false}
              />
            </div>
          )}
          {pair && stage === 'review' && (
            <div className={styles.cards}>
              <ItemCard
                key={'lost:' + pair.lostRevision}
                item={pair.lost}
                label="ของหาย"
                own={pair.role === 'LOST'}
              />
              <ItemCard
                key={'found:' + pair.foundRevision}
                item={pair.found}
                label="ของที่พบ"
                own={pair.role === 'FOUND'}
              />
              <span className={styles.join} aria-hidden="true" data-match-join>
                <ShellIcon name="target" />
              </span>
            </div>
          )}
          {pair && stage !== 'review' && (
            <>
              {pair.returnedAt && (
                <div className={styles.receipt}>
                  <span>
                    <ShellIcon name="check" />
                  </span>
                  <time dateTime={pair.returnedAt}>
                    {formatDate(pair.returnedAt)}
                  </time>
                </div>
              )}
              <ul className={styles.confirmations} aria-live="polite">
                {(
                  [
                    [
                      'เจ้าของสิ่งของ',
                      'ได้รับของแล้ว',
                      pair.lostConfirmedAt,
                      pair.role === 'LOST',
                    ],
                    [
                      'ผู้พบสิ่งของ',
                      'คืนของแล้ว',
                      pair.foundConfirmedAt,
                      pair.role === 'FOUND',
                    ],
                  ] as const
                ).map(([label, confirmed, at, own]) => (
                  <li key={label} data-confirmed={Boolean(at)}>
                    <span className={styles.confirmationIcon}>
                      <ShellIcon name={at ? 'check' : own ? 'user' : 'box'} />
                    </span>
                    <div>
                      <strong>
                        {label}
                        {own && <small>คุณ</small>}
                      </strong>
                      <p>{at ? confirmed : 'รอยืนยัน'}</p>
                    </div>
                    {at && <time dateTime={at}>{formatDate(at)}</time>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {ownConfirmed && !returned && (
            <p className={styles.waiting} role="status">
              คุณยืนยันแล้ว กำลังรออีกฝ่าย
            </p>
          )}
          {notice && (
            <p className={styles.notice} role="alert">
              {notice}
            </p>
          )}
        </div>
      </div>
      <footer className={styles.actions}>
        {stage === 'review' && (
          <>
            <Button onClick={close}>ไว้ดูทีหลัง</Button>
            <Button
              variant="contained"
              onClick={() => setReviewedRevision(currentRevision)}
              endIcon={<ShellIcon name="arrow" />}
            >
              ไปที่การคืนของ
            </Button>
          </>
        )}
        {stage === 'progress' && (
          <>
            {!ownConfirmed ? (
              <>
                <Button onClick={() => setReviewedRevision(null)}>
                  ดูสองประกาศ
                </Button>
                <Button
                  variant="contained"
                  onClick={() => setConfirmingRevision(currentRevision)}
                >
                  {action}
                </Button>
              </>
            ) : (
              <Button variant="contained" onClick={close}>
                ปิดหน้าต่าง
              </Button>
            )}
          </>
        )}
        {stage === 'confirm' && (
          <>
            <Button
              disabled={saving}
              onClick={() => setConfirmingRevision(null)}
            >
              ย้อนกลับ
            </Button>
            <Button
              variant="contained"
              disabled={saving}
              onClick={() => void confirm()}
            >
              {saving ? 'กำลังบันทึก…' : 'ยืนยัน'}
            </Button>
          </>
        )}
        {stage === 'complete' && (
          <Button variant="contained" onClick={close}>
            เรียบร้อย
          </Button>
        )}
        {stage === 'unavailable' && (
          <>
            <Button onClick={close}>ปิดหน้าต่าง</Button>
            {unavailable === 'session' && (
              <Link href="/login">เข้าสู่ระบบอีกครั้ง</Link>
            )}
            {!unavailable && (
              <Button variant="contained" onClick={() => void refresh()}>
                ลองอีกครั้ง
              </Button>
            )}
          </>
        )}
      </footer>
    </Dialog>
  );
}
