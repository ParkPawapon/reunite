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
export type EducationFields = Pick<
  ProfileInput,
  'studentId' | 'faculty' | 'department' | 'major'
>;
export type ProfileCompletionInput = Partial<EducationFields>;
export type ProfileNames = Pick<StudentProfile, 'firstName' | 'lastName'>;
export interface ProfileRepository {
  get(userId: number): Promise<StudentProfile | null>;
  credentials(userId: number): Promise<{
    email: string;
    hash: string | null;
  } | null>;
  complete(userId: number, input: ProfileCompletionInput): Promise<void>;
  update(
    userId: number,
    input: ProfileInput,
    expectedHash: string | null,
  ): Promise<StudentProfile | null>;
  setAvatar(
    userId: number,
    data: Uint8Array | null,
    version: string | null,
  ): Promise<void>;
  avatar(userId: number): Promise<Uint8Array | null>;
}
