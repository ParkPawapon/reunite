'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ShellIcon } from '@/components/shell/shell-icon';
import { REPORT_TITLE_LIMIT } from '@/modules/item-reports/domain/report';
import {
  closeReport,
  loadReportCatalogs,
  ReportRequestError,
  updateReportDetails,
  type ReportRow,
} from '@/modules/item-reports/presentation/reports-client';
import styles from './report-detail.module.css';

type Catalogs = Awaited<ReturnType<typeof loadReportCatalogs>>;

export function ReportManagement({
  row,
  onUpdated,
  onPendingChange,
}: {
  row: ReportRow;
  onUpdated: (row: ReportRow) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [panel, setPanel] = useState<'actions' | 'edit' | 'close'>('actions');
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const closeHeading = useRef<HTMLHeadingElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (panel !== 'edit') return;
    const controller = new AbortController();
    void loadReportCatalogs(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCatalogs(data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('โหลดหมวดหมู่และสถานที่ไม่สำเร็จ');
      });
    return () => controller.abort();
  }, [panel, attempt]);
  useEffect(() => {
    if (panel === 'edit' && catalogs) titleField.current?.focus();
    if (panel === 'close') closeHeading.current?.focus();
    if (panel === 'actions' && restoreFocus.current) {
      restoreFocus.current = false;
      editButton.current?.focus();
    }
  }, [panel, catalogs]);

  function openPanel(next: 'edit' | 'close') {
    setError('');
    setNotice('');
    setCatalogs(null);
    setPanel(next);
  }
  function finish() {
    restoreFocus.current = true;
    setError('');
    setPanel('actions');
  }
  async function save(
    persist: (signal: AbortSignal) => Promise<ReportRow>,
    message: string,
  ) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setError('');
    setPending(true);
    onPendingChange(true);
    try {
      const next = await persist(controller.signal);
      if (controller.signal.aborted) return;
      onUpdated(next);
      setNotice(message);
      finish();
    } catch (cause) {
      if (controller.signal.aborted) return;
      const status = cause instanceof ReportRequestError ? cause.status : 0;
      setError(
        status === 401
          ? 'หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง'
          : status === 404
            ? 'จัดการรายการนี้ไม่ได้ กรุณาปิดรายละเอียดแล้วรีเฟรชรายการ'
            : 'บันทึกไม่สำเร็จ กรุณาตรวจข้อมูลหรือลองอีกครั้ง',
      );
    } finally {
      request.current = null;
      if (!controller.signal.aborted) {
        setPending(false);
        onPendingChange(false);
      }
    }
  }
  function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    if (!title) {
      setError('กรุณากรอกชื่อสิ่งของ');
      titleField.current?.focus();
      return;
    }
    const category = catalogs?.categories.find(
      (item) => String(item.categoryId) === form.get('category'),
    );
    const location = catalogs?.locations.find(
      (item) => String(item.locationId) === form.get('location'),
    );
    if (!category || !location) {
      setError('กรุณาเลือกหมวดหมู่และสถานที่');
      return;
    }
    const description = String(form.get('description') ?? '');
    const fields = {
      title,
      description: description.trim() ? description : null,
      categoryId: category.categoryId,
      locationId: location.locationId,
    };
    if (
      fields.title === row.title &&
      fields.description === row.description &&
      fields.categoryId === row.categoryId &&
      fields.locationId === row.locationId
    ) {
      finish();
      return;
    }
    void save(
      async (signal) => ({
        ...(await updateReportDetails(row.reportId, fields, signal)),
        categoryName: category.categoryName,
        locationName: location.locationName,
      }),
      'บันทึกการแก้ไขแล้ว',
    );
  }
  return (
    <section className={styles.management} aria-label="จัดการประกาศ">
      {panel === 'actions' && (
        <div className={styles.manageActions}>
          <button
            className={styles.primary}
            type="button"
            ref={editButton}
            onClick={() => openPanel('edit')}
          >
            <ShellIcon name="edit" width={17} height={17} /> แก้ไขรายการ
          </button>
          {row.status === 'OPEN' && (
            <button
              className={styles.secondary}
              type="button"
              onClick={() => openPanel('close')}
            >
              ปิดประกาศ
            </button>
          )}
        </div>
      )}
      {panel === 'edit' && (
        <form className={styles.manageForm} onSubmit={edit}>
          <h3>แก้ไขรายการ</h3>
          {catalogs ? (
            <fieldset disabled={pending} className={styles.manageFields}>
              <label>
                ชื่อสิ่งของ
                <input
                  name="title"
                  defaultValue={row.title}
                  maxLength={REPORT_TITLE_LIMIT}
                  required
                  ref={titleField}
                />
              </label>
              <div className={styles.catalogFields}>
                <label>
                  หมวดหมู่
                  <select
                    name="category"
                    defaultValue={row.categoryId}
                    required
                  >
                    {catalogs.categories.map(({ categoryId, categoryName }) => (
                      <option key={categoryId} value={categoryId}>
                        {categoryName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  สถานที่
                  <select
                    name="location"
                    defaultValue={row.locationId}
                    required
                  >
                    {catalogs.locations.map(({ locationId, locationName }) => (
                      <option key={locationId} value={locationId}>
                        {locationName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                ลักษณะสิ่งของ
                <textarea
                  name="description"
                  rows={3}
                  maxLength={10000}
                  defaultValue={row.description ?? ''}
                />
              </label>
            </fieldset>
          ) : !error ? (
            <p role="status">กำลังโหลดหมวดหมู่และสถานที่…</p>
          ) : null}
          <div className={styles.manageActions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={finish}
              disabled={pending}
            >
              ยกเลิก
            </button>
            {catalogs ? (
              <button
                type="submit"
                className={styles.primary}
                disabled={pending}
              >
                {pending ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}
              </button>
            ) : (
              error && (
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => {
                    setError('');
                    setAttempt((value) => value + 1);
                  }}
                >
                  ลองโหลดอีกครั้ง
                </button>
              )
            )}
          </div>
        </form>
      )}
      {panel === 'close' && (
        <div className={styles.manageForm}>
          <h3 ref={closeHeading} tabIndex={-1}>
            ยืนยันการปิดประกาศ
          </h3>
          <p>เมื่อยืนยัน ระบบจะเปลี่ยนสถานะประกาศเป็น “ปิดแล้ว”</p>
          <div className={styles.manageActions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={finish}
              disabled={pending}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={pending}
              onClick={() =>
                void save(
                  async (signal) => ({
                    ...row,
                    ...(await closeReport(row.reportId, signal)),
                  }),
                  'ปิดประกาศแล้ว',
                )
              }
            >
              {pending ? 'กำลังปิด…' : 'ยืนยันปิดประกาศ'}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={styles.saved} role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
