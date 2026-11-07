export type StudentProfile = {
  userId: number;
  name: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  studentId: string | null;
  faculty: string | null;
  department: string | null;
  major: string | null;
  phone: string | null;
  avatarVersion: string | null;
};
export type ProfileInput = {
  firstName: string;
  lastName: string;
  email: string;
  studentId: string | null;
  faculty: string | null;
  department: string | null;
  major: string | null;
  phone: string | null;
  currentPassword?: string;
};
export interface ProfileRepository {
  get(userId: number): Promise<StudentProfile | null>;
  credentials(userId: number): Promise<{ email: string; hash: string } | null>;
  update(
    userId: number,
    input: ProfileInput,
    expectedHash: string,
  ): Promise<StudentProfile | null>;
  setAvatar(
    userId: number,
    data: Uint8Array | null,
    version: string | null,
  ): Promise<void>;
  avatar(userId: number): Promise<Uint8Array | null>;
}
