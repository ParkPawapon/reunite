'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { loginSchema } from '@/modules/auth/presentation/schemas';
import { submitLogin } from '@/modules/auth/presentation/login-client';
import styles from './login.module.css';

function Arrow() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 12h14m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Eye({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      {!open && (
        <path
          d="m4 3 16 18"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function LoginForm() {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [failure, setFailure] = useState('');

  useEffect(() => {
    if (document.activeElement === document.body)
      headingRef.current?.focus({ preventScroll: true });
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, []);

  useEffect(() => {
    if (failure) errorRef.current?.focus();
  }, [failure]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    setFailure('');
    const parsed = loginSchema.safeParse({
      email: emailRef.current?.value ?? '',
      password: passwordRef.current?.value ?? '',
    });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'email') next.email = 'กรุณากรอกอีเมลให้ถูกต้อง';
        if (issue.path[0] === 'password')
          next.password = 'กรุณากรอกรหัสผ่าน (ไม่เกิน 128 ตัวอักษร)';
      }
      setErrors(next);
      (next.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setErrors({});
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const result = await submitLogin(parsed.data, controller.signal);
      if (controller.signal.aborted) throw new Error('Request timed out');
      if (result.ok) {
        // Start a new document with the new session on the protected landing page.
        window.location.replace('/dashboard');
        return;
      }
      setFailure(result.message);
    } catch {
      if (request.current !== controller) return;
      setFailure('เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  }

  return (
    <div className={styles.formContent} data-login-form>
      <div className={styles.welcomeMark} aria-hidden="true">
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none">
          <path
            d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M5 7h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M3 11c5 4 13 4 18 0m-9 0v5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className={styles.formEyebrow}>ยินดีต้อนรับกลับมา</p>
      <h1 id="login-heading" ref={headingRef} tabIndex={-1}>
        เข้าสู่ระบบ
      </h1>
      <p className={styles.formIntro}>อีกนิดเดียว ก็พร้อมออกตามหาแล้ว</p>
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-busy={pending}
        className={styles.form}
      >
        {failure && (
          <div
            ref={errorRef}
            className={styles.alert}
            role="alert"
            tabIndex={-1}
          >
            {failure}
          </div>
        )}
        <div className={styles.field}>
          <label htmlFor="login-email">อีเมล</label>
          <div className={styles.inputWrap}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="m4 7 8 6 8-6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <input
              ref={emailRef}
              id="login-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              required
              maxLength={255}
              readOnly={pending}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              onChange={() => {
                if (errors.email) setErrors({ ...errors, email: undefined });
                setFailure('');
              }}
            />
          </div>
          {errors.email && (
            <p id="email-error" className={styles.fieldError}>
              {errors.email}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor="login-password">รหัสผ่าน</label>
          <div className={styles.inputWrap} data-login-password>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="5"
                y="10"
                width="14"
                height="11"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              ref={passwordRef}
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="กรอกรหัสผ่านของคุณ"
              required
              maxLength={128}
              readOnly={pending}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              onChange={() => {
                if (errors.password)
                  setErrors({ ...errors, password: undefined });
                setFailure('');
              }}
            />
            <button
              type="button"
              className={styles.showPassword}
              aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              <Eye open={showPassword} />
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className={styles.fieldError}>
              {errors.password}
            </p>
          )}
        </div>
        <button type="submit" className={styles.submit} disabled={pending}>
          <span>{pending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</span>
          {pending ? (
            <span className={styles.spinner} aria-hidden="true" />
          ) : (
            <Arrow />
          )}
        </button>
        <span className={styles.srOnly} role="status" aria-live="polite">
          {pending ? 'กำลังตรวจสอบบัญชี กรุณารอสักครู่' : ''}
        </span>
      </form>
      <a className={styles.mapLink} href="/research/kmutt-bangmod">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m9 4-6 3v14l6-3 6 3 6-3V4l-6 3-6-3Zm0 0v14m6-11v14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        <span>ดูแผนที่บางมด</span>
        <Arrow />
      </a>
    </div>
  );
}
