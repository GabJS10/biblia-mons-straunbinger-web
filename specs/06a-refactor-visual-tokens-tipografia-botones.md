# Paso 6a — Refactor visual: tokens de color, tipografía y lenguaje de botones

Primer prompt de un refactor visual dividido en 3 partes sobre el sitio ya
funcional (Pasos 1–5). Este paso cubre **solo** la base del nuevo estilo:
tokens de color de los 3 temas, las nuevas familias tipográficas y el lenguaje
de botones/bordes. No toca estructura ni lógica de componentes.

**Dirección de diseño:** editorial moderno (tipografía protagonista, mucho
blanco/negro, limpio), con una serif de carácter histórico para el cuerpo del
texto (sensación "de Biblia impresa"), acento dorado/ocre litúrgico y modo
oscuro en **negro real** (no gris oscuro).

Las partes siguientes (6b: letra capitular + rediseño del modal; 6c: navegación
lateral + botón de inicio) llegan en prompts separados y **no** se adelantan
aquí.

## Alcance de este paso

**Incluido:**

- Nueva paleta de tokens para los 3 temas (`themes.css`), con dos variables
  nuevas: `--border` (hairlines) y `--bg-raised` (superficies elevadas).
- Reemplazo de las tipografías: Lora → **Fraunces** (títulos) + **EB Garamond**
  (cuerpo). Inter se mantiene para UI.
- Botones de acción de "pill" relleno → estilo **contorno** (outline).
- Divisores gruesos → líneas finas tipo hairline (`1px solid var(--border)`).
- Más whitespace en la home y en el header del lector.
- Auditoría de color: todos los usos pasan a variables actualizadas.

**Fuera de alcance (no tocado):** estructura del modal (grid de libros/
capítulos → 6b), navegación anterior/siguiente (sigue en el header → 6c), letra
capitular (no existe aún → 6b), y `chapterFlow.ts` / `readingSequence.ts` /
`bookCatalog.ts` / rutas / schema.

## 1. Tokens de color — `src/styles/themes.css`

Se reemplazaron las variables de los 3 temas. Se **eliminó** `--note-icon` (su
color muteado ya no encaja con la nueva paleta; los marcadores/anclas de nota
pasan a usar `--accent` directamente). Se **añadieron** `--border` y
`--bg-raised`.

| Token              | Claro     | Oscuro (negro real) | Lectura   |
| ------------------ | --------- | ------------------- | --------- |
| `--bg`             | `#FAFAF7` | `#000000`           | `#F4ECD8` |
| `--text`           | `#17140F` | `#F2F0E8`           | `#2B2013` |
| `--text-secondary` | `#6B6558` | `#938F82`           | `#6B5D45` |
| `--accent`         | `#8A5D12` | `#D4A72C`           | `#8A5A2B` |
| `--border`         | `#E4E0D5` | `#1C1C1A`           | `#E0D3B8` |
| `--bg-raised`      | `#F1EDE3` | `#0D0D0C`           | `#EEE3C9` |

**Sobre `--bg-raised` (evitar duplicados):** el CSS anterior no tenía una
variable para superficies elevadas; la "elevación" se improvisaba con
`color-mix(in srgb, var(--text-secondary) 10%, transparent)` repetido en
`ReaderHeader` (`.nav-btn`) y `BookPickerModal` (`.book-btn`, `.chapter-cell`).
Esos usos se **reemplazaron** por `var(--bg-raised)` en vez de crear una
variable paralela.

**Destello `:target` (Paso 3):** el keyframe `target-flash` usa
`color-mix(in srgb, var(--accent) 30%, transparent)` (18% en
`prefers-reduced-motion`). Como referencia `var(--accent)`, **se adapta solo**
a cada tema: sobre el negro puro del modo oscuro, el nuevo dorado más brillante
(`#D4A72C`) al 30% queda como un lavado translúcido cálido que no compite con el
texto (`#F2F0E8`, que va por encima). Revisado; **sin cambios necesarios**.

## 2. Tipografía — `src/styles/global.css`

Lora se retiró por completo (`pnpm remove @fontsource/lora`). Dos familias
nuevas, self-hosted vía `@fontsource` (mismo patrón existente):

- **Fraunces** (`@fontsource-variable/fraunces`, paquete `standard`: ejes
  `wght` 100–900 + `opsz` óptico, más su itálica) → variable `--font-display`.
  Cubre los pesos 400/500/600 e itálica que se usan en títulos y encabezados.
- **EB Garamond** (`@fontsource/eb-garamond`, pesos 400, 500 e itálica 400) →
  variable `--font-body`. Cuerpo del texto bíblico, notas, introducciones y
  prólogo.
- **Inter** (sin cambios) → variable `--font-sans`. UI, botones, navegación.

Se **renombró** `--font-serif` → `--font-body` de forma consistente en todo el
código (ChapterReader, prólogo, introducción, home, modal). Familias reales:
`'Fraunces Variable'` y `'EB Garamond'`.

