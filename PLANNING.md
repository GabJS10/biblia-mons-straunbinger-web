# Resumen del proyecto para el agente de código

**Proyecto: Sitio web de lectura bíblica (Biblia Straubinger)**

**Objetivo**: Sitio web similar en experiencia a YouVersion (bible.com), usando la traducción católica de Monseñor Straubinger.

## Decisiones de arquitectura

- **Plataforma**: sitio web estático con **Astro** (elegido sobre React porque el contenido es mayormente estático; se pueden añadir "islas" interactivas puntuales en fases futuras para búsqueda/notas/favoritos).
- **Datos**: MVP servido desde **JSON estático**; migración a BD pequeña en fases posteriores, cuando se necesite.
- **Fuente del contenido**: scraping de `https://bibliastraubinger.com/`, que ya tiene el texto y las notas de Straubinger publicados y estructurados por libro. Se descartó extraer del PDF propio por ser mucho más laborioso.

## Alcance del MVP

Solo lectura simple: lista de libros → capítulos → texto, navegación anterior/siguiente.

## Roadmap

| Fase    | Contenido                                             |
| ------- | ----------------------------------------------------- |
| 0       | Scraping y estructuración del contenido (en progreso) |
| 1 (MVP) | Lector simple con Astro + JSON estático               |
| 2       | Búsqueda + favoritos (posible migración a BD)         |
| 3       | Planes de lectura + notas                             |

## Estructura confirmada del sitio origen

- **Un libro = una URL completa** con todos sus capítulos (ej. `bibliastraubinger.com/genesis/` trae los 50 capítulos de Génesis en una sola página). Total: ~73 URLs a scrapear, una por libro.
- **Capítulos**: `## Génesis 1`.
- **Subtítulos de sección editoriales**: `#### Creación del cielo y de la tierra` (insertados por el sitio, no parte del texto bíblico — pendiente decidir si se conservan como metadato).
- **Divisiones mayores en números romanos**: ej. "I. Desde la Creación del mundo hasta el Diluvio" (igual, pendiente decidir si se conservan).
- **Versículos**: número + texto. En libros del NT el número aparece en cursiva (`*5*`); en el AT aparece como número plano.
- **Notas de Straubinger — formato confirmado**:
  - En el cuerpo del texto, cada versículo con nota tiene un link: `[[12753]](#footnote-12753)`.
  - Todas las notas del libro están agrupadas al final de la página, bajo el encabezado `## Comentarios de Mons. Straubinger`, con el formato: `5. *Jesús:* Algunas variantes dicen... [↑](#footnote-ref-12753)`.
  - **El ID de la nota es un correlativo global de todo el sitio** (no es el número de versículo ni reinicia por libro/capítulo). La asociación real entre nota y versículo se hace por el ID del ancla (`#footnote-12753`), **no** por el número que aparece al inicio de cada nota en el bloque de comentarios (ese número es solo el versículo donde empieza, y puede ser engañoso).
  - **Una nota puede cubrir varios versículos** (ej. "17 s." cubre los versículos 17 y 18; "22 s." cubre 22 y 23) — la relación no siempre es 1 a 1.
- **Basura a descartar al final de cada página**: comentarios de spam (pingbacks) y sección de "artículos relacionados" del blog. El scraper debe cortar justo después de la última nota (`[↑](#footnote-ref-N)`) y no capturar nada después.

## Formato JSON objetivo (actualizado)

```json
{
  "book": "Judas",
  "chapter": 1,
  "verses": [
    {
      "number": 1,
      "text": "Judas, siervo de Jesucristo y hermano de Santiago...",
      "footnoteRefs": [12750]
    }
  ],
  "footnotes": {
    "12750": "S. Judas, hermano de Santiago el Menor, compuso la presente carta..."
  }
}
```

Las notas se guardan en un diccionario aparte (por ID), no incrustadas en cada versículo — evita duplicar texto largo cuando una nota cubre varios versículos; el frontend hace el lookup por ID al renderizar.

## Consideraciones legales/técnicas del scraping

- Scraping respetuoso: pausas entre requests, sin concurrencia agresiva (~73 páginas totales).

## Pendiente de validar (próximos pasos)

1. Decidir tratamiento de: subtítulos de sección editoriales y divisiones en números romanos (¿se guardan como metadato o se descartan?). Respuesta: Se guardan como metadato
2. Con todo esto confirmado, escribir el scraper (Node con `Cheerio`) que:
   - Itere sobre las ~73 URLs de libros. (Lo probaremos primero con el genesis)
   - Extraiga capítulos, versículos y sus `footnoteRefs`.
   - Extraiga el bloque de notas y lo indexe por ID de ancla.
   - Descarte contenido de navegación, spam y "relacionados".
   - Genere el JSON estructurado por libro (o por capítulo, a definir).
