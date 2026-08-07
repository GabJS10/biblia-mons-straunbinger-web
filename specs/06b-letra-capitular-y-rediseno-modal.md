# Paso 6b — Letra capitular y rediseño del modal de selección

Segundo prompt de 3 del refactor visual, sobre el sitio ya funcional con la base
del Paso 6a aplicada (paleta de 3 temas, tipografías Fraunces / EB Garamond /
Inter, botones de contorno). Este paso añade el **elemento de firma** del sitio
—la letra capitular— y rediseña la **superficie** del modal de selección hacia
un look de índice de libro impreso.

Parte exclusivamente visual: reutiliza los tokens ya establecidos
(`--font-display`, `--font-body`, `--font-sans`, `--accent`, `--border`,
`--bg-raised`); no crea variables paralelas ni toca lógica.

La parte final (6c: navegación lateral + botón de inicio) llega en un prompt
separado y **no** se adelanta aquí.

## Alcance de este paso

**Incluido:**

- Letra capitular (versal) en el primer versículo de cada capítulo real.
- Rediseño visual del `BookPickerModal`: vista de libros como índice
  tipográfico y vista de capítulos como cuadrícula de números sin cajas.
- Accesibilidad: áreas clickeables por padding + anillos de foco propios al
  quitar los bordes que antes enmarcaban las celdas.

**Fuera de alcance (no tocado):** navegación anterior/siguiente (sigue en el
header → 6c), botón de inicio (→ 6c), y la **lógica** del modal (`<dialog>`
nativo, tabs con `data-active`, transición libros↔capítulos, cierre X/backdrop/
Escape, cruce de datos de `bookCatalog.ts`). Tampoco `chapterFlow.ts` /
`readingSequence.ts` / rutas / schema.

## 1. Letra capitular (versal)

**Dónde se decide:** `ChapterReader.astro` calcula el índice del primer ítem de
tipo `verse` del flujo (`items.findIndex(i => i.kind === 'verse')`) y pasa
`dropcap` a ese `<Verse>`. Así la versal cae en el **primer versículo** aunque el
flujo abra con encabezados de división/sección (la versal no es el primer
carácter visible de la página, sino el del primer versículo).

**Solo en capítulos reales:** `ChapterReader` únicamente se usa en la ruta
`/[slug]/[capitulo]/`. Las introducciones (`/[slug]/introduccion/`) y el prólogo
(`/prologo/`) renderizan Markdown como prosa continua y **no** pasan por este
componente, así que nunca reciben versal. La regla se cumple por construcción,
sin condicionales por ruta.

**Cómo se renderiza** (`Verse.astro`, prop `dropcap`):

- Se separa la primera letra del texto (ignorando espacios iniciales) del resto,
  y se envuelve en `<span class="dropcap">`. Ambas partes quedan dentro de
  `.verse-text` **como texto real** (sin `aria-hidden`): un lector de pantalla
  lee `"E"` + `"n el principio…"` de corrido, sin perder la palabra.
- La versal se marca sin espacio en blanco intermedio (todo en una línea del
  template) para que `float: left` no deje un hueco entre la capital y el resto.
- En el versículo con versal se **omite el número visible** (`sup.verse-num`): el
  "1" es redundante frente a la capital que abre el capítulo, y su superíndice
  quedaría mal ubicado junto a la letra grande. El `id="verse-1"` del contenedor
  se conserva, así que los enlaces de retorno `↑` de las notas siguen anclando.
- Los superíndices de nota van, como siempre, **al final** del versículo (no al
  inicio), de modo que la versal flotada nunca choca con un marcador de nota.

**Estilo** (`.dropcap`, sin ornamento alguno — ni recuadro, ni fondo, ni borde,
ni sombra):

```css
.dropcap {
  float: left;
  font-family: var(--font-display); /* Fraunces */
  font-weight: 600;
  font-size: 4rem;
  line-height: 0.8;                 /* ajustado al cuerpo EB Garamond 1.25rem/1.8 */
  color: var(--accent);
  margin: 0.1rem 0.12em 0 0;
}
```

`float: left` funciona aunque `.verse` sea `display: inline`: el flotante se saca
del flujo y se posiciona respecto al bloque contenedor (`.chapter`), con el texto
envolviéndolo ~2-3 líneas. Los valores están afinados al ritmo vertical del
cuerpo (EB Garamond 1.25rem, `line-height: 1.8`); si ese ritmo cambia, se
reajustan aquí.

**Temas:** el color usa `var(--accent)`, que ya cambia de tono por tema
(`#8A5D12` claro · `#D4A72C` oscuro · `#8A5A2B` lectura), de modo que la versal se
adapta sola a los 3 fondos.

## 2. Rediseño del modal — `BookPickerModal.astro`

