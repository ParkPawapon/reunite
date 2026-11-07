# Backend Handoff — BE002 / BE003

## เป้าหมายและสถานะปัจจุบัน

พัฒนา API อ่านข้อมูลจาก PostgreSQL จำนวนสองเส้น แยกผู้รับผิดชอบคนละหนึ่งงาน เพื่อให้ Frontend เรียกใช้รายการหมวดหมู่สิ่งของและสถานที่สำหรับรายงานได้

สถานะล่าสุด: **BE003 ส่งและรวมแล้ว** — `GET /api/v1/locations` อ่าน PostgreSQL จริงและตอบ 200 พร้อม pagination ส่วน **BE002 ยังสงวนให้ผู้รับงานเดิม** และ `GET /api/v1/categories` ยังตอบ `501 NOT_IMPLEMENTED` ตารางและข้อมูลเดิมยังอยู่ครบ

งานที่ยังต้องส่งคือ BE002 โดยเปลี่ยน categories จาก 501 ให้เป็น API ที่อ่านข้อมูลจริง ตรวจ input และตอบตามสัญญาด้านล่าง สัญญา BE003 เก็บไว้เป็นตัวอย่างงานที่รวมแล้ว ผู้รับงานไม่ต้องทำ Frontend หรือเขียน/แก้ test files

ระบบ Profile และแจ้งเตือนบัญชีเพิ่มแยกไว้แล้วใน `modules/users/`, `modules/notifications/` และ `lib/http/account-handlers.ts` พร้อม migration `0005`–`0006` งาน BE002/BE003 ยังทำเฉพาะ categories/locations ตามสัญญาเดิม ไม่ต้องแก้ authentication, profile, รูปโปรไฟล์ หรือแจ้งเตือน และไม่ต้องสร้างตารางเพิ่ม ฐานข้อมูลปัจจุบันมี 9 ตารางรวมตารางเทคนิค

## การแบ่งงาน

| TASK                                      | งานที่ต้องส่ง            | Branch                        | Commit ที่แนะนำ                                         |
| ----------------------------------------- | ------------------------ | ----------------------------- | ------------------------------------------------------- |
| **BE002 — อ่านรายการหมวดหมู่สิ่งของ**     | `GET /api/v1/categories` | `BE002/list-item-categories`  | `feat(categories): implement category listing endpoint` |
| **BE003 — อ่านรายการสถานที่สำหรับรายงาน** | `GET /api/v1/locations`  | `BE003/list-report-locations` | `feat(locations): implement location listing endpoint`  |

BE002 ให้เริ่มจาก `main` ล่าสุด ทำงานภายใน module ของตน และส่ง PR แยก ส่วน BE003 รวมแล้วใน PR #12 และเก็บสัญญาไว้ใช้อ้างอิง API ทั้งคู่เป็นการอ่านข้อมูลสาธารณะ ไม่ต้องล็อกอิน

## Frontend และ Backend อยู่ตรงไหน

Repository นี้ใช้ Next.js แอปเดียวใน `apps/web` ทำทั้งสองฝั่ง โฟลเดอร์ `app` จึงมีทั้งหน้าเว็บและ API

| ส่วน                      | ตำแหน่ง                                                                        | หน้าที่                                                 |
| ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| FE: หน้า Login            | `apps/web/src/app/login/page.tsx`                                              | ประกอบหน้าและ metadata                                  |
| FE: Dashboard และโครงหน้า | `apps/web/src/app/dashboard/`, `components/dashboard/` และ `components/shell/` | หน้าแรกหลัง Login, Topbar, Sidebar, Footer และ Skeleton |
| FE: การแสดงผลและการโต้ตอบ | `apps/web/src/components/auth/` และ `components/loading/`                      | ฟอร์ม Login, Skeleton, ตัวละคร และ animation            |
| FE: รูปแบบและค่ากลาง      | CSS Modules ข้าง component และ `apps/web/src/theme/`                           | Layout, สี และตัวอักษร                                  |
| BE: Route                 | `apps/web/src/app/api/v1/**/route.ts`                                          | ผูก HTTP method กับ URL                                 |
| BE: Presentation          | `apps/web/src/modules/*/presentation/`                                         | รับ request ตรวจ input และจัด response                  |
| BE: Application           | `apps/web/src/modules/*/application/`                                          | จัดลำดับงานและเรียก repository                          |
| BE: Domain                | `apps/web/src/modules/*/domain/`                                               | กำหนดชนิดข้อมูลและสัญญา repository                      |
| BE: Infrastructure        | `apps/web/src/modules/*/infrastructure/`                                       | ติดต่อ PostgreSQL ด้วย SQL ที่เขียนเอง                  |
| BE: Composition           | `apps/web/src/modules/*/composition.ts`                                        | ประกอบ service กับ repository ของแต่ละ module           |
| BE: เครื่องมือร่วม        | `apps/web/src/lib/http/api.ts` และ `packages/database/src/`                    | Response/error helpers, database pool และ query helper  |

