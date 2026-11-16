# เอกสารมอบหมายงาน Backend (BE009, BE010, BE011, BE012)

## 1. ภาพรวมการแบ่งงาน (Task Overview)

เอกสารนี้เป็นข้อกำหนดมาตรฐานระดับ **Production Enterprise Clean Architecture** สำหรับโปรเจกต์ **Reunite (`campus-lost-found`)** โดยรอบนี้มอบหมายงานให้เพื่อนร่วมทีม 2 คน **คนละ 2 TASK (TASK ละ 1 API Endpoint)** รวมทั้งหมด 4 เส้น

งานทั้ง 4 เส้นถูกออกแบบให้ **ทำงานขนานกันได้ทันทีโดยไม่มีข้อขัดแย้งของไฟล์ (Zero-Conflict Parallel Work 100%)**:

- **เพื่อนคนที่ 1 (`BE009`, `BE011`):** ทำงานเฉพาะภายในโฟลเดอร์ `apps/web/src/modules/item-reports/`
- **เพื่อนคนที่ 2 (`BE010`, `BE012`):** ทำงานเฉพาะภายในโฟลเดอร์ `apps/web/src/modules/claims/`
- โครงสร้าง Route Handler กลาง, Zod Schema, และ Starter Code ที่คืนค่า `501 NOT_IMPLEMENTED` ถูกวางไว้ให้ครบถ้วนแล้ว
- **ทั้งสองคนไม่ต้องเขียนหรือแก้ไขไฟล์ชุดทดสอบ (Automated Tests)** ทางระบบมี Guardrail Test ใน `tests/unit/guardrails.test.ts` ตรวจสอบให้อัตโนมัติ

### ตารางสรุป TASK ทั้ง 4 เส้น

| รหัส TASK   | ผู้รับผิดชอบ      | HTTP Method & Path                      | โมดูลที่รับผิดชอบ       | Branch มาตรฐาน                    | หน้าที่หลักและ Business Flow                                                            |
| :---------- | :---------------- | :-------------------------------------- | :---------------------- | :-------------------------------- | :-------------------------------------------------------------------------------------- |
| **`BE009`** | **เพื่อนคนที่ 1** | `PATCH /api/v1/item-reports/:id/status` | `modules/item-reports/` | `BE009/update-item-report-status` | เจ้าของรายงานเปลี่ยนสถานะ (`OPEN` → `RESOLVED` / `CLOSED`) เมื่อได้ของคืนหรือปิดเคส     |
| **`BE011`** | **เพื่อนคนที่ 1** | `GET /api/v1/item-reports/me`           | `modules/item-reports/` | `BE011/list-owned-item-reports`   | เรียกดูรายการ "รายงานของฉัน" แบบแบ่งหน้า เพื่อใช้ติดตามและเลือกมากดเปลี่ยนสถานะ         |
| **`BE010`** | **เพื่อนคนที่ 2** | `PATCH /api/v1/claims/:id/status`       | `modules/claims/`       | `BE010/update-claim-status`       | เจ้าของรายงานพบของพิจารณาอนุมัติ/ปฏิเสธคำขอเคลม (`APPROVED` / `REJECTED`) พร้อมหมายเหตุ |
| **`BE012`** | **เพื่อนคนที่ 2** | `GET /api/v1/item-reports/:id/claims`   | `modules/claims/`       | `BE012/list-report-claims`        | เจ้าของรายงานดึงดูรายการคำขอเคลมทั้งหมดที่ส่งเข้ามายังสิ่งของชิ้นนี้ พร้อมหลักฐาน       |

---

## 2. โครงสร้าง Repository: FE เขียนตรงไหน และ BE เขียนตรงไหน

โปรเจกต์นี้เป็น **Modular Monolith** บน Next.js App Router แอปพลิเคชันเดียว (`apps/web`) ร่วมกับแพ็กเกจฐานข้อมูล (`packages/database`) และแพ็กเกจข้อมูลกลาง (`packages/shared`):

