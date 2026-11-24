'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import useMediaQuery from '@mui/material/useMediaQuery';
import { z } from 'zod';
import { ShellIcon } from '@/components/shell/shell-icon';
import { submitLogout } from '@/modules/auth/presentation/logout-client';
import {
  kmuttDepartments,
  kmuttEducation,
} from '@/modules/users/domain/kmutt-education';
import type { EducationFields } from '@/modules/users/domain/profile';
import {
  AccountRequestError,
  accountRequest,
} from '@/modules/users/presentation/profile-client';
import { profileCompletionSchema } from '@/modules/users/presentation/profile-schema';
import { LoginShell } from './login-shell';
import styles from './login.module.css';

const completionResult = z.object({ completed: z.literal(true) });
type Action = 'save' | 'logout';
const faculties = Object.keys(kmuttEducation);
const noDepartment = '__no_department__';
const completionErrors = {
  studentId: 'กรุณากรอกรหัสนักศึกษาเป็นตัวเลข 8–20 หลัก',
  faculty: 'กรุณาเลือกคณะ',
  department: 'กรุณาเลือกภาควิชา',
  major: 'กรุณาเลือกสาขาวิชา',
};

function SelectChevron({ className }: { className?: string }) {
  return <ShellIcon name="chevron" className={className} />;
}