เส้นทางข้อมูลของงานนี้คือ **Request → Route → Presentation → Application → Repository → PostgreSQL → Response** การแบ่งไฟล์ทำให้ส่วนรับ HTTP ไม่ต้องเขียน SQL เอง และส่วนอ่านฐานข้อมูลไม่ต้องรู้จัก React

ไฟล์ `.ts` ไม่ได้เป็น BE เสมอไป เช่น `modules/auth/presentation/login-client.ts` เป็นตัวเรียก API จากหน้า Login ส่วน `page.tsx` อาจเป็น Server Component ได้ ให้ดูหน้าที่และสิ่งที่ไฟล์เรียกใช้ด้วย ค่าลับและการเชื่อม PostgreSQL ต้องอยู่ฝั่ง server

## BE002 — อ่านรายการหมวดหมู่สิ่งของ

### ผลลัพธ์ที่ต้องการ

เมื่อเรียก `GET /api/v1/categories` ระบบอ่านตาราง `categories` แล้วส่งรายการหมวดหมู่กลับเป็น JSON เรียง `category_id` จากน้อยไปมาก และแบ่งหน้าด้วย `limit` / `offset`

| คอลัมน์ PostgreSQL | Field ใน JSON  | ชนิด   |
| ------------------ | -------------- | ------ |
| `category_id`      | `categoryId`   | number |
| `category_name`    | `categoryName` | string |

### ไฟล์และสิ่งที่ต้องทำ

| ไฟล์ภายใต้ `apps/web/src/`                                    | งาน                                                                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `app/api/v1/categories/route.ts`                              | Route ต่อไว้แล้ว ใช้เป็นจุดเริ่มไล่คำขอ                                                              |
| `modules/categories/presentation/list-categories.ts`          | แทน 501 ด้วยการตรวจ query เรียก service และส่ง response                                              |
| `modules/categories/application/category-service.ts`          | ปัจจุบันเป็น interface; เพิ่มส่วนทำงานให้ `list(page)` เรียก repository และคืน `Promise<Category[]>` |
| `modules/categories/domain/category.ts`                       | ใช้ `Category` และ `CategoryRepository` ที่มีอยู่                                                    |
| `modules/categories/infrastructure/pg-category-repository.ts` | สร้างไฟล์นี้เพื่ออ่านคอลัมน์ที่กำหนด เรียงรหัส แบ่งหน้า และแปลงชื่อ field                            |
| `modules/categories/composition.ts`                           | ต่อ service กับ SQL repository แทน placeholder                                                       |

งานเสร็จเมื่อ API คืนข้อมูลตรงกับตารางจริง รวมถึงกรณีไม่มีข้อมูลและ offset เลยรายการสุดท้าย โดยผ่านกติกาและรายการตรวจร่วมด้านล่าง

## BE003 — อ่านรายการสถานที่สำหรับรายงาน (รวมแล้ว)

