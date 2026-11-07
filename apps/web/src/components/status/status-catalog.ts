export const statusCatalog = {
  '301': {
    title: 'สถานีนี้ย้ายแล้ว',
    description: 'ปลายทางมีที่อยู่ถาวรใหม่ เลือกไปต่อเพื่อออกเดินทางอีกครั้ง',
    label: 'Moved permanently',
    scene: 'postbox',
    action: 'ไปยังหน้าภาพรวม',
  },
  '302': {
    title: 'วันนี้ใช้ทางเบี่ยง',
    description: 'ปลายทางเปลี่ยนชั่วคราว ยังเดินทางต่อจากหน้าภาพรวมได้',
    label: 'Found',
    scene: 'detour',
    action: 'ไปต่อ',
  },
  '303': {
    title: 'ไปดูผลกันต่อ',
    description: 'ขั้นตอนนี้พาไปยังอีกหน้าหนึ่ง เลือกไปต่อเพื่อเปิดหน้าภาพรวม',
    label: 'See other',
    scene: 'receipt',
    action: 'ไปต่อ',
  },
  '307': {
    title: 'เปลี่ยนชานชาลาสักครู่',
    description:
      'เส้นทางนี้เปลี่ยนปลายทางชั่วคราว เรามาเริ่มต่อจากหน้าภาพรวมกัน',
    label: 'Temporary redirect',
    scene: 'bridge',
    action: 'ไปยังหน้าภาพรวม',
  },
  '308': {
    title: 'ปักหมุดใหม่ให้แล้ว',
    description: 'เส้นทางเปลี่ยนอย่างถาวร เริ่มต้นต่อจากหน้าภาพรวมได้เลย',
    label: 'Permanent redirect',
    scene: 'signpost',
    action: 'ไปยังหน้าภาพรวม',
  },
  '400': {
    title: 'เบาะแสยังไม่เข้าที่',
    description: 'คำขอนี้อ่านได้ไม่ครบ กลับไปตรวจข้อมูลแล้วลองส่งอีกครั้งนะ',
    label: 'Bad request',
    scene: 'papers',
    action: 'กลับหน้าภาพรวม',
  },
  '401': {
    title: 'ขอดูบัตรก่อนนะ',
    description: 'เข้าสู่ระบบอีกครั้ง แล้วเราจะพาไปหาของสำคัญต่อ',
    label: 'Authentication required',
    scene: 'badge',
    action: 'เข้าสู่ระบบ',
  },
  '403': {
    title: 'เขตนี้ยังเข้าไม่ได้',
    description:
      'บัญชีนี้ไม่มีสิทธิ์เปิดหน้านี้ กลับไปยังพื้นที่ที่ใช้งานได้ก่อนนะ',
    label: 'Access restricted',
    scene: 'gate',
    action: 'กลับหน้าภาพรวม',
  },
  '404': {
    title: 'เอ… หน้านี้อยู่ไหนนะ',
    description:
      'เราหาหน้านี้ไม่เจอ อาจพิมพ์ลิงก์คลาดไปนิด กลับมาตั้งต้นด้วยกันนะ',
    label: 'Page not found',
    scene: 'trail',
    action: 'กลับหน้าภาพรวม',
  },
  '408': {
    title: 'เบาะแสมาช้าไปหน่อย',
    description: 'คำขอใช้เวลานานเกินไป ตรวจการเชื่อมต่อแล้วลองอีกครั้งได้เลย',
    label: 'Request timeout',
    scene: 'hourglass',
    action: 'ลองอีกครั้ง',
  },
  '405': {
    title: 'ทางนี้ใช้วิธีนี้ไม่ได้',
    description:
      'หน้านี้ไม่รองรับวิธีที่ส่งคำขอมา ลองกลับไปเริ่มจากหน้าภาพรวมก่อนนะ',
    label: 'Method not allowed',
    scene: 'turnstile',
    action: 'กลับหน้าภาพรวม',
  },
  '409': {
    title: 'เบาะแสชนกันพอดี',
    description:
      'ข้อมูลนี้ขัดกับข้อมูลที่มีอยู่ ลองตรวจรายการเดิมก่อนบันทึกอีกครั้งนะ',
    label: 'Conflict',
    scene: 'compare',
    action: 'กลับหน้าภาพรวม',
  },
  '410': {
    title: 'ตรงนี้ไม่มีแล้วนะ',
    description: 'หน้านี้ถูกนำออกแล้ว เริ่มตามหาจากหน้าภาพรวมได้เสมอ',
    label: 'Gone',
    scene: 'empty-frame',
    action: 'กลับหน้าภาพรวม',
  },
  '413': {
    title: 'กระเป๋าใบนี้ใหญ่ไปนิด',
    description: 'ไฟล์หรือข้อมูลมีขนาดเกินที่รับได้ ลองลดขนาดก่อนส่งอีกครั้งนะ',
    label: 'Payload too large',
    scene: 'suitcase',
    action: 'กลับหน้าภาพรวม',
  },
  '415': {
    title: 'แฟ้มนี้เปิดไม่ได้',
    description:
      'รูปแบบไฟล์ยังไม่รองรับ เลือกชนิดไฟล์ที่หน้าฟอร์มระบุแล้วลองใหม่',
    label: 'Unsupported media type',
    scene: 'folder',
    action: 'กลับหน้าภาพรวม',
  },
  '422': {
    title: 'ยังขาดอีกชิ้นหนึ่ง',
    description:
      'ข้อมูลบางช่องยังไม่ถูกต้อง กลับไปตรวจข้อความใต้ช่องกรอกอีกครั้งนะ',
    label: 'Validation needed',
    scene: 'puzzle',
    action: 'กลับหน้าภาพรวม',
  },
  '429': {
    title: 'ทีละนิด เดี๋ยวได้ไปต่อ',
    description: 'มีคำขอเข้ามาต่อเนื่อง พักสักครู่แล้วค่อยลองอีกครั้งนะ',
    label: 'Too many requests',
    scene: 'queue',
    action: 'กลับหน้าภาพรวม',
  },
  '500': {
    title: 'เบาะแสพันกันนิดหน่อย',
    description:
      'ระบบทำงานสะดุด ลองใหม่อีกครั้ง หรือกลับไปเริ่มจากหน้าภาพรวมได้',
    label: 'Something went wrong',
    scene: 'tangle',
    action: 'ลองอีกครั้ง',
  },
  '502': {
    title: 'สัญญาณยังมาไม่ถึง',
    description:
      'ระบบที่เชื่อมต่อกันตอบกลับไม่สมบูรณ์ ลองใหม่อีกครั้งในอีกสักครู่นะ',
    label: 'Bad gateway',
    scene: 'radio',
    action: 'ลองอีกครั้ง',
  },
  '501': {
    title: 'ส่วนนี้ยังต่อไม่เสร็จ',
    description:
      'ระบบยังไม่รองรับการทำงานส่วนนี้ กลับไปใช้พื้นที่ที่พร้อมแล้วได้ก่อนนะ',
    label: 'Not implemented',
    scene: 'blueprint',
    action: 'กลับหน้าภาพรวม',
  },
  '503': {
    title: 'สถานีขอพักสักครู่',
    description: 'บริการยังไม่พร้อมใช้งานตอนนี้ กลับมาลองใหม่ได้ในอีกสักครู่',
    label: 'Service unavailable',
    scene: 'tea',
    action: 'ลองอีกครั้ง',
  },
  '504': {
    title: 'รอคำตอบนานไปหน่อย',
    description: 'ระบบที่เรารออยู่ยังไม่ตอบกลับ ลองใหม่อีกครั้งเมื่อพร้อมนะ',
    label: 'Gateway timeout',
    scene: 'clock',
    action: 'ลองอีกครั้ง',
  },
} as const;
export type StatusCode = keyof typeof statusCatalog;
export type StatusSceneName = (typeof statusCatalog)[StatusCode]['scene'];
export const statusCodes = Object.keys(statusCatalog) as StatusCode[];
export function isStatusCode(code: string): code is StatusCode {
  return Object.hasOwn(statusCatalog, code);
}
