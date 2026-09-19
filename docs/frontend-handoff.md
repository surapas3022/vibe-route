# สัญญา Frontend — ให้หน้าบ้านตรงกับระบบ

ส่งไฟล์นี้ให้คนทำ frontend หน้าเดียวจบเดโม ไม่มีล็อกอิน ไม่มีแดชบอร์ด ไม่มีหน้าแอดมิน ททท.

เดโมที่เปิดดูเป็นภาพได้: [ref/viberoute-frontend-ref.html](ref/viberoute-frontend-ref.html) — mock ใช้ฟิลด์ API จริงและสถานที่ TAT ที่ล็อกไว้ ห้ามใช้ไฟล์ HTML เดิมอินทนนท์/ร่องขุ่น

แหล่งความจริงบนการ์ดคือ **response ของ backend** ไม่ใช่ `attraction.json` และไม่ใช่ข้อความที่โมเดลแต่ง

สัญญา HTTP เต็มอยู่ใน [viberoute-plan.md](viberoute-plan.md) ส่วนนี้คือ **ต้องวาดอะไรบนจอ**

## โครงจอ (375px ขึ้นไป)

```
[ แถบสถานะผู้ช่วย ]     [ สวิตช์เน้นชุมชนและจังหวัดรอง ]
[ ประวัติแชทซ้าย ]      [ ข้อความ intro ]
                       [ แผนที่จาก map_points ]
                       [ การ์ด places[0..5] ]
[ ช่องพิมพ์มู้ด + ส่ง ]
```

จอแคบ: ประวัติเป็นแผงเลื่อนทับ แผนที่อยู่เหนือการ์ด

## API ที่หน้าบ้านเรียก

ทุกคำขอใส่เฮดเดอร์ `X-Session-Id` (สร้าง UUID ในเบราว์เซอร์ครั้งแรก เก็บ localStorage)

- `GET /v1/health` → `{ assistant: { level, label, detail }, embed_ready, listing_count, poc_region }`
- `GET /v1/regions` และ `GET /v1/provinces?region=`
- `POST /v1/search` body `{ query, region?, province?, prefer_secondary, chat_id? }`
  - ค่าเริ่ม `region = ภาคเหนือ`, `prefer_secondary = true`
  - response `{ chat_id, message_id, intro, assistant, prefer_secondary, secondary_count, places[], map_points[] }`
- `GET /v1/chats` และ `GET /v1/chats/{id}`
- `POST /v1/feedback` `{ message_id, att_id, rating: 1 | -1 }`
- `GET /v1/places/{att_id}/images` และ `POST /v1/places/{att_id}/images` multipart
- `POST /v1/images/{image_id}/favorite`

ที่อยู่ API อ่านตอนรันจากช่องสำหรับทีมงาน / localStorage ค่าเริ่ม `http://localhost:8000` อย่าฝัง `VITE_API_BASE` เป็นทางเดียว

`places[]` แต่ละใบ: `att_id, name_th, province, district, type_label, why, score_vector, score_ranked, fee{status,label,text}, hours{status,label,text}, tel, website, facebook, limitation, lat, lng, images[]`

## สิ่งที่ต้องมีบนจอ

### 1. แถบสถานะผู้ช่วย (ตลอดเวลา)

ยิง `GET /v1/health` ตอนเปิดแอป แล้วทับด้วย `assistant` จากผลค้นล่าสุด

แสดง `assistant.label` เป็นข้อความหลัก และ `assistant.detail` เป็นคำอธิบายสั้น

สีตาม `assistant.level` เท่านั้น: `ready` / `fallback` / `off`

ห้ามโชว์ชื่อโมเดล, HTTP code, คำว่า token — ชื่อเทคนิคอยู่ในแผง **สำหรับทีมงาน**

ข้อความมาตรฐาน:

- **ผู้ช่วยพร้อม**
- **กำลังใช้ผู้ช่วยสำรอง**
- **ผู้ช่วยยังไม่พร้อม**

โหลดระหว่างค้น: `กำลังหาที่เที่ยวที่ตรงความรู้สึกของคุณ`

### 2. สวิตช์เน้นชุมชนและจังหวัดรอง

ค่าเริ่มต้นเปิด = ส่ง `prefer_secondary: true`

ปิด = ส่ง `prefer_secondary: false` แล้วค้นคำเดิมซ้ำ

ป้ายตอนปิดใช้ **เรียงตามความตรงมู้ด** หรือ **รวมเมืองหลัก** ห้ามเขียนว่า ยอดนิยม

หลังได้ผล โชว์ `secondary_count` เช่น `ใน 6 แห่งนี้ เป็นจังหวัดอื่นนอกเชียงใหม่ n แห่ง`

### 3. ช่องค้นมู้ด

ส่ง `{ query, region: "ภาคเหนือ", province?, prefer_secondary, chat_id? }`

ตัวกรองจังหวัดอ่านจาก `GET /v1/provinces?region=ภาคเหนือ` ไม่ฮาร์ดโค้ดรายชื่อ

ผลว่าง: แสดง `intro` จาก backend ตามเดิม ห้ามเดาจังหวัดอื่นมาเติมการ์ด

### 4. ข้อความ intro

แสดง `intro` ทั้งก้อนใต้แชทผู้ใช้ ห้ามตัดแล้วแต่งใหม่