| ฝั่ง              | เลเยอร์ (Layer)             | ตำแหน่งโฟลเดอร์                                                                                    | ความรับผิดชอบ                                                                                         |
| :---------------- | :-------------------------- | :------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **FE (Frontend)** | หน้าเว็บและ UI Components   | `apps/web/src/app/{dashboard,login,profile}/`<br>`apps/web/src/components/{dashboard,shell,auth}/` | แสดงผลหน้าจอ ปุ่ม ฟอร์ม การเคลื่อนไหว (Agent Honk) และรับการกดจากผู้ใช้                               |
| **BE (Backend)**  | **1. Route Handlers**       | `apps/web/src/app/api/v1/**/route.ts`                                                              | จุดรับคำขอ HTTP และส่งต่อไปยัง Handler **(ห้ามเขียน SQL หรือ Logic ในไฟล์นี้)**                       |
| **BE (Backend)**  | **2. Presentation Layer**   | `apps/web/src/modules/*/presentation/*.ts`                                                         | ตรวจสอบสิทธิ์ผู้ใช้ (`requireUser`), ตรวจค่าด้วย Zod (`parse`), และแปลงผลลัพธ์ผ่าน `reportDto`        |
| **BE (Backend)**  | **3. Application Layer**    | `apps/web/src/modules/*/application/*-service.ts`                                                  | ควบคุมกฎเกณฑ์ทางธุรกิจ เช่น ตรวจสิทธิ์ความเป็นเจ้าของ, โยน `AppError(404)` **(ห้าม import database)** |
| **BE (Backend)**  | **4. Domain Layer**         | `apps/web/src/modules/*/domain/*.ts`                                                               | นิยาม Entity Types และข้อตกลง Interface ของ Repository                                                |
| **BE (Backend)**  | **5. Infrastructure Layer** | `apps/web/src/modules/*/infrastructure/pg-*-repository.ts`                                         | เขียนคำสั่ง Parameterized SQL (`$1, $2`) ดึงข้อมูลจริงจาก PostgreSQL                                  |

---

## 3. บทสั่งงานเพื่อนทั้ง 2 คน (Copy ไปใช้สั่งงานได้ทันที)

### 3.1 บทสั่งงานเพื่อนคนที่ 1 (รับผิดชอบ `BE009` และ `BE011` — โมดูล `item-reports`)

> “เฮ้ยเพื่อน รอบนี้ต่องานของนายในโมดูล **รายงานของหายและของที่พบ (`item-reports`)** จำนวน 2 TASK ต่อเนื่องกัน คือ `BE009` และ `BE011` ทำเฉพาะในโมดูลของนายเองได้เลย:
>
> 1. **งานแรก `BE009` (`PATCH /api/v1/item-reports/:id/status`):**
>    - **ที่มาและความจำเป็น:** ก่อนหน้านี้ Route `PATCH /api/v1/item-reports/:id` ล็อกไม่ให้แก้ `status` ทำให้เจ้าของโพสต์ที่เจอกระเป๋าหรือได้ของคืนแล้ว ไม่สามารถปิดเคสเป็น `RESOLVED` หรือ `CLOSED` ได้เลย ข้อมูลจึงค้างที่ `OPEN` ตลอดไป
>    - **สิ่งที่นายต้องทำ:** ตรวจสิทธิ์ว่าผู้เรียกต้องล็อกอินและเป็นเจ้าของรายงาน รับ JSON Body `{ "status": "RESOLVED" }` หรือ `{ "status": "CLOSED" }` เปลี่ยนสถานะเฉพาะรายการที่ยังเป็น `OPEN` เท่านั้น ถ้าเป็นของคนอื่นหรือปิดไปแล้ว ให้ตอบ `404 NOT_FOUND` (Non-disclosing 404 เพื่อความปลอดภัย) และส่งผลลัพธ์ผ่าน `reportDto` เสมอ
>    - **จุดที่แก้:** ไปเขียน Business Logic ใน `ReportService.updateStatus` และ SQL ใน `PgReportRepository.updateStatusOwned`
> 2. **งานที่สอง `BE011` (`GET /api/v1/item-reports/me`):**
>    - **ที่มาและความจำเป็น:** เดิมที `GET /api/v1/item-reports` เป็น Public Feed ของทุกคนในมหาวิทยาลัย และถูกตัด `userId` ทิ้งเพื่อความเป็นส่วนตัว ทำให้ผู้ใช้ไม่มีหน้าดูว่า 'ฉันเคยแจ้งของหายหรือของที่พบอะไรไว้บ้าง?' จึงตามสถานะหรือหา ID ของตัวเองมากดปิดเคสใน BE009 ไม่ได้
>    - **สิ่งที่นายต้องทำ:** ตรวจสิทธิ์เซสชัน ดึงรายการรายงานที่เป็นของตัวเอง (`WHERE user_id = $1`) แบบแบ่งหน้า (`limit`, `offset`) เรียงจาก `report_id DESC` ส่งผลลัพธ์กลับใน Envelope มาตรฐานพร้อม `meta` และแปลงผ่าน `reportDto`
>    - **จุดที่แก้:** ไปเขียน Business Logic ใน `ReportService.listOwned` และ SQL ใน `PgReportRepository.listOwned`
>
> โครงสร้างไฟล์ Route, Schema, และ 501 Starter Code ถูกเชื่อมต่อให้เรียบร้อยแล้ว นายเขียนเฉพาะใน `apps/web/src/modules/item-reports/` ได้ทันที ไม่ต้องแตะต้องโฟลเดอร์อื่น!”

