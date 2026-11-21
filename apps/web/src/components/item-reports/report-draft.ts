import type { ReportType } from '@/modules/item-reports/presentation/reports-client';

export type ReportDraft = {
  title: string;
  categoryId: string;
  locationId: string;
  date: string;
  time: string;
  description: string;
};

export const emptyDraft: ReportDraft = {
  title: '',
  categoryId: '',
  locationId: '',
  date: '',
  time: '',
  description: '',
};

export const DESCRIPTION_LIMIT = 10000;

export const tabCopy: Record<
  ReportType,
  {
    tab: string;
    heading: string;
    intro: string;
    titlePlaceholder: string;
    place: string;
    placePlaceholder: string;
    when: string;
    date: string;
    submit: string;
  }
> = {
  LOST: {
    tab: 'ของหาย',
    heading: 'แจ้งของหาย',
    intro: 'ระบุจุดที่เห็นของครั้งสุดท้ายและลักษณะที่จำได้',
    titlePlaceholder: 'เช่น ร่มพับสีกรมท่า',
    place: 'สถานที่หาย',
    placePlaceholder: 'เลือกอาคารหรือบริเวณ',
    when: 'วันและเวลาที่หาย',
    date: 'วันที่หาย',
    submit: 'แจ้งของหาย',
  },
  FOUND: {
    tab: 'ของที่พบ',
    heading: 'แจ้งของที่พบ',
    intro: 'ระบุจุดที่พบและลักษณะที่เจ้าของใช้สังเกตได้',
    titlePlaceholder: 'เช่น กระเป๋าผ้าสีดำ',
    place: 'สถานที่พบ',
    placePlaceholder: 'เลือกอาคารหรือบริเวณ',
    when: 'วันและเวลาที่พบ',
    date: 'วันที่พบ',
    submit: 'แจ้งของที่พบ',
  },
};