**Aplicación de Fraunces (títulos):** además del reemplazo de Lora, los
encabezados que antes usaban Inter pasaron a Fraunces para materializar la
dirección editorial: `h1` de la home, `.reader-title`, `.division` (h2 de
capítulo) y `.section` (h3, en **itálica 500**). Se subió el tamaño del cuerpo
(1.15rem → 1.25rem) porque EB Garamond tiene una x-height menor que Lora y
rendía más pequeño al mismo tamaño.

**Auditoría:** `grep -rniE "font-serif|note-icon|lora"` sobre `*.astro`/`*.css`
→ **0 coincidencias**. Ningún componente referencia Lora ni por nombre de fuente
ni por variable.

## 3. Lenguaje visual — botones y bordes

- **Botones de acción → contorno.** Fondo transparente, `1px solid var(--accent)`
  (o `var(--border)` para los neutros como cerrar), texto en `--accent`,
  `border-radius: 2px` (nada de píldora), Inter, `text-transform: uppercase`,
  `letter-spacing: 0.06em`, `~0.85rem`. Hover: relleno `--accent` con texto
  `--bg` (para los de acción principal). Afecta a:
  - Home: `.btn-primary` (era pill relleno) y `.link-secondary` (ahora label UI).
  - `ReaderHeader`: `.btn-picker` (era pill con borde translúcido).
  - `BookPickerModal`: `.tab` (uppercase + hairline), `.btn-back`, `.btn-close`
    (era círculo con hover relleno → contorno neutro `--border`, radius 2px).
  - `ThemeToggle`: era círculo (`border-radius: 50%`) → cuadrado con contorno
    `--border`, radius 2px; se quitó el `box-shadow` (más limpio, mantiene el
    `backdrop-filter: blur` por legibilidad al flotar sobre el texto).
- **Hairlines.** Divisores/bordes gruesos → `1px solid var(--border)`:
  `.division` (era 2px `color-mix(accent 45%)`), `border-bottom` del
  `reader-header`, `border-top` de `.footnotes`, header del modal, y los bordes
  de `.book-btn` / `.chapter-cell` / `.nav-btn`.
- **Más whitespace.** Home: padding `5rem` → `7rem`, gaps y márgenes mayores.
  Header del lector: `margin-bottom` y `padding-bottom` mayores, `gap` de la
  topline `1rem` → `1.5rem`.

## 4. Auditoría de color

Revisados todos los componentes: no quedan valores hardcodeados de la paleta
anterior. Los `rgba(0,0,0,…)` de sombras/backdrop del modal y toggle son
neutros de superposición (no de paleta) y se conservan. El nuevo `--accent`
dorado se verificó legible en los 3 fondos, en particular `#D4A72C` sobre el
negro puro del modo oscuro (alto contraste) y `#8A5D12`/`#8A5A2B` (ocre oscuro)
sobre los cremas de claro y lectura.

## Archivos tocados

```
package.json / pnpm-lock.yaml     # -lora  +fraunces(variable)  +eb-garamond
src/styles/themes.css             # nueva paleta 3 temas; -note-icon +border +bg-raised
src/styles/global.css             # imports de fuentes; --font-serif→--font-body, +--font-display
src/components/ChapterReader.astro # cuerpo EB Garamond; división/sección Fraunces; hairline
src/components/Verse.astro         # footnote-ref: note-icon→accent (+ underline hover)
src/components/FootnotesSection.astro # note-icon→accent; hairline; título uppercase
src/components/ReaderHeader.astro  # título Fraunces; btn-picker contorno; nav bg-raised+hairline
src/components/BookPickerModal.astro # fuentes, tokens de color, tabs/close/back contorno (grid intacto)
src/components/ThemeToggle.astro   # círculo → contorno cuadrado
src/pages/index.astro              # h1 Fraunces; btn-primary contorno; +whitespace
src/pages/prologo/index.astro      # prosa EB Garamond
src/pages/[slug]/introduccion/index.astro # prosa EB Garamond
```

## Verificación realizada

- `pnpm astro check` → **0 errores, 0 warnings, 0 hints**.
- `pnpm astro build` → **0 warnings, 1339 páginas**.
- `grep` de `font-serif|note-icon|lora` en `*.astro`/`*.css` → **0 rastros**.
- Fuentes instaladas: `@fontsource-variable/fraunces` y
  `@fontsource/eb-garamond`; `@fontsource/lora` removido de `package.json`.

### Cómo probar manualmente

1. `astro dev --background` (ver `CLAUDE.md`).
2. Ciclar los 3 temas con el toggle: confirmar **negro real** en oscuro (no gris)
   y que el dorado se lee bien sobre los 3 fondos.
3. Home y header del lector: botones con **contorno** (no píldora rellena),
   uppercase; más aire alrededor.
4. Un capítulo (`/genesis/1/`): cuerpo en EB Garamond, encabezados de división en
   Fraunces, subtítulos de sección en Fraunces itálica; divisores finos.
5. Abrir el modal: tabs uppercase con subrayado fino, botón cerrar de contorno,
   celdas con borde hairline y hover en `--accent`.
