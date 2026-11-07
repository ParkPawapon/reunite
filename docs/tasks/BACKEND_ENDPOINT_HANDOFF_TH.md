# มอบหมายงาน Backend คนละหนึ่ง Endpoint

> สถานะล่าสุด: BE003 ของเพื่อนคนที่ 2 ส่งแล้วและอ่าน locations จาก PostgreSQL จริง ตอบ 200 พร้อม pagination; ผู้รวมงานเพิ่มการตรวจรับให้ตรงกับ API แล้ว งาน BE002 ของเพื่อนคนที่ 1 ยังสงวนไว้และ categories ยังตอบ 501 ส่วนรายละเอียดด้านล่างเป็นสัญญางานเดิมสำหรับใช้อ้างอิง

ชุดเริ่มงานนี้ถอด implementation เดิมของสอง endpoint ออกแล้ว ทั้ง HTTP orchestration, application service implementation และ SQL adapter เหลือสัญญาชนิดข้อมูล จุดต่อ และสถานะ `501 NOT_IMPLEMENTED` ให้เห็นชัดว่างานยังไม่เสร็จ ไม่มีการลบตารางหรือข้อมูลใน PostgreSQL

เอกสารนี้เป็นงานรอบใหม่ต่อจากการส่งมอบ 8 commit ก่อนหน้า หลัง PR ชุด starter นี้ merge แล้ว ให้ทั้งคู่ดึง main ล่าสุดและแตก branch จากจุดเดียวกัน โดยตรวจว่าสอง endpoint ตอบ 501 ตามชุดเริ่มงานก่อนลงมือ

## การแบ่งงาน

| ผู้รับผิดชอบ  | TASK                                      | Branch ที่ให้สร้างเมื่อได้รับ starter แล้ว | Endpoint                 |
| ------------- | ----------------------------------------- | ------------------------------------------ | ------------------------ |
| เพื่อนคนที่ 1 | **BE002 — อ่านรายการหมวดหมู่สิ่งของ**     | `BE002/list-item-categories`               | `GET /api/v1/categories` |
| เพื่อนคนที่ 2 | **BE003 — อ่านรายการสถานที่สำหรับรายงาน** | `BE003/list-report-locations`              | `GET /api/v1/locations`  |

แต่ละคนรับผิดชอบหนึ่ง HTTP method + หนึ่ง URL มีหลายไฟล์เพราะแยกหน้าที่ตามโครงสร้างเดิม ทั้งสองงานเป็น API อ่านข้อมูลสาธารณะ ไม่ต้องล็อกอิน และมีขนาดงานใกล้เคียงกัน รอบนี้ไม่มอบหมายงาน FE, migration, login, endpoint เพิ่ม หรือการเขียน/แก้ test

Commit ที่แนะนำ:

- BE002: `feat(categories): implement category listing endpoint`
- BE003: `feat(locations): implement location listing endpoint`

## BE และ FE อยู่ตรงไหน

เราใช้ Next.js แอปเดียวใน `apps/web` ทำทั้งสองฝั่ง ชื่อโฟลเดอร์ `app` จึงไม่ได้หมายถึง FE ทั้งหมด

| ส่วน                     | ตำแหน่งจริง                                                                   | หน้าที่                                           |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| FE: หน้าเว็บ             | `apps/web/src/app/login/page.tsx`                                             | ประกอบหน้า Login และกำหนด metadata                |
| FE: component            | `apps/web/src/components/auth/login-experience.tsx` และ `components/loading/` | แสดงหน้าจอ รับการกด/กรอก และจัดการภาพเคลื่อนไหว   |
| FE: รูปแบบ               | CSS Modules ข้าง component และ `apps/web/src/theme/`                          | จัดหน้าตาและค่ากลาง เช่น สี/ตัวอักษร              |
| BE: ประตู API            | `apps/web/src/app/api/v1/**/route.ts`                                         | รับ HTTP method ตาม URL แล้วส่งงานต่อ             |
| BE: ตัวประสาน HTTP       | `apps/web/src/lib/http/handlers.ts` และ `modules/*/presentation/`             | ตรวจ request เรียก service และจัด response        |
| BE: กฎและลำดับงาน        | `apps/web/src/modules/*/application/`                                         | ทำงานของ endpoint โดยไม่ผูกกับ React/Next/pg      |
| BE: สัญญา/ชนิดข้อมูล     | `apps/web/src/modules/*/domain/`                                              | ระบุรูปข้อมูลและสิ่งที่ repository ต้องทำได้      |
| BE: SQL                  | `apps/web/src/modules/*/infrastructure/`                                      | อ่าน/เขียน PostgreSQL ด้วย pg และ SQL ที่เขียนเอง |
| BE: การประกอบ dependency | `apps/web/src/lib/composition.ts` และ `modules/*/composition.ts`              | ต่อ service เข้ากับ repository และ database       |
| BE: เครื่องมือฐานข้อมูล  | `packages/database/src/` กับ `packages/database/migrations/`                  | pool, query helper, transaction และ versioned SQL |

