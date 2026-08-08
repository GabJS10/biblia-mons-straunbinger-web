# Paso 7b — Resaltados de versículos y colecciones

Segundo paso de la Fase 7. Sobre la autenticación del 7a, añade el **esquema de
datos** (tablas `collections` y `highlights` con RLS) y la **interacción de
resaltado en el lector**: tocar un versículo abre un selector para resaltarlo y
asignarlo a una colección. Todo cliente-side, siguiendo el patrón de islas
vanilla TS del proyecto.

**Fuera de alcance (Paso 7c):** la página de gestión "Mis resaltados"
(renombrar/borrar colecciones desde una vista dedicada, mover resaltados fuera
del picker).

## Base de datos

### Migración

- **Nombre exacto:** `20260807221507_create_highlights_and_collections.sql`
  (en `supabase/migrations/`).
- **Aplicada** al proyecto remoto `biblia` (`gfcjqaobtzonirfyipgz`) con
  `supabase db push --db-url …` → `Finished supabase db push.` (exit 0).
  Registrada en `supabase_migrations.schema_migrations` (version `20260807221507`).

> **Nota de flujo:** `supabase link` falla en este proyecto por un bug del CLI
> (`LegacyLinkApiKeysNetworkError`, parseo de fecha de las *legacy API keys*),
> así que las operaciones de DB se hacen con `--db-url` (conexión directa por
> IPv6) y la generación de tipos con `--project-id` (Management API, sin Docker).
> Documentado ya en el Paso 7a.

### Esquema

`collections` (id, user_id → auth.users, name, created_at) y `highlights`
(id, user_id → auth.users, book_slug, chapter, verse_number,
collection_id → collections **on delete set null**, created_at). La constraint
**`unique (user_id, book_slug, chapter, verse_number)`** hace idempotente el
upsert por versículo. Índices en `highlights.collection_id` y
`collections.user_id`; el prefijo `(user_id, book_slug, chapter)` del fetch por
capítulo lo cubre la constraint única.

### RLS — **activa y confirmada**

`row security = t` en ambas tablas. **8 políticas** (SELECT/INSERT/UPDATE/DELETE
× 2 tablas), todas `TO authenticated`. Endurecimientos aplicados sobre el SQL
base del prompt, siguiendo la checklist de la skill de Supabase (mejoras que
preservan el modelo "solo mis filas"):

- `(select auth.uid()) = user_id` en lugar de `auth.uid()` directo → se evalúa
  una vez por consulta, no por fila (mejor plan).
- `TO authenticated` explícito → las políticas no se evalúan para `anon`, que
  además queda denegado por defecto (sin política).
- Los **UPDATE** llevan `USING` **y** `WITH CHECK` → sin `WITH CHECK` un usuario
  podría reasignar una fila a otro `user_id`.
- `grant … to authenticated` en ambas tablas para exponerlas al Data API (RLS
  sigue bloqueando a `anon`).

Verificación (psql sobre el remoto):

```
 tablename  | rowsecurity            8 filas en pg_policies, todas {authenticated}
 collections | t                     select/insert/update/delete own collections
 highlights  | t                     select/insert/update/delete own highlights
```

### Tipos TypeScript

Generados con `supabase gen types typescript --project-id gfcjqaobtzonirfyipgz
--schema public` → **`src/types/supabase.ts`**. El cliente en
`src/lib/supabase.ts` se tipó con `createClient<Database>(…)`.

## Aplicación

### Contexto del capítulo — `ChapterReader.astro`

El contenedor `.chapter` expone `data-book-slug`, `data-book-name` y
`data-chapter-id` (valores de la ruta, pasados como props `bookSlug`/`chapterId`
desde `[slug]/[capitulo]/index.astro`; el nombre visible sale de `book.book`).
El script de resaltado los lee para saber en qué libro/capítulo está sin
recibirlos por otra vía.

### Login reutilizable — `src/lib/supabase.ts`

Se extrajo **`signInWithGoogle()`** (mismo `signInWithOAuth` + `redirectTo` a la
página actual). Lo usan tanto `AuthWidget` como el resaltado, sin duplicar la
llamada.

### Capa de datos — `src/lib/highlights.ts`

Aísla las consultas a Supabase (RLS filtra por usuario, así que los `select` no
repiten el `user_id`):

- `getCollections(force?)` — lista del usuario, **cacheada en memoria** durante
  la sesión de navegación (se reutiliza en cualquier capítulo sin refetch);
  `clearCollectionsCache()` al cerrar sesión.