---

### 3.2 บทสั่งงานเพื่อนคนที่ 2 (รับผิดชอบ `BE010` และ `BE012` — โมดูล `claims`)

> “เฮ้ยเพื่อน รอบนี้ต่องานของนายในโมดูล **คำขอรับของคืน (`claims`)** จำนวน 2 TASK ต่อเนื่องกัน คือ `BE010` และ `BE012` ทำเฉพาะในโมดูลของนายเองได้เลย:
>
> 1. **งานแรก `BE010` (`PATCH /api/v1/claims/:id/status`):**
>    - **ที่มาและความจำเป็น:** ก่อนหน้านี้ผู้ใช้ส่งคำขอเคลมได้ แต่เจ้าของของที่เก็บได้ (Report Owner) ไม่มี Endpoint ในการกดอนุมัติหรือปฏิเสธคำขอเคลมนั้น ทำให้สถานะค้างอยู่ที่ `PENDING` ตลอด
>    - **สิ่งที่นายต้องทำ:** ตรวจสิทธิ์ว่าต้องเป็นเจ้าของรายงานแจ้งพบของ (`item_reports.user_id = session.userId`) รับ Body `{ "status": "APPROVED" | "REJECTED", "resolutionNote"?: string | null }` พิจารณาเฉพาะคำขอที่สถานะยังเป็น `PENDING` เท่านั้น เมื่อตัดสินแล้วบันทึกสถานะใหม่ พร้อม `resolution_note`, `resolved_by = session.userId` และ `updated_at = NOW()` หากไม่ใช่เจ้าของรายงานหรือเคลมถูกตัดสินไปแล้ว ให้ตอบ `404 NOT_FOUND`
>    - **จุดที่แก้:** ไปเขียน Business Logic ใน `ClaimService.updateStatus` และ SQL ใน `PgClaimRepository.reviewReportClaim`
> 2. **งานที่สอง `BE012` (`GET /api/v1/item-reports/:id/claims`):**
>    - **ที่มาและความจำเป็น:** เพื่อให้เจ้าของรายงานสามารถดูได้ว่า 'ของชิ้นนี้ที่ฉันเก็บได้ มีใครส่งคำขอเคลมเข้ามาบ้าง และส่งหลักฐาน (evidence) อะไรมา?' ก่อนที่จะนำ Claim ID ไปกดอนุมัติ/ปฏิเสธใน BE010
>    - **สิ่งที่นายต้องทำ:** ตรวจสิทธิ์ผู้เรียกต้องล็อกอิน และต้องเป็นเจ้าของรายงาน `id` นั้น (`r.user_id = session.userId`) ดึงรายการเคลมทั้งหมดที่ยื่นเข้ามาที่รายงานชิ้นนี้แบบแบ่งหน้า (`limit`, `offset`) เรียงจาก `claim_id DESC` หากผู้เรียกไม่ได้เป็นเจ้าของรายงานชิ้นนี้ ให้ตอบ `404 NOT_FOUND` เพื่อความปลอดภัย
>    - **จุดที่แก้:** ไปเขียน Business Logic ใน `ClaimService.listForReport` และ SQL ใน `PgClaimRepository.listForReportOwner`
>
> ฐานข้อมูล Migration 0008 ถูกรันแล้ว และโครงสร้างไฟล์ Route, Presentation, และ 501 Starter Code ถูกเชื่อมต่อให้ครบแล้ว นายลุยเขียน Service และ SQL ใน `apps/web/src/modules/claims/` ได้ทันที!”

---

## 4. ตารางอธิบายคำศัพท์เทคนิค (Technical Glossary สำหรับทีม)

