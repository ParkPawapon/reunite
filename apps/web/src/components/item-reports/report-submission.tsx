'use client';
import { useId, useState } from 'react';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ShellIcon } from '@/components/shell/shell-icon';
import { useShellMotion } from '@/components/shell/shell-motion';
import type { ReportOption } from '@/modules/item-reports/presentation/reports-client';
import type { ReportType } from '@/modules/item-reports/presentation/reports-client';
import {
  DESCRIPTION_LIMIT,
  emptyDraft,
  tabCopy,
  type ReportDraft,
} from './report-draft';
import {
  FIELD_ORDER,
  validateReport,
  type FieldErrors,
} from './report-validation';
import { useReportOptions } from './use-report-options';
import styles from './report-submission.module.css';

type Option = ReportOption;

// Labels sit above each field, so the outline must not reserve a notch for them.
const baseSlots = {
  inputLabel: { shrink: true },
  input: { notched: false, label: '' },
} as const;
const dateClass = (value: string) =>
  value ? styles.dateField : `${styles.dateField} ${styles.emptyDate}`;

function SelectChevron({ className }: { className?: string }) {
  return <ShellIcon name="chevron" className={className} />;
}
function ChoiceSkeleton({ animate }: { animate: boolean }) {
  return (
    <div aria-hidden="true">
      <Skeleton width={96} height={20} animation={animate ? 'wave' : false} />
      <Skeleton
        variant="rounded"
        height={52}
        animation={animate ? 'wave' : false}
        className={styles.choiceSkeleton}
      />
    </div>
  );
}
function Choice({
  id,
  label,
  placeholder,
  value,
  options,
  error,
  onChange,
}: {
  id: string;
  error?: string;
  label: string;
  placeholder: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      select
      required
      fullWidth
      id={id}
      label={label}
      error={Boolean(error)}
      helperText={error}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{
        ...baseSlots,
        select: {
          displayEmpty: true,
          IconComponent: SelectChevron,
          renderValue: (selected) =>
            options.find((option) => String(option.id) === selected)?.name ?? (
              <span className={styles.placeholder}>{placeholder}</span>
            ),
        },
      }}
    >
      {options.length ? (
        options.map((option) => (
          <MenuItem key={option.id} value={String(option.id)}>
            {option.name}
          </MenuItem>
        ))
      ) : (
        <MenuItem value="" disabled>
          ยังไม่มีตัวเลือก
        </MenuItem>
      )}
    </TextField>
  );
}

