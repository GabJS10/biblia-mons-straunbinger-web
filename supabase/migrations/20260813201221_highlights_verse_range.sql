-- Paso 9a — Migración de `verse_number` (un versículo) a rango
-- `verse_start` / `verse_end` (siempre dentro del mismo capítulo).
--
-- Contexto: hasta el Paso 7b un resaltado era UN versículo, con la constraint
-- única (user_id, book_slug, chapter, verse_number) que hacía idempotente el
-- upsert. Ahora un resaltado cubre un RANGO [verse_start, verse_end] dentro del
-- mismo capítulo. Se permiten rangos solapados (notas personales), así que la
-- constraint única desaparece: la creación pasa a ser un `insert` normal.
--
-- Migración de datos sin pérdida: cada fila existente es un rango de un solo
-- versículo, así que verse_end = verse_number (= el futuro verse_start).

-- 1) Nueva columna para el fin del rango (nullable al principio para poblarla).
alter table highlights add column verse_end int;

-- 2) Migrar datos: todo resaltado existente es un rango de un solo versículo.
update highlights set verse_end = verse_number;

-- 3) Renombrar la columna original: pasa a ser el inicio del rango.
alter table highlights rename column verse_number to verse_start;

-- 4) Ya poblada, verse_end no admite nulos (igual que verse_start).
alter table highlights alter column verse_end set not null;

-- 5) Quitar la constraint única de versículo individual: con rangos permitimos
--    resaltados solapados, no necesitamos prevenir duplicados por versículo.
alter table highlights
  drop constraint highlights_user_id_book_slug_chapter_verse_number_key;

-- 6) Integridad básica del rango: el fin no puede ser anterior al inicio.
alter table highlights
  add constraint highlights_verse_range_check check (verse_end >= verse_start);

-- 7) La constraint única cubría el prefijo (user_id, book_slug, chapter) que usa
--    el fetch por capítulo (getChapterHighlights). Al eliminarla, se añade un
--    índice equivalente para no regresar el rendimiento de esa consulta.
create index highlights_user_book_chapter_idx
  on highlights (user_id, book_slug, chapter);

-- Las políticas RLS NO referencian el nombre de la columna de versículo
-- (solo comparan user_id), así que no requieren cambios tras el rename.