- `createCollection(name, userId)` — inserta y actualiza el caché.
- `getChapterHighlights(bookSlug, chapter)` — solo los de ESE capítulo.
- `upsertHighlight({…})` — upsert con
  `onConflict: 'user_id,book_slug,chapter,verse_number'`.
- `deleteHighlight(id)`.

### Selector — `src/components/HighlightPicker.astro`

`<dialog>` nativo (patrón de `BookPickerModal`), incluido **una vez** en las
páginas de capítulo (no intro/prólogo), vacío hasta abrirse. Al abrir para un
versículo muestra: la referencia (ej. **"Génesis 1:3"**), "Quitar resaltado" si
ya estaba resaltado, "Sin colección" (asigna `collection_id: null`), la lista de
colecciones (marcando la asignada con ✓), y un campo + "Crear y asignar" para
crear una colección al vuelo. Cierre por X, backdrop y Escape (nativo).

**Interacción** (script del propio componente):

- Al cargar el capítulo con sesión: fetch de resaltados del capítulo +
  colecciones, y pintado de `.is-highlighted` en los versículos.
- **Delegación** de un solo listener en `.chapter`: ignora clicks en
  `.footnote-ref` (siguen navegando a la nota) y en `.dropcap` (la versal no
  abre el picker); cualquier otro click dentro de un `.verse` lo abre.
- **Sin sesión:** el click dispara `signInWithGoogle()` (mismo login del
  AuthWidget) en vez de abrir el picker.
- **Optimista:** al elegir una opción se marca/actualiza el versículo y se cierra
  el diálogo antes de la red; el `upsert`/`delete` corre después. Si **falla**,
  revierte la marca visual y reabre el picker con un mensaje de error breve
  (`console.error` + banner dentro del diálogo).
- Reacciona a `onAuthStateChange`: al cerrar sesión limpia marcas y caché.

### Estilo

Mismo lenguaje que `BookPickerModal` (Fraunces para nombres de colección, Inter
para UI, contorno en vez de relleno, hairlines). `.is-highlighted` usa
`color-mix(in srgb, var(--accent) 15%, transparent)` con
`box-decoration-break: clone` para repartir el fondo por línea sin cajas rotas;
convive con la versal (el `float` de la letra capitular queda fuera del fondo
inline y su acento fuerte lee como parte del resaltado) y con los superíndices
de nota.

## Estructura de archivos

```
supabase/
  migrations/
    20260807221507_create_highlights_and_collections.sql   # NUEVO — esquema + RLS
src/
  types/
    supabase.ts                          # NUEVO — tipos generados del esquema
  lib/
    supabase.ts                          # MOD — createClient<Database> + signInWithGoogle()
    highlights.ts                        # NUEVO — capa de datos (fetch/upsert/delete/caché)
  components/
    HighlightPicker.astro                # NUEVO — <dialog> selector + interacción
    ChapterReader.astro                  # MOD — data-attrs de contexto + estilo .is-highlighted
    AuthWidget.astro                     # MOD — reutiliza signInWithGoogle()
  pages/[slug]/[capitulo]/index.astro    # MOD — pasa slug/chapterId + incluye <HighlightPicker />
```

## Verificación realizada

- `pnpm astro check` → **0 errores, 0 warnings, 0 hints**.
- `pnpm astro build` → OK, **1347 páginas**, sin warnings.
- **Migración aplicada** y registrada en remoto; **RLS activa** + 8 políticas
  (confirmado por psql sobre `pg_tables`/`pg_policies`).
- **Presencia del picker:** `id="highlight-picker"` aparece **1 vez** en
  `genesis/1` y **0 veces** en `genesis/introduccion`, `prologo` e `index`.
- **Data-attrs** presentes en el capítulo:
  `data-book-slug="genesis" data-book-name="Génesis" data-chapter-id="1"`.

### Cómo probar manualmente

1. Con `.env` válido, `astro dev --background` → `http://localhost:4321`.
2. En `/genesis/1/` **sin sesión**: tocar un versículo lanza el login de Google
   (no abre el picker).
3. Tras iniciar sesión: tocar un versículo abre el selector con la referencia
   correcta. Elegir "Sin colección" lo resalta; recargar → el resaltado persiste.
4. Reabrir el mismo versículo → "Quitar resaltado" lo elimina (marca desaparece).
5. "Crear y asignar" con un nombre → crea la colección y resalta; reabrir otro
   versículo muestra esa colección en la lista (caché, sin refetch).
6. Tocar el **primer** versículo (con versal): el resaltado convive con la letra
   capitular sin verse sucio; tocar un superíndice de nota **no** abre el picker,
   navega a la nota.
7. Cerrar sesión desde el AuthWidget → las marcas de resaltado desaparecen.
```
