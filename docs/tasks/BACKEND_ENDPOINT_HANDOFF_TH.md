# เอกสารมอบหมายงานและข้อกำหนดทางวิศวกรรม Backend (BE002–BE003 และ BE005–BE008)

## 1. ภาพรวมและสถานะปัจจุบันของงาน Backend Handoff

เอกสารนี้เป็นข้อกำหนดมาตรฐานระดับ Production Enterprise ตามสถาปัตยกรรม Clean / Hexagonal Modular Monolith ของโปรเจกต์ **Reunite (`campus-lost-found`)** สำหรับการกระจายงานพัฒนา API Endpoint ให้ทีมพัฒนาฝั่ง Backend โดยไม่ต้องทำส่วนหน้าเว็บ (Frontend) และไม่ต้องเขียนหรือแก้ไขชุดทดสอบอัตโนมัติ (Automated Tests)

### สรุปสถานะงานทั้งหมดในชุดส่งมอบ

| รหัส TASK | ผู้รับผิดชอบ                   | HTTP Method & Endpoint         | โมดูล (`apps/web/src/modules/*`) | Branch มาตรฐาน                 | สถานะปัจจุบัน                                              |
| --------- | ------------------------------ | ------------------------------ | -------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| **BE002** | สมาชิกทีม (รอบก่อนหน้า)        | `GET /api/v1/categories`       | `modules/categories/`            | `BE002/list-item-categories`   | รวมงานแล้วใน PR #21 (200 / 404 ตามสัญญา)                   |
| **BE003** | สมาชิกทีม (รอบก่อนหน้า)        | `GET /api/v1/locations`        | `modules/locations/`             | `BE003/list-report-locations`  | **เสร็จสมบูรณ์และรวมเข้า `main` แล้ว (PR #12)** (`200 OK`) |
| **BE005** | **เพื่อนคนที่ 1 (TASK ที่ 1)** | `GET /api/v1/item-reports`     | `modules/item-reports/`          | `BE005/list-item-reports`      | รวมงานแล้วใน PR #22 (200 / 404 ตามสัญญา)                   |
| **BE006** | **เพื่อนคนที่ 1 (TASK ที่ 2)** | `GET /api/v1/item-reports/:id` | `modules/item-reports/`          | `BE006/get-item-report-detail` | รวมงานแล้วใน PR #23 (200 / 404 ตามสัญญา)                   |
| **BE007** | **เพื่อนคนที่ 2 (TASK ที่ 1)** | `GET /api/v1/claims`           | `modules/claims/`                | `BE007/list-owned-claims`      | **เปิดงานรอบใหม่ (`501 NOT_IMPLEMENTED`)**                 |
| **BE008** | **เพื่อนคนที่ 2 (TASK ที่ 2)** | `GET /api/v1/claims/:id`       | `modules/claims/`                | `BE008/get-owned-claim-detail` | **เปิดงานรอบใหม่ (`501 NOT_IMPLEMENTED`)**                 |

> **หลักการออกแบบเพื่อให้ทั้ง 2 คนทำงานขนานกันได้ทันที (Zero-Conflict Parallel Work):**
>
> - **เพื่อนคนที่ 1 (`BE005`, `BE006`)** ทำงานเฉพาะภายในโฟลเดอร์ `apps/web/src/modules/item-reports/` เท่านั้น
> - **เพื่อนคนที่ 2 (`BE007`, `BE008`)** ทำงานเฉพาะภายในโฟลเดอร์ `apps/web/src/modules/claims/` เท่านั้น
> - ส่วนเชื่อมต่อกลางใน `apps/web/src/lib/http/handlers.ts`, `apps/web/src/lib/composition.ts` และไฟล์ Route (`apps/web/src/app/api/v1/**/route.ts`) ถูกผูกเข้ากับฟังก์ชันแยกของแต่ละงานไว้เรียบร้อยแล้ว **ทั้งสองคนจึงไม่ต้องแก้ไขไฟล์กลางร่วมกัน และสามารถทำ TASK ของตนเองได้ทันทีโดยไม่ต้องรอกัน**
> - งานเริ่มต้นใช้ 501 เพื่อแยก TASK ให้ทีม สถานะส่งมอบล่าสุด: BE002, BE005, BE006 รวมงานแล้ว; BE007, BE008 ยังเป็นงานรอดำเนินการ สัญญาด้านล่างเก็บเป็นเกณฑ์ตรวจรับและเอกสารอ้างอิง

---

## 2. โครงสร้าง Repository: FE เขียนตรงไหน และ BE เขียนตรงไหน (ฉบับถูกต้อง 100%)

โปรเจกต์นี้เป็น **Modular Monolith** ที่ใช้ Next.js App Router แอปพลิเคชันเดียว (`apps/web`) ร่วมกับแพ็กเกจฐานข้อมูล (`packages/database`) และแพ็กเกจชนิดข้อมูลกลาง (`packages/shared`) ดังนั้นคำว่าอยู่ในโฟลเดอร์ `apps/web` จึงไม่ได้แปลว่าเป็น Frontend ทั้งหมด แต่แบ่งขอบเขต FE และ BE อย่างชัดเจนดังนี้:

### 2.1 แผนผังตำแหน่งไฟล์ Frontend (FE) vs Backend (BE)

| ฝั่ง              | ชั้นงาน (Layer)                                                 | ตำแหน่งโฟลเดอร์จริงใน Repository                                                                                         | หน้าที่และความรับผิดชอบ                                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FE (Frontend)** | หน้าเว็บและการกำหนดเส้นทางหน้าจอ (Pages & Layouts)              | `apps/web/src/app/login/`, `dashboard/`, `profile/`, `coming-soon/`, `status/[code]/`, `research/`                       | ประกอบหน้าเว็บ กำหนด Metadata และตรวจสิทธิ์ก่อนเข้าหน้า (Server Component)                                                                                                                      |
| **FE (Frontend)** | ส่วนแสดงผลและการโต้ตอบกับผู้ใช้ (UI Components)                 | `apps/web/src/components/{auth,dashboard,profile,shell,loading,coming-soon,status}/`                                     | แสดงฟอร์ม ปุ่ม เมนู ภาพเคลื่อนไหว (Agent Honk) และรับการกดหรือกรอกข้อมูลจากผู้ใช้ในเบราว์เซอร์ (`'use client'`)                                                                                 |
| **FE (Frontend)** | ตัวช่วยเรียก API จากฝั่งเบราว์เซอร์ (Client Fetchers)           | `apps/web/src/modules/auth/presentation/{login-client,logout-client}.ts`, `modules/users/presentation/profile-client.ts` | ส่งคำขอ HTTP (`fetch`) จากหน้าเว็บไปยัง `/api/v1/...` (แม้จะเป็นไฟล์ `.ts` ใน `modules/` แต่ทำหน้าที่เป็นตัวเชื่อมฝั่ง Client)                                                                  |
| **FE (Frontend)** | ระบบสี ตัวอักษร และสไตล์ (Theme & CSS)                          | `apps/web/src/theme/` และไฟล์ `*.module.css` ข้าง Component                                                              | กำหนด Design Tokens (`colors.json`, `tokens.css`), ฟอนต์ (`Outfit`, `Noto Sans Thai`) และการจัดวางหน้าจอ                                                                                        |
| **BE (Backend)**  | **1. ประตูรับคำขอ API (Route Handlers)**                        | `apps/web/src/app/api/v1/**/route.ts`                                                                                    | ผูก HTTP Method (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`) เข้ากับ URL และรันบน Node.js Server (`runtime = 'nodejs'`) **ห้ามเขียน SQL หรือ Business Logic ในไฟล์นี้**                            |
| **BE (Backend)**  | **2. ชั้นรับ-ส่ง HTTP และตรวจข้อมูลเข้า (Presentation Layer)**  | `apps/web/src/modules/*/presentation/` และ `apps/web/src/lib/http/{api,handlers,account-handlers}.ts`                    | แกะค่าจาก URL/Query/Body, ตรวจความถูกต้องด้วย Zod Schema (`parse`), ตรวจสิทธิ์เซสชัน (`requireUser`), เรียก Application Service, แปลงผลลัพธ์เป็น DTO และห่อ Response มาตรฐาน (`api`, `success`) |
| **BE (Backend)**  | **3. ชั้นตรรกะและลำดับงานธุรกิจ (Application Layer)**           | `apps/web/src/modules/*/application/*-service.ts`                                                                        | ควบคุมกฎทางธุรกิจ เช่น ถ้ารายการไม่มีในระบบต้องโยน `AppError('NOT_FOUND', 404, ...)` โดย **ห้าม import `next`, `react`, `zod`, `pg` หรือ `@campus/database` เด็ดขาด** (บังคับด้วย ESLint)       |
| **BE (Backend)**  | **4. ชั้นสัญญาและชนิดข้อมูลหลัก (Domain Layer)**                | `apps/web/src/modules/*/domain/*.ts`                                                                                     | นิยามรูปร่างข้อมูลหลัก (Entity/Type) และข้อตกลงของคลังข้อมูล (`Repository Interface / Port`) เป็น TypeScript บริสุทธิ์                                                                          |
| **BE (Backend)**  | **5. ชั้นเชื่อมต่อฐานข้อมูล PostgreSQL (Infrastructure Layer)** | `apps/web/src/modules/*/infrastructure/pg-*-repository.ts`                                                               | เขียนคำสั่ง Parameterized SQL (`$1, $2, ...`) ผ่าน `query()` ของ `@campus/database` และแปลงชื่อคอลัมน์ `snake_case` จากฐานข้อมูลให้เป็น `camelCase` ตามสัญญา Domain                             |
| **BE (Backend)**  | **6. จุดประกอบชิ้นส่วนระบบ (Composition Root)**                 | `apps/web/src/lib/composition.ts` และ `apps/web/src/modules/*/composition.ts`                                            | สร้าง Instance ของ Repository แล้วส่งเข้าไปใน Service (Dependency Injection)                                                                                                                    |
| **BE (Backend)**  | **7. เครื่องมือฐานข้อมูลและโครงสร้างตาราง (Database Package)**  | `packages/database/src/` และ `packages/database/migrations/0001..0006.sql`                                               | จัดการ Connection Pool (`pg`), Transaction, Argon2id Password Hashing และไฟล์สร้างตาราง SQL ทั้ง 9 ตาราง                                                                                        |

### 2.2 เส้นทางการวิ่งของข้อมูลในฝั่ง Backend (Clean Architecture Request Flow)

```text
HTTP Request (เช่น GET /api/v1/item-reports?type=LOST&limit=10)
  │
  ▼
[1. Route Handler]        apps/web/src/app/api/v1/item-reports/route.ts
  │  (รับเมธอด GET แล้วส่งต่อให้ handlers.listReports)
  ▼
[2. Presentation Layer]   apps/web/src/modules/item-reports/presentation/list-reports.ts
  │  (ครอบด้วย api() → อ่าน queryInput(request) → ตรวจด้วย parse(reportFilterSchema, ...)
  │   → เรียก getService().list(filter) → แปลงแต่ละรายการด้วย reportDto → คืนค่าด้วย success(data, 200, meta))
  ▼
[3. Application Layer]    apps/web/src/modules/item-reports/application/report-service.ts
  │  (เมธอด list(filter) หรือ find(id) ดำเนินลำดับงานทางธุรกิจและตรวจผลลัพธ์ เช่น ไม่พบข้อมูลโยน 404)
  ▼
[4. Domain Port]          apps/web/src/modules/item-reports/domain/report.ts
  │  (สัญญา ReportRepository กำหนดว่า list() และ find() ต้องรับและคืนค่าชนิดใด)
  ▼
[5. Infrastructure Layer] apps/web/src/modules/item-reports/infrastructure/pg-report-repository.ts
  │  (รัน Parameterized SQL SELECT ผ่าน query(this.db, sql, [...]) และแปลงแถวฐานข้อมูลด้วย map(row))
  ▼
[6. PostgreSQL 18.4]      ตาราง item_reports หรือ claims
```

---

## 3. บทพูดสำหรับสั่งงานเพื่อน (เข้าใจง่าย มีคำอธิบายศัพท์เทคนิคครบ)

### 3.1 บทเปิดคุยรวมกับเพื่อนทั้ง 2 คน

> “รอบนี้เรามีงาน Backend ให้ทำคนละ 2 TASK โดย 1 TASK คือการทำ API 1 เส้น (รวมคนละ 2 เส้น) รอบนี้เน้นทำเฉพาะฝั่ง Backend ล้วน ๆ เลย **ไม่ต้องทำหน้าเว็บ (Frontend) ไม่ต้องแก้ตารางฐานข้อมูล และไม่ต้องเขียนหรือแก้ไฟล์ Test**
>
> ในโปรเจกต์นี้เราใช้ Next.js ตัวเดียวอยู่ใต้ `apps/web` แต่แยกฝั่งชัดเจน:
>
> - **ฝั่ง Frontend (FE)** คือหน้าจอที่ผู้ใช้เห็นและกด อยู่ใน `app/*/page.tsx` กับ `components/`
> - **ฝั่ง Backend (BE)** คือส่วนที่รับคำขอ ตรวจข้อมูล คุยกับฐานข้อมูล PostgreSQL แล้วส่ง JSON กลับ อยู่ใน `app/api/v1/` และ `modules/`
>
> เพื่อให้ทำงานง่ายและไม่ชนกันเลย เราแยกให้ **คนที่ 1 ทำโมดูล `item-reports` (`BE005` กับ `BE006`)** และ **คนที่ 2 ทำโมดูล `claims` (`BE007` กับ `BE008`)** ทั้งสองคนทำในโฟลเดอร์โมดูลของตัวเองได้เลย ไม่ต้องรอกัน และไม่ต้องแก้ไฟล์กลางร่วมกัน
>
> ตอนนี้เราถอดโค้ดส่วน Business Logic และคำสั่ง SQL ของทั้ง 4 เส้นออกไว้ให้แล้ว ถ้าลองยิง API ตอนนี้จะได้รหัส `501 NOT_IMPLEMENTED` ซึ่งแปลว่ารอให้พวกนายมาเขียนต่อให้เสร็จสมบูรณ์
>
> เวลาเขียนในแต่ละเส้น ให้ไล่ตาม 3 ชั้นมาตรฐานของโปรเจกต์เสมอ คือ:
>
> 1. **Presentation (`presentation/*.ts`)** — รับ Request มาตรวจค่าพารามิเตอร์ (Validation) แล้วส่งเข้า Service
> 2. **Application (`application/*-service.ts`)** — จัดลำดับงานและตรวจเงื่อนไขธุรกิจ (เช่น ถ้าหา ID ไม่เจอ ให้โยน `404 NOT_FOUND`)
> 3. **Infrastructure (`infrastructure/pg-*-repository.ts`)** — เขียนคำสั่ง SQL `SELECT` แบบใช้ตัวแปร `$1, $2` ดึงข้อมูลจริงจาก PostgreSQL แล้วส่งกลับ”

### 3.2 บทสั่งงานเพื่อนคนที่ 1 (`BE005` และ `BE006` — โมดูล `item-reports`)

> “ของนายรับผิดชอบโมดูล **รายงานของหายและของที่พบ (`item-reports`)** จำนวน 2 TASK ต่อเนื่องกัน คือ `BE005` และ `BE006` ทั้งสองเส้นเป็น API สาธารณะ (คนทั่วไปเรียกดูได้โดยไม่ต้องล็อกอิน)
>
> - **งานแรก `BE005` (`GET /api/v1/item-reports`)** คือเส้นดึงรายการแจ้งของหาย/ของที่พบแบบแบ่งหน้า (`limit`, `offset`) และกรองข้อมูลได้ตาม `type` (`LOST`/`FOUND`), `status` (`OPEN`/`RESOLVED`/`CLOSED`), `categoryId` และ `locationId` โดยเรียงจากรายงานล่าสุดลงมา (`report_id DESC`)
> - **งานที่สอง `BE006` (`GET /api/v1/item-reports/:id`)** คือเส้นดึงรายละเอียดของรายงาน 1 ชิ้นตามเลข `id` ที่ส่งมาทาง URL ถ้ามีข้อมูลก็ส่งกลับเป็น `200 OK` แต่ถ้าไม่มี `id` นี้ในตาราง ให้ตอบ `404 NOT_FOUND`
>
> จุดสำคัญของทั้ง 2 งานนี้คือ เวลาส่งข้อมูลรายงานออกไปสู่สาธารณะ **ต้องแปลงผ่านฟังก์ชัน `reportDto` ที่มีให้แล้วเสมอ เพื่อไม่ให้ `userId` ของคนแจ้งหลุดออกไปใน JSON** ตอนส่งงานให้เปิด PR แยกตามชื่อ Branch ของแต่ละ TASK รัน `bun run lint` กับ `bun run typecheck` ให้ผ่าน และแคปผลทดสอบจาก Postman หรือ curl มาแนบใน PR ได้เลย”

### 3.3 บทสั่งงานเพื่อนคนที่ 2 (`BE007` และ `BE008` — โมดูล `claims`)

> “ของนายรับผิดชอบโมดูล **คำขอรับของคืน (`claims`)** จำนวน 2 TASK ต่อเนื่องกัน คือ `BE007` และ `BE008` ทั้งสองเส้นนี้เป็นข้อมูลส่วนตัวที่มีหลักฐานการเป็นเจ้าของ (`evidence`) ดังนั้น **ผู้เรียกต้องล็อกอินก่อนเสมอ** (ใช้ฟังก์ชัน `requireUser(request)` ที่ส่งเข้าไปให้ใน Handler ได้เลย)
>
> - **งานแรก `BE007` (`GET /api/v1/claims`)** คือเส้นดึงรายการคำขอรับของคืน **เฉพาะของตัวเอง (`user_id` ของคนที่ล็อกอินอยู่)** แบบแบ่งหน้าด้วย `limit` กับ `offset` เรียงจากรายการล่าสุดลงมา (`claim_id DESC`)
> - **งานที่สอง `BE008` (`GET /api/v1/claims/:id`)** คือเส้นดึงรายละเอียดคำขอรับของคืน 1 รายการตามเลข `id` แต่มีกฎความปลอดภัยสำคัญคือ **ต้องเช็กใน SQL ด้วยว่าเป็น `claim_id` นั้นและเป็น `user_id` ของคนที่ล็อกอินอยู่จริง ๆ** ถ้าไม่เจอ หรือเป็นคำขอของคนอื่น ให้ตอบ `404 NOT_FOUND` เหมือนกันทั้งหมดเพื่อไม่ให้คนอื่นเดาเลขใบเคลมได้
>
> นายทำเฉพาะในโฟลเดอร์ `modules/claims/` ได้เลย ไม่ต้องแก้ไฟล์หน้าเว็บหรือเขียน Test เพิ่ม ตอนส่งงานให้รัน `bun run lint` กับ `bun run typecheck` ให้ผ่าน และแนบผลยิง Postman/curl ทั้งกรณีสำเร็จและกรณีผิดพลาดมาใน PR”

---

## 4. ตารางอธิบายคำศัพท์เทคนิค (Technical Glossary สำหรับทีม)

| คำศัพท์เทคนิค                                         | ความหมายแบบเข้าใจง่าย                                                                                                                      | ตัวอย่างในโปรเจกต์นี้                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **API Endpoint**                                      | ช่องทางรับคำขอของเซิร์ฟเวอร์ ประกอบด้วย HTTP Method + URL Path                                                                             | `GET /api/v1/item-reports` หรือ `GET /api/v1/claims/:id`                        |
| **Route Handler**                                     | ไฟล์ด่านหน้าที่ผูก URL ของ Next.js เข้ากับฟังก์ชันทำงานฝั่งเซิร์ฟเวอร์                                                                     | `apps/web/src/app/api/v1/item-reports/route.ts`                                 |
| **Query Parameter**                                   | ค่าตัวเลือกที่ส่งต่อท้าย URL หลังเครื่องหมาย `?` สำหรับกรองหรือแบ่งหน้า                                                                    | `?type=LOST&status=OPEN&limit=10&offset=0`                                      |
| **Path Parameter (`:id`)**                            | ค่าตัวแปรที่ฝังอยู่ในตำแหน่งของ URL เพื่อระบุรหัสข้อมูลรายชิ้น                                                                             | `/api/v1/item-reports/42` (ค่า `id` คือ `42`)                                   |
| **Pagination (`limit` / `offset`)**                   | การแบ่งดึงข้อมูลทีละหน้า โดย `limit` คือจำนวนสูงสุดต่อหน้า และ `offset` คือจำนวนแถวที่ข้ามไป                                               | `limit=20&offset=0` (ดึง 20 รายการแรก)                                          |
| **Validation / Schema**                               | การตรวจความถูกต้องของข้อมูลขาเข้าก่อนนำไปใช้งาน หากผิดกติกาจะถูกปฏิเสธทันที (`422`)                                                        | ใช้ `parse(reportFilterSchema, queryInput(request))` หรือ `parse(idSchema, id)` |
| **DTO (Data Transfer Object)**                        | รูปแบบข้อมูลที่คัดเฉพาะฟิลด์ที่ปลอดภัยสำหรับส่งออกทาง API                                                                                  | `reportDto(report)` จะตัด `userId` ออกก่อนส่งให้ผู้ใช้ทั่วไป                    |
| **Presentation Layer**                                | ชั้นที่ทำหน้าที่คุยกับ HTTP (อ่านพารามิเตอร์, ตรวจสิทธิ์, จัดรูปแบบ JSON Response)                                                         | ไฟล์ใน `modules/*/presentation/*.ts`                                            |
| **Application Service**                               | ชั้นที่รวมลำดับการทำงานและกฎธุรกิจ โดยไม่ยึดติดกับฐานข้อมูลหรือ HTTP                                                                       | `ReportService` และ `ClaimService` ใน `modules/*/application/`                  |
| **Domain / Port (Contract)**                          | ข้อตกลง (Interface) ที่กำหนดว่าข้อมูลมีหน้าตาอย่างไร และ Repository ต้องมีฟังก์ชันอะไรบ้าง                                                 | `Report`, `ReportRepository`, `Claim`, `ClaimRepository` ใน `modules/*/domain/` |
| **Infrastructure / Repository**                       | ชั้นที่เขียนคำสั่ง SQL ติดต่อกับฐานข้อมูล PostgreSQL จริงตามข้อตกลงของ Domain                                                              | `PgReportRepository` และ `PgClaimRepository` ใน `modules/*/infrastructure/`     |
| **Parameterized SQL (`$1, $2`)**                      | การเขียน SQL โดยแยกคำสั่งออกจากตัวแปรข้อมูล เพื่อป้องกันช่องโหว่ SQL Injection 100%                                                        | `SELECT ... WHERE claim_id = $1 AND user_id = $2` พร้อมส่ง `[id, userId]`       |
| **Non-disclosing `404`**                              | การตอบ `404 NOT_FOUND` แทน `403 FORBIDDEN` เมื่อผู้ใช้พยายามเข้าถึงข้อมูลส่วนตัวของคนอื่น เพื่อไม่ให้รู้ว่ามีรหัสข้อมูลนั้นอยู่จริงหรือไม่ | การเรียกดู `GET /api/v1/claims/:id` ที่ไม่ใช่ของตนเอง                           |
| **HTTP Status `200` / `401` / `404` / `422` / `501`** | รหัสสถานะมาตรฐาน: `200` สำเร็จ, `401` ยังไม่ล็อกอิน, `404` ไม่พบข้อมูล, `422` ข้อมูลขาเข้าไม่ถูกต้อง, `501` ยังไม่ได้เขียนโค้ดส่วนนี้      | ใช้ผ่าน `success(...)` และ `new AppError(code, status, message)`                |

---

## 5. ข้อกำหนดทางวิศวกรรมราย TASK (Production Enterprise Clean Architecture Requirements)

### กติกามาตรฐานด้านสถาปัตยกรรมและความปลอดภัยที่ทุก TASK ต้องปฏิบัติตาม (Non-Negotiable Guardrails)

1. **การกั้นเลเยอร์ตามกฎ ESLint (`eslint.config.mjs`):**
   - ห้ามใช้ `any` (`@typescript-eslint/no-explicit-any`), ห้ามใช้ `!` (`no-non-null-assertion`), ห้ามใช้ `console.log` (`no-console`) และห้ามมีตัวแปรที่ไม่ได้ใช้งาน
   - ในไฟล์ชั้น `domain/` และ `application/` **ห้าม import** `next`, `react`, `zod`, `pg`, `@campus/database`, `@/lib/**`, `server-only`, `node:*` หรือไฟล์จากชั้น `infrastructure/` และ `presentation/` เด็ดขาด
   - ในไฟล์ชั้น `infrastructure/` และ `presentation/` ที่ทำงานฝั่งเซิร์ฟเวอร์ ต้องมี `import 'server-only';` ที่บรรทัดแรกเสมอ
2. **การเข้าถึงฐานข้อมูล (`@campus/database`):**
   - ใช้ฟังก์ชัน `query<Row>(this.db, sqlText, values)` เท่านั้น ห้ามใช้ ORM และห้ามต่อสตริงตัวแปรลงใน SQL โดยตรง (ต้องใช้ `$1, $2, ...` เสมอ)
   - ห้ามใช้ `SELECT *` ต้องระบุชื่อคอลัมน์ตามค่าคงที่ `columns` ที่กำหนดไว้ใน Repository เสมอ
3. **การจัดการ HTTP Response และ Error Envelope (`@/lib/http/api`):**
   - ทุก Presentation Handler ต้องครอบการทำงานด้วย `api(request, async () => { ... })` เพื่อให้ระบบแนบ `X-Request-Id`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` และแปลงข้อผิดพลาดเป็น JSON มาตรฐาน `{ error: { code, message, requestId } }` โดยอัตโนมัติ
   - เรียก `getService()` ภายใน Callback ของ `api(...)` หลังจากตรวจ Validation ข้อมูลขาเข้าผ่านแล้ว

---

### TASK 1 (เพื่อนคนที่ 1): `BE005` — อ่านรายการแจ้งของหายและของที่พบพร้อมตัวกรองและการแบ่งหน้า

- **รหัสและชื่อ TASK:** `BE005` — Implement Filtered & Paginated Item Report Listing Endpoint
- **ชื่อ Branch ที่ต้องใช้:** `BE005/list-item-reports`
- **ข้อความ Commit ที่แนะนำ:** `feat(item-reports): implement item report listing endpoint`
- **Endpoint:** `GET /api/v1/item-reports`
- **การยืนยันตัวตน (Authentication):** ไม่ต้องใช้ (Public Endpoint)

#### 5.1.1 ขอบเขตไฟล์ที่ต้องแก้ไข (เฉพาะใน `apps/web/src/modules/item-reports/`)

1. `apps/web/src/modules/item-reports/presentation/list-reports.ts` — ตรวจ Query Parameters, เรียก `getService().list(filter)`, แปลงผลลัพธ์แต่ละรายการผ่าน `reportDto` และคืนค่า `success(data, 200, { limit: filter.limit, offset: filter.offset })`
2. `apps/web/src/modules/item-reports/application/report-service.ts` — แก้ไขเมธอด `list(filter: ReportFilter)` ในคลาส `ReportService` ให้เรียก `this.repository.list(filter)`
3. `apps/web/src/modules/item-reports/infrastructure/pg-report-repository.ts` — แก้ไขเมธอด `list(filter: ReportFilter)` ในคลาส `PgReportRepository` ให้รันคำสั่ง Parameterized SQL `SELECT` จากตาราง `item_reports`

_(หมายเหตุ: ไฟล์ Route `apps/web/src/app/api/v1/item-reports/route.ts`, ตัวกรอง `reportFilterSchema` ใน `presentation/schemas.ts`, ตัวแปลง `reportDto` ใน `presentation/dto.ts` และสัญญา `ReportRepository` ใน `domain/report.ts` ถูกเตรียมไว้ให้ครบแล้ว ไม่ต้องแก้ไข)_

#### 5.1.2 สัญญาข้อมูลขาเข้า (Query Parameters & Validation)

ใช้ `queryInput(request)` ร่วมกับ `parse(reportFilterSchema, queryInput(request))` จาก `@/lib/http/api` และ `../presentation/schemas`:

| Query Parameter | ชนิดข้อมูลและขอบเขตที่รองรับ                       | ค่าเริ่มต้น (Default) | ความหมาย                            |
| --------------- | -------------------------------------------------- | --------------------- | ----------------------------------- |
| `type`          | `'LOST'` หรือ `'FOUND'` (Optional)                 | ไม่กรอง (`undefined`) | ประเภทรายงาน (ของหาย / ของที่พบ)    |
| `status`        | `'OPEN'`, `'RESOLVED'`, หรือ `'CLOSED'` (Optional) | ไม่กรอง (`undefined`) | สถานะของรายงาน                      |
| `categoryId`    | จำนวนเต็มบวก `1`–`2147483647` (Optional)           | ไม่กรอง (`undefined`) | รหัสหมวดหมู่สิ่งของ (`category_id`) |
| `locationId`    | จำนวนเต็มบวก `1`–`2147483647` (Optional)           | ไม่กรอง (`undefined`) | รหัสสถานที่ (`location_id`)         |
| `limit`         | จำนวนเต็ม `1`–`100` (Optional)                     | `20`                  | จำนวนรายการสูงสุดที่ต้องการดึง      |
| `offset`        | จำนวนเต็ม `0`–`100000` (Optional)                  | `0`                   | จำนวนรายการที่ต้องการข้าม           |

- หากส่งพารามิเตอร์ที่ไม่อยู่ในตารางข้างต้น, ส่งชื่อพารามิเตอร์ซ้ำ (เช่น `?limit=5&limit=10`), หรือส่งค่าผิดรูปแบบ/เกินขอบเขต ระบบต้องตอบ **`422 Unprocessable Entity`** (`error.code: "VALIDATION_ERROR"`) ทันทีโดยไม่คิวรีฐานข้อมูล

#### 5.1.3 ข้อกำหนดคำสั่ง SQL และการเรียงลำดับใน `PgReportRepository.list`

- ดึงคอลัมน์ตามค่าคงที่ `columns` จากตาราง `item_reports`
- รองรับตัวกรองแบบ Optional ทั้ง 4 ตัวด้วย Parameterized SQL (`$1` ถึง `$6`):
  - `$1`: `filter.type ?? null` (`($1::varchar IS NULL OR type = $1)`)
  - `$2`: `filter.status ?? null` (`($2::varchar IS NULL OR status = $2)`)
  - `$3`: `filter.categoryId ?? null` (`($3::integer IS NULL OR category_id = $3)`)
  - `$4`: `filter.locationId ?? null` (`($4::integer IS NULL OR location_id = $4)`)
  - `$5`: `filter.limit` (`LIMIT $5`)
  - `$6`: `filter.offset` (`OFFSET $6`)
- **ต้องเรียงลำดับด้วย `ORDER BY report_id DESC`** เพื่อให้ตรงกับดัชนีประสิทธิภาพ `item_reports_type_status_report_idx (type, status, report_id DESC)` และแสดงรายงานใหม่ล่าสุดก่อนเสมอ
- แปลงแต่ละแถวด้วยฟังก์ชัน `map(row)` ที่มีอยู่ในไฟล์

#### 5.1.4 สัญญาผลลัพธ์ขาออก (Response Contract)

- ใน `list-reports.ts` ต้องนำรายการ `Report[]` ที่ได้จาก `getService().list(filter)` มาแปลงด้วย `.map(reportDto)` ก่อนส่งเข้า `success(..., 200, { limit: filter.limit, offset: filter.offset })` **ห้ามส่งฟิลด์ `userId` ออกไปใน Public Response เด็ดขาด**
- ตัวอย่าง Response `200 OK`:

```json
{
  "data": [
    {
      "reportId": 12,
      "categoryId": 1,
      "locationId": 3,
      "type": "FOUND",
      "title": "กระเป๋าสตางค์สีดำ",
      "description": "พบแถวหน้าห้องสมุด",
      "image": null,
      "eventDatetime": "2026-11-04T05:30:00.000Z",
      "status": "OPEN",
      "createdAt": "2026-11-04T06:00:00.000Z",
      "updatedAt": "2026-11-04T06:00:00.000Z"
    }
  ],
  "meta": {
    "limit": 20,
    "offset": 0
  }
}
```

---

### TASK 2 (เพื่อนคนที่ 1): `BE006` — อ่านรายละเอียดรายงานสิ่งของรายชิ้นตามรหัส `id`

- **รหัสและชื่อ TASK:** `BE006` — Implement Single Item Report Detail Endpoint
- **ชื่อ Branch ที่ต้องใช้:** `BE006/get-item-report-detail`
- **ข้อความ Commit ที่แนะนำ:** `feat(item-reports): implement item report detail endpoint`
- **Endpoint:** `GET /api/v1/item-reports/:id`
- **การยืนยันตัวตน (Authentication):** ไม่ต้องใช้ (Public Endpoint)

#### 5.2.1 ขอบเขตไฟล์ที่ต้องแก้ไข (เฉพาะใน `apps/web/src/modules/item-reports/`)

1. `apps/web/src/modules/item-reports/presentation/get-report.ts` — อ่านพารามิเตอร์ `(await context.params).id`, ตรวจด้วย `parse(idSchema, ...)`, เรียก `getService().find(id)`, แปลงผ่าน `reportDto(...)` และคืนค่า `success(..., 200)`
2. `apps/web/src/modules/item-reports/application/report-service.ts` — แก้ไขเมธอด `find(id: number)` ในคลาส `ReportService` ให้เรียก `this.repository.find(id)` และหากได้ค่า `null` ให้โยน `throw new AppError('NOT_FOUND', 404, 'Report not found')`
3. `apps/web/src/modules/item-reports/infrastructure/pg-report-repository.ts` — แก้ไขเมธอด `find(id: number)` ในคลาส `PgReportRepository` ให้รัน Parameterized SQL `SELECT` ตาม ` WHERE report_id = $1`

#### 5.2.2 สัญญาข้อมูลขาเข้าและการจัดการข้อผิดพลาด

- พารามิเตอร์ `id` จาก URL (`(await context.params).id`) ต้องผ่าน `parse(idSchema, (await context.params).id)`:
  - ถ้ารหัสไม่ใช่จำนวนเต็มบวกในช่วง `1`–`2147483647` (เช่น `0`, `-5`, `abc`, `99999999999`) ระบบต้องตอบ **`422 Unprocessable Entity`** (`error.code: "VALIDATION_ERROR"`)
- หาก `id` ถูกต้องแต่ไม่มีแถวข้อมูลในตาราง `item_reports`:
  - `PgReportRepository.find(id)` คืนค่า `null`
  - `ReportService.find(id)` โยน `new AppError('NOT_FOUND', 404, 'Report not found')`
  - ระบบตอบ **`404 Not Found`** (`error.code: "NOT_FOUND"`, `error.message: "Report not found"`)

#### 5.2.3 สัญญาผลลัพธ์ขาออก (Response Contract)

- เมื่อพบข้อมูล ตอบ **`200 OK`** โดยแปลงผ่าน `reportDto(report)` (ไม่มี `meta` และไม่มี `userId`):

```json
{
  "data": {
    "reportId": 12,
    "categoryId": 1,
    "locationId": 3,
    "type": "FOUND",
    "title": "กระเป๋าสตางค์สีดำ",
    "description": "พบแถวหน้าห้องสมุด",
    "image": null,
    "eventDatetime": "2026-11-04T05:30:00.000Z",
    "status": "OPEN",
    "createdAt": "2026-11-04T06:00:00.000Z",
    "updatedAt": "2026-11-04T06:00:00.000Z"
  }
}
```

---

### TASK 1 (เพื่อนคนที่ 2): `BE007` — อ่านรายการคำขอรับของคืนของผู้ใช้ที่ล็อกอินอยู่พร้อมการแบ่งหน้า

- **รหัสและชื่อ TASK:** `BE007` — Implement Authenticated Owned Claim Listing Endpoint
- **ชื่อ Branch ที่ต้องใช้:** `BE007/list-owned-claims`
- **ข้อความ Commit ที่แนะนำ:** `feat(claims): implement owned claim listing endpoint`
- **Endpoint:** `GET /api/v1/claims`
- **การยืนยันตัวตน (Authentication):** **บังคับต้องมี Session Cookie ที่ยังไม่หมดอายุ** (เรียก `await requireUser(request)` ที่รับเข้ามาในพารามิเตอร์ของ `listClaims`)

#### 5.3.1 ขอบเขตไฟล์ที่ต้องแก้ไข (เฉพาะใน `apps/web/src/modules/claims/`)

1. `apps/web/src/modules/claims/presentation/list-claims.ts` — ตรวจสิทธิ์ผู้ใช้ด้วย `const user = await requireUser(request)`, ตรวจ Query Parameters ด้วย `parse(paginationSchema.strict(), queryInput(request))`, เรียก `getService().list(user.userId, pagination)` และคืนค่า `success(claims, 200, pagination)`
2. `apps/web/src/modules/claims/application/claim-service.ts` — แก้ไขเมธอด `list(userId: number, page: Page)` ในคลาส `ClaimService` ให้เรียก `this.repository.listOwned(userId, page)`
3. `apps/web/src/modules/claims/infrastructure/pg-claim-repository.ts` — แก้ไขเมธอด `listOwned(userId: number, page: Page)` ในคลาส `PgClaimRepository` ให้รัน Parameterized SQL `SELECT` จากตาราง `claims`

#### 5.3.2 สัญญาข้อมูลขาเข้าและการตรวจสิทธิ์

1. **การยืนยันตัวตน (`requireUser(request)`):**
   - หากไม่มีคุกกี้เซสชัน หรือเซสชันหมดอายุ/ถูกยกเลิก `requireUser(request)` จะโยน `401 UNAUTHORIZED` ทันที
2. **การตรวจ Query Parameters (`paginationSchema.strict()`):**
   - รองรับเฉพาะ `limit` (จำนวนเต็ม `1`–`100`, ค่าเริ่มต้น `20`) และ `offset` (จำนวนเต็ม `0`–`100000`, ค่าเริ่มต้น `0`)
   - **ต้องใช้ `paginationSchema.strict()`** ร่วมกับ `queryInput(request)` เพื่อปฏิเสธพารามิเตอร์ที่ไม่รู้จักหรือพารามิเตอร์ซ้ำด้วย **`422 Unprocessable Entity`** (`VALIDATION_ERROR`)

#### 5.3.3 ข้อกำหนดคำสั่ง SQL และการเรียงลำดับใน `PgClaimRepository.listOwned`

- ดึงคอลัมน์ตามค่าคงที่ `columns` (`claim_id, report_id, user_id, evidence, status, claim_date, updated_at`) จากตาราง `claims`
- **ต้องกรองเฉพาะของเจ้าของเซสชันและเรียงลำดับจากใหม่ไปเก่า:**
  - `WHERE user_id = $1 ORDER BY claim_id DESC LIMIT $2 OFFSET $3` พร้อมส่งพารามิเตอร์ `[userId, page.limit, page.offset]`
  - คิวรีนี้จะใช้ดัชนีผสม `claims_user_claim_idx (user_id, claim_id DESC)` ได้โดยไม่ต้อง Sort ซ้ำในหน่วยความจำ
- แปลงแต่ละแถวด้วยฟังก์ชัน `map(row)` ที่มีอยู่ในไฟล์

#### 5.3.4 สัญญาผลลัพธ์ขาออก (Response Contract)

- ตอบ **`200 OK`** พร้อม `{ data: Claim[], meta: { limit, offset } }` (หากผู้ใช้ยังไม่มีคำขอเคลมเลย ให้คืน `data: []` จากผลคิวรีจริง):

```json
{
  "data": [
    {
      "claimId": 5,
      "reportId": 12,
      "userId": 2,
      "evidence": "มีบัตรนักศึกษาและพวงกุญแจรูปเป็ดอยู่ในกระเป๋าช่องใน",
      "status": "PENDING",
      "claimDate": "2026-11-04T07:15:00.000Z",
      "updatedAt": "2026-11-04T07:15:00.000Z"
    }
  ],
  "meta": {
    "limit": 20,
    "offset": 0
  }
}
```

---

### TASK 2 (เพื่อนคนที่ 2): `BE008` — อ่านรายละเอียดคำขอรับของคืนรายรายการเฉพาะของตนเองตามรหัส `id`

- **รหัสและชื่อ TASK:** `BE008` — Implement Authenticated Owned Claim Detail Endpoint
- **ชื่อ Branch ที่ต้องใช้:** `BE008/get-owned-claim-detail`
- **ข้อความ Commit ที่แนะนำ:** `feat(claims): implement owned claim detail endpoint`
- **Endpoint:** `GET /api/v1/claims/:id`
- **การยืนยันตัวตน (Authentication):** **บังคับต้องมี Session Cookie ที่ยังไม่หมดอายุ** (เรียก `await requireUser(request)`)

#### 5.4.1 ขอบเขตไฟล์ที่ต้องแก้ไข (เฉพาะใน `apps/web/src/modules/claims/`)

1. `apps/web/src/modules/claims/presentation/get-claim.ts` — ตรวจสิทธิ์ผู้ใช้ด้วย `const user = await requireUser(request)`, ตรวจรหัส `id` ด้วย `parse(idSchema, (await context.params).id)`, เรียก `getService().find(id, user.userId)` และคืนค่า `success(claim, 200)`
2. `apps/web/src/modules/claims/application/claim-service.ts` — แก้ไขเมธอด `find(id: number, userId: number)` ในคลาส `ClaimService` ให้เรียก `this.repository.findOwned(id, userId)` และหากได้ค่า `null` ให้โยน `throw new AppError('NOT_FOUND', 404, 'Claim not found')`
3. `apps/web/src/modules/claims/infrastructure/pg-claim-repository.ts` — แก้ไขเมธอด `findOwned(id: number, userId: number)` ในคลาส `PgClaimRepository` ให้รัน Parameterized SQL `SELECT` ที่กรองทั้ง `claim_id` และ `user_id`

#### 5.4.2 กฎความปลอดภัยและการป้องกันการเดารหัสข้อมูล (Privacy & Non-Disclosing `404`)

- ข้อมูล `evidence` ในตาราง `claims` เป็นหลักฐานส่วนตัวของผู้ยื่นขอรับของคืน
- ใน `PgClaimRepository.findOwned(id, userId)` ต้องใช้เงื่อนไข SQL:
  `SELECT ${columns} FROM claims WHERE claim_id = $1 AND user_id = $2` พร้อมส่ง `[id, userId]`
- หากไม่พบ `claim_id` นี้ **หรือ** `claim_id` นี้เป็นของผู้ใช้คนอื่น (แม้ผู้เรียกจะเป็นเจ้าของ `item_reports` ก็ตาม) ผลลัพธ์จาก `findOwned` จะเป็น `null` และ `ClaimService.find` ต้องโยน **`new AppError('NOT_FOUND', 404, 'Claim not found')`** เสมอ (ห้ามคืน `403 FORBIDDEN` เพื่อไม่ให้ผู้ไม่หวังดีทราบว่ามี `claim_id` นั้นอยู่ในระบบ)

#### 5.4.3 สัญญาผลลัพธ์ขาออก (Response Contract)

- เมื่อเป็นเจ้าของคำขอเคลมจริง ตอบ **`200 OK`**:

```json
{
  "data": {
    "claimId": 5,
    "reportId": 12,
    "userId": 2,
    "evidence": "มีบัตรนักศึกษาและพวงกุญแจรูปเป็ดอยู่ในกระเป๋าช่องใน",
    "status": "PENDING",
    "claimDate": "2026-11-04T07:15:00.000Z",
    "updatedAt": "2026-11-04T07:15:00.000Z"
  }
}
```

---

## 6. การเตรียมฐานข้อมูลและข้อมูลตัวอย่างในเครื่อง (Local Database & Seed Dataset)

ก่อนเริ่มทดสอบ API ในเครื่องของตนเอง ให้เปิด Docker Desktop แล้วรันคำสั่งต่อไปนี้จากรากของโปรเจกต์:

```sh
bun run env:setup
docker compose up -d postgres
bun run db:migrate
bun run db:seed --development-only
bun run dev
```

คำสั่ง `bun run db:seed --development-only` (`packages/database/scripts/seed.ts` และ `packages/database/src/development-seed.ts`) จะทำงานภายใต้ Transaction เดียวแบบ **Idempotent** (รันซ้ำกี่ครั้งก็ไม่สร้างข้อมูลซ้ำ) และเตรียมข้อมูลให้พร้อมสำหรับทดสอบทุก Endpoint ทันที:

1. **บัญชีผู้ใช้สำหรับล็อกอินทดสอบ (`users`):**
   - บัญชีหลัก `demo@reunite.test` (รหัสผ่านถูกสุ่มและบันทึกไว้ในไฟล์ส่วนตัว `tmp/local-seed/login-account.json` ซึ่งไม่ถูกส่งขึ้น Git)
   - บัญชีจำลองคนที่สอง `peer@reunite.test` สำหรับใช้เป็นเจ้าของรายการเปรียบเทียบสิทธิ์
2. **หมวดหมู่สิ่งของ (`categories` — 5 รายการ):**
   - รองรับการทดสอบ `BE002` (`GET /api/v1/categories`) และการกรอง `categoryId` ใน `BE005`
3. **สถานที่ในมหาวิทยาลัย (`locations` — 5 รายการ):**
   - รองรับการทดสอบ `BE003` (`GET /api/v1/locations`) และการกรอง `locationId` ใน `BE005`
4. **รายการแจ้งของหายและเจอของ (`item_reports` — 6 รายการ):**
   - ครอบคลุมทั้ง `type` แบบ `LOST` (3 รายการ) และ `FOUND` (3 รายการ)
   - ครอบคลุมทุกสถานะ `status` ได้แก่ `OPEN` (4 รายการ), `RESOLVED` (1 รายการ) และ `CLOSED` (1 รายการ)
   - รองรับการทดสอบ `BE005` (`GET /api/v1/item-reports`) และ `BE006` (`GET /api/v1/item-reports/:id`)
5. **คำขอรับสิ่งของคืน (`claims` — 3 รายการ):**
   - **2 รายการแรก** เป็นของบัญชี `demo@reunite.test` (สถานะ `PENDING` และ `APPROVED`) → เมื่อล็อกอินด้วย `demo@reunite.test` แล้วเรียก `BE007` (`GET /api/v1/claims`) ต้องเห็นเฉพาะ 2 รายการนี้ และเมื่อเรียก `BE008` (`GET /api/v1/claims/:id`) ด้วย ID ของ 2 รายการนี้ต้องได้ `200 OK`
   - **1 รายการที่สาม** เป็นของบัญชี `peer@reunite.test` → เมื่อล็อกอินด้วย `demo@reunite.test` แล้วลองเรียก `BE008` (`GET /api/v1/claims/:id`) ด้วย ID ของรายการนี้ ต้องได้ **`404 NOT_FOUND`** (พิสูจน์ว่าไม่รั่วไหลข้อมูลของผู้อื่น)

---

## 7. รายการตรวจสอบก่อนส่งงาน (Definition of Done & PR Checklist สำหรับเพื่อนทั้ง 2 คน)

ผู้รับผิดชอบแต่ละ TASK ต้องตรวจสอบรายการต่อไปนี้ก่อนเปิด Pull Request:

1. **การแยก Branch และ Commit ตามกฎ Repository Policy (`.github/workflows/repository-policy.yml`):**
   - ชื่อ Branch ต้องตรงรูปแบบ `TASK000/kebab-case-description` เช่น:
     - `BE005/list-item-reports`
     - `BE006/get-item-report-detail`
     - `BE007/list-owned-claims`
     - `BE008/get-owned-claim-detail`
   - ข้อความ Commit ต้องขึ้นต้นด้วย Conventional Commit เช่น `feat(item-reports): ...` หรือ `feat(claims): ...`
2. **การตรวจสอบคุณภาพโค้ดด้วยคำสั่งมาตรฐาน (ต้องผ่าน 0 Warnings / 0 Errors):**
   ```sh
   bun run format:check
   bun run lint
   bun run typecheck
   ```
3. **ขอบเขตไฟล์ (Strict Scope Boundary):**
   - ห้ามแก้ไขไฟล์นอกโมดูลของตนเอง
   - ห้ามแก้ไขไฟล์ Migration (`packages/database/migrations/`), ห้ามแก้ไขไฟล์ Test (`tests/`) และห้ามปิดหรือใส่ `.skip` ใน Test
4. **หลักฐานการทดสอบผ่าน Postman หรือ `curl` ที่ต้องแนบในคำอธิบาย PR:**
   - **สำหรับ `BE005` (`GET /api/v1/item-reports`):**
     - เรียกปกติ `/api/v1/item-reports` → ได้ `200 OK` พร้อม `meta: { limit: 20, offset: 0 }`, ข้อมูลเรียง `reportId` จากมากไปน้อย และไม่มีฟิลด์ `userId`
     - เรียกพร้อมตัวกรอง เช่น `?type=FOUND&status=OPEN&limit=2&offset=0` → ได้ `200 OK`
     - เรียกค่าผิดกติกา เช่น `?limit=101`, `?status=APPROVED`, `?unknown=1`, `?limit=1&limit=2` → ได้ `422 VALIDATION_ERROR`
   - **สำหรับ `BE006` (`GET /api/v1/item-reports/:id`):**
     - เรียก `id` ที่มีอยู่จริง → ได้ `200 OK` และไม่มีฟิลด์ `userId`
     - เรียก `id` ที่ไม่มีอยู่จริง เช่น `/api/v1/item-reports/2147483647` → ได้ `404 NOT_FOUND`
     - เรียก `id` ผิดรูปแบบ เช่น `/api/v1/item-reports/abc` หรือ `/api/v1/item-reports/0` → ได้ `422 VALIDATION_ERROR`
   - **สำหรับ `BE007` (`GET /api/v1/claims`):**
     - เรียกโดยไม่ส่งคุกกี้เซสชัน → ได้ `401 UNAUTHORIZED`
     - เรียกพร้อมคุกกี้เซสชันปกติ → ได้ `200 OK` เฉพาะรายการของตนเอง เรียง `claimId` จากมากไปน้อย พร้อม `meta: { limit: 20, offset: 0 }`
     - เรียกพารามิเตอร์ผิด เช่น `?limit=0`, `?unknown=1`, `?limit=1&limit=2` → ได้ `422 VALIDATION_ERROR`
   - **สำหรับ `BE008` (`GET /api/v1/claims/:id`):**
     - เรียกโดยไม่ส่งคุกกี้เซสชัน → ได้ `401 UNAUTHORIZED`
     - เรียก `id` คำขอเคลมของตนเอง → ได้ `200 OK` พร้อมรายละเอียดและ `evidence`
     - เรียก `id` คำขอเคลมของผู้ใช้คนอื่น หรือ `id` ที่ไม่มีอยู่จริง → ได้ `404 NOT_FOUND`
     - เรียก `id` ผิดรูปแบบ เช่น `/api/v1/claims/abc` → ได้ `422 VALIDATION_ERROR`

---

## 8. บันทึกอ้างอิงสำหรับงานรอบก่อนหน้า (`BE002` และ `BE003`)

- **`BE003` (`GET /api/v1/locations`):** ส่งมอบและรวมเข้า `main` แล้วใน [PR #12](https://github.com/ParkPawapon/reunite/pull/12) สามารถดูโค้ดใน `apps/web/src/modules/locations/` เป็นตัวอย่างต้นแบบ (Reference Implementation) ของการแบ่งชั้น Presentation (`list-locations.ts`), Application (`location-service.ts`), Domain (`location.ts`) และ Infrastructure (`pg-location-repository.ts`) ได้โดยตรง
- **`BE002` (`GET /api/v1/categories`):** รวมงานแล้วใน PR #21 อ่าน categories จริงเรียง `category_id ASC` และคืน `{ data: [{ categoryId, categoryName }], meta: { limit, offset } }`
- **สถานะการตรวจรับโดยผู้รวมงาน:** ปรับ assertion และเพิ่ม PostgreSQL integration coverage แล้วสำหรับ BE002, BE005, BE006; คงการตรวจ 501 สำหรับ BE007, BE008 จนกว่าจะส่งมอบ ผู้รับงานยังทำเฉพาะโมดูล ส่วนงาน test และการรวมเป็นหน้าที่ผู้รวมงานตามข้อตกลงเดิม
