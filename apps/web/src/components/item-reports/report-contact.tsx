'use client';

import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { useActionConfirmation } from '@/components/confirmation/use-action-confirmation';
import { accountRequest } from '@/modules/users/presentation/profile-client';
import styles from './report-contact.module.css';

const preferencesSchema = z.object({
  shareEmail: z.boolean(),
  sharePhone: z.boolean(),
});
const contactSchema = z.object({
  preferences: preferencesSchema.nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});
type Preferences = z.infer<typeof preferencesSchema>;

export function ReportContact({
  reportId,
  matchId,
  owner = false,
}: {
  reportId: number;
  matchId?: number;
  owner?: boolean;
}) {
  const href = `/api/v1/item-reports/${reportId}/contact`;
  const ask = useActionConfirmation();
  const write = useRef<AbortController | null>(null);
  const url = matchId ? `${href}?matchId=${matchId}` : href;
  const [attempt, setAttempt] = useState(0);
  const [contact, setContact] = useState<z.infer<typeof contactSchema> | null>(
    null,
  );
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let controller: AbortController | undefined;
    const refresh = () => {
      if (!owner && document.visibilityState !== 'visible') return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      void accountRequest(url, contactSchema, {
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      })
        .then((value) => {
          if (!request.signal.aborted) {
            setContact(value);
            if (owner) setDraft(value.preferences);
            setError('');
          }
        })
        .catch(() => {
          if (!request.signal.aborted) {
            setContact(null);
            setError('โหลดช่องทางติดต่อไม่สำเร็จ');
          }
        });
    };
    refresh();
    const timer = owner ? undefined : window.setInterval(refresh, 10000);
    if (!owner) document.addEventListener('visibilitychange', refresh);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [url, attempt, owner]);
  useEffect(() => () => write.current?.abort(), []);

  async function save(preferences: Preferences) {
    if (
      write.current ||
      !(await ask({
        title: 'บันทึกช่องทางติดต่อไหม?',
        confirmLabel: 'บันทึก',
        icon: 'user',
      }))
    )
      return;
    const request = new AbortController();
    write.current = request;
    setSaving(true);
    setNotice('');
    setError('');
    try {
      await accountRequest(href, preferencesSchema, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      });
      setContact((current) => current && { ...current, preferences });
      setNotice('บันทึกการแชร์ช่องทางติดต่อแล้ว');
    } catch {
      if (!request.signal.aborted) setError('บันทึกไม่ได้ กรุณาลองอีกครั้ง');
    } finally {
      write.current = null;
      if (!request.signal.aborted) setSaving(false);
    }
  }

  return (
    <section className={styles.contact} aria-label="ช่องทางติดต่อ">
      <h3>ช่องทางติดต่อ</h3>
      {error && <p role="alert">{error}</p>}
      {!contact &&
        (error ? (
          <button
            type="button"
            onClick={() => {
              setError('');
              setAttempt((value) => value + 1);
            }}
          >
            ลองอีกครั้ง
          </button>
        ) : (
          <p role="status">กำลังโหลดช่องทางติดต่อ…</p>
        ))}
      {owner && contact && draft && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save(draft);
          }}
        >
          <p>
            ผู้ที่คำร้องได้รับอนุมัติจะเห็นช่องทางที่คุณเลือก สำหรับคู่จับคู่
            ทั้งสองฝ่ายต้องเปิดแชร์ก่อน
          </p>
          <fieldset disabled={saving} aria-label="เลือกช่องทางที่อนุญาตให้แชร์">
            <label>
              <input
                type="checkbox"
                checked={draft.shareEmail}
                onChange={(e) => {
                  setNotice('');
                  setDraft({ ...draft, shareEmail: e.target.checked });
                }}
              />{' '}
              แชร์อีเมลจากโปรไฟล์
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.sharePhone}
                onChange={(e) => {
                  setNotice('');
                  setDraft({ ...draft, sharePhone: e.target.checked });
                }}
              />{' '}
              แชร์เบอร์โทรจากโปรไฟล์
            </label>
          </fieldset>
          <button
            type="submit"
            disabled={
              saving ||
              (draft.shareEmail === contact.preferences?.shareEmail &&
                draft.sharePhone === contact.preferences?.sharePhone)
            }
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกช่องทางติดต่อ'}
          </button>
          {notice && <p role="status">{notice}</p>}
        </form>
      )}
      {!owner &&
        contact &&
        (contact.email || contact.phone ? (
          <dl>
            {contact.email && (
              <>
                <dt>อีเมล</dt>
                <dd>{contact.email}</dd>
              </>
            )}
            {contact.phone && (
              <>
                <dt>เบอร์โทรศัพท์</dt>
                <dd>{contact.phone}</dd>
              </>
            )}
          </dl>
        ) : (
          <p>
            {matchId
              ? 'จะแสดงช่องทางติดต่อเมื่อทั้งสองฝ่ายเปิดแชร์ในรายละเอียดประกาศของตนเอง'
              : 'ยังไม่มีช่องทางติดต่อที่เปิดให้คุณเห็น'}
          </p>
        ))}
    </section>
  );
}
