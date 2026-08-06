# Paso 4 — Navegación anterior/siguiente y reapertura del modal

Cuarto paso del sitio de lectura bíblica (Biblia Straubinger). Añade navegación
secuencial anterior/siguiente entre capítulos e introducciones, y permite
reabrir el `BookPickerModal` desde cualquier página del lector, sobre la base de
los Pasos 1–3.

## Alcance de este paso

**Incluido:**

- Refactor de la lógica del catálogo de libros a un módulo compartido
  (`src/lib/bookCatalog.ts`).
- Secuencia de lectura plana y helper `getAdjacent` (`src/lib/readingSequence.ts`).
- Cabecera compartida `ReaderHeader` con título, botón "Elegir libro" (reabre el
  modal) y botones anterior/siguiente.
- Integración de `ReaderHeader` en las tres páginas del lector (capítulo,
  introducción, prólogo), reemplazando el header mínimo ad-hoc del Paso 3.

**Fuera de alcance (Paso 5, último pendiente):** el toggle visual de tema.

## Refactor — `src/lib/bookCatalog.ts`

Se extrajo a este módulo la lógica que vivía inline en `index.astro`: cruzar
`bookOrder` (orden canónico) × colección `books` × colección `intros` para
producir el array de `BookItem` (`slug`, `name`, `testament`, `chapterIds:
string[]`, `hasIntro`) que consume `BookPickerModal`.

- Exporta `getBookCatalog(): Promise<BookItem[]>` y el tipo `BookItem` (ahora
  **fuente de verdad** del tipo; `BookPickerModal` lo re-exporta por
  conveniencia y `index.astro` lo consume vía el módulo, sin duplicar lógica).
- Mismo resultado que antes; `index.astro` quedó reducido a
  `const books = await getBookCatalog();`.

## Secuencia de lectura — `src/lib/readingSequence.ts`

Construye, a partir de `getBookCatalog()`, un array plano `SequenceNode[]` con
todo lo navegable en orden de lectura:

- Por cada libro, en el orden de `bookOrder`: primero su **introducción** (si
  `hasIntro`), luego cada **capítulo** en el orden real de `chapterIds` (tal cual
  vienen del JSON — **no** se reordenan numéricamente, respetando Salmos 9a/9b…).
- El **prólogo NO se incluye** (documento aparte, fuera del flujo continuo).
- Cada nodo: `url`, `label` (texto legible: "Génesis 1" o
  "Génesis — Introducción") y `type` (`'intro'` | `'chapter'`).

`getAdjacent(currentUrl)` localiza el nodo por URL (normalizando la barra final)
y devuelve `{ prev, next }`. En los extremos —o si la URL no está en la
secuencia— el valor correspondiente es `null`.

## Componente compartido — `src/components/ReaderHeader.astro`

Props: `eyebrow` (línea superior: nombre del libro, "Introducción" o "Prólogo"),
`title`, y opcionalmente `prev`/`next` (nodos de `getAdjacent`).

- Título + una línea superior (`eyebrow`).
- Botón **"Elegir libro"** con `data-open-picker`; el componente incluye el
  `BookPickerModal` alimentado con `getBookCatalog()`, de modo que el modal está
  disponible (y reabrible) en cualquier página que use `ReaderHeader`.
- Si se pasan `prev`/`next`: dos botones con flecha + nombre del destino
  (← a la izquierda, → a la derecha). Si `prev` o `next` es `null`, ese botón
  **no se renderiza** (no queda deshabilitado); un `.nav-spacer` invisible ocupa
  su lado del flex para que el botón presente quede en su extremo sin hueco.
- La página de **prólogo** usa `ReaderHeader` **sin** `prev`/`next`.

## Integración en las páginas

- `/[slug]/[capitulo]/`: calcula `getAdjacent(Astro.url.pathname)` y pasa
  `prev`/`next`. `eyebrow={book.book}`, `title={`Capítulo ${chapterId}`}`.
- `/[slug]/introduccion/`: igual, con `eyebrow="Introducción"`.
- `/prologo/`: `<ReaderHeader eyebrow="Prólogo" title={title} />` sin nav.
- Se eliminó el header inline (`.reader-header`, `.reader-book`,
  `.reader-chapter`) de las tres páginas en favor del componente compartido.

## Estilo

- Botones y cabecera usan solo las variables de tema existentes (`--accent`,
  `--text`, `--text-secondary`, `--bg`); sin colores nuevos hardcodeados.
- La barra de navegación es un flex a los extremos del header (debajo del
  título). Cada botón tiene `max-width: 50%`.
- **Responsive:** el nombre del destino (`.nav-label`) trunca con
  `text-overflow: ellipsis` (`white-space: nowrap`) en pantallas angostas,
  mientras la flecha (`.nav-arrow`, `flex: none`) permanece siempre visible.
- `prefers-reduced-motion: reduce` desactiva las transiciones de los botones.

## Estructura de archivos

```
src/
  lib/
    bookCatalog.ts                    # NUEVO — catálogo compartido + tipo BookItem
    readingSequence.ts                # NUEVO — secuencia plana + getAdjacent
  components/
    ReaderHeader.astro                # NUEVO — cabecera + modal + nav
    BookPickerModal.astro             # MOD — re-exporta BookItem desde bookCatalog
  pages/
    [slug]/[capitulo]/index.astro     # MOD — ReaderHeader + getAdjacent
    [slug]/introduccion/index.astro   # MOD — ReaderHeader + getAdjacent
    prologo/index.astro               # MOD — ReaderHeader sin nav
    index.astro                       # MOD — usa getBookCatalog()
```

## Verificación realizada

- `pnpm astro check` → **0 errores, 0 warnings, 0 hints**.
- `pnpm astro build` → **0 warnings de ruta, 1339 páginas**.
- **`/genesis/introduccion/`**: sin botón "anterior" (inicio absoluto de la
  secuencia); "siguiente" → `/genesis/1/`.
- **`/genesis/1/`**: "anterior" → `/genesis/introduccion/`; "siguiente" →
  `/genesis/2/`.
- **Cruce entre libros**: `/genesis/50/` → "siguiente" → `/exodo/1/` (Éxodo no
  tiene intro, así que enlaza a su capítulo 1).
- **Salmos**: `/salmos/9a/` → "anterior" `/salmos/8/`, "siguiente" `/salmos/9b/`.
- **`/apocalipsis/22/`** (último nodo): sin botón "siguiente".
- **Modal reabrible**: `data-open-picker` e `id="book-picker"` presentes en
  páginas de capítulo y de prólogo.
- **Etiquetas legibles** en los botones: "Génesis — Introducción", "Génesis 2".

### Cómo probar manualmente

1. `astro dev --background` (ver `CLAUDE.md`).
2. Abrir `/genesis/introduccion/`: no debe existir botón "anterior".
3. En `/genesis/1/`: "anterior" lleva a la introducción, "siguiente" a Génesis 2.
4. Navegar hasta `/genesis/50/` y pulsar "siguiente": debe ir a Éxodo 1.
5. En `/salmos/9a/`: "siguiente" va a 9b (no a 10).
6. En `/apocalipsis/22/`: no debe existir botón "siguiente".
7. Desde cualquier capítulo, pulsar "Elegir libro": el modal se abre y funciona
   igual que en la home.
```