export function ReportSubmission() {
  const id = useId();
  const motion = useShellMotion();
  const wide = useMediaQuery('(min-width: 768px)');
  const [type, setType] = useState<ReportType>('LOST');
  const [drafts, setDrafts] = useState<Record<ReportType, ReportDraft>>({
    LOST: emptyDraft,
    FOUND: emptyDraft,
  });
  const [allErrors, setAllErrors] = useState<Record<ReportType, FieldErrors>>({
    LOST: {},
    FOUND: {},
  });
  const draft = drafts[type];
  const errors = allErrors[type];
  const copy = tabCopy[type];
  const { state, retry } = useReportOptions();
  const categories = state.status === 'ready' ? state.categories : [];
  const locations = state.status === 'ready' ? state.locations : [];
  const noOptions =
    state.status === 'ready' && (!categories.length || !locations.length);
  const when = draft.date && draft.time ? `${draft.date}T${draft.time}` : '';
  const fieldId = (name: string) => `${id}-${name}`;
  const patch = (fields: Partial<ReportDraft>) => {
    setDrafts((current) => ({
      ...current,
      [type]: { ...current[type], ...fields },
    }));
    // An error goes away as soon as the user edits that field.
    setAllErrors((current) => {
      const next = { ...current[type] };
      for (const key of Object.keys(fields) as (keyof ReportDraft)[])
        delete next[key];
      return { ...current, [type]: next };
    });
  };
  const submit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateReport(type, draft);
    if (result.ok) return;
    setAllErrors((current) => ({ ...current, [type]: result.errors }));
    for (const name of FIELD_ORDER) {
      if (!result.errors[name]) continue;
      const target = document.getElementById(fieldId(name));
      if (target) {
        target.focus();
        break;
      }
    }
  };
  const whenError =
    errors.date && errors.time
      ? 'กรุณาเลือกวันและเวลา'
      : (errors.date ?? errors.time);
  return (
    <div
      className={styles.root}
      data-report-submission
      data-motion={motion ? 'running' : 'still'}
    >
      <header className={styles.pageHeader}>
        <h1>{copy.heading}</h1>
        <p className={styles.intro}>{copy.intro}</p>
      </header>
      <Tabs
        value={type}
        onChange={(_, value: ReportType) => setType(value)}
        aria-label="ประเภทรายการ"
        selectionFollowsFocus
        className={styles.tabs}
      >
        <Tab
          value="LOST"
          label={tabCopy.LOST.tab}
          icon={<ShellIcon name="box" width={18} height={18} />}
          iconPosition="start"
          id={`${id}-tab-LOST`}
          aria-controls={`${id}-panel`}
        />
        <Tab
          value="FOUND"
          label={tabCopy.FOUND.tab}
          icon={<ShellIcon name="check" width={18} height={18} />}
          iconPosition="start"
          id={`${id}-tab-FOUND`}
          aria-controls={`${id}-panel`}
        />
      </Tabs>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${type}`}
      >
        <form className={styles.card} noValidate onSubmit={submit}>
          {state.status === 'loading' ? (
            <p className={styles.srOnly} role="status">
              กำลังโหลดหมวดหมู่และสถานที่
            </p>
          ) : null}
          {state.status === 'error' ? (
            <div role="alert" className={styles.notice}>
              <p>
                โหลดหมวดหมู่และสถานที่ไม่สำเร็จ
                ลองอีกครั้งเมื่อการเชื่อมต่อพร้อม
              </p>
              <Button
                type="button"
                variant="outlined"
                className={styles.retry}
                color="primary"
                onClick={retry}
                startIcon={<ShellIcon name="refresh" width={16} height={16} />}
              >
                ลองอีกครั้ง
              </Button>
            </div>
          ) : null}
          {noOptions ? (
            <div role="status" className={styles.notice}>
              <p>
                ยังไม่มีหมวดหมู่หรือสถานที่ในระบบ จึงยังแจ้งรายการไม่ได้
                กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มข้อมูล แล้วกลับมาลองใหม่
              </p>
            </div>
          ) : null}
          <div className={styles.grid}>
            <TextField
              required
              fullWidth
              id={fieldId('title')}
              label="ชื่อสิ่งของ"
              placeholder={copy.titlePlaceholder}
              error={Boolean(errors.title)}
              helperText={errors.title}
              value={draft.title}
              onChange={(event) => patch({ title: event.target.value })}
              slotProps={baseSlots}
            />
            {state.status === 'loading' ? (
              <ChoiceSkeleton animate={motion} />
            ) : (
              <Choice
                id={fieldId('categoryId')}
                error={errors.categoryId}
                label="หมวดหมู่"
                placeholder="เลือกหมวดหมู่"
                value={draft.categoryId}
                options={categories}
                onChange={(categoryId) => patch({ categoryId })}
              />
            )}
            {state.status === 'loading' ? (
              <ChoiceSkeleton animate={motion} />
            ) : (
              <Choice
                id={fieldId('locationId')}
                error={errors.locationId}
                label={copy.place}
                placeholder={copy.placePlaceholder}
                value={draft.locationId}
                options={locations}
                onChange={(locationId) => patch({ locationId })}
              />
            )}
            {wide ? (
              <TextField
                required
                fullWidth
                type="datetime-local"
                id={fieldId('date')}
                label={copy.when}
                error={Boolean(whenError)}
                helperText={whenError}
                className={dateClass(when)}
                value={when}
                onChange={(event) => {
                  const [date = '', time = ''] = event.target.value.split('T');
                  patch({ date, time });
                }}
                slotProps={{
                  ...baseSlots,
                  htmlInput: { 'data-placeholder': 'เลือกวันและเวลา' },
                }}
              />
            ) : (
              <>
                <TextField
                  required
                  fullWidth
                  type="date"
                  id={fieldId('date')}
                  label={copy.date}
                  error={Boolean(errors.date)}
                  helperText={errors.date}
                  className={dateClass(draft.date)}
                  value={draft.date}
                  onChange={(event) => patch({ date: event.target.value })}
                  slotProps={{
                    ...baseSlots,
                    htmlInput: { 'data-placeholder': 'เลือกวันที่' },
                  }}
                />
                <TextField
                  required
                  fullWidth
                  type="time"
                  id={fieldId('time')}
                  label="เวลา"
                  error={Boolean(errors.time)}
                  helperText={errors.time}
                  className={dateClass(draft.time)}
                  value={draft.time}
                  onChange={(event) => patch({ time: event.target.value })}
                  slotProps={{
                    ...baseSlots,
                    htmlInput: { 'data-placeholder': 'เลือกเวลา' },
                  }}
                />
              </>
            )}
            <TextField
              className={styles.fullRow}
              fullWidth
              multiline
              minRows={4}
              id={fieldId('description')}
              error={Boolean(errors.description)}
              label="ลักษณะสิ่งของ (ไม่บังคับ)"
              placeholder="เช่น สี ยี่ห้อ หรือรอยตำหนิ"
              helperText={
                errors.description ??
                `ไม่เกิน ${DESCRIPTION_LIMIT.toLocaleString('en-US')} ตัวอักษร`
              }
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
              slotProps={{
                ...baseSlots,
                htmlInput: { maxLength: DESCRIPTION_LIMIT },
              }}
            />
          </div>
          <div className={styles.footer}>
            <p className={styles.hint}>* จำเป็นต้องกรอก</p>
            <Button type="submit" variant="contained" className={styles.submit}>
              {copy.submit}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