### 5. การ์ดสถานที่ (สูงสุด 6 ใบ ตามลำดับ `places[]`)

ห้ามเรียงใหม่เอง ห้ามซ่อนใบเพราะไม่มีรูปหรือไม่มีค่าเข้าชม

| บนการ์ด | ฟิลด์ | กฎแสดง |
|---|---|---|
| ปก | `images` ใบที่ `is_cover` | ไม่มีรูปใช้พื้นว่าง ห้ามให้ AI วาด |
| ชื่อ | `name_th` | ตาม backend |
| ที่อยู่ | `province` · `district` | `district` เป็น null ไม่โชว์ |
| ประเภท | `type_label` | null ไม่โชว์แท็ก |
| ทำไมตรงมู้ด | `why` | ข้อความจาก backend ทั้งก้อน |
| ค่าเข้าชม | `fee.label` + ป้าย `fee.status` | `confirmed` = มีในฐาน, `unknown` = ยังไม่มี ห้ามคำนวณราคาจาก `fee.text` |
| เวลาเปิดปิด | `hours.label` + ป้าย `hours.status` | ห้าม parse เป็นชั่วโมง |
| โทร | `tel` | โชว์ปุ่มโทรเฉพาะเมื่อ `tel` ไม่เป็น null ถ้าค่าเข้าชมหรือเวลาเป็น unknown และมีเบอร์ ใช้ประโยค `กรุณาติดต่อ [tel] ก่อนเดินทาง` |
| ข้อจำกัด | `limitation` | โชว์เมื่อไม่เป็น null ไม่มีแล้วไม่ต้องมีช่องแดง |
| เว็บ/เฟซ | `website` `facebook` | ลิงก์เมื่อมี |
| คะแนน | `score_vector` `score_ranked` | แผงสำหรับทีมงานเท่านั้น |
| ตรง/ไม่ตรง | `POST /v1/feedback` | `{ message_id, att_id, rating: 1 \| -1 }` |

### 6. แผนที่

Leaflet + แผ่น OpenStreetMap ไม่ใช้ Google Maps ไม่ใช้คีย์

ปักเฉพาะจุดใน `map_points[]` (เป็นตัวเลขแล้ว)

ห้ามปักจาก `places[].lat` ถ้าเป็น null ห้ามแปลง URL เอง

จำนวนหมุดอาจน้อยกว่า 6 การ์ดที่ไม่มีหมุดยังอยู่ ถ้าไม่มีหมุดเลย โชว์แผนที่ว่าง ห้ามเดาพิกัด

### 7. รูปจากนักท่องเที่ยว

`POST /v1/places/{att_id}/images` ชนิด jpg/png/webp ไม่เกิน 5MB

ปุ่มถูกใจ `POST /v1/images/{image_id}/favorite`

เรียงตาม `images[]` ที่ backend ส่งมา ห้ามเรียง `fav_count` เองถ้าลำดับไม่ตรง

เฟส 1 โชว์ทันทีที่อัปโหลดสำเร็จ ไม่มีหน้าตรวจรูป

### 8. ประวัติซ้าย

`GET /v1/chats` รายการ, `GET /v1/chats/{id}` ทั้งข้อความ

คลิกประวัติแล้ววาด intro + การ์ด + แผนที่จากของที่เก็บไว้ ไม่ค้นใหม่จนกว่าจะพิมพ์คำใหม่

## สถานะที่ต้องมี

- เปิดแอปครั้งแรก: แถบสถานะจาก health + คำชวนพิมพ์มู้ด ไม่มีการ์ดปลอม
- กำลังค้น
- ได้ 6 การ์ด
- ได้ 0 การ์ด (ใช้ intro จาก backend)
- ผู้ช่วย `off` แต่การ์ดยังขึ้น
- อัปโหลดรูปไม่สำเร็จ (ชนิด/ขนาด)
- แผนที่ไม่มีหมุดเลย

## สิ่งที่หน้าบ้านห้ามทำ

- คำนวณค่าเข้าชม เวลา พิกัด ข้อจำกัดตลาด จาก JSON ดิบ
- เรียง `places[]` ใหม่ตามคะแนนที่หน้าบ้านคิดเอง
- เขียนว่าฟรี/มีค่าเข้า ถ้า `fee.status !== "confirmed"`
- เรียกโมเดลจากเบราว์เซอร์ (ไม่มี API key บน frontend)
- มีหน้า login / สมัคร ในเฟส 1

## ลำดับงานคน frontend

1. หน้าเปล่า + client + mock JSON ตาม schema นี้
2. แถบสถานะ + ช่องค้น + เรนเดอร์การ์ดให้ครบตาราง
3. ต่อ `POST /v1/search` จริง แผนที่จาก `map_points` สวิตช์ `prefer_secondary`
4. ประวัติ ฟีดแบ็ก อัปโหลดรูป ถูกใจ
5. โทนกระดาษ/หมึก รองรับ 375px แผงสำหรับทีมงาน

เดโมขั้นต่ำ: พิมพ์มู้ด → การ์ด 6 ใบพร้อมป้ายค่าเข้าชม/เวลา → สวิตช์เมืองรอง → แผนที่ → เคสไม่มีค่าเข้าชมแล้วยังมีเบอร์