export function CompleteProfileForm({ initial }: { initial: EducationFields }) {
  const [education, setEducation] = useState({
    faculty: initial.faculty ?? '',
    department:
      initial.department ??
      (initial.major &&
      kmuttDepartments(initial.faculty ?? '')?.['']?.includes(initial.major)
        ? noDepartment
        : ''),
    major: initial.major ?? '',
  });
  const [pending, setPending] = useState<Action | null>(null);
  const [failure, setFailure] = useState('');
  const busy = useRef(false);
  const alert = useRef<HTMLDivElement>(null);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  useEffect(() => {
    if (failure) alert.current?.focus();
  }, [failure]);

  const { faculty } = education;
  const department =
    education.department === noDepartment ? '' : education.department;
  const programs = kmuttDepartments(faculty) ?? {};
  const departments = Object.keys(programs).filter(Boolean);
  const majors = Object.hasOwn(programs, department)
    ? (programs[department] ?? [])
    : [];
  const showDepartment = Boolean(departments.length || department);
  const showMajor = Boolean(
    education.major ||
    (majors.length && (!showDepartment || education.department)),
  );
  const dropdowns = [
    {
      name: 'faculty',
      label: 'คณะ',
      options: faculties,
      placeholder: 'เลือกคณะ',
      key: 'faculty',
      visible: true,
    },
    {
      name: 'department',
      label: 'ภาควิชา',
      options: departments,
      placeholder: 'เลือกภาควิชา',
      key: `department-${faculty}`,
      visible: showDepartment,
    },
    {
      name: 'major',
      label: 'สาขาวิชา',
      options: majors,
      placeholder: 'เลือกสาขาวิชา',
      key: `major-${faculty}-${education.department}`,
      visible: showMajor,
    },
  ] as const;

  function selectEducation(name: keyof typeof education, value: string) {
    switch (name) {
      case 'faculty':
        setEducation({ faculty: value, department: '', major: '' });
        break;
      case 'department':
        setEducation({ faculty, department: value, major: '' });
        break;
      case 'major':
        setEducation({ ...education, major: value });
        break;
    }
  }

  async function execute(action: Action, request: () => Promise<unknown>) {
    if (busy.current) return;
    busy.current = true;
    setPending(action);
    setFailure('');
    try {
      await request();
      window.location.replace(action === 'save' ? '/dashboard' : '/login');
    } catch (error) {
      if (error instanceof AccountRequestError && error.status === 401) {
        window.location.replace('/login');
        return;
      }
      setFailure(
        error instanceof AccountRequestError && error.status === 409
          ? 'รหัสนักศึกษานี้ถูกใช้แล้ว กรุณาตรวจสอบและลองอีกครั้ง'
          : action === 'save'
            ? 'บันทึกโปรไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง'
            : 'ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง',
      );
      busy.current = false;
      setPending(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = profileCompletionSchema.safeParse({
      studentId: new FormData(event.currentTarget).get('studentId'),
      ...education,
      department: department || null,
    });
    if (!input.success) {
      const firstField = input.error.issues[0]?.path[0];
      const field =
        firstField === 'major' && showDepartment && !education.department
          ? 'department'
          : firstField;
      setFailure(
        typeof field === 'string' && Object.hasOwn(completionErrors, field)
          ? completionErrors[field as keyof typeof completionErrors]
          : 'กรุณาตรวจสอบข้อมูลการศึกษา',
      );
      return;
    }
    void execute('save', () =>
      accountRequest('/api/v1/profile/complete', completionResult, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input.data),
      }),
    );
  }

  return (
    <LoginShell ready headingId="complete-profile-heading">
      <div className={`${styles.formContent} ${styles.completeProfile}`}>
        <h1 id="complete-profile-heading">ตั้งค่าโปรไฟล์</h1>
        <p className={styles.formIntro}>กรุณากรอกข้อมูลการศึกษาให้ครบถ้วน</p>
        <form
          className={styles.form}
          onSubmit={submit}
          aria-busy={pending === 'save'}
          noValidate
        >
          {failure && (
            <div
              className={styles.alert}
              ref={alert}
              role="alert"
              tabIndex={-1}
            >
              {failure}
            </div>
          )}
          <div className={styles.field}>
            <label htmlFor="completion-studentId">รหัสนักศึกษา</label>
            <div className={`${styles.inputWrap} ${styles.educationInput}`}>
              <input
                id="completion-studentId"
                name="studentId"
                inputMode="numeric"
                pattern="[0-9]{8,20}"
                maxLength={20}
                required
                readOnly={pending !== null}
                defaultValue={initial.studentId ?? ''}
              />
            </div>
          </div>
          {dropdowns
            .filter(({ visible }) => visible)
            .map(({ name, label, options, placeholder, key }) => {
              const value = education[name];
              const id = `completion-${name}`;
              const allowNoDepartment =
                name === 'department' &&
                (Boolean(programs['']?.length) || value === noDepartment);
              return (
                <div
                  className={`${styles.field} ${name === 'faculty' ? '' : styles.educationReveal}`}
                  key={key}
                >
                  <label id={`${id}-label`} htmlFor={id}>
                    {label}
                  </label>
                  <div
                    className={`${styles.inputWrap} ${styles.educationSelect}`}
                  >
                    <Select
                      id={id}
                      labelId={`${id}-label`}
                      name={name}
                      value={value}
                      variant="standard"
                      disableUnderline
                      displayEmpty
                      fullWidth
                      required
                      IconComponent={SelectChevron}
                      disabled={pending !== null}
                      renderValue={(selected) => (
                        <span
                          className={
                            selected ? undefined : styles.educationPlaceholder
                          }
                        >
                          {selected === noDepartment
                            ? 'ไม่ระบุภาควิชา'
                            : selected || placeholder}
                        </span>
                      )}
                      MenuProps={{
                        marginThreshold: 8,
                        transitionDuration: reduceMotion
                          ? 0
                          : { enter: 160, exit: 150 },
                        slotProps: {
                          paper: {
                            className: styles.educationMenu,
                            elevation: 4,
                          },
                        },
                      }}
                      onChange={(event) =>
                        selectEducation(name, event.target.value)
                      }
                    >
                      <MenuItem value="">{placeholder}</MenuItem>
                      {allowNoDepartment && (
                        <MenuItem value={noDepartment}>ไม่ระบุภาควิชา</MenuItem>
                      )}
                      {value &&
                        value !== noDepartment &&
                        !options.includes(value) && (
                          <MenuItem value={value}>{value}</MenuItem>
                        )}
                      {options.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </Select>
                  </div>
                </div>
              );
            })}
          <button
            type="submit"
            className={styles.submit}
            disabled={pending !== null}
          >
            {pending === 'save' ? 'กำลังบันทึก…' : 'บันทึกและไปหน้าภาพรวม'}
          </button>
        </form>
        <div className={styles.microsoftForm}>
          <button
            type="button"
            className={styles.submit}
            disabled={pending !== null}
            onClick={() =>
              void execute('logout', () =>
                submitLogout(AbortSignal.timeout(15000)),
              )
            }
          >
            {pending === 'logout' ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
          </button>
        </div>
      </div>
    </LoginShell>
  );
}
