# Paso 10 — Tarjeta compartible (PNG) de un resaltado

Botón para descargar cualquier resaltado de "Mis resaltados" como una tarjeta
de imagen (PNG), en dos formatos: **cuadrado** (1080×1080, tipo post) o
**historia** (1080×1920). La tarjeta es una identidad visual fija (fondo negro,
acento dorado) que NO depende del tema activo del sitio: se ve igual la haya
generado el usuario en modo claro, oscuro o lectura.

## Alcance de este paso

**Incluido:**

- Endpoint JSON prerenderizado con el texto de cada capítulo.
- `src/lib/shareCard.ts` — obtención del texto + generación/descarga del PNG.
- `src/components/ShareCardTemplate.astro` — plantilla off-screen reutilizable.
- Dependencia `html-to-image`.
- Auto-ajuste de tamaño para pasajes largos.
- Integración en `HighlightsManager.astro` (dos botones por resaltado).

**Fuera de alcance / NO tocado:** esquema de datos, `chapterFlow.ts`,
`readingSequence.ts`, `bookCatalog.ts`, y la lógica de creación/edición de
resaltados (picker del lector, `RangeSelectionToolbar`).

## 1. Endpoint de datos — `src/pages/api/verses/[slug]/[chapter].json.ts`

Ruta estática (un archivo JSON por capítulo real, materializado en build; el
sitio sigue siendo 100% estático, no hay API dinámica).

- `getStaticPaths`: itera la colección `books` × sus capítulos, misma fuente
  que `[slug]/[capitulo]/index.astro`. El id de capítulo es `label ?? number`
  (Salmos dobles `9a`/`9b` incluidos), idéntico al valor guardado en
  `highlights.chapter`, así el cliente pide la URL directa sin traducir.
- Payload minimal: `{ verses: [{ number, text }] }` — SOLO número y texto (sin
  notas ni metadata), lo único que necesita la cita de la tarjeta.

## 2. Obtención del texto — `getPassageText` (`src/lib/shareCard.ts`)

`getPassageText(bookSlug, chapter, verseStart, verseEnd)` hace `fetch` al
endpoint, filtra los versículos del rango por número y los une con un espacio
como **prosa continua** (sin números de versículo visibles: la tarjeta muestra
una cita, no un pasaje numerado). Lanza si la petición falla.

## 3. Generación de la imagen — `generateCardImage` + `html-to-image`

Se instaló `html-to-image` (1.11.13). `generateCardImage(options)`:

1. Localiza el nodo `[data-share-card]` ya presente en la página (no crea uno
   nuevo: reutiliza la plantilla — ver punto 4).
2. Aplica la clase de formato (`share-card--square` / `share-card--story`) y
   reescribe cita y referencia.
3. Espera `document.fonts.ready` **antes** de medir y capturar (si no, el
   layout y el PNG saldrían con la fuente de fallback).
4. Ajusta el tamaño si el pasaje se desborda (punto 5).
5. `htmlToImage.toPng(node, { width, height, pixelRatio: 1 })` — el nodo ya
   está a tamaño real en px, no hace falta escalar.
6. Dispara la descarga con un `<a download>` temporal cuyo `href` es el data
   URL. El nombre lo deriva `cardFileName` del slug/capítulo/rango
   (`genesis-1-1-2.png` para un rango, `genesis-1-1.png` para un versículo).

## 4. Plantilla — `src/components/ShareCardTemplate.astro`

Nodo con el markup/estilo exacto de la tarjeta (comilla decorativa, cita, línea
separadora, referencia, wordmark). Incluido **una sola vez** en
`/mis-resaltados/`; su contenido se reescribe antes de cada captura y se
reutiliza para cualquier resaltado.

- **Posicionamiento:** `position: fixed; left: -9999px` — fuera del viewport
  pero **visible** (nunca `display:none`/`visibility:hidden`, que impedirían
  calcular layout/`scrollHeight` y podrían capturar vacío).
- **Formato:** la clase modificadora ajusta dimensiones, padding y tamaños de
  fuente (el formato historia usa texto algo más grande).
