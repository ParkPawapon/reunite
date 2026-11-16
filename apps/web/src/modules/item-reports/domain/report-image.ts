export interface ReportImageRepository {
  ownedInfo(
    reportId: number,
    userId: number,
  ): Promise<{ hasImage: boolean } | null>;
  owns(reportId: number, userId: number): Promise<boolean>;
  get(reportId: number): Promise<Uint8Array | null>;
  setOwned(
    reportId: number,
    userId: number,
    data: Uint8Array | null,
  ): Promise<boolean>;
}
