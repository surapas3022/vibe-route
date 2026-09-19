# VibeRoute backend

FastAPI on port 8000. Facts (fee/hours/tel/lat) come from TAT columns. The LLM only writes `intro` and `why`.

## One-time setup

1. Create a Supabase project, then run `supabase/schema.sql` in the SQL editor. If a dialog asks about Row Level Security, click **Run and enable RLS**. Do not use the anon key against these tables. Existing projects that already have a single `embedding` column should run `supabase/migrate_dual_embeddings.sql` instead.
2. Create a public storage bucket named `place-images`.
3. Copy `.env.example` to `.env`. From **Settings → API Keys** paste the **Secret key** (`sb_secret_...`) into `SUPABASE_SECRET_KEY`. Embeddings are stored twice: NVIDIA `nemotron-3-embed-1b` at 2048-d and Gemini `gemini-embedding-001` at 768-d. Search uses NVIDIA first, then Gemini, and never mixes the two spaces.
4. `data/attraction.json` is already in the repo (gitignored). Re-copy from Downloads only if you replace the TAT dump.

## Run locally

```powershell
cd D:\CAMP\Hackathon
python -m venv .venv
.\.venv\Scripts\pip install -r backend\requirements.txt
$env:PYTHONPATH = "D:\CAMP\Hackathon\backend"
.\.venv\Scripts\python backend\scripts\ingest.py
.\.venv\Scripts\uvicorn app.main:app --app-dir backend --reload --port 8000
```

Health: `GET http://localhost:8000/v1/health`  
Docs: `http://localhost:8000/docs`

Ingest writes both vectors. NVIDIA 2048 runs first, then Gemini 768. Already-filled columns are skipped unless `--reembed`. Use `--nvidia-only` or `--gemini-only` to run one pass. If Gemini hits the daily cap, NVIDIA rows already saved stay.

## Docker

```powershell
docker compose up --build
```

Ingest still runs on the host (or `docker compose run --rm backend python scripts/ingest.py`) because it talks to Supabase, not a local database.
