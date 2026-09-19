from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db
from app.config import get_settings
from app.embed import EmbedError, embed_gemini_texts, embed_nvidia_texts
from app.tat import load_records, prepare_row


def to_vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{value:.8f}" for value in values) + "]"


def _facts(row: dict) -> dict:
    return {key: value for key, value in row.items() if key != "embed_text"}


async def _run_pass(
    *,
    name: str,
    column: str,
    dim: int,
    todo: list[dict],
    embedder,
    batch_size: int,
    pause: float,
) -> None:
    print(f"{name} remaining to embed: {len(todo)}", flush=True)
    if not todo:
        return
    for start in range(0, len(todo), batch_size):
        chunk = todo[start : start + batch_size]
        try:
            vectors = await embedder(
                [row["embed_text"] for row in chunk],
                task_type="RETRIEVAL_DOCUMENT",
            )
        except EmbedError as exc:
            print(f"{name} stopped: {exc}", flush=True)
            return
        payload = []
        for row, vector in zip(chunk, vectors):
            if len(vector) != dim:
                raise SystemExit(f"{name} dim {len(vector)} ที่ {row['att_id']} ต้องเป็น {dim}")
            item = _facts(row)
            item[column] = to_vector_literal(vector)
            payload.append(item)
        db.upsert_listings(payload)
        print(f"{name} upserted {min(start + batch_size, len(todo))}/{len(todo)}", flush=True)
        await asyncio.sleep(pause)


async def ingest(*, reembed: bool, nvidia: bool, gemini: bool) -> None:
    settings = get_settings()
    path = Path(settings.data_path)
    if not path.is_absolute():
        path = ROOT / path
    if not path.exists():
        raise SystemExit(f"ไม่พบไฟล์ข้อมูล: {path}")
    if not db.supabase_configured():
        raise SystemExit("ตั้งค่า SUPABASE_URL และ SUPABASE_SECRET_KEY ก่อน")
    if nvidia and not settings.nvidia_key_list:
        raise SystemExit("ตั้งค่า NVIDIA_API_KEY ก่อน")
    if gemini and not settings.gemini_key_list:
        raise SystemExit("ตั้งค่า GEMINI_API_KEY ก่อน")

    records = load_records(path)
    prepared = []
    for raw in records:
        row = prepare_row(raw, settings.poc_region)
        if row:
            prepared.append(row)
    prepared = list({row["att_id"]: row for row in prepared}.values())
    print(f"North listings prepared: {len(prepared)}", flush=True)

    if nvidia:
        skip = set() if reembed else db.existing_embedded_ids(settings.poc_region, column="embedding_nvidia")
        todo = [row for row in prepared if row["att_id"] not in skip]
        await _run_pass(
            name="nvidia-2048",
            column="embedding_nvidia",
            dim=settings.embed_dims_nvidia,
            todo=todo,
            embedder=embed_nvidia_texts,
            batch_size=10,
            pause=1.5,
        )
    if gemini:
        skip = set() if reembed else db.existing_embedded_ids(settings.poc_region, column="embedding_gemini")
        todo = [row for row in prepared if row["att_id"] not in skip]
        await _run_pass(
            name="gemini-768",
            column="embedding_gemini",
            dim=settings.embed_dims_gemini,
            todo=todo,
            embedder=embed_gemini_texts,
            batch_size=10,
            pause=1.2,
        )
    print("ingest done", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest TAT North listings into Supabase")
    parser.add_argument("--reembed", action="store_true")
    parser.add_argument("--nvidia-only", action="store_true")
    parser.add_argument("--gemini-only", action="store_true")
    args = parser.parse_args()
    nvidia = not args.gemini_only
    gemini = not args.nvidia_only
    if args.nvidia_only and args.gemini_only:
        nvidia = True
        gemini = True
    asyncio.run(ingest(reembed=args.reembed, nvidia=nvidia, gemini=gemini))


if __name__ == "__main__":
    main()
