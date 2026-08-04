# Paso 1 — Base del proyecto

Documentación de la configuración base del sitio de lectura bíblica (Biblia
Straubinger). Este paso sienta la infraestructura sobre la que se construirán la
navegación, el lector y las notas en fases posteriores.

## Alcance de este paso

**Incluido:**

- Content Collections tipadas con Zod para los datos de los libros y el contenido
  editorial en Markdown.
- Carga y validación de los **73 libros reales** ya scrapeados.
- Sistema de tres temas (claro / oscuro / lectura) con persistencia y sin
  parpadeo (flash of wrong theme).
- Tipografías serif + sans self-hosted.
- `Layout` base y una página de prueba.

**Fuera de alcance (fases posteriores):** navegación entre libros/capítulos, modal
selector, renderizado de versículos/notas, y el botón visual de cambio de tema
(aquí solo queda la infraestructura de temas, no el toggle).

## Stack

- **Astro 7.1.6** (sitio estático, sin backend).
- **pnpm** como gestor de paquetes, **Node ≥ 22** (entorno con Node 24).
- **TypeScript 6.x** — fijado a propósito: `astro check` aún no soporta el
  compilador nativo de TypeScript 7 (no expone la API programática que necesita).
- Zod (vía `astro/zod`) para validar los datos.

## Content Collections — `src/content.config.ts`

Se definen dos colecciones con la API de Content Layer (loader `glob` de
`astro/loaders`). El loader deriva el `id` de cada entrada del nombre de archivo
(p. ej. `genesis.json` → `id: "genesis"`).

### `books` (datos, JSON)

Carga `src/content/books/*.json`. Schema validado contra la estructura real:

| Campo               | Tipo                                   | Notas                                   |
| ------------------- | -------------------------------------- | --------------------------------------- |
| `book`              | string                                 | Nombre para mostrar.                     |
| `slug`              | string                                 | Slug del libro.                          |
| `source`            | url                                    | URL de origen en bibliastraubinger.com. |
| `chapters[]`        | array                                  | Capítulos del libro.                     |
| `chapters[].chapter`| number                                 | Número de capítulo.                      |
| `chapters[].sections[]` | array (`default []`)               | Subtítulos editoriales.                 |
| `  ├ title`         | string                                 |                                         |
| `  ├ startVerse`    | number                                 |                                         |
| `  └ footnoteRefs`  | number[] **opcional**                  | Solo algunas secciones lo traen.        |
| `chapters[].verses[]` | array                                | Versículos.                             |
| `  ├ number`        | number                                 |                                         |
| `  ├ text`          | string                                 |                                         |
| `  └ footnoteRefs`  | number[] (`default []`)                | Puede estar vacío.                      |
| `divisions[]`       | array (`default []`)                   | Divisiones mayores (números romanos).   |
| `  ├ title`         | string                                 |                                         |
| `  ├ startChapter`  | number                                 |                                         |
| `  └ startVerse`    | number                                 |                                         |
| `footnotes`         | `Record<string, string>` (`default {}`)| `{ "<idNumérico>": "<texto>" }`.        |

> Las notas se guardan en un diccionario por ID (no incrustadas en cada
> versículo): una misma nota puede cubrir varios versículos. El frontend hará el
> lookup por el ID de `footnoteRefs` al renderizar.

### `intros` (contenido, Markdown)

Carga `src/content/intros/*.md`. Frontmatter:

- `title` (string, requerido).
- `book` (string, **opcional**): si está ausente → prólogo general de toda la
  Biblia; si tiene un slug de libro → introducción de ese libro.

## Contenido

- `src/content/books/*.json` — los **73 libros** (copiados de `scripts/output/`,
  generados por el scraper de la fase 0).
- `src/content/intros/prologo.md` — ejemplo de prólogo general (sin `book`).
- `src/content/intros/genesis.md` — ejemplo de introducción por libro
  (`book: genesis`).

## Sistema de temas

Tres modos, controlados por el atributo `data-theme` en `<html>`:

| Tema      | Descripción                                                        |
| --------- | ------------------------------------------------------------------ |
| `light`   | Claro (por defecto).                                               |
| `dark`    | Oscuro.                                                            |
| `reading` | Cálido sepia/papel envejecido, bajo contraste, para lectura larga. |

- **`src/styles/themes.css`** — custom properties por tema: `--bg`, `--text`,
  `--text-secondary`, `--accent` (links y números de versículo), `--note-icon`
  (íconos de nota).
- **Persistencia sin parpadeo**: un script inline `is:inline` en el `<head>` de
  `Layout.astro` lee `localStorage.theme` y fija `data-theme` **antes** del primer
  render, evitando el flash of wrong theme. Valida el valor (`light|dark|reading`)
  y cae a `light` por defecto.
- El botón de cambio de tema **no** se implementa en este paso; solo la
  infraestructura (variables CSS + persistencia).

## Tipografía

Self-hosted vía `@fontsource` (importadas en `src/styles/global.css`):

- **Lora** (serif) → cuerpo del texto bíblico, pensada para lectura prolongada.
  Variable `--font-serif`.
- **Inter** (sans-serif) → UI y navegación. Variable `--font-sans`.

## Estructura resultante

```
src/
  content.config.ts        # definición de las 2 colecciones
  content/
    books/*.json           # 73 libros
    intros/
      prologo.md           # prólogo general (sin book)
      genesis.md           # intro de ejemplo (book: genesis)
  layouts/
    Layout.astro           # shell + script de tema + global.css
  pages/
    index.astro            # página de prueba "Biblia Straubinger"
  styles/
    themes.css             # variables CSS de los 3 temas
    global.css             # temas + fuentes + estilos base
```

## Verificación realizada

- `pnpm astro sync` → los 73 JSON reales pasan el schema Zod sin errores.
- `pnpm astro check` → **0 errores, 0 warnings, 0 hints**.
- `pnpm astro build` → build estático correcto; el HTML generado contiene el
  título, `lang="es"`, el script de tema inline, y **35 archivos `.woff2`**
  empaquetados (Lora + Inter self-hosted).
- El atributo `data-theme` lo fija el script en runtime, por lo que no aparece en
  el HTML estático (comportamiento esperado).

### Cómo probar los temas manualmente

1. Levantar el dev server: `astro dev --background` (ver `CLAUDE.md`).
2. En la consola del navegador: `localStorage.setItem('theme','reading')` y
   recargar → el fondo cambia a sepia sin parpadeo. Repetir con `dark` y `light`.

## Notas para el mantenimiento

- Los libros vienen del scraper (`scripts/`). Para refrescar el catálogo:
  regenerar en `scripts/output/` y copiar los `*.json` a `src/content/books/`.
- Si un futuro libro trae un campo nuevo, ajustar el schema en
  `src/content.config.ts` y volver a correr `pnpm astro sync`.
- Mantener TypeScript en la línea 6.x mientras `astro check` no soporte TS 7.
