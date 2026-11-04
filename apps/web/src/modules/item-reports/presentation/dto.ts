import type { Report } from '../domain/report';
export function reportDto(report: Report) {
  return {
    reportId: report.reportId,
    categoryId: report.categoryId,
    locationId: report.locationId,
    type: report.type,
    title: report.title,
    description: report.description,
    image: report.image,
    eventDatetime: report.eventDatetime,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}
