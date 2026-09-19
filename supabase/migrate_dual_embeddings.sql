-- Dual embeddings: Gemini 768 and NVIDIA 2048 on the same listings row.
-- Run in SQL editor. Copies any old `embedding` column, then drops it.

create extension if not exists vector;

alter table listings add column if not exists embedding_gemini vector(768);
alter table listings add column if not exists embedding_nvidia vector(2048);

do $$
declare
  dim int;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'embedding'
  ) then
    select vector_dims(embedding) into dim
    from listings
    where embedding is not null
    limit 1;

    if dim = 768 then
      update listings
      set embedding_gemini = embedding
      where embedding is not null and embedding_gemini is null;
    elsif dim = 2048 then
      update listings
      set embedding_nvidia = embedding
      where embedding is not null and embedding_nvidia is null;
    end if;

    drop index if exists listings_embedding_idx;
    alter table listings drop column embedding;
  end if;
end $$;

drop index if exists listings_embedding_idx;
drop index if exists listings_embedding_nvidia_idx;
create index if not exists listings_embedding_gemini_idx
  on listings using hnsw (embedding_gemini vector_cosine_ops);
-- pgvector HNSW/IVFFlat cap at 2000 dims, so NVIDIA 2048 has no ANN index.
-- Exact <=> on ~1877 North rows is fast enough.

drop function if exists match_listings(vector, int, text, text);
drop function if exists match_listings(vector(768), int, text, text);
drop function if exists match_listings(vector(2048), int, text, text);

create or replace function match_listings_gemini(
  query_embedding vector(768),
  match_count int default 12,
  filter_region text default 'ภาคเหนือ',
  filter_province text default null
)
returns table (
  att_id text,
  score_vector float
)
language sql
stable
as $$
  select
    l.att_id,
    (1 - (l.embedding_gemini <=> query_embedding))::float as score_vector
  from listings l
  where l.embedding_gemini is not null
    and l.region = filter_region
    and (filter_province is null or l.province = filter_province)
  order by l.embedding_gemini <=> query_embedding
  limit match_count;
$$;

create or replace function match_listings_nvidia(
  query_embedding vector(2048),
  match_count int default 12,
  filter_region text default 'ภาคเหนือ',
  filter_province text default null
)
returns table (
  att_id text,
  score_vector float
)
language sql
stable
as $$
  select
    l.att_id,
    (1 - (l.embedding_nvidia <=> query_embedding))::float as score_vector
  from listings l
  where l.embedding_nvidia is not null
    and l.region = filter_region
    and (filter_province is null or l.province = filter_province)
  order by l.embedding_nvidia <=> query_embedding
  limit match_count;
$$;