ไฟล์ `.ts` ไม่ได้แปลว่าเป็น BE เสมอ เช่น `modules/auth/presentation/login-client.ts` ถูกเรียกจากหน้า Login เพื่อ fetch API และการมี `page.tsx` ก็ไม่ได้แปลว่าโค้ดทุกบรรทัดรันใน browser เพราะ Next.js มี Server Components การแยกต้องดูหน้าที่และ dependency ด้วย

FE เรียก `/api/v1/...` ผ่าน HTTP ส่วนการอ่าน PostgreSQL และค่าลับอย่าง DATABASE_URL อยู่บน server เท่านั้น

## BE002 — อ่านรายการหมวดหมู่สิ่งของ

### บทที่ใช้สั่งงาน

“งานของนายคือทำ GET /api/v1/categories หนึ่งเส้น ใช้สำหรับอ่านหมวดหมู่สิ่งของจากฐานข้อมูลแล้วส่งกลับให้หน้าเว็บเอาไปใช้ต่อ

เริ่มจากดู route ว่าคำขอเข้าทางไหน จากนั้นทำตัวรับ request ใน module categories ตรวจ limit กับ offset เรียก service แล้วให้ repository อ่านตาราง categories ด้วย SQL

ผลลัพธ์แต่ละรายการต้องมี categoryId และ categoryName เรียงตามรหัสจากน้อยไปมาก ถ้าตารางว่างก็ส่งรายการว่างได้ แต่ต้องเป็นผลจากการอ่านฐานข้อมูลจริง

รอบนี้ทำเฉพาะเส้นอ่านรายการ ไม่ต้องทำหน้าเว็บ ไม่ต้องเพิ่มเส้นสร้างหรือแก้หมวดหมู่ และไม่ต้องเขียน test เพิ่ม ตอนส่งงานขอ URL ที่ลองผ่าน Postman พร้อม status และ response ให้ดูด้วย”

### ไฟล์ของงานนี้

- ดูจุดรับคำขอ: `apps/web/src/app/api/v1/categories/route.ts` ซึ่งต่อไว้แล้ว
- ทำ HTTP handler: `apps/web/src/modules/categories/presentation/list-categories.ts`
- ทำ application service: `apps/web/src/modules/categories/application/category-service.ts` ปัจจุบันเหลือ interface ให้เปลี่ยนเป็น implementation ตาม contract
- สร้าง SQL adapter ใหม่: `apps/web/src/modules/categories/infrastructure/pg-category-repository.ts`
- ต่อของจริงแทน placeholder ใน `apps/web/src/modules/categories/composition.ts`
- ใช้ชนิดข้อมูลและ repository contract ที่มีใน `apps/web/src/modules/categories/domain/category.ts`

ไม่จำเป็นต้องแก้ `lib/http/handlers.ts` หรือ `lib/composition.ts` เพราะผู้ดูแลต่อการส่งงานเข้า module นี้ไว้แล้ว

### สัญญาผลลัพธ์

| คอลัมน์ PostgreSQL | ชื่อใน JSON    | ชนิด   |
| ------------------ | -------------- | ------ |
| `category_id`      | `categoryId`   | number |
| `category_name`    | `categoryName` | string |

อ่านจากตาราง `categories` เรียง `category_id` จากน้อยไปมาก และแบ่งหน้าตาม limit/offset

