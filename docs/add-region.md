# เพิ่มภาคอื่นหลัง POC ภาคเหนือ

แผนใน [viberoute-plan.md](viberoute-plan.md) ตั้งใจไว้แล้ว: ตารางรองรับทั้งประเทศ (~8,634 แห่ง) แต่เดโม ingest และค้นเฉพาะภาคเหนือ (~2,077) ขยายภาคอื่นด้วยค่า `region` **ไม่รื้อ API และไม่รัน schema ใหม่**

ไฟล์ข้อมูลยังใช้ `data/attraction.json` ชุดเดิม ไม่ต้องแยกไฟล์ต่อภาค

## ชื่อภาคต้องตรงกับ TAT

กรองจาก `REGION_NAME_TH` ทีละตัวอักษร ไม่ใช่ชื่อเล่น

| ใช้ค่านี้ตอน ingest / ค้น | ประมาณจำนวนในไฟล์ | อย่าใช้ |
|---|---|---|
| `ภาคเหนือ` | ~2,077 | `North` |
| `ภาคกลาง` | ~2,433 | `Central` |
| `ภาคตะวันออกเฉียงเหนือ` | ~1,485 | `ภาคอีสาน` |
| `ภาคใต้` | ~1,474 | `South` |
| `ภาคตะวันออก` | ~1,153 | `East` |

มีแถวที่ไม่มีชื่อภาคประมาณ 12 รายการ ingest จะข้ามอยู่แล้ว

ตรวจชื่อจริงในไฟล์:

```powershell
python -c "import json; from collections import Counter; d=json.load(open(r'data\attraction.json',encoding='utf-8')); rows=d if isinstance(d,list) else d[list(d)[0]]; print(Counter(str(r.get('REGION_NAME_TH') or '') for r in rows))"
```

## สิ่งที่ไม่ต้องทำ

- ไม่แก้ `supabase/schema.sql` — คอลัมน์ `listings.region` และ index มีแล้ว
- ไม่สร้างตารางหรือ RPC ใหม่ — `match_listings_nvidia` / `match_listings_gemini` กรองด้วย `filter_region`
- ไม่ลบภาคเหนือที่ฝังแล้ว — upsert ตาม `att_id` แถวเดิมอยู่ครบ

ค่า default `'ภาคเหนือ'` ใน SQL เป็นแค่ fallback ถ้าไม่ส่ง `filter_region` API ปกติส่งค่าภาคมาอยู่แล้ว ไม่ต้องแก้ SQL เพื่อเพิ่มภาค

## Ingest ด้วยโค้ดปัจจุบัน (ไม่แก้สคริปต์)

`backend/scripts/ingest.py` กรองด้วย `POC_REGION` จาก `.env` ค่าเริ่มคือ `ภาคเหนือ`

**อย่าเปลี่ยน `POC_REGION` ใน `.env` ถาวร** ถ้ายังอยากให้ค่าเริ่มของแอปเป็นภาคเหนือ เพราะค่านั้นยังถูกใช้เป็น:

- ค่าเริ่มตอนค้นถ้า frontend ไม่ส่ง `region`
- จำนวนใน `GET /v1/health` (`listing_count`, `embed_*_count`)
- ค่าเริ่ม `GET /v1/provinces` ถ้าไม่ส่ง `?region=`

ตั้งชั่วคราวใน PowerShell แล้ว ingest ทีละภาค (ตัวอย่างภาคใต้ + NVIDIA):

```powershell
cd D:\CAMP\Hackathon
$env:PYTHONPATH = "D:\CAMP\Hackathon\backend"
$env:PYTHONUNBUFFERED = "1"
$env:POC_REGION = "ภาคใต้"
python -u backend\scripts\ingest.py --nvidia-only
```

สลับภาคด้วยการเปลี่ยน `$env:POC_REGION` แล้วรันซ้ำ อย่า ingest ทั้ง 5 ภาคในคำสั่งเดียวด้วยโค้ดชุดนี้ เพราะสคริปต์รับภาคเดียวต่อรอบ

- ไม่ใส่ `--reembed` ถ้าต้องการฝังเฉพาะแถวที่ยังไม่มีเวกเตอร์ (ภาคเหนือที่ฝังแล้วจะถูกข้าม)
- ใส่ `--gemini-only` ถ้าจะทำพาส Gemini 768 แยก
- ไม่ใส่แฟลกเลย = NVIDIA แล้วตามด้วย Gemini

