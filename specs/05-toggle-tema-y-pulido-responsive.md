# Paso 5 — Botón flotante de tema y pulido responsive

Quinto y último paso base del sitio de lectura bíblica (Biblia Straubinger).
Añade el botón flotante para cambiar de tema (visible en todo el sitio) y una
pasada de pulido responsive/accesibilidad sobre lo ya construido en los
Pasos 1–4. Es un paso puramente de UI/interacción: no toca datos, rutas ni el
sistema de notas.

## Alcance de este paso

**Incluido:**

- Componente `ThemeToggle.astro`: botón flotante que cicla los 3 temas.
- Integración global (una sola vez en `Layout.astro`).
- Auditoría y correcciones responsive: áreas táctiles, clearance del toggle
  frente al header, foco de teclado.

**Fuera de alcance:** nada pendiente del plan base; este paso lo cierra.

## Componente — `src/components/ThemeToggle.astro`

Botón `position: fixed` en la esquina superior derecha (`top/right: 0.75rem`,
`z-index: 50`), circular, de 2.75rem (≈44px de área táctil).

- **Ciclo:** claro → oscuro → lectura → claro… Al hacer click actualiza
  `document.documentElement.dataset.theme` y `localStorage.theme`.
- **Misma clave que el anti-parpadeo:** usa `localStorage['theme']` con los
  valores `light`/`dark`/`reading`, idénticos al script `is:inline` de
  `Layout.astro` (Paso 1), de modo que la elección persiste y ambos coinciden.
- **Ícono según el tema:** tres SVG inline simples (sol / luna / libro), sin
  dependencia externa. El ícono visible lo decide **CSS** a partir de
  `html[data-theme=…]` (reglas `:global`), así coincide con el fondo ya en el
  primer render —sin flash de ícono ni depender de JS—. El JS, además, **lee
  `document.documentElement.dataset.theme` al inicializar** (no asume `light`).
- **Accesibilidad:** es un `<button>` nativo (alcanzable por teclado, activable
  con Enter/Espacio). El `aria-label` describe la **acción** (el próximo tema:
  "Cambiar a modo oscuro", etc.) y se actualiza en cada click. Anillo de foco
  visible (`:focus-visible`).
- **Transición suave:** `html`/`body` ya transicionan `background-color`/`color`
  (global.css, Paso 1); el cambio de tema se ve gradual en todo el sitio, no
  solo en el botón.
- Respeta `prefers-reduced-motion` (sin transición del botón).

## Integración global — `Layout.astro`

`<ThemeToggle />` se incluye **una sola vez** en `<body>`, antes del `<slot />`,
por lo que aparece automáticamente en todas las páginas (home, capítulo,
introducción, prólogo) sin tocarlas individualmente.

**No se superpone con el `BookPickerModal`:** el modal usa `<dialog>` nativo con
`.showModal()`, que lo coloca en el *top layer* (por encima de cualquier
`z-index`) y deja el resto de la página **inerte**. Su `::backdrop` cubre el
toggle mientras el modal está abierto, y el toggle no es enfocable en ese
estado. No hizo falta lógica extra.

## Auditoría y pulido responsive

Revisado en móvil (~360–420px), tablet (~768px) y desktop. Ajustes aplicados:

- **Clearance toggle ↔ `ReaderHeader`.** El botón "Elegir libro" queda al borde
  derecho del contenido; en anchos donde el contenido ocupa casi todo el ancho
  se solapaba con el toggle flotante. Se añadió `padding-right: 3rem` al
  `.reader-topline` en `@media (max-width: 48rem)`, de modo que el botón se
  desplaza a la izquierda del toggle. En desktop el contenido está centrado
  (max-width 44rem) y nunca alcanza la esquina, así que no aplica.
