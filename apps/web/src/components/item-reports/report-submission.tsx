'use client';
import { useId, useState } from 'react';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ShellIcon } from '@/components/shell/shell-icon';
import { useShellMotion } from '@/components/shell/shell-motion';
import type { ReportType } from '@/modules/item-reports/presentation/reports-client';
import {
  DESCRIPTION_LIMIT,
  emptyDraft,
  tabCopy,
  type ReportDraft,
} from './report-draft';
import styles from './report-submission.module.css';

type Option = { id: number; name: string };

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
function Choice({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
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
      label={label}
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
  const draft = drafts[type];
  const copy = tabCopy[type];
  const categories: Option[] = [];
  const locations: Option[] = [];
  const when = draft.date && draft.time ? `${draft.date}T${draft.time}` : '';
  const patch = (fields: Partial<ReportDraft>) =>
    setDrafts((current) => ({
      ...current,
      [type]: { ...current[type], ...fields },
    }));
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
        <form
          className={styles.card}
          noValidate
          onSubmit={(event) => event.preventDefault()}
        >
          <div className={styles.grid}>
            <TextField
              required
              fullWidth
              label="ชื่อสิ่งของ"
              placeholder={copy.titlePlaceholder}
              value={draft.title}
              onChange={(event) => patch({ title: event.target.value })}
              slotProps={baseSlots}
            />
            <Choice
              label="หมวดหมู่"
              placeholder="เลือกหมวดหมู่"
              value={draft.categoryId}
              options={categories}
              onChange={(categoryId) => patch({ categoryId })}
            />
            <Choice
              label={copy.place}
              placeholder={copy.placePlaceholder}
              value={draft.locationId}
              options={locations}
              onChange={(locationId) => patch({ locationId })}
            />
            {wide ? (
              <TextField
                required
                fullWidth
                type="datetime-local"
                label={copy.when}
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
                  label={copy.date}
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
                  label="เวลา"
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
              label="ลักษณะสิ่งของ (ไม่บังคับ)"
              placeholder="เช่น สี ยี่ห้อ หรือรอยตำหนิ"
              helperText={`ไม่เกิน ${DESCRIPTION_LIMIT.toLocaleString('en-US')} ตัวอักษร`}
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