| คำศัพท์เทคนิค                    | ความหมายแบบเข้าใจง่าย                                                                                                | ตัวอย่างในโปรเจกต์นี้                                                      |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------- |
| **API Endpoint**                 | ช่องทางรับคำขอของเซิร์ฟเวอร์ ประกอบด้วย HTTP Method + URL Path                                                       | `PATCH /api/v1/item-reports/:id/status` หรือ `GET /api/v1/item-reports/me` |
| **State Machine / Lifecycle**    | กฎการเปลี่ยนสถานะของข้อมูล เช่น เริ่มจาก `OPEN` เปลี่ยนเป็น `RESOLVED` หรือ `CLOSED` ได้เพียงทางเดียว ห้ามย้อนกลับ   | ควบคุมใน `BE009` และ `BE010`                                               |
| **Non-disclosing 404**           | การตอบ `404 NOT_FOUND` แทน `403 FORBIDDEN` เมื่อเข้าถึงข้อมูลคนอื่น เพื่อไม่ให้รู้ว่ามีรหัสข้อมูลนั้นอยู่จริงหรือไม่ | ป้องกันการแอบส่องเคลมและรายงานของผู้อื่น                                   |
| **Parameterized SQL (`$1, $2`)** | การเขียนคำสั่ง SQL โดยส่งตัวแปรแยกจากคำสั่ง เพื่อป้องกันช่องโหว่ SQL Injection 100%                                  | คำสั่งใน `PgReportRepository` และ `PgClaimRepository`                      |
| **DTO (Data Transfer Object)**   | รูปแบบข้อมูลที่คัดเฉพาะฟิลด์ที่ปลอดภัยสำหรับส่งออกทาง API                                                            | `reportDto(report)` ตัด `userId` ออกก่อนส่งให้สาธารณะ                      |
| **501 NOT_IMPLEMENTED**          | โค้ดตั้งต้นที่สร้างเส้นทางและเชื่อมต่อระบบไว้แล้ว เพื่อรอให้ผู้พัฒนาเข้ามาเติม Business Logic & SQL จริง             | สัญญาตั้งต้นของทั้ง 4 TASK                                                 |

---

## 5. ข้อกำหนดทางวิศวกรรมราย TASK (Detailed Technical Specifications)

### 5.1 TASK 1 (เพื่อนคนที่ 1): `BE009` — เปลี่ยนสถานะของรายงานแจ้งของหาย/ของที่พบ

- **รหัส TASK:** `BE009` — Implement Owner-Scoped Item Report Status Lifecycle Endpoint
- **Branch มาตรฐาน:** `BE009/update-item-report-status`
- **Commit Message ที่แนะนำ:** `feat(item-reports): implement owner status transition endpoint`
- **Endpoint:** `PATCH /api/v1/item-reports/:id/status`
- **การยืนยันตัวตน:** บังคับ Session Cookie (`requireUser`) + ตรวจ Origin ตรงกับระบบ (`mutation`)
- **ไฟล์ที่ต้องพัฒนาต่อ (เฉพาะใน `apps/web/src/modules/item-reports/`):**
  1. `application/report-service.ts`: แก้ไขเมธอด `updateStatus(id: number, userId: number, status: 'RESOLVED' | 'CLOSED')`
  2. `infrastructure/pg-report-repository.ts`: เขียนคำสั่ง SQL ใน `updateStatusOwned(id, userId, status)`

#### กฎทางธุรกิจและ SQL ใน `updateStatusOwned`:

```sql
UPDATE item_reports
SET status = $3, updated_at = NOW()
WHERE report_id = $1 AND user_id = $2 AND status = 'OPEN'
RETURNING report_id, user_id, category_id, location_id, type, title,
          description, image, event_datetime, status, created_at, updated_at
```

- หากสำเร็จ คืนค่า `reportDto(report)` (`200 OK`)
- หากรายงานไม่ใช่ของตนเอง, หาไม่เจอ, หรือไม่ได้อยู่ในสถานะ `OPEN` ให้ตอบ `404 NOT_FOUND`

#### ตัวอย่าง Request Body:

```json
{
  "status": "RESOLVED"
}
```

_(รับเฉพาะ `"RESOLVED"` หรือ `"CLOSED"` เท่านั้น หากส่งค่าอื่นจะถูกปฏิเสธด้วย `422 VALIDATION_ERROR`)_

---

### 5.2 TASK 2 (เพื่อนคนที่ 1): `BE011` — เรียกดูรายการรายงานของตนเอง (My Reports)

