# Paso 8 — Control de tamaño de texto (A- / A+) en el lector

Añade un control **A- / A+** para que el lector ajuste el tamaño del cuerpo de
lectura (versículos, notas y prosa de introducción/prólogo). La preferencia es
**persistente por dispositivo** y se aplica **antes del primer render** para no
producir salto de tamaño al cargar. El control es visible **solo en las páginas
del lector** (capítulo, introducción, prólogo), no en la home ni en
"Mis resaltados".

Sigue el mismo patrón de isla vanilla TypeScript + persistencia en
`localStorage` ya usado por el `ThemeToggle` (Paso 5), conviviendo con la lógica
de temas de forma **independiente**: cada uno lee/escribe su propia clave
(`theme` vs `fontScale`).

## Alcance de este paso

**Incluido:**

- Variable CSS `--verse-font-scale` (default `1`) en el scope global.
- `font-size` del cuerpo de lectura pasado a `calc(base * var(--verse-font-scale))`.
- Aplicación anticipada del valor guardado en el script `is:inline` del Layout.
- Componente `FontSizeControl.astro` (dos botones A- / A+).
- Integración en `ReaderHeader.astro` y ajuste responsive del header.

**Fuera de alcance:** temas (no se toca su lógica), y cualquier componente no
mencionado.

## Variable de escala — CSS

`src/styles/global.css`, en el `:root` donde viven las variables de tipografía:

```css
--verse-font-scale: 1;
```

Es el multiplicador del cuerpo de lectura. Se cambió el `font-size` **fijo** por
un `calc()` en los tres lugares donde vive el cuerpo de lectura larga:

| Componente / página          | Selector    | Antes      | Después                                      |
| ---------------------------- | ----------- | ---------- | -------------------------------------------- |
| `ChapterReader.astro`        | `.chapter`  | `1.25rem`  | `calc(1.25rem * var(--verse-font-scale))`    |
| `FootnotesSection.astro`     | `.footnote` | `1.05rem`  | `calc(1.05rem * var(--verse-font-scale))`    |
| `[slug]/introduccion/…`      | `.prose`    | `1.25rem`  | `calc(1.25rem * var(--verse-font-scale))`    |
| `prologo/…`                  | `.prose`    | `1.25rem`  | `calc(1.25rem * var(--verse-font-scale))`    |

**Decisión — la intro/prólogo comparten la preferencia:** son el mismo tipo de
contenido de lectura larga que los versículos, así que lo más simple y
consistente es que escalen con la misma variable. Un único control gobierna todo
el cuerpo de lectura del sitio.

**La letra capitular (versal) NO escala.** `.dropcap` en `Verse.astro` se
mantiene fija en `font-size: 4rem`: es un elemento decorativo, no cuerpo de
lectura. Al ir `float`-ada y con `line-height` propio, su tamaño fijo convive
bien con un cuerpo más grande o más chico sin romper el ritmo.

## Persistencia — mismo patrón que el tema

- **Clave de `localStorage`: `fontScale`.** Guarda el valor numérico de la
  escala como string (p. ej. `"1.15"`).
- **Pasos permitidos:** `[0.85, 1, 1.15, 1.3, 1.45]` — incrementos pequeños y
  perceptibles, con el default (`1`) en el medio y mínimo/máximo acotados para no
  romper el layout en extremos.
- **Aplicación anticipada (sin flash de tamaño):** el mismo script `is:inline`
  del `<head>` de `Layout.astro` que aplica el tema ahora, además, lee
  `localStorage.fontScale` y —si es un número válido en `[0.85, 1.45]`— setea
  `--verse-font-scale` como estilo inline en `<html>` **antes de que se pinte el
  contenido**. Si no existe o es inválido, no setea nada y aplica el default `1`
  de `:root`. Ambas piezas del script (tema y escala) son independientes.

```js
const fs = parseFloat(localStorage.getItem('fontScale'));
if (fs >= 0.85 && fs <= 1.45) {
  document.documentElement.style.setProperty('--verse-font-scale', String(fs));
}
```

## Componente — `src/components/FontSizeControl.astro`

Grupo de **dos botones** con lenguaje de **contorno** (coherente con
`btn-picker` y `theme-toggle`), unidos por una hairline:

- **A-** (`data-font-dec`): retrocede un paso, sin bajar del mínimo.
- **A+** (`data-font-inc`): avanza un paso, sin pasar del máximo.
- La "A" de cada botón tiene tamaño distinto (0.8rem vs 1.1rem) y un signo
  `−` / `+`, reforzando visualmente disminuir/aumentar — patrón reconocible.
- **En vivo:** cada click actualiza `--verse-font-scale` en `<html>` y guarda en
  `localStorage.fontScale`.
- **Deshabilitado en los extremos (no oculto):** el botón que llegó al mínimo o
  máximo queda `disabled` + `opacity: 0.35`, para que el usuario entienda que
  llegó al límite. El estado se sincroniza también **al cargar** (leyendo el
  paso actual), no solo tras un click.
