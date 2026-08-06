# Paso 3 — Lector de capítulo, versículos y notas al pie

Tercer paso del sitio de lectura bíblica (Biblia Straubinger). Construye las
páginas reales de lectura —capítulo, introducción y prólogo— y el sistema de
notas al pie con numeración local y saltos por ancla, sobre la base de los Pasos
1 y 2 (Content Collections, temas, tipografías, `bookOrder`, `BookPickerModal`).

## Alcance de este paso

**Incluido:**

- Ruta de capítulo `/[slug]/[capitulo]/` generada con `getStaticPaths` (una por
  cada capítulo de cada libro).
- `ChapterReader`: fusión de las tres fuentes de contenido (divisiones del libro,
  secciones editoriales, versículos) en un único flujo ordenado.
- `Verse` y `FootnotesSection` con numeración **local** de notas por capítulo.
- Scroll suave y destello `:target` (CSS puro, sin JS), respetando
  `prefers-reduced-motion`.
- Ruta de introducción `/[slug]/introduccion/` y de prólogo `/prologo/`.
- Header mínimo de orientación (solo informativo).
- **Corrección de anomalías de datos** que colisionaban en la ruta de capítulo
  (ver sección "Anomalías de datos").

**Fuera de alcance (fases posteriores):** navegación anterior/siguiente entre
capítulos, reapertura del modal desde el lector, toggle visual de tema, y manejo
especial de formato poético (todo el texto se trata como prosa por ahora).

## Fusión del contenido del capítulo — `src/lib/chapterFlow.ts`

`buildChapterFlow(book, chapter)` produce el flujo ordenado y resuelve las notas.
Se aisló como módulo para mantener los componentes `.astro` declarativos.

- **Orden de inserción:** se recorren los versículos en orden; antes del
  versículo N se insertan, como encabezados, las divisiones y secciones cuyo
  `startVerse === N`.
  - Las **divisiones** solo aplican si `division.startChapter === chapter.chapter`
    (son estructurales, a nivel de libro). Se renderizan como `h2` (prominentes).
  - Las **secciones** son subtítulos editoriales locales al capítulo. Se
    renderizan como `h3` (menores). Distinto nivel de heading para reflejar la
    jerarquía.
  - Encabezados cuyo `startVerse` no coincida con ningún versículo (datos raros)
    se emiten al final, ordenados, para no perderlos.
- **Numeración local de notas:** las notas del JSON se guardan por **ID global**
  (p. ej. 18, 4821). El lector las re-numera **1, 2, 3…** en el orden de su
  **primera aparición** dentro del capítulo (recorriendo el flujo, incluidas las
  `footnoteRefs` de secciones). Ese número local es el que se muestra en el
  superíndice y junto a la nota; el ID global solo se usa para las anclas
  `#footnote-<idGlobal>` (que deben ser únicas).
- **Mapeo id→primer verso:** al asignar el número local se registra el número del
  primer versículo que referenció la nota; es el destino del enlace de retorno
  "↑". Si la primera referencia proviene de una sección, se usa su `startVerse`.
- **Coherencia texto/notas:** una `footnoteRef` cuyo ID no exista en el
  diccionario `footnotes` del libro se ignora (ni marcador ni entrada en el pie),
  de modo que nunca hay un superíndice sin nota ni una nota sin texto.

## Componentes

### `Verse.astro`

- Contenedor `<span class="verse" id="verse-{number}">` (ancla de retorno).
- Número de versículo visible en superíndice, color `--accent`.
- Un `<a class="footnote-ref" href="#footnote-{idGlobal}">` por referencia, con el
  **número local** en dígitos Unicode (¹²³…). `aria-label="Nota {local}"`.
- Los versículos fluyen **inline** dentro de la prosa (separados por espacio); no
  hay manejo de poesía todavía.

### `FootnotesSection.astro`

- Solo se renderiza si el capítulo tiene ≥ 1 nota efectivamente referenciada (si
  `notes.length === 0`, no emite nada — ni el encabezado ni una lista vacía).
- Encabezado "Notas de Mons. Straubinger".
- Lista únicamente de las notas referenciadas en **este** capítulo (no todo el
  diccionario del libro), en orden de primera aparición, cada una con:
  `id="footnote-{idGlobal}"`, el mismo número local del superíndice, el texto
  (`footnotes[idGlobal]`), y un enlace `<a href="#verse-{N}">↑</a>` al primer
  versículo que la referenció.

### `ChapterReader.astro`

Orquesta: llama a `buildChapterFlow`, mapea el flujo a `h2` / `h3` / `<Verse>` y
cierra con `<FootnotesSection>`. Prosa en serif, justificada.

## Scroll suave y destello — `src/styles/global.css`

- `scroll-behavior: smooth` en `html` (salto suave al superíndice y de vuelta).
- `@keyframes target-flash` + `.verse:target` / `.footnote:target`: destello de
  `background-color` (~2 s, se desvanece). Definido **sin scope** en `global.css`
  para que aplique a los elementos que renderizan los componentes (cada `.astro`
  tiene su propio hash de scope; el selector global los alcanza por igual).
- `prefers-reduced-motion: reduce`: sin animación (cambio de color estático
  mientras el elemento es el `:target`) y `scroll-behavior: auto`.

## Rutas de contenido editorial

- **Introducción** `/[slug]/introduccion/`: `getStaticPaths` solo para intros con
  `book` definido. Renderiza el Markdown con `render()` de content collections,
  cuerpo en serif, título del frontmatter.
- **Prólogo** `/prologo/`: la intro **sin** `book`. Si no existiera ninguna,
  muestra "Prólogo próximamente" en vez de romper el build.

## Header mínimo

