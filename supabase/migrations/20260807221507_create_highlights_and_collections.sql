-- Paso 7b — Esquema de resaltados y colecciones.
--
-- `collections`: agrupaciones nombradas creadas por el usuario.
-- `highlights`:  un versículo resaltado (book_slug + chapter + verse_number),
--                opcionalmente asignado a una colección. La constraint única
--                (user_id, book_slug, chapter, verse_number) permite el upsert
--                idempotente por versículo.
--
-- Seguridad (checklist de la skill de Supabase):
--   * RLS activada en ambas tablas; cada usuario solo ve/gestiona SUS filas.
--   * Políticas con `to authenticated` (no se evalúan para peticiones anónimas;
--     además el anon carece de política => queda denegado por defecto).
--   * `(select auth.uid())` en vez de `auth.uid()` directo: se evalúa una vez
--     por consulta (mejor plan) en lugar de una vez por fila.
--   * Los UPDATE llevan USING y WITH CHECK: sin WITH CHECK un usuario podría
--     reasignar la fila a otro user_id.

create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  created_at timestamptz default now()
);

create table highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  book_slug text not null,
  chapter text not null,
  verse_number int not null,
  collection_id uuid references collections on delete set null,
  created_at timestamptz default now(),
  unique (user_id, book_slug, chapter, verse_number)
);

-- Índices: la constraint única ya cubre el prefijo (user_id, book_slug, chapter)
-- del fetch por capítulo, así que no se añade un índice extra de user_id en
-- highlights. Sí se indexan las FKs que se filtran/actualizan por su cuenta.
create index highlights_collection_id_idx on highlights (collection_id);
create index collections_user_id_idx on collections (user_id);

alter table collections enable row level security;
alter table highlights enable row level security;

-- Exponer al Data API solo para el rol autenticado (RLS bloquea a anon igualmente).
grant select, insert, update, delete on collections to authenticated;
grant select, insert, update, delete on highlights to authenticated;

-- ---------- Políticas: collections ----------
create policy "select own collections" on collections
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own collections" on collections
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own collections" on collections
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own collections" on collections
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Políticas: highlights ----------
create policy "select own highlights" on highlights
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own highlights" on highlights
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own highlights" on highlights
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "delete own highlights" on highlights
  for delete to authenticated using ((select auth.uid()) = user_id);
