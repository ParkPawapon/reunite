export type ReportImageAccess = {
  hasImage: boolean;
  imageCount: number;
  maxImages: number;
  slots: number[];
};

export type ReportImageMutationResult = ReportImageAccess & {
  updated: true;
};

export type ReportImageWriteSlot = 1 | 2 | 3 | 'next';
export type ReportImageDeleteSlot = 1 | 2 | 3 | 'all';

export interface ReportImageRepository {
  ownedInfo(
    reportId: number,
    userId: number,
  ): Promise<ReportImageAccess | null>;
  listPublicInfo(reportId: number): Promise<{
    imageCount: number;
    slots: number[];
  } | null>;
  owns(reportId: number, userId: number): Promise<boolean>;
  get(reportId: number, slot?: 1 | 2 | 3): Promise<Uint8Array | null>;
  setOwned(
    reportId: number,
    userId: number,
    data: Uint8Array,
    slot?: ReportImageWriteSlot,
  ): Promise<ReportImageAccess | 'full' | null>;
  deleteOwned(
    reportId: number,
    userId: number,
    slot?: ReportImageDeleteSlot,
  ): Promise<ReportImageAccess | null>;
}