หลังจบ ลบตัวแปรชั่วคราวถ้าไม่ต้องการให้ process ถัดไปใช้ภาคใต้:

```powershell
Remove-Item Env:POC_REGION
```

ตรวจว่าขึ้นในฐาน (ต้องมีเซิร์ฟเวอร์รันอยู่):

```powershell
curl http://localhost:8000/v1/regions
curl "http://localhost:8000/v1/provinces?region=ภาคใต้"
```

`GET /v1/health` ยังนับเฉพาะ `POC_REGION` ใน `.env` จึงอาจยังโชว์จำนวนเหนือแม้ภาคใต้ฝังครบแล้ว — ถือว่าปกติจนกว่าจะแยก `--region` ออกจากค่าเริ่มของแอป

## วิธีข้ามแถวที่ฝังแล้ว

ไม่ได้เทียบไฟล์ JSON กับของเก่าทีละฟิลด์ แต่ถาม Supabase ว่า `att_id` นี้มีเวกเตอร์ในคอลัมน์ของพาสนั้นหรือยัง

- คีย์หลักคือ `att_id`
- NVIDIA ดู `embedding_nvidia` Gemini ดู `embedding_gemini` คนละชุด
- “เคยใส่แล้ว” = คอลัมน์นั้นไม่เป็น `null` ไม่ใช่ว่ามีแถวในตารางแล้วก็จบ
- ถ้าไม่ใส่ `--reembed` จะดึง id ที่ข้ามได้จาก `db.existing_embedded_ids(region, column=...)` แล้วทำเฉพาะที่เหลือ
- ตอนเริ่มพาสจะพิมพ์เช่น `nvidia-2048 remaining to embed: 0` แปลว่าคอลัมน์นี้ในภาคนั้นครบแล้ว
- รันซ้ำหลังไฟดับหรือโควตาหมดได้ ของที่ใส่ไปแล้วจะไม่ยิง API ซ้ำ
- `--reembed` จะฝังใหม่ทั้งภาค ทับของเก่า
- skip **ไม่ได้** เทียบว่าชื่อหรือรายละเอียดใน JSON เปลี่ยนหรือเปล่า ถ้าข้อความเปลี่ยนแต่ `att_id` เดิมและไม่ใส่ `--reembed` เวกเตอร์เก่าอยู่

เปลี่ยน `POC_REGION` เป็นภาคใต้แล้วรัน จะดูแค่แถว `region = ภาคใต้` ภาคเหนือไม่ถูกนับใน skip และไม่ถูกแตะ

## แก้ ingest ให้รับ `--region` (แนะนำก่อนขยายจริง)

ตอนนี้สคริปต์ล็อกกับ `POC_REGION` และพิมพ์ว่า `North listings prepared` ควรแยกสองค่า:

- `POC_REGION` = ค่าเริ่มของแอป (เดโมยังเป็นภาคเหนือได้)
- `--region ภาคใต้` = ภาคที่ ingest รอบนี้

ใน `backend/scripts/ingest.py`:

1. เพิ่ม `--region` (ค่าเริ่ม = `settings.poc_region`)
2. ส่งค่านั้นเข้า `prepare_row(raw, region)` และ `existing_embedded_ids(region, ...)`
3. เปลี่ยนข้อความ log จาก `North listings prepared` เป็นชื่อภาคจริง
4. อย่าให้ `--region` ไปเปลี่ยนค่าเริ่มของ `/v1/search`

ตัวอย่างหลังแก้แล้ว:

```powershell
python -u backend\scripts\ingest.py --nvidia-only --region ภาคใต้
python -u backend\scripts\ingest.py --nvidia-only --region ภาคกลาง
```

รอบละภาคดีกว่า ingest ทั้งประเทศทีเดียว เพราะโควตา embed และเวลา pause ในสคริปต์ (batch 10, พัก ~1.5 วินาที)

## ให้ค้นเจอภาคใหม่

สัญญาค้นมี `region` อยู่แล้ว ค่าเริ่มถ้าไม่ส่งคือ `POC_REGION`

Frontend ต้อง:

