'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Popover from '@mui/material/Popover';
import { ShellIcon } from '@/components/shell/shell-icon';
import {
  buildThaiCalendarGrid,
  clampDateTimeToNow,
  formatEventDatetime,
  formatIsoDate,
  formatThaiCalendarMonthYear,
  isFutureDateIso,
  isFutureMonthYear,
  maxHourForDate,
  maxMinuteForDateTime,
  nowInBangkok,
  parseIsoDateParts,
  parseTimeParts,
  shiftYearMonth,
  stepTimePart,
  THAI_MONTHS_FULL,
  THAI_WEEKDAYS_SHORT,
  type BangkokNow,
} from './report-format';
import styles from './thai-datetime-field.module.css';

export type ThaiDateTimeFieldProps = {
  id?: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  compact?: boolean;
  date: string;
  time: string;
  nameDate?: string;
  nameTime?: string;
  error?: string;
  helperText?: string;
  onChange: (next: { date: string; time: string }) => void;
};

const pad2 = (value: number) => String(value).padStart(2, '0');

function clampDigits(raw: string, max: number, fallback: number): number {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return fallback;
  const parsed = Number.parseInt(digits.slice(-2), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(0, parsed));
}

export function ThaiDateTimeField({
  id,
  label,
  placeholder = 'เลือกวันและเวลา',
  required = false,
  disabled = false,
  compact = false,
  date,
  time,
  nameDate,
  nameTime,
  error,
  helperText,
  onChange,
}: ThaiDateTimeFieldProps) {
  const generatedId = useId();
  const triggerId = id ?? `${generatedId}-trigger`;
  const popoverId = `${generatedId}-popover`;
  const dialogTitleId = `${generatedId}-title`;
  const helperId = `${generatedId}-helper`;
  const hourInputId = `${generatedId}-hour`;
  const minuteInputId = `${generatedId}-minute`;
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);
  const [pickingMonthYear, setPickingMonthYear] = useState(false);
  const [draftDate, setDraftDate] = useState('');
  const [hourText, setHourText] = useState('00');
  const [minuteText, setMinuteText] = useState('00');
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(11);
  const [nowFields, setNowFields] = useState<BangkokNow>(() => nowInBangkok());
  const todayIso = nowFields.date;

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      setNowFields(nowInBangkok());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  const openPicker = (target: HTMLButtonElement) => {
    if (disabled) return;
    const liveNow = nowInBangkok();
    const rawDate = parseIsoDateParts(date) ? date : liveNow.date;
    const rawTime = parseTimeParts(time) ?? {
      hour: liveNow.hour,
      minute: liveNow.minute,
    };
    const clamped = clampDateTimeToNow(
      rawDate,
      rawTime.hour,
      rawTime.minute,
      liveNow,
    );
    const initialDateParts = parseIsoDateParts(clamped.date) ?? {
      year: liveNow.year,
      month: liveNow.month,
      day: liveNow.day,
    };
    setNowFields(liveNow);
    setDraftDate(clamped.date);
    setHourText(pad2(clamped.hour));
    setMinuteText(pad2(clamped.minute));
    setViewYear(initialDateParts.year);
    setViewMonth(initialDateParts.month);
    setPickingMonthYear(false);
    setAnchorEl(target);
  };

  const closePicker = () => {
    setAnchorEl(null);
    setPickingMonthYear(false);
  };

  const setNowInBangkok = () => {
    const liveNow = nowInBangkok();
    setNowFields(liveNow);
    setDraftDate(liveNow.date);
    setViewYear(liveNow.year);
    setViewMonth(liveNow.month);
    setHourText(pad2(liveNow.hour));
    setMinuteText(pad2(liveNow.minute));
    setPickingMonthYear(false);
  };

  const commit = () => {
    const liveNow = nowInBangkok();
    setNowFields(liveNow);
    const clamped = clampDateTimeToNow(
      draftDate,
      clampDigits(hourText, 23, 0),
      clampDigits(minuteText, 59, 0),
      liveNow,
    );
    onChange({
      date: clamped.date,
      time: `${pad2(clamped.hour)}:${pad2(clamped.minute)}`,
    });
    closePicker();
  };

  const calendarCells = useMemo(
    () => buildThaiCalendarGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const formattedDisplay =
    date && time ? formatEventDatetime(`${date}T${time}:00`) : '';
  const visibleHelper = error || helperText;

  const activeDate = draftDate || todayIso;
  const maxHour = maxHourForDate(activeDate, nowFields);
  const currentHour = Math.min(clampDigits(hourText, 23, 0), maxHour);
  const maxMinute = maxMinuteForDateTime(activeDate, currentHour, nowFields);
  const currentMinute = clampDigits(minuteText, 59, 0);
  const isTodayOrFutureSelected = activeDate >= todayIso;
  const isHourIncrementDisabled =
    isTodayOrFutureSelected && currentHour >= maxHour;
  const isMinuteIncrementDisabled =
    isTodayOrFutureSelected &&
    currentHour >= maxHour &&
    currentMinute >= maxMinute;
  const nextMonthCandidate = shiftYearMonth(viewYear, viewMonth, 1);
  const isNextMonthDisabled = isFutureMonthYear(
    nextMonthCandidate.year,
    nextMonthCandidate.month,
    nowFields.year,
    nowFields.month,
  );
  const isNextYearDisabled = viewYear >= nowFields.year;

  const stepHour = (delta: 1 | -1) => {
    const liveNow = nowInBangkok();
    setNowFields(liveNow);
    const currentDate = draftDate || liveNow.date;
    const limitHour = maxHourForDate(currentDate, liveNow);
    const curHour = Math.min(clampDigits(hourText, 23, 0), limitHour);
    if (delta === 1 && currentDate >= liveNow.date && curHour >= limitHour)
      return;
    const nextHour = stepTimePart(curHour, limitHour, delta);
    const clamped = clampDateTimeToNow(
      currentDate,
      nextHour,
      clampDigits(minuteText, 59, 0),
      liveNow,
    );
    setHourText(pad2(clamped.hour));
    setMinuteText(pad2(clamped.minute));
  };

  const stepMinute = (delta: 1 | -1) => {
    const liveNow = nowInBangkok();
    setNowFields(liveNow);
    const currentDate = draftDate || liveNow.date;
    const limitHour = maxHourForDate(currentDate, liveNow);
    const curHour = Math.min(clampDigits(hourText, 23, 0), limitHour);
    const limitMinute = maxMinuteForDateTime(currentDate, curHour, liveNow);
    const curMinute = Math.min(clampDigits(minuteText, 59, 0), limitMinute);
    if (
      delta === 1 &&
      currentDate >= liveNow.date &&
      curHour >= limitHour &&
      curMinute >= limitMinute
    )
      return;
    const nextMinute = stepTimePart(curMinute, limitMinute, delta);
    setHourText(pad2(curHour));
    setMinuteText(pad2(nextMinute));
  };

  return (
    <div className={styles.root}>
      <label
        htmlFor={triggerId}
        className={`${styles.label} ${compact ? styles.labelCompact : ''}`}
      >
        {label}
        {required ? ' *' : ''}
      </label>
      <button
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-describedby={visibleHelper ? helperId : undefined}
        onClick={(event) =>
          open ? closePicker() : openPicker(event.currentTarget)
        }
        className={[
          styles.trigger,
          compact ? styles.triggerCompact : '',
          open ? styles.triggerOpen : '',
          error ? styles.triggerError : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className={styles.iconSlot} aria-hidden="true">
          <ShellIcon name="calendar" width={18} height={18} />
        </span>
        <span
          className={`${styles.valueText} ${
            formattedDisplay ? '' : styles.placeholderText
          }`}
        >
          {formattedDisplay || placeholder}
        </span>
        <ShellIcon
          name="chevron"
          width={18}
          height={18}
          className={open ? styles.chevronOpen : styles.chevron}
        />
      </button>
      {nameDate ? <input type="hidden" name={nameDate} value={date} /> : null}
      {nameTime ? <input type="hidden" name={nameTime} value={time} /> : null}
      {visibleHelper ? (
        <p
          id={helperId}
          className={error ? styles.errorText : styles.helperText}
        >
          {visibleHelper}
        </p>
      ) : null}

      <Popover
        id={popoverId}
        open={open}
        anchorEl={anchorEl}
        onClose={closePicker}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-labelledby': dialogTitleId,
            className: styles.paper,
            elevation: 0,
          },
        }}
      >
        <div className={styles.bodyGrid}>
          <div className={styles.calendarPane}>
            <div className={styles.calendarHead}>
              <button
                id={dialogTitleId}
                type="button"
                className={styles.monthTitleBtn}
                aria-expanded={pickingMonthYear}
                aria-label={`เลือกเดือนและปี ขณะนี้คือ ${formatThaiCalendarMonthYear(viewYear, viewMonth)}`}
                onClick={() => setPickingMonthYear((current) => !current)}
              >
                <span>{formatThaiCalendarMonthYear(viewYear, viewMonth)}</span>
                <ShellIcon
                  name="chevron"
                  width={16}
                  height={16}
                  className={pickingMonthYear ? styles.chevronUp : undefined}
                />
              </button>
              <div className={styles.navGroup}>
                <button
                  type="button"
                  className={styles.navBtn}
                  aria-label="เดือนก่อนหน้า"
                  onClick={() => {
                    const next = shiftYearMonth(viewYear, viewMonth, -1);
                    setViewYear(next.year);
                    setViewMonth(next.month);
                  }}
                >
                  <ShellIcon
                    name="chevron"
                    width={16}
                    height={16}
                    className={styles.chevronLeft}
                  />
                </button>
                <button
                  type="button"
                  className={styles.navBtn}
                  aria-label="เดือนถัดไป"
                  disabled={isNextMonthDisabled}
                  onClick={() => {
                    if (isNextMonthDisabled) return;
                    setViewYear(nextMonthCandidate.year);
                    setViewMonth(nextMonthCandidate.month);
                  }}
                >
                  <ShellIcon
                    name="chevron"
                    width={16}
                    height={16}
                    className={styles.chevronRight}
                  />
                </button>
              </div>
            </div>

            {pickingMonthYear ? (
              <div className={styles.monthPickerPanel}>
                <div className={styles.yearBar}>
                  <button
                    type="button"
                    className={styles.navBtn}
                    aria-label="ปีก่อนหน้า"
                    onClick={() => setViewYear((y) => y - 1)}
                  >
                    <ShellIcon
                      name="chevron"
                      width={16}
                      height={16}
                      className={styles.chevronLeft}
                    />
                  </button>
                  <span className={styles.yearLabel}>
                    พ.ศ. {viewYear + 543}
                  </span>
                  <button
                    type="button"
                    className={styles.navBtn}
                    aria-label="ปีถัดไป"
                    disabled={isNextYearDisabled}
                    onClick={() => {
                      if (isNextYearDisabled) return;
                      setViewYear((y) => y + 1);
                    }}
                  >
                    <ShellIcon
                      name="chevron"
                      width={16}
                      height={16}
                      className={styles.chevronRight}
                    />
                  </button>
                </div>
                <div className={styles.monthsGrid}>
                  {THAI_MONTHS_FULL.map((monthLabel, index) => {
                    const monthNumber = index + 1;
                    const selected = monthNumber === viewMonth;
                    const isFutureMonth = isFutureMonthYear(
                      viewYear,
                      monthNumber,
                      nowFields.year,
                      nowFields.month,
                    );
                    return (
                      <button
                        key={monthLabel}
                        type="button"
                        disabled={isFutureMonth}
                        className={
                          selected
                            ? styles.monthOptionSelected
                            : styles.monthOptionBtn
                        }
                        aria-pressed={selected}
                        onClick={() => {
                          if (isFutureMonth) return;
                          const liveNow = nowInBangkok();
                          setNowFields(liveNow);
                          setViewMonth(monthNumber);
                          const currentParts = parseIsoDateParts(draftDate);
                          if (currentParts) {
                            const maxDay = new Date(
                              Date.UTC(viewYear, monthNumber, 0),
                            ).getUTCDate();
                            const candidateIso = formatIsoDate(
                              viewYear,
                              monthNumber,
                              Math.min(currentParts.day, maxDay),
                            );
                            const clamped = clampDateTimeToNow(
                              candidateIso,
                              clampDigits(hourText, 23, 0),
                              clampDigits(minuteText, 59, 0),
                              liveNow,
                            );
                            setDraftDate(clamped.date);
                            setHourText(pad2(clamped.hour));
                            setMinuteText(pad2(clamped.minute));
                          }
                          setPickingMonthYear(false);
                        }}
                      >
                        {monthLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className={styles.weekdays} aria-hidden="true">
                  {THAI_WEEKDAYS_SHORT.map((dayName, idx) => (
                    <span
                      key={dayName}
                      className={
                        idx === 0 ? styles.weekdaySunday : styles.weekday
                      }
                    >
                      {dayName}
                    </span>
                  ))}
                </div>
                <div
                  className={styles.daysGrid}
                  role="group"
                  aria-label="ปฏิทิน"
                >
                  {calendarCells.map((cell) => {
                    const isSelected = cell.iso === draftDate;
                    const isToday = cell.iso === todayIso;
                    const isFuture = isFutureDateIso(cell.iso, todayIso);
                    const className = isFuture
                      ? styles.dayBtnDisabled
                      : isSelected
                        ? styles.dayBtnSelected
                        : !cell.inMonth
                          ? styles.dayBtnMuted
                          : isToday
                            ? styles.dayBtnToday
                            : styles.dayBtn;
                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        disabled={isFuture}
                        className={className}
                        aria-label={`${cell.day} ${formatThaiCalendarMonthYear(cell.year, cell.month)}`}
                        aria-pressed={isSelected}
                        onClick={() => {
                          if (isFuture) return;
                          const liveNow = nowInBangkok();
                          setNowFields(liveNow);
                          const clamped = clampDateTimeToNow(
                            cell.iso,
                            clampDigits(hourText, 23, 0),
                            clampDigits(minuteText, 59, 0),
                            liveNow,
                          );
                          setDraftDate(clamped.date);
                          setHourText(pad2(clamped.hour));
                          setMinuteText(pad2(clamped.minute));
                          if (!cell.inMonth) {
                            setViewYear(cell.year);
                            setViewMonth(cell.month);
                          }
                        }}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className={styles.timePane}>
            <p className={styles.timeHeading}>เวลา</p>
            <div className={styles.timeRow}>
              <div className={styles.timeUnit}>
                <label htmlFor={hourInputId} className={styles.timeUnitLabel}>
                  ชั่วโมง
                </label>
                <div className={styles.timeBox}>
                  <input
                    id={hourInputId}
                    type="text"
                    inputMode="numeric"
                    aria-label="ชั่วโมง"
                    maxLength={2}
                    value={hourText}
                    className={styles.timeInput}
                    onChange={(event) => {
                      const liveNow = nowInBangkok();
                      setNowFields(liveNow);
                      const currentDate = draftDate || liveNow.date;
                      const limitHour = maxHourForDate(currentDate, liveNow);
                      const cleaned = event.target.value
                        .replace(/\D/g, '')
                        .slice(0, 2);
                      if (!cleaned) {
                        setHourText('');
                        return;
                      }
                      const parsed = Number.parseInt(cleaned, 10);
                      const boundedHour = Math.min(parsed, limitHour);
                      setHourText(
                        parsed > limitHour ? pad2(boundedHour) : cleaned,
                      );
                      const limitMinute = maxMinuteForDateTime(
                        currentDate,
                        boundedHour,
                        liveNow,
                      );
                      if (clampDigits(minuteText, 59, 0) > limitMinute) {
                        setMinuteText(pad2(limitMinute));
                      }
                    }}
                    onBlur={() => {
                      const liveNow = nowInBangkok();
                      setNowFields(liveNow);
                      const currentDate = draftDate || liveNow.date;
                      const limitHour = maxHourForDate(currentDate, liveNow);
                      const boundedHour = clampDigits(hourText, limitHour, 0);
                      const limitMinute = maxMinuteForDateTime(
                        currentDate,
                        boundedHour,
                        liveNow,
                      );
                      const boundedMinute = Math.min(
                        clampDigits(minuteText, 59, 0),
                        limitMinute,
                      );
                      setHourText(pad2(boundedHour));
                      setMinuteText(pad2(boundedMinute));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        stepHour(1);
                      } else if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        stepHour(-1);
                      }
                    }}
                  />
                  <div className={styles.stepperCol}>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      aria-label="เพิ่มชั่วโมง"
                      disabled={isHourIncrementDisabled}
                      onClick={() => stepHour(1)}
                    >
                      <ShellIcon
                        name="chevron"
                        width={12}
                        height={12}
                        className={styles.chevronUp}
                      />
                    </button>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      aria-label="ลดชั่วโมง"
                      onClick={() => stepHour(-1)}
                    >
                      <ShellIcon name="chevron" width={12} height={12} />
                    </button>
                  </div>
                </div>
              </div>

              <span className={styles.colon} aria-hidden="true">
                :
              </span>

              <div className={styles.timeUnit}>
                <label htmlFor={minuteInputId} className={styles.timeUnitLabel}>
                  นาที
                </label>
                <div className={styles.timeBox}>
                  <input
                    id={minuteInputId}
                    type="text"
                    inputMode="numeric"
                    aria-label="นาที"
                    maxLength={2}
                    value={minuteText}
                    className={styles.timeInput}
                    onChange={(event) => {
                      const liveNow = nowInBangkok();
                      setNowFields(liveNow);
                      const currentDate = draftDate || liveNow.date;
                      const limitHour = maxHourForDate(currentDate, liveNow);
                      const curHour = Math.min(
                        clampDigits(hourText, 23, 0),
                        limitHour,
                      );
                      const limitMinute = maxMinuteForDateTime(
                        currentDate,
                        curHour,
                        liveNow,
                      );
                      const cleaned = event.target.value
                        .replace(/\D/g, '')
                        .slice(0, 2);
                      if (!cleaned) {
                        setMinuteText('');
                        return;
                      }
                      const parsed = Number.parseInt(cleaned, 10);
                      setMinuteText(
                        parsed > limitMinute ? pad2(limitMinute) : cleaned,
                      );
                    }}
                    onBlur={() => {
                      const liveNow = nowInBangkok();
                      setNowFields(liveNow);
                      const currentDate = draftDate || liveNow.date;
                      const limitHour = maxHourForDate(currentDate, liveNow);
                      const curHour = Math.min(
                        clampDigits(hourText, 23, 0),
                        limitHour,
                      );
                      const limitMinute = maxMinuteForDateTime(
                        currentDate,
                        curHour,
                        liveNow,
                      );
                      setMinuteText(
                        pad2(clampDigits(minuteText, limitMinute, 0)),
                      );
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        stepMinute(1);
                      } else if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        stepMinute(-1);
                      }
                    }}
                  />
                  <div className={styles.stepperCol}>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      aria-label="เพิ่มนาที"
                      disabled={isMinuteIncrementDisabled}
                      onClick={() => stepMinute(1)}
                    >
                      <ShellIcon
                        name="chevron"
                        width={12}
                        height={12}
                        className={styles.chevronUp}
                      />
                    </button>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      aria-label="ลดนาที"
                      onClick={() => stepMinute(-1)}
                    >
                      <ShellIcon name="chevron" width={12} height={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <p className={styles.timeHint}>รูปแบบ 24 ชั่วโมง</p>
            <p className={styles.timeLiveNote} aria-live="polite">
              {isTodayOrFutureSelected
                ? `เลือกได้ถึง ${nowFields.time} น. (เวลาไทยขณะนี้)`
                : `เวลาไทยขณะนี้ ${nowFields.time} น.`}
            </p>
          </div>
        </div>

        <div className={styles.popoverFooter}>
          <button
            type="button"
            className={styles.todayBtn}
            onClick={setNowInBangkok}
          >
            วันนี้
          </button>
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={closePicker}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={commit}
            >
              ยืนยัน
            </button>
          </div>
        </div>
      </Popover>
    </div>
  );
}