## BE003 — อ่านรายการสถานที่สำหรับรายงาน

### บทที่ใช้สั่งงาน

“งานของนายคือทำ GET /api/v1/locations หนึ่งเส้น ใช้สำหรับอ่านสถานที่ที่ระบบรายงานอ้างอิงได้

ทำอยู่ใน module locations ตรวจ limit กับ offset จาก request แล้วเรียก service และ repository เพื่ออ่านตาราง locations จริง

ผลลัพธ์มี locationId, locationName และ detail เรียงรหัสจากน้อยไปมาก detail อาจเป็น null ได้ ต้องส่ง null กลับตามข้อมูล ไม่เปลี่ยนเป็นข้อความอื่นเอง

งานนี้เป็นรายการสถานที่ในฐานข้อมูล ยังไม่ใช่งานค้นหาอาคารสามมิติ ชั้น ห้อง หรือคำนวณเส้นทาง รอบนี้ไม่ต้องทำหน้าเว็บ ไม่ต้องแก้โมเดล และไม่ต้องเขียน test เพิ่ม ตอนส่งงานขอ URL, status และ response ที่ลองผ่าน Postman เช่นเดียวกัน”

### ไฟล์ของงานนี้

- ดูจุดรับคำขอ: `apps/web/src/app/api/v1/locations/route.ts` ซึ่งต่อไว้แล้ว
- ทำ HTTP handler: `apps/web/src/modules/locations/presentation/list-locations.ts`
- ทำ application service: `apps/web/src/modules/locations/application/location-service.ts` ปัจจุบันเหลือ interface ให้เปลี่ยนเป็น implementation ตาม contract
- สร้าง SQL adapter ใหม่: `apps/web/src/modules/locations/infrastructure/pg-location-repository.ts`
- ต่อของจริงแทน placeholder ใน `apps/web/src/modules/locations/composition.ts`
- ใช้ชนิดข้อมูลและ repository contract ที่มีใน `apps/web/src/modules/locations/domain/location.ts`

ไม่จำเป็นต้องแก้ไฟล์กลางร่วมกับ BE002

### สัญญาผลลัพธ์

| คอลัมน์ PostgreSQL | ชื่อใน JSON    | ชนิด             |
| ------------------ | -------------- | ---------------- |
| `location_id`      | `locationId`   | number           |
| `location_name`    | `locationName` | string           |
| `detail`           | `detail`       | string หรือ null |

อ่านจากตาราง `locations` เรียง `location_id` จากน้อยไปมาก และแบ่งหน้าตาม limit/offset ข้อมูลนี้ยังไม่ได้เชื่อมอัตโนมัติกับ GeoJSON/โมเดล 3D

## กติกาที่ทั้งคู่ต้องทำเหมือนกัน

1. ใช้ GET และรับเฉพาะ query parameters `limit` กับ `offset` ไม่มี request body
2. `limit` เป็นจำนวนเต็ม 1–100 ค่าเริ่มต้น 20
3. `offset` เป็นจำนวนเต็ม 0–100000 ค่าเริ่มต้น 0
4. ค่าไม่ถูกต้อง ชื่อ parameter ที่ไม่รองรับ หรือชื่อ parameter ซ้ำ ต้องตอบ 422 ตาม helper เดิม
5. สำเร็จตอบ 200 พร้อม `{ data: [...], meta: { limit, offset } }` ไม่ต้องเพิ่ม total count
6. ตารางว่างตอบ 200 พร้อม `data: []` ซึ่งต้องมาจากการ query จริง
7. ใช้ PostgreSQL ผ่านเครื่องมือเดิมใน `@campus/database` เขียน SQL เองและส่งค่าผ่าน parameters เช่น `$1`, `$2` ห้ามต่อค่าผู้ใช้เข้า SQL และห้ามเพิ่ม ORM
8. เลือกเฉพาะคอลัมน์ที่ต้องใช้ แล้วแปลงชื่อเป็น JSON ตาม contract
9. ใช้ `api`, `parse`, `paginationSchema`, `queryInput`, `success` ใน `apps/web/src/lib/http/api.ts` ตามหน้าที่ เพื่อให้ error envelope, request ID และ no-store headers ยังเป็นมาตรฐานเดียวกัน
10. การ validation อยู่ใน presentation; application รับค่าที่ตรวจแล้ว; SQL อยู่ใน infrastructure; การต่อชิ้นส่วนอยู่ใน composition ของ module ตัว handler รับฟังก์ชัน `getService` มาให้เรียก `getService()` ภายใน callback ของ `api` หลังตรวจ input เพื่อให้ข้อผิดพลาดตอนสร้าง dependency ยังผ่านตัวจัดการ error เดิม
11. รักษา `server-only` ในส่วนที่ใช้ SQL หรือ server infrastructure ห้ามส่ง ENV, SQL error, stack หรือ connection string กลับให้ผู้เรียก
12. ทำเฉพาะ module ของตน ไม่มีการเพิ่มข้อมูลจริง แก้ schema หรือเพิ่ม API อื่น

