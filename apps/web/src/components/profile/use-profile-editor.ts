'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { StudentProfile } from '@/modules/users/domain/profile';
import { profileSchema } from '@/modules/users/presentation/profile-schema';
import {
  accountRequest,
  AccountRequestError,
  studentProfileDto,
} from '@/modules/users/presentation/profile-client';
const fields = (profile: StudentProfile) => ({
  firstName: profile.firstName ?? '',
  lastName: profile.lastName ?? '',
  email: profile.email,
  studentId: profile.studentId ?? '',
  faculty: profile.faculty ?? '',
  department: profile.department ?? '',
  major: profile.major ?? '',
  phone: profile.phone ?? '',
});
export type ProfileFields = ReturnType<typeof fields>;
function message(error: unknown) {
  if (error instanceof AccountRequestError) {
    if (error.status === 401) return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
    if (error.status === 409)
      return 'อีเมลหรือรหัสนักศึกษานี้ถูกใช้แล้ว หรือข้อมูลมีการเปลี่ยนแปลง กรุณาตรวจสอบอีกครั้ง';
    if (error.code === 'PASSWORD_REQUIRED')
      return 'กรุณายืนยันรหัสผ่านปัจจุบันให้ถูกต้องเพื่อเปลี่ยนอีเมล';
    if (error.status === 429)
      return 'ลองหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่';
    if (error.status === 413) return 'รูปต้องมีขนาดไม่เกิน 2 MB';
    if (error.status === 422 || error.status === 415)
      return 'ตรวจสอบข้อมูลอีกครั้ง รูปต้องเป็น JPG, PNG หรือ WebP แบบภาพนิ่ง';
  }
  return 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง';
}
export function useProfileEditor(initial: StudentProfile) {
  const [profile, setProfile] = useState(initial);
  const [values, setValues] = useState(() => fields(initial));
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<
    Partial<Record<keyof ProfileFields, string>>
  >({});
  const [pending, setPending] = useState(false);
  const [photoPending, setPhotoPending] = useState(false);
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const formRequest = useRef<AbortController | null>(null);
  const photoRequest = useRef<AbortController | null>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(fields(profile));
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(
    () => () => {
      formRequest.current?.abort();
      photoRequest.current?.abort();
    },
    [],
  );
  function updated(result: StudentProfile) {
    setProfile(result);
    window.dispatchEvent(new Event('reunite:account-updated'));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formRequest.current || photoRequest.current) return;
    setFailure('');
    setSuccess('');
    const parsed = profileSchema.safeParse({
      ...values,
      ...(values.email.trim().toLowerCase() !== profile.email
        ? { currentPassword: password || undefined }
        : {}),
    });
    if (!parsed.success) {
      const invalid: Partial<Record<keyof ProfileFields, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && key in values)
          invalid[key as keyof ProfileFields] =
            key === 'studentId'
              ? 'ใช้ตัวเลข 8–20 หลัก'
              : key === 'phone'
                ? 'ตรวจสอบรูปแบบเบอร์โทรศัพท์'
                : 'กรุณาตรวจสอบข้อมูลช่องนี้';
      }
      setErrors(invalid);
      document.getElementById(`profile-${Object.keys(invalid)[0]}`)?.focus();
      return;
    }
    setErrors({});
    const controller = new AbortController();
    formRequest.current = controller;
    setPending(true);
    try {
      const result = await accountRequest(
        '/api/v1/profile',
        studentProfileDto,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15000),
          ]),
        },
      );
      if (!controller.signal.aborted) {
        updated(result);
        setValues(fields(result));
        setPassword('');
        setSuccess('บันทึกข้อมูลเรียบร้อยแล้ว');
      }
    } catch (error) {
      if (!controller.signal.aborted) setFailure(message(error));
    } finally {
      if (formRequest.current === controller) {
        formRequest.current = null;
        setPending(false);
      }
    }
  }
  async function photo(file?: File, remove = false) {
    if (photoRequest.current || formRequest.current) return;
    setFailure('');
    setSuccess('');
    if (
      !remove &&
      (!file ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 2 * 1024 * 1024)
    ) {
      setFailure('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB');
      return;
    }
    const controller = new AbortController();
    photoRequest.current = controller;
    setPhotoPending(true);
    try {
      const result = await accountRequest(
        '/api/v1/profile/avatar',
        studentProfileDto,
        {
          method: remove ? 'DELETE' : 'PUT',
          ...(file
            ? { body: file, headers: { 'Content-Type': file.type } }
            : {}),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15000),
          ]),
        },
      );
      if (!controller.signal.aborted) {
        updated(result);
        setSuccess(
          remove ? 'ลบรูปโปรไฟล์แล้ว' : 'บันทึกรูปโปรไฟล์เรียบร้อยแล้ว',
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) setFailure(message(error));
    } finally {
      if (photoRequest.current === controller) {
        photoRequest.current = null;
        setPhotoPending(false);
      }
      if (input.current) input.current.value = '';
    }
  }
  function change(key: keyof ProfileFields, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setSuccess('');
    setErrors((current) => ({ ...current, [key]: undefined }));
  }
  function cancel() {
    setValues(fields(profile));
    setPassword('');
    setErrors({});
    setFailure('');
    setSuccess('');
  }
  return {
    profile,
    values,
    password,
    errors,
    pending,
    photoPending,
    failure,
    success,
    input,
    dirty,
    save,
    photo,
    change,
    cancel,
    setPassword,
  };
}
export type ProfileEditor = ReturnType<typeof useProfileEditor>;
