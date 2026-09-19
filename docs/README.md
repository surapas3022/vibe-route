# VibeRoute docs

สำเนาแผนในโฟลเดอร์นี้ สำหรับ zip / ส่งต่อทีม ยังไม่ใช่โค้ดแอป

ต้นฉบับที่ Cursor ใช้ยังอยู่ที่เครื่องคนเขียนแผน ไม่ลบออก เพื่อไม่ให้แผง Plan ใน Cursor หาย

| ไฟล์ | ส่งให้ใคร | เนื้อหา |
|---|---|---|
| [frontend-handoff.md](frontend-handoff.md) | คนทำ frontend | จอเดียว ฟิลด์ API ทุกช่อง สิ่งที่ห้ามคิดเอง |
| [ref/viberoute-frontend-ref.html](ref/viberoute-frontend-ref.html) | คนทำ frontend | เดโม HTML ที่ตรงสัญญา เปิดในเบราว์เซอร์แล้วทำตามใน React |
| [viberoute-plan.md](viberoute-plan.md) | คนทำ backend / ทั้งทีม | แผนเต็ม สถาปัตยกรรม กติกา rerank ingest เดโม |
| [add-region.md](add-region.md) | คนทำ backend | วิธี ingest ภาคอื่นโดยไม่รื้อ schema/API |
| [opportunity-canvas.md](opportunity-canvas.md) | สไลด์ / ที่ปรึกษา | 11 ช่อง Canvas ว่าแผนครอบแล้วช่องไหน |

สัญญา HTTP ที่ล็อกแล้ว: `contracts/openapi.yaml` และ `contracts/openapi.json` (ดึงจาก FastAPI) ให้ตรงกับตารางใน `frontend-handoff.md`

Backend อยู่ที่ `backend/` — รันตาม `backend/README.md`

Frontend อยู่ที่ `frontend/` — Vite + React + TypeScript ตามแผน เปิดผ่าน Docker `docker compose up --build` แล้วเข้า `http://localhost` หรือ `http://localhost:8080` nginx เสิร์ฟ `dist` และ proxy `/v1` ไป backend เลย์เอาต์ตาม [ref/viberoute-frontend-ref.html](ref/viberoute-frontend-ref.html)
