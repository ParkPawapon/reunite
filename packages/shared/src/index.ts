export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
export type Page = { limit: number; offset: number };
export type ReportType = 'LOST' | 'FOUND';
export type ReportStatus = 'OPEN' | 'RESOLVED' | 'CLOSED';
export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export { normalizeEmail } from './email';
