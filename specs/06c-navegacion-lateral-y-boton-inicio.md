# Paso 6c — Navegación lateral y botón de inicio

Tercer y último prompt del refactor visual, sobre el sitio con los Pasos 6a
(paleta, tipografía, botones de contorno) y 6b (letra capitular, modal
rediseñado) ya aplicados. Cubre exclusivamente:

- Mover la navegación anterior/siguiente del header a **flechas laterales
  fijas** (con barra de fallback en móvil), en un componente nuevo.
- Añadir un **botón de inicio** al header del lector.

Parte de superficie: **reutiliza `getAdjacent`** de `readingSequence.ts` tal cual
(no se modifica) y no toca datos, rutas ni schema.

## Alcance de este paso

**Incluido:**

- Nuevo componente `ChapterNav.astro` (dos patrones responsive, solo CSS).
- `ReaderHeader.astro`: se le quitan los botones prev/next; se le añade el botón
  de inicio.
- Páginas de capítulo e introducción: pasan `prev`/`next` a `<ChapterNav>` en
  vez de a `<ReaderHeader>`.

**Fuera de alcance (no tocado):** `readingSequence.ts` (solo se consume
`getAdjacent`), `chapterFlow.ts`, `bookCatalog.ts`, rutas, schema, la letra
capitular y el modal (cerrados en 6b). El prólogo sigue sin navegación.

## 1. Nuevo componente — `src/components/ChapterNav.astro`

Recibe `prev`/`next` (tipo `SequenceNode | null`, el mismo que devuelve
`getAdjacent`) y renderiza **dos patrones alternados solo con CSS** (media query,
sin JS):

### Patrón anchas (≥ 64rem) — flechas fijas

- Dos botones **circulares** finos, `position: fixed`, centrados verticalmente
  (`top: 50%; transform: translateY(-50%)`), pegados a los bordes de la ventana
  (`left/right: 1.5rem`).
- Solo ícono (chevron SVG de contorno, `stroke`), sin texto. `border: 1px solid
  var(--border)`, fondo `var(--bg-raised)`, color `var(--text-secondary)` →
  `var(--accent)` en hover/foco.
- El nombre del destino va en `title` **y** `aria-label` (`Ir a Génesis 2`), no
  visible en pantalla.

**Elección del breakpoint (64rem):** la columna de lectura (`.reader`) es
`max-width: 44rem` centrada. A 64rem de viewport quedan ~10rem de gutter por
lado — espacio de sobra para una flecha de 3rem a 1.5rem del borde, sin acercarse
al texto. Por debajo de 64rem el gutter se estrecha rápido, así que ahí se cambia
al fallback en barra. No hay ancho intermedio problemático: a 64rem justos el
gutter ya es holgado.

### Patrón angostas (< 64rem) — barra al final

- Las flechas fijas se ocultan por completo; en su lugar, una barra con botones
  **flecha + nombre del destino**, mismo formato visual que la nav del header del
  Paso 4 (fondo `var(--bg-raised)`, hairline, ellipsis en nombres largos).
- Botones con `flex: 1 1 0`: si están los dos, se reparten 50/50; si solo hay uno
  (extremo de la secuencia), ocupa el ancho completo.
- **Va después de `FootnotesSection`** en el flujo del documento: se garantiza
  colocando `<ChapterNav>` tras `<ChapterReader>` en la página (la barra está en
  flujo normal; las flechas son `fixed`, su orden en el DOM da igual).

### Extremos de la secuencia

Si `prev` o `next` es `null`, ese botón **no se renderiza** en ninguno de los dos
patrones — sin hueco ni espacio reservado (no hay spacers; el `flex: 1` de la
barra y el `fixed` de las flechas no necesitan reservar el lado ausente).

### Mutua exclusión de patrones

Un solo breakpoint gobierna ambos: por defecto (mobile-first) `.edge-arrow {
display: none }` y `.bar-nav { display: flex }`; en `@media (min-width: 64rem)`
se invierte (`.edge-arrow { display: grid }`, `.bar-nav { display: none }`). Así
**nunca** se ven los dos patrones a la vez ni desaparecen ambos.

## 2. Integración

- **`ReaderHeader.astro`:** se eliminaron las props `prev`/`next`, el bloque
  `<nav class="reader-nav">` y todo su CSS (`.nav-btn`, `.nav-spacer`,
  `.nav-arrow`, `.nav-label`, `.reader-nav`). El header vuelve a ser: botón de
  inicio + eyebrow + título + botón "Elegir libro".