ส่งและรวมแล้วใน [PR #12](https://github.com/ParkPawapon/reunite/pull/12) ไม่ต้องเริ่มงานนี้ซ้ำ ส่วนนี้เป็นตัวอย่างการแบ่ง module และสัญญาที่ใช้งานจริง

`GET /api/v1/locations` อ่าน PostgreSQL จริง เรียง `location_id` จากน้อยไปมาก แบ่งหน้าด้วย `limit` / `offset` และส่ง `locationId`, `locationName`, `detail` โดยรักษา `detail: null` เมื่อฐานข้อมูลเป็น NULL

| ไฟล์ภายใต้ `apps/web/src/`                                   | ส่วนที่ทำงานแล้ว                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `app/api/v1/locations/route.ts`                              | รับ HTTP request และส่งต่อไปยัง handler                                                |
| `modules/locations/presentation/list-locations.ts`           | ตรวจ query แบบ strict/ชื่อซ้ำ เรียก service และสร้าง response ผ่าน error envelope กลาง |
| `modules/locations/application/location-service.ts`          | `LocationService.list(page)` ส่งงานให้ repository                                      |
| `modules/locations/domain/location.ts`                       | ชนิดข้อมูลและสัญญา repository                                                          |
| `modules/locations/infrastructure/pg-location-repository.ts` | อ่านคอลัมน์ตามสัญญาด้วย parameterized SQL เรียงรหัสและแบ่งหน้า                         |
| `modules/locations/composition.ts`                           | ประกอบ service กับ PostgreSQL repository                                               |

Integration checks ตรวจข้อมูลที่ seed ใน schema ทดสอบจริง ทั้งลำดับ/การแบ่งหน้า, offset ที่ไม่มีข้อมูล, NULL และ query ที่ไม่ถูกต้อง สถานที่ในตารางยังไม่ได้เชื่อมกับ GeoJSON หรือโมเดล 3D งาน BE003 ไม่รวมชั้น ห้อง เส้นทาง หรือการแก้ข้อมูลแผนที่

## สัญญา API ที่ทั้งสองงานต้องใช้

### Request และ pagination

ใช้ `GET` ไม่มี request body และรับเฉพาะ query parameters ต่อไปนี้:

| Parameter | ค่าที่รองรับ       | ค่าเริ่มต้น |
| --------- | ------------------ | ----------- |
| `limit`   | จำนวนเต็ม 1–100    | 20          |
| `offset`  | จำนวนเต็ม 0–100000 | 0           |

ค่าไม่ถูกต้อง ชื่อ parameter ที่ไม่รองรับ หรือชื่อ parameter ซ้ำ ต้องตอบ **422** รหัส `VALIDATION_ERROR` เช่น `?limit=0`, `?limit=abc`, `?offset=-1`, `?unknown=1` และ `?limit=1&limit=2`

ใช้ `queryInput(request)` เพื่อตรวจชื่อซ้ำ และ `parse` กับ `paginationSchema` เพื่อตรวจค่า ต้องกำหนด schema ให้ปฏิเสธ field ที่ไม่รู้จักด้วย เช่น `paginationSchema.strict()` เพราะ `paginationSchema` เดิมไม่ได้เปิด strict ไว้เอง

### Response

สำเร็จตอบ **200** พร้อม `{ data: [...], meta: { limit, offset } }` โดย `meta` ต้องตรงกับค่าที่ใช้ query จริง ไม่เพิ่ม total count หรือ field อื่นนอกสัญญา

หากตารางว่างหรือ offset เลยข้อมูล ให้ตอบ 200 พร้อมรายการว่าง เช่น:

```json
{
  "data": [],
  "meta": {
    "limit": 20,
    "offset": 0
  }
}
```

ตัวอย่างนี้อธิบายรูปแบบ response เท่านั้น ผลลัพธ์ต้องมาจากการอ่าน PostgreSQL จริง ห้าม hardcode รายการหรือคืน array ว่างตลอด

ใช้ `success` จัดผลสำเร็จ และครอบงานด้วย `api` จาก `lib/http/api.ts` เพื่อรักษา error envelope, `X-Request-Id`, `Cache-Control: no-store` และการซ่อนข้อผิดพลาดภายใน

### การแบ่งหน้าที่และการเข้าถึงข้อมูล

- Presentation ตรวจ input ก่อนเรียก service; application รับค่าที่ตรวจแล้ว; repository รับผิดชอบ SQL; composition ประกอบ dependency
- Handler ได้ฟังก์ชัน `getService` จากส่วนกลาง ให้เรียก `getService()` ภายใน callback ของ `api` หลังตรวจ input เพื่อให้ข้อผิดพลาดระหว่างสร้าง service ผ่าน error handler เดิมด้วย
- ใช้ database/query helper ใน `@campus/database` และส่งค่าผ่าน SQL parameters เช่น `$1`, `$2` ห้ามต่อค่าผู้ใช้เข้า SQL และห้ามเพิ่ม ORM
- เลือกเฉพาะคอลัมน์ในสัญญา แปลงชื่อจากคอลัมน์ DB เป็น JSON และใช้ชนิดข้อมูลจาก domain เดิม
- รักษา `server-only` ในส่วนที่ใช้ SQL หรือ server infrastructure ห้ามส่ง ENV, connection string, SQL error หรือ stack trace กลับให้ผู้เรียก
- ส่วนกลางใน `lib/http/handlers.ts` และ `lib/composition.ts` ต่อเข้าทั้งสอง module แล้ว งานนี้ไม่จำเป็นต้องแก้ไฟล์กลางร่วมกัน

## เกณฑ์รับงานและหลักฐานที่ต้องแนบ

PR ของงานที่ยังไม่เสร็จต้องระบุ endpoint, ไฟล์ที่เปลี่ยน และผลเรียกผ่าน Postman หรือ curl โดยมี URL, HTTP status และ response ของกรณีต่อไปนี้:

| กรณี                                                 | ผลที่ต้องได้                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| เรียก URL โดยไม่ส่ง query                            | 200, `meta.limit = 20`, `meta.offset = 0`                      |
| `?limit=2&offset=0` และ `?limit=2&offset=2`          | 200, meta ตรง request, ข้อมูลเรียงรหัสขึ้นและแบ่งช่วงตรงกับ DB |
| `?limit=0`, `?limit=101`, `?limit=1.5`, `?limit=abc` | 422, `VALIDATION_ERROR`                                        |
| `?offset=-1`, `?offset=100001`                       | 422, `VALIDATION_ERROR`                                        |
| `?unknown=1` และ `?limit=1&limit=2`                  | 422, `VALIDATION_ERROR`                                        |
| ไม่มีรายการในช่วงที่ขอ                               | 200 และ `data: []` จากผล query จริง                            |
| ตรวจข้อมูลที่คืน                                     | ชื่อ field และชนิดตรงสัญญา ไม่มี field ภายใน DB หลุดออกมา      |
| สำหรับ BE003 เมื่อ `detail` ใน DB เป็น NULL          | JSON มี `detail: null`                                         |
| ตรวจ response headers ทั้งสำเร็จและผิดพลาด           | มี request ID และ `Cache-Control: no-store`                    |

ตรวจเทียบกับข้อมูลในฐานข้อมูล local หรือฐานข้อมูลทดสอบที่แยกไว้ ไม่เพิ่มหรือลบข้อมูลจริงเพื่อทำหลักฐาน ก่อนส่ง PR ให้รัน `bun run lint` และ `bun run typecheck` แล้วแนบผล

ผู้รับงานไม่ต้องเพิ่มหรือแก้ test files และต้องไม่ปิด CI หรือใส่ skip ขณะนี้ integration test ตรวจ categories เป็น 501 และตรวจ locations ที่เสร็จแล้วเป็น 200 พร้อม pagination/ข้อมูลจริง ผู้ดูแลการรวมงานจะปรับ assertion ของ categories ให้ตรวจ 200 ก่อน merge BE002

## ขอบเขตการเปลี่ยนแปลง

งานนี้ครอบคลุมหนึ่ง endpoint ต่อคน ได้แก่ validation, handler, application service, SQL repository และ composition ของ module ตัวเอง ใช้ Bun Workspaces, Next.js และ PostgreSQL ตามโครงสร้างเดิม

ไม่รวมหน้าเว็บ, Login, CRUD หมวดหมู่/สถานที่, migration, การแก้ schema, API อื่น หรือระบบ 3D หากพบว่าจำเป็นต้องเปลี่ยนสัญญาหรือไฟล์กลาง ให้ระบุเหตุผลใน PR เพื่อให้ทีมตกลงร่วมกันก่อนขยายขอบเขต

ผู้ดูแลการรวมงานรับผิดชอบปรับสถานะใน README และ API_CONTRACT เมื่อแต่ละ endpoint เสร็จ ข้อกำหนดร่วมดูได้ที่ [API_CONTRACT](../API_CONTRACT.md) และวิธีเตรียมเครื่องดู [README](../../README.md)

## คำศัพท์ที่ใช้

| คำ                       | ความหมาย                                                                       |
| ------------------------ | ------------------------------------------------------------------------------ |
| Endpoint                 | คู่ HTTP method และ URL เช่น `GET /api/v1/categories`                          |
| Query parameter          | ค่าท้าย URL เช่น `?limit=20&offset=0`                                          |
| Pagination               | การแบ่งข้อมูลเป็นช่วงด้วยจำนวนรายการและจุดเริ่มต้น                             |
| Validation               | การตรวจ input ว่าอยู่ในรูปแบบและขอบเขตที่รองรับ                                |
| Service                  | ส่วนจัดลำดับงานของ endpoint                                                    |
| Repository               | ส่วนอ่านข้อมูลตามสัญญาที่ domain กำหนด                                         |
| Composition / dependency | จุดประกอบส่วนต่าง ๆ และส่วนที่ต้องเรียกใช้เพื่อทำงาน                           |
| Contract / interface     | ข้อตกลงเรื่อง input/output; การมี interface อย่างเดียวยังไม่ได้ทำให้ API ทำงาน |
| Parameterized SQL        | แยกค่าข้อมูลออกจากข้อความ SQL เพื่อไม่ให้ค่ากลายเป็นคำสั่ง                     |
| 200 / 422 / 501          | สำเร็จ / input ไม่ผ่านกติกา / ยังไม่ได้พัฒนาให้ทำงาน                           |
