-- Region on each search turn so trending queries/likes can be split by ภาค.
alter table messages add column if not exists retrieval_query text;
alter table messages add column if not exists region text;
create index if not exists messages_region_idx
  on messages (region, created_at desc)
  where region is not null;
