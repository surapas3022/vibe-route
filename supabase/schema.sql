-- Run in the Supabase SQL editor. If asked about RLS, choose "Run and enable RLS".
-- Frontend never talks to Postgres; FastAPI uses the service_role key, which bypasses RLS.
-- Do not add anon/authenticated policies. Empty policy set = tables locked to the backend.

create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists listings (
  att_id text primary key,
  name_th text not null,
  province text not null,
  district text,
  region text not null,
  type_label text,
  detail_clean text,
  highlight text,
  fee_th text,
  fee_kid text,
  hours_raw text,
  tel text,
  website text,
  facebook text,
  limitation text,
  lat double precision,
  lng double precision,
  search_text text,
  embedding_gemini vector(768),
  embedding_nvidia vector(2048),
  updated_at timestamptz not null default now()
);

create index if not exists listings_region_idx on listings (region);
create index if not exists listings_province_idx on listings (province);
create index if not exists listings_embedding_gemini_idx
  on listings using hnsw (embedding_gemini vector_cosine_ops);
-- pgvector HNSW/IVFFlat cap at 2000 dims. 1877 North rows use exact scan on 2048.

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  title text not null,
  created_at timestamptz not null default now(),
  hidden_at timestamptz
);

create index if not exists chats_session_idx on chats (session_id, created_at desc);
create index if not exists chats_visible_idx
  on chats (session_id, created_at desc)
  where hidden_at is null;

alter table chats add column if not exists hidden_at timestamptz;

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  query text not null,
  prefer_secondary boolean not null default true,
  intro text not null,
  assistant jsonb not null,
  places jsonb not null,
  map_points jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_chat_idx on messages (chat_id, created_at);

create table if not exists feedback (
  message_id uuid not null references messages(id) on delete cascade,
  att_id text not null,
  session_id text not null,
  rating smallint not null check (rating in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (message_id, att_id, session_id)
);

create table if not exists place_images (
  id uuid primary key default gen_random_uuid(),
  att_id text not null references listings(att_id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  uploader_session text not null,
  fav_count integer not null default 0,
  moderation_status text not null default 'accepted',
  created_at timestamptz not null default now()
);

create index if not exists place_images_att_idx
  on place_images (att_id, fav_count desc, created_at desc);

create table if not exists image_favorites (
  image_id uuid not null references place_images(id) on delete cascade,
  session_id text not null,
  created_at timestamptz not null default now(),
  primary key (image_id, session_id)
);

alter table listings enable row level security;
alter table chats enable row level security;
alter table messages enable row level security;
alter table feedback enable row level security;
alter table place_images enable row level security;
alter table image_favorites enable row level security;

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

create or replace function listing_region_counts()
returns table (name text, count bigint)
language sql
stable
as $$
  select region as name, count(*)::bigint
  from listings
  group by region
  order by count(*) desc;
$$;

create or replace function listing_province_counts(filter_region text default null)
returns table (name text, region text, count bigint)
language sql
stable
as $$
  select province as name, region, count(*)::bigint
  from listings
  where filter_region is null or region = filter_region
  group by province, region
  order by count(*) desc;
$$;