Se abandona el look de "grid de botones con borde" (que el 6a solo suavizó con
hairlines) por algo más tipográfico. **Solo CSS + clases**: el HTML y el script
no se tocan.

### Vista de libros — índice tipográfico

- Nombres en `var(--font-display)` (Fraunces), `1.2rem`, peso 500, alineados a la
  izquierda.
- **Sin fondo ni borde de caja.** Cada libro es texto plano con un `border-bottom`
  hairline (`1px solid var(--border)`); al ser un grid multicolumna, los hairlines
  alinean en filas continuas y dan el aire de un índice impreso.
- Grid: `minmax(13rem, 1fr)` (nombres largos como "I Paralipómenos (1 Crónicas)"
  caben mejor), `column-gap: 2.5rem`, `row-gap: 0` (las filas las marca el
  hairline).
- Hover: color `--accent` + subrayado. **Sin** relleno ni borde nuevo.
- Tabs AT/NT: se mantienen como en el 6a (uppercase + hairline + activo en
  `--accent`); combinan con el nuevo índice sin ajustes.

### Vista de capítulos — cuadrícula de números

- Números en `var(--font-sans)` (Inter). Se evaluó Fraunces (`--font-display`),
  pero **a la densidad de Salmos (152 celdas) el sans se lee más limpio y
  parejo**; la serif de display recargaba la cuadrícula.
- **Sin cajas:** la celda conserva su tamaño (`aspect-ratio: 1`, `minmax(3.25rem)`)
  como **área táctil generosa**, pero desaparecen fondo y borde. Hover: color
  `--accent` + subrayado.
- Celda "Introducción": se distingue de los números con **itálica en Fraunces**
  (`--font-display`, `font-style: italic`, en `--accent`), ocupando toda la fila
  con un hairline inferior — no un recuadro.
- Se conserva el `overflow-y: auto` del contenedor (`.view`), así Salmos sigue
  haciendo scroll dentro del modal.

## 3. Accesibilidad

Al quitar los bordes/fondos tipo botón:

- **Área clickeable por padding, no por texto:** `.book-btn` mantiene
  `padding: 0.7rem 0.25rem`; `.chapter-cell` mantiene `aspect-ratio: 1` sobre
  `minmax(3.25rem)` (~52px). El objetivo táctil no depende del ancho del glifo.
- **Foco de teclado con anillo propio** (`:focus-visible`), ya que no hay borde de
  fondo que lo sugiera: `.book-btn` con `outline: 2px solid var(--accent)` y
  `outline-offset: 2px`; `.chapter-cell` con el mismo anillo pero
  `outline-offset: -2px` (inset) para no solaparse con celdas vecinas en la
  cuadrícula densa. `.tab`, `.btn-back` y `.btn-close` conservan su foco.
- Los elementos siguen siendo `<button>` (libros) y `<a>` (capítulos): alcanzables
  por teclado y activables como antes.

## Archivos tocados

```
src/components/ChapterReader.astro   # marca el primer versículo con dropcap
src/components/Verse.astro           # prop dropcap: versal + omisión del número; estilo .dropcap
src/components/BookPickerModal.astro # rediseño visual (índice de libros + grid de números); solo CSS/clases
```

## Verificación realizada

- `pnpm astro check` → **0 errores, 0 warnings, 0 hints**.
- `pnpm astro build` → **0 warnings, 1339 páginas**.
- **Versal presente solo en capítulos:** `.dropcap` aparece exactamente 1 vez en
  `genesis/1` (la "A" de "Al principio…") y **0** veces en
  `genesis/introduccion` y `prologo`.
- **Cae en el primer versículo, no en el encabezado:** en `genesis/1` la versal
  va después del `<h2 class="division">`; en `mateo/1` y `salmos/1`, después del
  `<h3 class="section">`; el primer versículo omite el `sup.verse-num` mientras
  `verse-2` conserva su número.

### Cómo probar manualmente

1. `astro dev --background` (ver `CLAUDE.md`).
2. `/genesis/1/`: la "E" de "En el principio…" aparece como versal dorada que
   envuelve ~2-3 líneas, sin número "1" delante; el resto de versículos conservan
   su número. Probar los 3 temas: la versal cambia de tono con `--accent`.
3. Un capítulo que abra con división/sección (encabezado antes del texto):
   verificar que la versal cae en el primer **versículo**, no en el encabezado.
4. `/prologo/` y una introducción: prosa continua **sin** versal.
5. Abrir el modal: los libros se ven como índice (Fraunces, hairlines, sin
   cajas); hover subraya y colorea. Elegir un libro con intro (p. ej. Génesis):
   la celda "Intro" en itálica Fraunces, los números en Inter sin cajas; Salmos
   hace scroll. Navegar con `Tab`: anillo de foco visible en libros y números.
