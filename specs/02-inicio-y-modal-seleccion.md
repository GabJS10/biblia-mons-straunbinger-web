# Paso 2 — Página de inicio + modal de selección de libro/capítulo

Segundo paso del sitio de lectura bíblica (Biblia Straubinger). Construye la
pantalla de bienvenida y el selector de libro/capítulo estilo bible.com, sobre la
base ya existente (Content Collections, temas y tipografías del Paso 1).

## Alcance de este paso

**Incluido:**

- Archivo de orden canónico de los 73 libros (`src/data/bookOrder.ts`).
- Página de inicio con título, descripción, botón "Elegir libro" y link a "Prólogo".
- Modal `BookPickerModal` con `<dialog>` nativo: vista de libros (2 tabs por
  testamento) → vista de capítulos, con recuadro "Introducción" cuando aplica.
- Cruce de datos en build time (`bookOrder` × `books` × `intros`).

**Fuera de alcance (fases posteriores):** páginas reales de capítulo/introducción
(los links ya apuntan a `/[slug]/[n]/` y `/[slug]/introduccion/`, pero esas rutas
se crean en el Paso 3), la página de prólogo (`/prologo/`), y el toggle visual de
tema.

## Decisiones

- **Orden canónico como dato estático** (`bookOrder.ts`): array `as const` de
  `{ slug, testament, order }`, 46 AT + 27 NT. Los slugs coinciden 1:1 con el id
  de la colección `books` (nombre de archivo). Si un slug no encuentra su JSON, el
  build **falla a propósito** (`throw` en `index.astro`) para detectar el bug.
- **Capítulos construidos en el cliente, no en build time.** Los grids de libros
  sí se renderizan en HTML; los de capítulos se generan con JS al pulsar un libro.
  Motivo: Salmos tiene 152 capítulos — pre-renderizar todos los capítulos de los
  73 libros generaría miles de nodos inútiles. Cada botón de libro lleva la
  información necesaria en `data-*` (`data-slug`, `data-name`, `data-chapters`,
  `data-intro`).
- **`<dialog>` nativo + TypeScript vanilla**, sin frameworks ni librerías de
  animación. Escape lo maneja el propio `<dialog>`; el cierre por backdrop se
  detecta comparando `event.target === dialog`.
- **Alternancia de vistas y tabs vía atributos + CSS**, no manipulando `hidden` en
  JS: `data-view="books|chapters"` en el `<dialog>` y `data-active="AT|NT"` en la
  vista de libros. Esto permite transiciones CSS limpias.
- **Sin colores hardcodeados**: todo usa las variables de `themes.css`
  (`--bg`, `--text`, `--text-secondary`, `--accent`). Para estados hover/borde se
  usa `color-mix()` sobre esas variables, de modo que el modal respeta los tres
  temas.
- **`hasIntro` desde la colección `intros`**: se toma el conjunto de `data.book`
  definidos (las intros con `book` ausente son el prólogo general y no marcan
  ningún libro).

## Comportamiento del modal

1. Se abre con `.showModal()` desde cualquier elemento con `data-open-picker`.
2. Vista de libros: dos tabs ("Antiguo Testamento" / "Nuevo Testamento") y un grid
   de libros del testamento activo, en orden canónico.
3. Al pulsar un libro, la **misma** vista cambia a capítulos (sin cerrar): botón
   "← Volver a libros", título del libro, recuadro "Introducción" (solo si el libro
   tiene intro) y celdas numeradas `1..chapters.length`.
4. Cada capítulo es un `<a>` a `/[slug]/[n]/`; la introducción, a
   `/[slug]/introduccion/`.
5. Cierre: botón "✕", click en backdrop, o tecla Escape. Al cerrar, el modal
   vuelve a la vista de libros y a la pestaña AT.

## Estilo

- Animación de entrada del diálogo con `@starting-style` + `transition` (opacidad y
  desplazamiento); fade al alternar vistas con `@keyframes fade-in` (se re-dispara
  al cambiar el `display`). Respeta `prefers-reduced-motion`.
- Grids responsive con `grid-template-columns: repeat(auto-fill, minmax(...))`
  (mobile-first): libros `minmax(9rem, 1fr)`, capítulos `minmax(3.25rem, 1fr)`.
- En móvil el modal es pantalla completa; desde `40rem` toma márgenes, esquinas
  redondeadas y sombra.

## Estructura de archivos

```
src/
  data/
    bookOrder.ts               # NUEVO — 73 libros { slug, testament, order }
  components/
    BookPickerModal.astro      # NUEVO — <dialog> + tabs + grids + lógica vanilla
  pages/
    index.astro                # REESCRITO — bienvenida + cruce de datos + modal
```

`index.astro` importa el tipo `BookItem` exportado desde el frontmatter de
`BookPickerModal.astro` y le pasa el array `books` ya cruzado como prop.

## Verificación realizada

- `pnpm astro check` → **0 errores, 0 warnings, 0 hints**.
- `pnpm astro build` → build estático correcto.
- Inspección del HTML generado:
  - **73** botones `.book-btn` (46 AT + 27 NT).
  - Botón `data-open-picker` ("Elegir libro"), link a `/prologo/`, y `<dialog
    id="book-picker">` presentes.
  - `data-slug="genesis"` con `data-chapters="50"` y `data-intro="1"` (confirma el
    cruce con `intros`: existe `genesis.md`).
  - `data-slug="salmos"` con `data-chapters="152"`.

### Prueba manual sugerida

1. `astro dev --background` (ver `CLAUDE.md`).
2. Pulsar "Elegir libro" → abre el modal en AT. Cambiar a NT con la tab.
3. Pulsar un libro → aparece el grid de capítulos; en Génesis debe verse el
   recuadro "Introducción" antes del 1. "Volver a libros" regresa.
4. Cerrar con ✕, con click en el fondo y con Escape. Cambiar el tema por
   `localStorage.setItem('theme','reading')` y confirmar que el modal respeta la
   paleta.
5. Los links de capítulo/introducción darán 404 por ahora (esperado: las páginas
   destino llegan en el Paso 3).

## Notas para el mantenimiento

- `bookOrder.ts` es la fuente del orden y del conjunto de libros mostrados. Si se
  añade/quita un libro, actualizar aquí y en `src/content/books/`.
- Los links del modal asumen las rutas `/[slug]/[n]/` y `/[slug]/introduccion/`
  del Paso 3: mantener ese contrato al construir esas páginas.