- **Colores fijos escritos a mano** (NO `var(--…)`): negro `#000000`, dorado
  `#d4a72c`, crema `#f2f0e8`, gris `#7a766c`. Las **fuentes** sí reutilizan
  `var(--font-display|body|sans)` porque son globales y no cambian con el tema.

## 5. Auto-ajuste para pasajes largos — `fitText`

El bloque de contenido (`.share-card-inner`) tiene altura fija (anclas
absolutas top/bottom). `fitText` compara su `scrollHeight` (contenido real)
contra su `clientHeight` (área disponible): mientras desborde, reduce el
`font-size` de la cita en pasos de **0.05rem**, con un **piso** de la mitad del
tamaño base (no encoge indefinidamente).

## 6. Integración — `HighlightsManager.astro`

Cada item de resaltado añade dos botones (ícono de descarga + texto, mismo
contorno `hm-textbtn` del resto del componente): **"Cuadrado"** y **"Historia"**.
Al pulsar cualquiera:

- `getPassageText` con los datos del highlight, luego `generateCardImage` con el
  texto, la referencia (`formatReference` vía el helper `reference(h)` existente)
  y el formato del botón.
- **Estado de carga:** el botón se deshabilita y muestra "Generando…" mientras
  se construye la imagen; revierte al terminar o fallar.
- **Errores:** `console.error` + `alert` breve, sin romper el resto de la página.

## Estilo de la tarjeta (mockup aprobado)

- Fondo negro sólido `#000000`.
- Comilla: Fraunces 600, dorado `#d4a72c`, grande (proporcional al formato).
- Cita: EB Garamond itálica, `#f2f0e8`, centrada, line-height 1.5, tamaño
  auto-ajustable.
- Línea separadora: 56px × 1px, dorada.
- Referencia: Fraunces medium, dorado.
- Wordmark: Inter, mayúsculas, letter-spacing 0.18em, gris `#7a766c`, cerca del
  borde inferior.
- Padding interno ~10% del ancho.

## Estructura de archivos

```
src/
  pages/
    api/verses/[slug]/[chapter].json.ts  # NUEVO — endpoint JSON prerenderizado
    mis-resaltados/index.astro           # MOD — incluye <ShareCardTemplate /> una vez
  components/
    ShareCardTemplate.astro              # NUEVO — plantilla off-screen de la tarjeta
    HighlightsManager.astro              # MOD — botones Cuadrado/Historia + lógica de descarga
  lib/
    shareCard.ts                         # NUEVO — getPassageText, generateCardImage, cardFileName
package.json                             # MOD — dependencia html-to-image
```

## Verificación realizada

- `pnpm astro check` → **0 errores, 0 warnings, 0 hints** (32 archivos).
- `pnpm astro build` → **Complete!** (1386 páginas HTML, exit 0).
- **Endpoints JSON:** 1336 archivos generados en `dist/api/verses/`. Muestreo:
  `dist/api/verses/genesis/1.json` → 31 versículos, payload `{ number, text }`
  correcto. Salmos dobles presentes (`salmos/9a.json`, `salmos/9b.json`).
- **Plantilla:** `class="share-card share-card--square"` aparece **1 vez** en
  `dist/mis-resaltados/index.html` y **0 veces** en `dist/genesis/1/index.html`
  y `dist/index.html`.

### Cómo probar manualmente

1. `astro dev --background` (ver `CLAUDE.md`), con sesión iniciada y al menos un
   resaltado creado.
2. En `/mis-resaltados/`: cada resaltado muestra los botones **"Cuadrado"** y
   **"Historia"**. Pulsar uno descarga un PNG (1080×1080 o 1080×1920) con la
   cita, la referencia y el wordmark sobre fondo negro dorado.
3. Con el sitio en modo claro o lectura, la tarjeta descargada sigue siendo
   negra/dorada (no depende del tema).
4. Un resaltado de **rango largo** (varios versículos) sale con el texto más
   pequeño pero legible (auto-ajuste), sin desbordar los bordes.
5. Mientras genera, el botón se deshabilita y dice "Generando…"; al terminar
   revierte. Con la red cortada, muestra un `alert` de error y revierte.
```