- **Accesibilidad:** son `<button>` nativos (teclado + Enter/Espacio), con
  `aria-label` descriptivo ("Disminuir tamaño de texto" / "Aumentar tamaño de
  texto"), el grupo con `role="group"` y `aria-label="Tamaño del texto"`, y
  anillo de foco `:focus-visible`. Respeta `prefers-reduced-motion`.

El script deriva el paso actual con `nearestIndex(readScale())`: lee la escala
guardada (fallback al default) y busca el paso más cercano, de modo que el
estado de los botones siempre coincide con lo aplicado por el script inline.

Los pasos y el rango `[0.85, 1.45]` están duplicados entre el componente y la
validación del script inline; si se cambian en uno, ajustar en el otro (anotado
en ambos archivos).

## Integración — `ReaderHeader.astro`

`<FontSizeControl />` se incluye en el header, dentro de un nuevo cluster
derecho `.reader-actions` que agrupa los controles existentes:

```
[ícono inicio]  [A- | A+]  [Elegir libro]
```

Como `ReaderHeader` solo se importa en las páginas de **capítulo, introducción y
prólogo**, el control aparece exactamente ahí y **no** en la home (que no tiene
cuerpo de lectura) ni en "Mis resaltados" (que usa su propio header y solo
menciona a `ReaderHeader` en un comentario).

## Responsive

- El cluster `.reader-actions` es `flex` con `gap: 0.5rem`, `flex-wrap: wrap` y
  `justify-content: flex-end`; el `.reader-topline` pasó a `flex-wrap: wrap`. En
  anchos intermedios/móvil, si el cluster no cabe junto al título, **envuelve
  como bloque bajo el encabezado** manteniéndose alineado a la derecha, sin
  apretarse.
- Se mantiene el `padding-right: 3rem` del `.reader-topline` en
  `@media (max-width: 48rem)` (Paso 5) para no solaparse con el `ThemeToggle`
  flotante.
- Áreas táctiles ~44px: cada botón A-/A+ tiene `min-height: 2.75rem` y
  `min-width: 2.5rem`. El `.btn-home` (2.75rem) perdió su `margin-left: -0.6rem`
  de alineación con el borde de columna, innecesario ahora que vive en el
  cluster derecho.

## Estructura de archivos

```
src/
  components/
    FontSizeControl.astro     # NUEVO — control A- / A+ (isla vanilla TS)
    ReaderHeader.astro        # MOD — cluster .reader-actions + <FontSizeControl/>
    ChapterReader.astro       # MOD — font-size del cuerpo a calc(... * var)
    FootnotesSection.astro    # MOD — font-size de notas a calc(... * var)
  layouts/
    Layout.astro              # MOD — script inline aplica fontScale (independiente del tema)
  pages/
    [slug]/introduccion/index.astro   # MOD — .prose a calc(... * var)
    prologo/index.astro               # MOD — .prose a calc(... * var)
  styles/
    global.css                # MOD — declara --verse-font-scale: 1 en :root
```

`Verse.astro` NO se tocó: la versal `.dropcap` permanece fija en `4rem`.

## Verificación realizada

- `pnpm astro check` → **0 errores, 0 warnings, 0 hints**.
- `pnpm astro build` → **0 warnings, 1386 páginas, "Complete!"**.
- **Variable + `calc()` en el bundle:** `--verse-font-scale:1` presente en
  `:root`; en el CSS/HTML compilado aparecen
  `font-size:calc(1.25rem * var(--verse-font-scale))` (cuerpo y prosa de
  intro/prólogo) y `font-size:calc(1.05rem * var(--verse-font-scale))` (notas).
- **Versal fija:** `.dropcap` compilado conserva `font-size:4rem` (sin la
  variable de escala).
- **Presencia correcta del control:** "Disminuir tamaño de texto" aparece 1 vez
  en `genesis/1` (capítulo) y en `genesis/introduccion` / `prologo`, y **0
  veces** en la home (`index.html`).
- **Clave coherente e independiente:** el script inline y el componente usan
  `localStorage['fontScale']`, distinta de `theme`; ambos scripts conviven en el
  mismo `<head>` sin interferir.

### Cómo probar manualmente

1. `astro dev --background` (ver `CLAUDE.md`).
2. En `/genesis/1/`: click en **A+** varias veces → el texto de versículos y
   notas crece por pasos; **A-** lo reduce. La letra capitular NO cambia de
   tamaño.
3. Llegar al máximo: **A+** queda deshabilitado (atenuado). Llegar al mínimo:
   **A-** queda deshabilitado.
4. Elegir un tamaño y **recargar**: el texto aparece ya en ese tamaño, sin salto
   visible (lo aplica el script inline). Navegar a otro capítulo, a la
   introducción y al prólogo: la preferencia persiste en todos.
5. En la home no aparece el control; el tema sigue funcionando igual que antes
   (claves independientes).
6. En móvil (~375px): el cluster de acciones no se solapa con el `ThemeToggle`
   y, si no cabe en línea, envuelve bajo el título; los botones A-/A+ se tocan
   cómodamente (~44px).
```