ตัวอย่าง response ที่ถูกต้องเมื่อไม่มีข้อมูล:

```json
{
  "data": [],
  "meta": {
    "limit": 20,
    "offset": 0
  }
}
```

นี่เป็นตัวอย่างรูปแบบ response ไม่ใช่ implementation ให้คืน array ว่างตลอด

## ของที่เตรียมให้แล้วและของที่ต้องลงมือทำ

มีให้แล้ว: route wiring, service/domain contracts, module-owned composition จุดต่อ, database pool/query helper, pagination/error helpers และ migration ของตารางจริง

ต้องทำเอง: ตรวจ request, เรียก service, application implementation, SQL repository, แปลงแถวข้อมูล และต่อ dependency ของ module ให้ครบ ปัจจุบันทั้ง handler และ service factory ตอบ 501 และไม่มี SELECT ของสองรายการนี้เหลือใน production implementation

ให้ทั้งคู่ทำคนละ module เพื่อให้รวมงานง่าย ผู้ดูแลเป็นคนปรับสถานะใน README/API_CONTRACT เมื่อทั้งสองงานเสร็จ จึงไม่ต้องแก้เอกสารกลางแข่งกัน

## วิธีส่งงานโดยไม่มอบหมายการเขียน test

ให้เปิด PR แยกคนละงาน พร้อมอธิบาย endpoint และไฟล์ที่เปลี่ยน แนบผลลองเรียกด้วย Postman หรือ curl อย่างน้อย:

- URL ปกติ: ได้ 200 และ meta ค่าเริ่มต้น
- `?limit=2&offset=0`: ได้ 200 และ meta ตรงกับ request
- `?limit=0`, `?limit=101`, `?offset=-1`: ได้ 422
- `?unknown=1` และ `?limit=1&limit=2`: ได้ 422
- ตรวจชื่อ/ชนิด fields และลำดับรหัสจาก response; สำหรับ locations ตรวจว่า detail ที่เป็น null ยังคงเป็น null

ให้ตรวจ `bun run lint` และ `bun run typecheck` ก่อนส่งงาน ไม่ต้องเพิ่มหรือแก้ test files ไม่ปิด CI และไม่ใส่ skip ให้ test เดิม

ผู้ดูแลปรับเฉพาะ assertion ใน test integration เดิมให้ตรวจสถานะ 501, error ของแต่ละ TASK, request ID, no-store headers และ service placeholder ตามพฤติกรรม starter ปัจจุบัน ส่วนการตรวจสิทธิ์เขียนข้อมูลยังอยู่ครบ ไม่มีการ skip test หรือเปลี่ยนกฎ CI

เมื่อ endpoint ของเพื่อนแต่ละคนเสร็จ ผู้ดูแลเป็นคนปรับ assertion ของส่วนนั้นกลับมาตรวจข้อมูลที่ seed ในฐานข้อมูลทดสอบจริง พร้อมผล 200, pagination และลำดับข้อมูล ก่อนรวม PR งานของเพื่อนจึงยังไม่รวมการเขียน test ส่วนผู้ดูแลรับผิดชอบให้ CI ตรงกับพฤติกรรมที่ตั้งใจในแต่ละช่วง การผ่าน CI ของ starter หมายถึง placeholder และระบบส่วนที่เหลือทำงานตามที่ตรวจ ไม่ได้หมายความว่าสอง endpoint ทำเสร็จแล้ว