Header informativo arriba del contenido: nombre del libro + "Capítulo N" (o
"Introducción" / "Prólogo"). Sin navegación ni botón de modal (Paso 4).

## Anomalías de datos corregidas

El scraper dejó **números de capítulo duplicados** dentro de un mismo libro, que
colisionaban en la ruta `/[slug]/[capitulo]/` (Astro descartaba páginas con un
WARN de ruta en conflicto). Dos causas distintas, dos tratamientos (decididos con
el usuario):

1. **Filas basura en 6 epístolas** (`1-corintios`, `1-juan`, `1-macabeos`,
   `1-pedro`, `1-tesalonicenses`, `1-timoteo`): un falso "capítulo 1" de un solo
   versículo divisor (p. ej. `"CORINTIOS – – – (1, 1-9)"`) al inicio del libro.
   **Se eliminaron** de los JSON fuente (la entrada con `chapter === 1`,
   `verses.length === 1` y texto con `– – –`).
2. **Salmos dobles legítimos** (`salmos` 9 y 113): dos mitades reales con el mismo
   número por la numeración Vulgata vs. hebrea. Se les añadió una **etiqueta** de
   capítulo `9a`/`9b` y `113a`/`113b` (campo `label`, nuevo en el schema), sin
   perder contenido.

### Cambios derivados

- **Schema** (`src/content.config.ts`): nuevo campo opcional
  `chapters[].label: string`. Ausente → se usa `String(chapter)`.
- **Ruta de capítulo:** el segmento `[capitulo]` es `label ?? String(chapter)`.
  Así `/salmos/9a/`, `/salmos/9b/`… existen y `/salmos/9/` ya no.
- **`BookPickerModal` (Paso 2):** su `BookItem` pasó de `chapters: number`
  (conteo) a `chapterIds: string[]` (lista de identificadores). El atributo
  `data-chapters` ahora lleva la lista separada por comas y el script genera una
  celda por id (texto e `href /[slug]/[id]/`). Esto mantiene el contrato de links
  del modal coherente con las etiquetas de Salmos.

> Nota de mantenimiento: si el scraper se vuelve a correr, estas correcciones
> deben re-aplicarse sobre los JSON regenerados (o, mejor, corregirse en el
> scraper): quitar las filas divisoras y etiquetar los salmos dobles.

## Estructura de archivos

```
src/
  lib/
    chapterFlow.ts                    # NUEVO — fusión de fuentes + numeración local
  components/
    Verse.astro                       # NUEVO
    FootnotesSection.astro            # NUEVO
    ChapterReader.astro               # NUEVO
    BookPickerModal.astro             # MOD — chapterIds en vez de conteo
  pages/
    [slug]/[capitulo]/index.astro     # NUEVO — página de capítulo
    [slug]/introduccion/index.astro   # NUEVO — introducción por libro
    prologo/index.astro               # NUEVO — prólogo general
    index.astro                       # MOD — pasa chapterIds al modal
  content.config.ts                   # MOD — chapters[].label opcional
  styles/global.css                   # MOD — scroll-behavior + :target flash
content/books/                        # MOD — datos: 6 epístolas + salmos
```

## Verificación realizada

- `pnpm astro check` → **0 errores, 0 warnings, 0 hints**.
- `pnpm astro build` → **0 warnings de ruta** (antes de la corrección de datos
  había 8 conflictos que descartaban páginas). **1339 páginas**.
- **Génesis 1** (división + 2 secciones + notas): el flujo emite `h2` (división)
  → `h3` (sección) → versículos en orden; sección de notas presente.
- **Numeración local ≠ ID global:** Génesis 2 → superíndices ¹²³⁴ apuntan a
  `#footnote-18/19/20/21` (IDs globales reales); las notas muestran ¹²³⁴.
- **Anclas coherentes:** en Génesis 2, el superíndice ¹ → `#footnote-18`, y la
  nota 18 tiene retorno `↑` → `#verse-1` (primer verso que la referenció), cuya
  ancla `id="verse-1"` existe.
- **Sección de notas nunca vacía:** escaneo de `dist/` → 0 páginas con el título
  "Notas de Mons. Straubinger" sin ítems. (Con los datos actuales **todos** los
  1336 capítulos tienen ≥ 1 nota, por lo que el estado "sin sección" solo lo
  ejercita la condición `notes.length > 0` y el filtro de IDs sin texto.)
- **Salmos:** existen `/salmos/9a/`, `/salmos/9b/`, `/salmos/113a/`,
  `/salmos/113b/`; **no** existen `/salmos/9/` ni `/salmos/113/`. El modal en la
  home emite `9a,9b` y `113a,113b`.
- **Epístolas:** `/1-corintios/1/` renderiza el capítulo real (31 v., 11 notas),
  sin la fila divisora.
- **Introducción/Prólogo:** `/genesis/introduccion/` y `/prologo/` renderizan el
  Markdown en serif; el prólogo muestra el cuerpo real (no el placeholder).

### Cómo probar manualmente

1. `astro dev --background` (ver `CLAUDE.md`).
2. Abrir `/genesis/1/`: ver la división, las dos secciones y los superíndices.
   Click en un superíndice → scroll suave hasta la nota (con destello); click en
   "↑" → regreso al versículo correcto (con destello).
3. Abrir `/1-corintios/1/`: confirmar que empieza en el texto real, sin la línea
   divisora basura.
4. Desde la home, abrir el modal → Salmos: las celdas 9 y 113 aparecen como
   `9a/9b` y `113a/113b` y enlazan a las páginas correctas.
5. Con `prefers-reduced-motion` activo, confirmar que el salto no anima el
   destello (solo cambia el color).
```