- **รหัส TASK:** `BE011` — Implement Authenticated Own Item Reports Listing Endpoint
- **Branch มาตรฐาน:** `BE011/list-owned-item-reports`
- **Commit Message ที่แนะนำ:** `feat(item-reports): implement own reports listing endpoint`
- **Endpoint:** `GET /api/v1/item-reports/me`
- **การยืนยันตัวตน:** บังคับ Session Cookie (`requireUser`) + `Cache-Control: no-store`
- **ไฟล์ที่ต้องพัฒนาต่อ (เฉพาะใน `apps/web/src/modules/item-reports/`):**
  1. `application/report-service.ts`: แก้ไขเมธอด `listOwned(userId: number, page: Page)` ให้เรียก `repository.listOwned`
  2. `infrastructure/pg-report-repository.ts`: เขียนคำสั่ง SQL ใน `listOwned(userId, page)`

#### คำสั่ง SQL ใน `listOwned`:

```sql
SELECT report_id, user_id, category_id, location_id, type, title,
       description, image, event_datetime, status, created_at, updated_at
FROM item_reports
WHERE user_id = $1
ORDER BY report_id DESC
LIMIT $2 OFFSET $3
```

- รับ Query Parameters: `limit` (1–100, default 20) และ `offset` (0–100000, default 0)
- ส่งผลลัพธ์ผ่าน `reportDto` พร้อม `meta: { limit, offset }` (`200 OK`)

---

### 5.3 TASK 1 (เพื่อนคนที่ 2): `BE010` — พิจารณาอนุมัติหรือปฏิเสธคำขอเคลม

- **รหัส TASK:** `BE010` — Implement Report-Owner Claim Review & Decision Endpoint
- **Branch มาตรฐาน:** `BE010/update-claim-status`
- **Commit Message ที่แนะนำ:** `feat(claims): implement report owner claim decision endpoint`
- **Endpoint:** `PATCH /api/v1/claims/:id/status`
- **การยืนยันตัวตน:** บังคับ Session Cookie (`requireUser`) + ตรวจ Origin ตรงกับระบบ (`mutation`)
- **การรองรับฐานข้อมูล:** มี Migration `0008_claim_resolution.sql` รองรับ `resolution_note` และ `resolved_by` เรียบร้อยแล้ว
- **ไฟล์ที่ต้องพัฒนาต่อ (เฉพาะใน `apps/web/src/modules/claims/`):**
  1. `application/claim-service.ts`: แก้ไขเมธอด `updateStatus(id, reportOwnerId, decision)`
  2. `infrastructure/pg-claim-repository.ts`: เขียนคำสั่ง SQL ใน `reviewReportClaim(claimId, reportOwnerId, decision)`

#### คำสั่ง SQL ใน `reviewReportClaim`:

```sql
UPDATE claims c
SET status = $3,
    resolution_note = $4,
    resolved_by = $2,
    updated_at = NOW()
FROM item_reports r
WHERE c.report_id = r.report_id
  AND c.claim_id = $1
  AND r.user_id = $2
  AND c.status = 'PENDING'
RETURNING c.claim_id, c.report_id, c.user_id, c.evidence, c.status,
          c.resolution_note, c.resolved_by, c.claim_date, c.updated_at
```

- ผู้ล็อกอินต้องเป็นเจ้าของ `item_reports` (`r.user_id = $2`) เท่านั้น
- คำขอเคลมต้องอยู่ในสถานะ `PENDING` เท่านั้น หากไม่ใช่เจ้าของหรือเคลมถูกตัดสินแล้ว ตอบ `404 NOT_FOUND`

#### ตัวอย่าง Request Body:

```json
{
  "status": "APPROVED",
  "resolutionNote": "หลักฐานตรงกับบัตรนักศึกษาที่พบ ส่งมอบของคืนเรียบร้อยแล้ว"
}
```

---

### 5.4 TASK 2 (เพื่อนคนที่ 2): `BE012` — เรียกดูรายการคำขอเคลมที่ส่งเข้ามายังรายงานของตนเอง

- **รหัส TASK:** `BE012` — Implement Report-Owner Incoming Claims Listing Endpoint
- **Branch มาตรฐาน:** `BE012/list-report-claims`
- **Commit Message ที่แนะนำ:** `feat(claims): implement report incoming claims listing endpoint`
- **Endpoint:** `GET /api/v1/item-reports/:id/claims`
- **การยืนยันตัวตน:** บังคับ Session Cookie (`requireUser`) + `Cache-Control: no-store`
- **ไฟล์ที่ต้องพัฒนาต่อ (เฉพาะใน `apps/web/src/modules/claims/`):**
  1. `application/claim-service.ts`: แก้ไขเมธอด `listForReport(reportId, reportOwnerId, page)`
  2. `infrastructure/pg-claim-repository.ts`: เขียนคำสั่ง SQL ใน `listForReportOwner(reportId, reportOwnerId, page)`