## บทเปิดประชุมกับเพื่อนทั้งสองคน

“รอบนี้ให้ทำ Backend คนละหนึ่ง endpoint งานมีขนาดใกล้กัน คนแรกอ่านหมวดหมู่ คนที่สองอ่านสถานที่ ยังไม่ต้องทำหน้าเว็บหรือเขียน test เพิ่ม

Endpoint หมายถึงคู่ของ method กับ URL เช่น GET /api/v1/categories คำว่า GET คือขออ่านข้อมูล ส่วน URL บอกว่าจะอ่านเรื่องอะไร

FE คือส่วนที่ผู้ใช้เห็นและกด อยู่ในหน้า page กับ components ส่วน BE คือส่วนรับคำขอ ตรวจข้อมูล ทำงานกับฐานข้อมูล และตอบกลับ ใน repo นี้ใช้ Next.js ตัวเดียว แต่แยกหน้าที่ไว้ตามโฟลเดอร์

ให้เริ่มไล่จาก route ไป presentation, application และ infrastructure ชื่อพวกนี้อาจดูเยอะ แต่จำง่าย ๆ ว่า รับคำขอ → จัดลำดับงาน → คุยฐานข้อมูล

ผมถอด logic เดิมของสองเส้นออกแล้ว ตอนนี้ได้ 501 ซึ่งแปลว่างานยังไม่ได้ implement พวกนายต้องต่อให้ข้อมูลเดินทางจากฐานข้อมูลกลับออกมาได้จริง

ทำใน module ของตัวเอง ถ้าเจอว่าต้องแก้ไฟล์กลางหรือ schema ให้คุยก่อน เพราะสองงานนี้วางให้ทำแยกกันได้ ตอนส่งขอให้เล่าด้วยว่ารับอะไร อ่านตารางไหน และตอบอะไรกลับมา”

## คำเทคนิคที่ใช้ในบท

| คำ                   | ความหมายง่าย ๆ                                                   |
| -------------------- | ---------------------------------------------------------------- |
| FE / Frontend        | ส่วนหน้าเว็บและการโต้ตอบที่ผู้ใช้เห็น                            |
| BE / Backend         | ส่วนฝั่ง server ที่รับคำขอ ทำงาน และติดต่อฐานข้อมูล              |
| Endpoint             | คู่ method และ URL ที่เรียกทำงานได้หนึ่งแบบ                      |
| Request / Response   | สิ่งที่ผู้เรียกส่งเข้ามา / สิ่งที่ระบบส่งกลับ                    |
| Query parameter      | ค่าท้าย URL เช่น `?limit=20&offset=0`                            |
| Pagination           | แบ่งข้อมูลออกมาเป็นช่วง แทนการดึงทั้งหมด                         |
| Validation           | ตรวจว่าค่าที่รับมาอยู่ในรูปแบบและขอบเขตที่รองรับ                 |
| Service              | ส่วนจัดลำดับงานของ endpoint                                      |
| Repository           | ส่วนติดต่อข้อมูลตามสัญญาที่กำหนด                                 |
| Composition          | จุดประกอบ service, repository และ database เข้าด้วยกัน           |
| Contract / interface | ข้อตกลงว่ารับค่าอะไรและต้องส่งผลแบบไหน ยังไม่ใช่โค้ดที่ทำงานจริง |
| Parameterized SQL    | แยกค่าที่รับมาจากข้อความ SQL เพื่อให้ค่าไม่กลายเป็นคำสั่ง        |
| 200 / 422 / 501      | สำเร็จ / คำขอมีค่าที่ไม่ผ่านกติกา / ยังไม่ได้ implement          |

ข้อคิดให้ฝากท้ายงาน: “หนึ่ง endpoint อาจใช้หลายไฟล์ แต่ทุกไฟล์ต้องบอกได้ว่ารับผิดชอบอะไร ถ้ายังอธิบายไม่ได้ว่าข้อมูลวิ่งผ่านแต่ละส่วนอย่างไร ให้ไล่เส้นทางนั้นก่อนเพิ่มโค้ด”