- **Áreas táctiles ≥ ~44px** (usando `min-height`/`min-width` sin agrandar el
  ícono visible):
  - `ThemeToggle`: 2.75rem × 2.75rem.
  - `ReaderHeader`: `.btn-picker` y `.nav-btn` con `min-height: 2.75rem`.
  - `BookPickerModal`: `.tab` con `min-height: 2.75rem`; `.btn-close` de
    2.25rem → 2.75rem.
  - `Verse` `.footnote-ref` (superíndice): `padding: 0.5em 0.35em` +
    `margin: 0 -0.15em` para ampliar la caja clickeable sin cambiar el tamaño
    visible del marcador ni el interlineado de la prosa (mejor esfuerzo dado que
    es un ancla inline dentro del texto).
  - `FootnotesSection` `.footnote-back` (flecha ↑): `inline-grid` centrado con
    `min-width/height: 2.75rem` y márgenes negativos para no desalinear la
    cuadrícula de la nota.
  - Celdas de capítulo del modal: ya median ≥ 3.25rem (aspect-ratio 1 → ~52px),
    cómodas para tocar; el grid vive en un contenedor con `overflow-y: auto`,
    así Salmos (152 capítulos) hace scroll dentro del modal en móvil.
- **Foco de teclado visible:** `:focus-visible` con anillo `--accent` en el
  toggle, `.btn-picker`, `.nav-btn`, `.footnote-ref` y `.footnote-back`.
- **Contraste en los 3 temas:** revisado el `--accent` (`#8a5a2b`) sobre el
  fondo `reading` (sepia `#f4ecd8`) —marrón oscuro sobre crema, legible— y el
  destello `:target` (Paso 3), que usa `color-mix(--accent 30%)`: un lavado
  translúcido cálido que no compite con el texto ni desentona con la paleta.
  Sin cambios necesarios.
- **Nombres largos:** "Cantar de los Cantares", "Hechos de los Apóstoles",
  "I Paralipómenos (1 Crónicas)" se envuelven dentro de su celda
  (`book-grid` con `minmax(9rem, 1fr)`, texto centrado) sin romper el grid; en
  el header, los `label` de navegación ya truncan con ellipsis (Paso 4) y la
  flecha permanece visible.

## Estructura de archivos

```
src/
  components/
    ThemeToggle.astro                 # NUEVO — botón flotante de tema
    ReaderHeader.astro                # MOD — clearance + áreas táctiles + foco
    BookPickerModal.astro             # MOD — áreas táctiles (tabs, cerrar)
    Verse.astro                       # MOD — área táctil + foco del superíndice
    FootnotesSection.astro            # MOD — área táctil + foco de la flecha ↑
  layouts/
    Layout.astro                      # MOD — incluye <ThemeToggle /> global
```

## Verificación realizada

- `pnpm astro check` → **0 errores, 0 warnings, 0 hints**.
- `pnpm astro build` → **0 warnings, 1339 páginas**.
- **Presencia global:** `.theme-toggle` aparece exactamente 1 vez en `index`,
  capítulo (`genesis/1`), introducción (`genesis/introduccion`) y `prologo`.
- **Clave coherente:** el script del toggle usa `localStorage.getItem('theme')`
  y `setItem('theme', …)` — la misma que el anti-parpadeo del Paso 1.
- **Ícono por tema:** el CSS empaquetado contiene
  `html[data-theme=light] .icon-light{display:block}` (y dark/reading), más el
  fallback `html:not([data-theme]) .icon-light` → el ícono coincide con el tema
  aplicado sin flash.
- **Labels dinámicos:** "Cambiar a modo claro/oscuro/lectura" presentes en el
  bundle; el init lee `document.documentElement.dataset.theme`.
- **Sin colisión con el modal:** confirmado `<dialog>` nativo (top layer);
  nombres largos y Salmos (`9a,9b,113a,113b`) renderizan bien en el grid.

### Cómo probar manualmente

1. `astro dev --background` (ver `CLAUDE.md`).
2. Desde la home y desde `/genesis/1/`: click en el toggle cicla claro → oscuro
   → lectura → claro; el fondo/texto transiciona suave en toda la página.
3. Elegir un tema, recargar: no hay parpadeo y el ícono del toggle coincide con
   el tema aplicado.
4. Teclado: `Tab` hasta el toggle (anillo de foco visible) y `Enter`/`Espacio`
   cambia el tema.
5. Abrir el `BookPickerModal`: el toggle queda cubierto por el backdrop y no
   interfiere; al cerrar, vuelve a estar disponible.
6. En móvil (~375px): el botón "Elegir libro" no se solapa con el toggle; nav,
   celdas del modal y flecha ↑ se tocan cómodamente; Salmos hace scroll dentro
   del modal.
```
