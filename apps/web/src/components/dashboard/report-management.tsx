'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { bangkokEventFields } from '@/components/item-reports/report-format';
import { ReportLocationChoice } from '@/components/item-reports/report-location-choice';
import { ThaiDateTimeField } from '@/components/item-reports/thai-datetime-field';
import { validateReport } from '@/components/item-reports/report-validation';
import { ShellIcon } from '@/components/shell/shell-icon';
import { REPORT_TITLE_LIMIT } from '@/modules/item-reports/domain/report';
import {
  closeReport,
  loadReportOptions,
  ReportRequestError,
  updateReportDetails,
  type ReportRow,
} from '@/modules/item-reports/presentation/reports-client';
import styles from './report-detail.module.css';

type Catalogs = Awaited<ReturnType<typeof loadReportOptions>>;

export function ReportManagement({
  row,
  mode,
  formId,
  onUpdated,
  onPendingChange,
  onEditReadyChange,
}: {
  row: ReportRow;
  mode: 'edit' | 'close';
  formId: string;
  onUpdated: (row: ReportRow, message: string) => void;
  onPendingChange: (pending: boolean) => void;
  onEditReadyChange: (ready: boolean) => void;
}) {
  const locationFieldId = useId();
  const dateFieldId = useId();
  const [locationId, setLocationId] = useState(String(row.locationId));
  const eventFields = bangkokEventFields(row.eventDatetime);
  const [eventDate, setEventDate] = useState(eventFields.date);
  const [eventTime, setEventTime] = useState(eventFields.time);
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const closeHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (mode !== 'edit') {
      onEditReadyChange(false);
      return;
    }
    onEditReadyChange(false);
    const controller = new AbortController();
    void loadReportOptions(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setCatalogs(data);
        onEditReadyChange(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('โหลดหมวดหมู่และสถานที่ไม่สำเร็จ');
          onEditReadyChange(false);
        }
      });
    return () => controller.abort();
  }, [mode, attempt, onEditReadyChange]);
  useEffect(() => {
    if (mode === 'edit' && catalogs) titleField.current?.focus();
    if (mode === 'close') closeHeading.current?.focus();
  }, [mode, catalogs]);
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
      onUpdated(next, message);
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
      (item) => String(item.id) === form.get('category'),
    );
    const location = catalogs?.locations.find(
      (item) => String(item.id) === locationId,
    );
    if (!category || !location) {
      setError('กรุณาเลือกหมวดหมู่และสถานที่');
      return;
    }
    const description = String(form.get('description') ?? '');
    const date = String(form.get('date') ?? '');
    const time = String(form.get('time') ?? '');
    const validated = validateReport(row.type, {
      title,
      description,
      date,
      time,
      categoryId: String(category.id),
      locationId,
    });
    if (!validated.ok) {
      setError(Object.values(validated.errors)[0] ?? 'กรุณาตรวจข้อมูล');
      return;
    }
    const eventChanged = date !== eventFields.date || time !== eventFields.time;
    const fields = {
      title,
      description: description.trim() ? description : null,
      categoryId: category.id,
      locationId: location.id,
      ...(eventChanged
        ? { eventDatetime: validated.payload.eventDatetime }
        : {}),
    };
    if (
      fields.title === row.title &&
      fields.description === row.description &&
      fields.categoryId === row.categoryId &&
      fields.locationId === row.locationId &&
      !eventChanged
    ) {
      onUpdated(row, 'ไม่มีข้อมูลที่เปลี่ยนแปลง');
      return;
    }
    void save(
      async (signal) => ({
        ...(await updateReportDetails(row.reportId, fields, signal)),
        categoryName: category.name,
        locationName: location.name,
      }),
      'บันทึกการแก้ไขแล้ว',
    );
  }
  return (
    <section
      className={mode === 'close' ? styles.dangerCard : styles.manageCard}
      aria-label={mode === 'close' ? 'ยืนยันการปิดประกาศ' : 'แก้ไขรายการ'}
    >
      {mode === 'edit' && (
        <form id={formId} className={styles.manageForm} onSubmit={edit}>
          <div className={styles.manageCardHead}>
            <span className={styles.sectionIcon}>
              <ShellIcon name="edit" width={18} height={18} />
            </span>
            <div>
              <h3>แก้ไขรายการ</h3>
              <p className={styles.mutedText}>
                ปรับชื่อ หมวดหมู่ สถานที่
                หรือรายละเอียดเพื่อให้ค้นหาและจับคู่แม่นยำขึ้น
              </p>
            </div>
          </div>
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
                    {catalogs.categories.map(({ id, name }) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={styles.editLocation}>
                  <ReportLocationChoice
                    id={locationFieldId}
                    label={row.type === 'LOST' ? 'สถานที่หาย' : 'สถานที่พบ'}
                    placeholder="ค้นหาอาคารหรือบริเวณ"
                    options={catalogs.locations}
                    value={locationId}
                    onChange={setLocationId}
                    disabled={pending}
                  />
                </div>
              </div>
              <ThaiDateTimeField
                id={dateFieldId}
                label={
                  row.type === 'LOST' ? 'วันและเวลาที่หาย' : 'วันและเวลาที่พบ'
                }
                required
                compact
                disabled={pending}
                date={eventDate}
                time={eventTime}
                nameDate="date"
                nameTime="time"
                onChange={({ date, time }) => {
                  setEventDate(date);
                  setEventTime(time);
                }}
              />
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
            <p className={styles.mutedText} role="status">
              กำลังโหลดหมวดหมู่และสถานที่…
            </p>
          ) : (
            <div className={styles.editReloadRow}>
              <button
                type="button"
                className={styles.outlineBtn}
                onClick={() => {
                  setError('');
                  setAttempt((value) => value + 1);
                }}
              >
                <ShellIcon name="refresh" width={15} height={15} />
                ลองโหลดอีกครั้ง
              </button>
            </div>
          )}
        </form>
      )}
      {mode === 'close' && (
        <form
          id={formId}
          className={styles.manageForm}
          onSubmit={(event) => {
            event.preventDefault();
            void save(
              async (signal) => ({
                ...row,
                ...(await closeReport(row.reportId, signal)),
              }),
              'ปิดประกาศแล้ว',
            );
          }}
        >
          <div className={styles.dangerHeader}>
            <span className={styles.dangerIcon}>
              <ShellIcon name="alert" width={20} height={20} />
            </span>
            <div>
              <h3 ref={closeHeading} tabIndex={-1}>
                ยืนยันการปิดประกาศ
              </h3>
              <p>เมื่อยืนยัน ระบบจะเปลี่ยนสถานะประกาศเป็น “ปิดแล้ว”</p>
            </div>
          </div>
          <div className={styles.dangerItemSummary}>
            <strong>{row.title}</strong>
            <span>{row.locationName}</span>
          </div>
        </form>
      )}
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