1. โหลดรายภาคจาก `GET /v1/regions` อย่าฮาร์ดโค้ด `<option>ภาคเหนือ</option>` อย่างใน [ref/viberoute-frontend-ref.html](ref/viberoute-frontend-ref.html)
2. ส่ง `POST /v1/search` เป็น `{ "query": "...", "region": "ภาคใต้", "province": null, "prefer_secondary": true }`
3. จังหวัดในภาคนั้นโหลดจาก `GET /v1/provinces?region=ภาคใต้` ไม่ฮาร์ดโค้ดรายชื่อ

ถ้าไม่ส่ง `region` ระบบจะค้นภาคเหนือ แม้ฐานจะมีภาคอื่นอยู่แล้ว

## จุดที่ยังฮาร์ดโค้ดภาคเหนือ

ค้นหา/ฝังทำงานได้ทันทีหลัง ingest แต่ข้อความและกติกาเมืองรองยังเป็นของเหนือ

| จุด | ไฟล์ | ผลถ้าไม่แก้ |
|---|---|---|
| intro ว่าง / fallback | `backend/app/routers/search.py` `_fallback_intro` | ข้อความยังพูดว่า «ภาคเหนือ» ทั้งที่ค้นภาคอื่น |
| intro เมื่อไม่มีการ์ด / fallback LLM | `backend/app/llm.py` `explain_vibe` | เช่นเดียวกัน |
| system prompt | `backend/app/llm.py` `_system_prompt` | บอกโมเดลว่าอธิบาย Northern Thailand อยู่ |
| ลดน้ำหนักเชียงใหม่ | `backend/app/rerank.py` | ทุกภาค: จังหวัดที่ไม่ใช่เชียงใหม่ได้ ×1.08 จังหวัดหลักของภาคนั้นไม่ถูกดึงลง |
| `secondary_count` | `rerank.secondary_count` | นับ «ไม่ใช่เชียงใหม่» แม้จะเป็นภาคใต้ |
| เดโม HTML | `docs/ref/viberoute-frontend-ref.html` | ล็อก `region: "ภาคเหนือ"` |
| เทสค่าเริ่ม | `backend/tests/test_api.py` | คาด `poc_region == ภาคเหนือ` — อย่าเปลี่ยน `.env` ถาวรถ้ายังใช้เทสชุดนี้ |

กติกา rerank ที่สมเหตุสมผลต่อภาค (แนวทาง ยังไม่มีในโค้ด):

- ภาคเหนือ: ลด `เชียงใหม่` (มีอยู่แล้ว)
- ภาคกลาง: ควรลด `กรุงเทพมหานคร`
- ภาคตะวันออก: พิจารณา `ชลบุรี`
- ภาคใต้: พิจารณา `ภูเก็ต` / `สุราษฎร์ธานี`
- ภาคตะวันออกเฉียงเหนือ: ดูจังหวัดที่หนาสุดในฐานหลัง ingest แล้วค่อยล็อก

อย่าใช้จำนวนลิสต์เป็น proxy ความนิยม คนไปจริงกับจำนวนแหล่งใน JSON ไม่ตรงกัน ดูเหตุผลในแผนหลัก

## เช็กว่าภาคใหม่พร้อมใช้

1. Ingest จบโดยไม่ `stopped:` จากโควตา
2. `GET /v1/regions` มี `{ "name": "ภาคใต้", "count": ... }`
3. ค้นด้วย body ที่ระบุภาค แล้วการ์ด `province` อยู่ในภาคนั้น
4. ค้นภาคเหนือคำเดิม ผลไม่เพี้ยน
5. ผลว่างต้องเป็น intro ของภาคนั้น ไม่ดึงจังหวัดจากภาคอื่นมาเติม — RPC กรอง `l.region = filter_region` อยู่แล้ว

## ค่าใช้จ่าย / เวลา

สคริปต์ฝังทีละ 10 แถว พัก 1.5 วินาที (NVIDIA) / 1.2 วินาที (Gemini) แถวที่ผ่าน `prepare_row` ต้องมี `STATUS_DATA` ใช้งานได้ ชื่อไม่ใช่ `test` และมีรายละเอียด

ภาคกลางใหญ่สุด (~2,433 ก่อนกรองคุณภาพ) จึงแพงและนานกว่าภาคเหนือ ถ้าคีย์หมดกลางคัน รันซ้ำโดยไม่ใส่ `--reembed` ได้
