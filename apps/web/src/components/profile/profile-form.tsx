'use client';
import { AnimatePresence, motion } from 'motion/react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import { ShellIcon } from '@/components/shell/shell-icon';
import {
  kmuttDepartments,
  kmuttEducation,
} from '@/modules/users/domain/kmutt-education';
import type { ProfileEditor, ProfileFields } from './use-profile-editor';
import styles from './profile.module.css';

const labels: Record<keyof ProfileFields, string> = {
  firstName: 'ชื่อจริง',
  lastName: 'นามสกุล',
  email: 'อีเมล',
  studentId: 'รหัสนักศึกษา',
  faculty: 'คณะ',
  department: 'ภาควิชา',
  major: 'สาขาวิชา',
  phone: 'เบอร์โทรศัพท์',
};
const faculties = Object.keys(kmuttEducation);

export function ProfileForm({
  editor,
  running,
  canChangeEmail,
}: {
  editor: ProfileEditor;
  running: boolean;
  canChangeEmail: boolean;
}) {
  const {
    profile,
    values,
    errors,
    pending,
    photoPending,
    password,
    dirty,
    failure,
    success,
  } = editor;
  const programs = kmuttDepartments(values.faculty) ?? {};
  const departments = Object.keys(programs).filter(Boolean);
  const majors = Object.hasOwn(programs, values.department)
    ? (programs[values.department] ?? [])
    : [];
  const emailLocked = !canChangeEmail;
  const firstNameLocked = !canChangeEmail && Boolean(profile.firstName);
  const lastNameLocked = !canChangeEmail && Boolean(profile.lastName);

  function educationSelect(
    key: 'faculty' | 'department' | 'major',
    options: readonly string[],
  ) {
    const value = values[key];
    return (
      <TextField
        select
        id={`profile-${key}`}
        label={labels[key]}
        value={value}
        fullWidth
        disabled={pending || (!options.length && !value)}
        error={Boolean(errors[key])}
        helperText={errors[key]}
        onChange={(event) => editor.change(key, event.target.value)}
        slotProps={{
          select: {
            MenuProps: {
              transitionDuration: running ? undefined : 0,
              slotProps: { paper: { className: styles.educationMenu } },
            },
          },
        }}
      >
        <MenuItem value="">ไม่ระบุ</MenuItem>
        {value && !options.includes(value) && (
          <MenuItem value={value}>{value}</MenuItem>
        )}
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  function field(
    key: keyof ProfileFields,
    max: number,
    options: {
      required?: boolean;
      autoComplete?: string;
      type?: string;
      disabled?: boolean;
    } = {},
  ) {
    return (
      <TextField
        id={`profile-${key}`}
        label={labels[key]}
        value={values[key]}
        required={options.required}
        disabled={options.disabled}
        fullWidth
        type={options.type ?? 'text'}
        autoComplete={options.autoComplete ?? 'off'}
        error={Boolean(errors[key])}
        helperText={errors[key]}
        onChange={(event) => editor.change(key, event.target.value)}
        slotProps={{
          htmlInput: {
            maxLength: max,
            readOnly: pending,
            ...(key === 'studentId' ? { inputMode: 'numeric' } : {}),
          },
        }}
      />
    );
  }
  return (
    <form
      className={styles.form}
      noValidate
      aria-busy={pending}
      onSubmit={(event) => void editor.save(event)}
    >
      <section className={styles.section} aria-labelledby="personal-heading">
        <header className={styles.sectionHeading}>
          <h2 id="personal-heading">ข้อมูลส่วนตัว</h2>
        </header>
        <div className={styles.fields}>
          {field('firstName', 100, {
            required: true,
            autoComplete: 'given-name',
            disabled: firstNameLocked,
          })}
          {field('lastName', 100, {
            required: true,
            autoComplete: 'family-name',
            disabled: lastNameLocked,
          })}
        </div>
      </section>
      <section className={styles.section} aria-labelledby="student-heading">
        <header className={styles.sectionHeading}>
          <h2 id="student-heading">ข้อมูลการศึกษา</h2>
        </header>
        <div className={styles.fields}>
          {field('studentId', 20)}
          {educationSelect('faculty', faculties)}
          {educationSelect('department', departments)}
          {educationSelect('major', majors)}
        </div>
      </section>
      <section className={styles.section} aria-labelledby="contact-heading">
        <header className={styles.sectionHeading}>
          <h2 id="contact-heading">ช่องทางติดต่อ</h2>
        </header>
        <div className={styles.fields}>
          {field('phone', 20, { type: 'tel', autoComplete: 'tel' })}
          {field('email', 255, {
            required: true,
            type: 'email',
            autoComplete: 'email',
            disabled: emailLocked,
          })}
          <AnimatePresence initial={false}>
            {canChangeEmail &&
              values.email.trim().toLowerCase() !== profile.email && (
                <motion.div
                  className={styles.password}
                  key="password"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: running ? 0.2 : 0 }}
                >
                  <TextField
                    id="profile-password"
                    label="รหัสผ่านปัจจุบัน"
                    type="password"
                    autoComplete="current-password"
                    required
                    fullWidth
                    value={password}
                    onChange={(event) => editor.setPassword(event.target.value)}
                    helperText="ยืนยันรหัสผ่านก่อนเปลี่ยนอีเมล"
                    slotProps={{
                      htmlInput: { maxLength: 1024, readOnly: pending },
                    }}
                  />
                </motion.div>
              )}
          </AnimatePresence>
        </div>
      </section>
      <div className={styles.actions}>
        <div className={styles.feedback} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {(failure || success || pending || dirty) && (
              <motion.p
                key={
                  failure
                    ? 'error'
                    : success
                      ? 'success'
                      : pending
                        ? 'saving'
                        : 'dirty'
                }
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: running ? 0.16 : 0 }}
                role={
                  failure ? 'alert' : success || pending ? 'status' : undefined
                }
                className={
                  failure
                    ? styles.failure
                    : success
                      ? styles.success
                      : styles.saveHint
                }
              >
                <ShellIcon
                  name={
                    failure
                      ? 'alert'
                      : success
                        ? 'check'
                        : pending
                          ? 'refresh'
                          : 'edit'
                  }
                  width={16}
                  height={16}
                />
                <span>
                  {failure ||
                    success ||
                    (pending
                      ? 'กำลังบันทึกข้อมูล…'
                      : 'มีการแก้ไขที่ยังไม่บันทึก')}
                </span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className={styles.actionButtons}>
          <Button
            type="button"
            color="inherit"
            disabled={!dirty || pending || photoPending}
            onClick={editor.cancel}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            type="submit"
            disabled={!dirty || pending || photoPending}
            loading={pending}
          >
            บันทึกการเปลี่ยนแปลง
          </Button>
        </div>
      </div>
    </form>
  );
}
