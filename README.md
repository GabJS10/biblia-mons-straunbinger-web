# Biblia Straubinger — Web

Sitio de lectura de la Biblia católica en la traducción de **Mons. Juan
Straubinger**, con sus comentarios y notas originales. La experiencia se inspira
en YouVersion (bible.com): elegir libro → capítulo → texto, con navegación
anterior/siguiente pensada para la lectura diaria.

Construido con [Astro](https://astro.build) como sitio estático (SSG). El texto
bíblico se sirve desde JSON estático generado por un scraper; los resaltados y
colecciones del usuario se guardan en [Supabase](https://supabase.com) y toda la
lógica de datos corre en el navegador.

## Características

- **Lector completo del canon católico**: 73 libros (incluidos los
  deuterocanónicos) en orden canónico, con capítulos, versículos y las notas al
  pie de Straubinger.
- **Selector de libro** en un modal, ordenado por el orden de lectura canónico.
- **Introducciones editoriales** por libro y un prólogo general, en Markdown.
- **Notas de Straubinger** enlazadas versículo ↔ nota, indexadas por el ID del
  ancla original.
- **Tema claro/oscuro** con toggle persistente y diseño responsive.
- **Autenticación con Google** (Supabase Auth, flujo PKCE, sin backend propio).
- **Resaltados y colecciones**: resaltar versículos, organizarlos en colecciones
  y consultarlos en la página *Mis resaltados*. Protegidos por políticas RLS por
  usuario.

## Arquitectura

- **Framework**: Astro (SSG). El contenido es mayormente estático; las partes
  interactivas (auth, resaltados, toggle de tema, modal) son islas puntuales.
- **Contenido**: dos [content collections](https://docs.astro.build/en/guides/content-collections/)
  definidas en `src/content.config.ts`:
  - `books` — un JSON por libro en `src/content/books/`, generado por el scraper.
  - `intros` — introducciones y prólogo en Markdown en `src/content/intros/`.
- **Rutas dinámicas**: `getStaticPaths` genera una página por capítulo
  (`/[slug]/[capitulo]/`) y por introducción (`/[slug]/introduccion/`).
- **Datos de usuario**: Supabase (Postgres + Auth). El cliente vive en
  `src/lib/supabase.ts` y usa la clave *anon* pública; la seguridad real está en
  las políticas **RLS**, no en ocultar la clave. La capa de datos de resaltados y
  colecciones está en `src/lib/highlights.ts`.

### Estructura del proyecto

```text
/
├── scripts/            # Scraper de bibliastraubinger.com (fase 0) + salida
│   ├── scrape.mjs
│   └── output/         # JSON crudo por libro generado por el scraper
├── specs/              # Especificaciones por fase del proyecto
├── src/
│   ├── components/     # Islas y UI (modal, lector, auth, resaltados, tema…)
│   ├── content/
│   │   ├── books/      # 73 JSON de libros (colección `books`)
│   │   └── intros/     # Introducciones y prólogo en Markdown (colección `intros`)
│   ├── content.config.ts
│   ├── data/           # bookOrder — orden canónico de lectura
│   ├── layouts/
│   ├── lib/            # supabase, highlights, catálogo, secuencia de lectura
│   ├── pages/          # index, prólogo, mis-resaltados, rutas dinámicas
│   ├── styles/         # global.css + themes.css (tokens de tema)
│   └── types/          # tipos generados de Supabase
├── supabase/
│   └── migrations/     # Esquema de highlights y collections (con RLS)
├── PLANNING.md         # Resumen, decisiones de arquitectura y roadmap
└── astro.config.mjs
```

## Puesta en marcha

Requisitos: **Node ≥ 22.12** y `pnpm`.

```bash
pnpm install
cp .env.example .env   # completa las credenciales de Supabase
pnpm dev               # servidor local en http://localhost:4321
```

### Variables de entorno

Copia `.env.example` a `.env` y completa (Supabase → *Project Settings → API*):

| Variable                   | Descripción                                    |
| :------------------------- | :--------------------------------------------- |
| `PUBLIC_SUPABASE_URL`      | *Project URL* del proyecto Supabase.           |
| `PUBLIC_SUPABASE_ANON_KEY` | Clave *anon* / *public* (pública por diseño).  |

El prefijo `PUBLIC_` es intencional: Astro solo expone al navegador las variables
con ese prefijo. El `.env` está en `.gitignore` y no debe subirse.

## Comandos

Todos se ejecutan desde la raíz del proyecto:

| Comando         | Acción                                                    |
| :-------------- | :-------------------------------------------------------- |
| `pnpm install`  | Instala las dependencias.                                 |
| `pnpm dev`      | Servidor de desarrollo en `localhost:4321`.               |
| `pnpm build`    | Compila el sitio de producción a `./dist/`.               |
| `pnpm preview`  | Previsualiza la build localmente antes de desplegar.      |
| `pnpm astro …`  | CLI de Astro (`astro add`, `astro check`, …).             |
| `pnpm scrape`   | Ejecuta el scraper de contenido (ver más abajo).          |

## Contenido: el scraper

El texto y las notas se extraen de
[bibliastraubinger.com](https://bibliastraubinger.com/) con un scraper en Node +
[Cheerio](https://cheerio.js.org/). Es la **fase 0** del proyecto.

```bash
pnpm scrape            # por defecto: Génesis (prueba)
pnpm scrape genesis    # un libro concreto por slug
pnpm scrape --all      # los 73 libros del catálogo
```

La salida se escribe en `scripts/output/<slug>.json` y de ahí se traslada a
`src/content/books/` para alimentar la colección `books`. Los detalles del
formato, las anomalías del origen y las notas de implementación están en
[`scripts/README.md`](scripts/README.md).

## Base de datos (Supabase)

El esquema de `highlights` y `collections` está en
`supabase/migrations/`. Puntos clave:

- **RLS activada** en ambas tablas: cada usuario solo ve y gestiona sus filas.
- Constraint única `(user_id, book_slug, chapter, verse_number)` que habilita el
  upsert idempotente por versículo.
- Al borrar una colección, sus resaltados quedan sueltos (`on delete set null`),
  no se borran.

Para aplicar las migraciones necesitas la [CLI de Supabase](https://supabase.com/docs/guides/cli)
y un proyecto vinculado.

## Roadmap

Ver [`PLANNING.md`](PLANNING.md) para el detalle. Resumen:

| Fase    | Contenido                                                    |
| :------ | :----------------------------------------------------------- |
| 0       | Scraping y estructuración del contenido.                    |
| 1 (MVP) | Lector simple con Astro + JSON estático.                    |
| 2       | Búsqueda + favoritos (resaltados y colecciones — hecho).    |
| 3       | Planes de lectura + notas.                                  |

Las especificaciones detalladas por paso están en [`specs/`](specs/).

## Créditos

Traducción y notas: **Mons. Juan Straubinger**. Contenido de origen:
[bibliastraubinger.com](https://bibliastraubinger.com/). Desarrollo del sitio:
[Gabriel Ballesteros](https://www.linkedin.com/in/gabriel-ballesteros-3114b916a/).