- **`/[slug]/[capitulo]/index.astro`** y **`/[slug]/introduccion/index.astro`:**
  siguen calculando `getAdjacent(Astro.url.pathname)` igual que antes, pero ahora
  pasan `prev`/`next` a `<ChapterNav>`, colocado tras `<main class="reader-body">`
  (es decir, después de las notas). El `<ReaderHeader>` ya no recibe navegación.
- **`/prologo/index.astro`:** sin cambios (nunca tuvo navegación).

## 3. Botón de inicio — `ReaderHeader.astro`

Enlace `<a href="/">` en la línea superior del header, junto al botón "Elegir
libro" (el encabezado eyebrow+título va en `.reader-lead` con `flex: 1 1 auto`,
que empuja el ícono de inicio y el picker al extremo derecho). SVG inline de
**casa, de contorno** (`stroke`, sin relleno), ~1.4rem, `color:
var(--text-secondary)` → `var(--accent)` en hover. `aria-label="Ir al inicio"`,
foco visible, área táctil de 2.75rem.

## 4. Responsive y superposiciones

- **Flechas fijas ↔ `ThemeToggle`:** el toggle está fijo arriba-derecha
  (`top/right: 0.75rem`); las flechas están centradas verticalmente
  (`top: 50%`). Están en zonas opuestas del viewport, no se solapan. Además las
  flechas usan `z-index: 40` (bajo el toggle, 50) por si acaso.
- **Transición en 64rem:** patrones mutuamente excluyentes con un único
  breakpoint → sin estado intermedio con ambos o ninguno.
- **Anchos intermedios (tablets):** el fallback en barra cubre todo < 64rem, y a
  ≥ 64rem el gutter (~10rem) mantiene las flechas lejos del texto. No tapan
  contenido.
- **Modal abierto:** al ser contenido normal `fixed`, el `::backdrop` del
  `<dialog>` nativo (top layer) cubre las flechas y vuelve la página inerte,
  igual que con el `ThemeToggle` — sin lógica extra.

## Archivos tocados

```
src/components/ChapterNav.astro              # NUEVO — flechas fijas + barra fallback
src/components/ReaderHeader.astro            # MOD — quita prev/next; añade botón de inicio
src/pages/[slug]/[capitulo]/index.astro      # MOD — <ChapterNav> tras el lector
src/pages/[slug]/introduccion/index.astro    # MOD — <ChapterNav> tras el contenido
```

## Verificación realizada

- `pnpm astro check` → **0 errores, 0 warnings, 0 hints**.
- `pnpm astro build` → **0 warnings, 1339 páginas**.
- **Extremos de la secuencia (verificado en el HTML):** el primer nodo
  (`genesis/introduccion`) renderiza solo `edge-next` + `bar-next` (destino
  "Génesis 1"), sin botón previo; el último (`apocalipsis/22`) solo `edge-prev` +
  `bar-prev` (destino "Apocalipsis 21"), sin siguiente; un nodo intermedio
  (`genesis/2`) renderiza los cuatro.
- **Barra tras las notas:** en `genesis/2`, `.footnotes` aparece antes que
  `.bar-nav` en el HTML.
- **Header:** orden `reader-lead → btn-home → btn-picker`; ninguna página
  conserva la nav vieja (`.nav-btn`).

### Cómo probar manualmente

1. `astro dev --background` (ver `CLAUDE.md`).
2. En desktop (≥ 64rem), en `/genesis/2/`: dos flechas circulares en los bordes,
   centradas verticalmente; hover cambia a `--accent`; el `title`/`aria-label`
   nombra el destino. En `/genesis/1/` no hay flecha izquierda (no hay anterior);
   en el último nodo de la secuencia no hay derecha.
3. Achicar la ventana por debajo de 64rem: las flechas desaparecen y aparece la
   barra al final, **después de las notas**, con flecha + nombre (ellipsis en
   nombres largos). En ningún ancho se ven ambos patrones ni ninguno.
4. Header: el botón de inicio (casa) enlaza a `/`; hover a `--accent`; foco
   visible con `Tab`.
5. Verificar que las flechas no tapan el texto en anchos intermedios ni chocan
   con el toggle de tema; y que al abrir el modal quedan cubiertas por el
   backdrop.