#### คำสั่ง SQL ใน `listForReportOwner`:

```sql
-- ตรวจสอบก่อนว่ารายงานนี้เป็นของผู้ใช้จริงหรือไม่ หากไม่ใช่ให้ตอบ 404
-- จากนั้นดึงรายการเคลมของรายงานนั้น:
SELECT c.claim_id, c.report_id, c.user_id, c.evidence, c.status,
       c.resolution_note, c.resolved_by, c.claim_date, c.updated_at
FROM claims c
WHERE c.report_id = $1
ORDER BY c.claim_id DESC
LIMIT $2 OFFSET $3
```

- ผู้มีสิทธิ์ดูรายการเคลม ต้องเป็นเจ้าของรายงาน `report_id` นั้นเท่านั้น
- คืนค่ารายการคำขอเคลมพร้อมหลักฐาน (`evidence`) และสถานะปัจจุบัน เพื่อใช้ในการตัดสินใจ (`200 OK`)

---

## 6. การเตรียมฐานข้อมูลและรันเซิร์ฟเวอร์ในเครื่อง (Local Setup)

ก่อนเริ่มทดสอบ API ให้รันคำสั่งต่อไปนี้จากรากของโปรเจกต์:

```sh
bun run env:setup
docker compose up -d postgres
bun run db:migrate
bun run db:seed --development-only
bun run dev
```

ข้อมูลตัวอย่างในระบบจะถูกเตรียมไว้ให้พร้อมทดสอบทันที:

- บัญชีหลัก `demo@reunite.test` (รหัสผ่านสุ่มอยู่ใน `tmp/local-seed/login-account.json`)
- บัญชีเปรียบเทียบ `peer@reunite.test` (สำหรับทดสอบ Non-disclosing 404 เมื่อเรียกดูข้อมูลของผู้อื่น)
- ข้อมูล `item_reports` (สถานะ `OPEN`, `RESOLVED`, `CLOSED`)
- ข้อมูล `claims` (สถานะ `PENDING`, `APPROVED`)

---

## 7. รายการตรวจสอบก่อนส่งงาน (Definition of Done & PR Checklist)

ผู้รับผิดชอบแต่ละ TASK ต้องตรวจสอบรายการต่อไปนี้ก่อนเปิด Pull Request:

1. **การแยก Branch ตามชื่อมาตรฐาน:**
   - `BE009/update-item-report-status`
   - `BE011/list-owned-item-reports`
   - `BE010/update-claim-status`
   - `BE012/list-report-claims`
2. **การตรวจสอบคุณภาพโค้ด (ต้องผ่าน 0 Warnings / 0 Errors):**
   ```sh
   bun run format:check
   bun run lint
   bun run typecheck
   bun run test:unit
   ```
3. **ขอบเขตไฟล์ที่แก้ไข:**
   - เพื่อนคนที่ 1 แก้ไขเฉพาะไฟล์ใน `apps/web/src/modules/item-reports/`
   - เพื่อนคนที่ 2 แก้ไขเฉพาะไฟล์ใน `apps/web/src/modules/claims/`
   - ห้ามแก้ไขไฟล์ Test (`tests/`) หรือไฟล์ Migration (`packages/database/migrations/`)
4. **หลักฐานการทดสอบด้วย Postman หรือ curl:**
   - **`BE009`:** อัปเดตรายงานของตนเองจาก `OPEN` ไปเป็น `RESOLVED`/`CLOSED` ได้ `200 OK`, อัปเดตของคนอื่นได้ `404 NOT_FOUND`
   - **`BE011`:** ล็อกอินแล้วเรียกดูรายงานของตนเองได้ `200 OK` พร้อม `meta`, ไม่ส่งคุกกี้ได้ `401 UNAUTHORIZED`
   - **`BE010`:** เจ้าของรายงานพิจารณาเคลม `PENDING` ได้ `200 OK`, ผู้เคลมอนุมัติตัวเองได้ `404 NOT_FOUND`
   - **`BE012`:** เจ้าของรายงานเรียกดูเคลมของตนเองได้ `200 OK`, คนอื่นเรียกดูรายงานที่ไม่ใช่ของตนได้ `404 NOT_FOUND`
