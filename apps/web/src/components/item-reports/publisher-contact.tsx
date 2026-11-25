import type { ReportPublisher } from '@/modules/item-reports/domain/report';

export function PublisherContact({
  publisher,
}: {
  publisher: ReportPublisher;
}) {
  return (
    <>
      <div>
        <dt>ชื่อ</dt>
        <dd>{publisher.name ?? 'ไม่ระบุชื่อ'}</dd>
      </div>
      <div>
        <dt>อีเมล</dt>
        <dd>{publisher.email}</dd>
      </div>
      <div>
        <dt>เบอร์โทรศัพท์</dt>
        <dd>{publisher.phone ?? 'ไม่ระบุเบอร์โทรศัพท์'}</dd>
      </div>
    </>
  );
}
