/**
 * Endpoint JSON prerenderizado con el texto de un capítulo.
 *
 * `/api/verses/[slug]/[chapter].json` — un archivo estático por cada
 * combinación libro/capítulo real (misma fuente que `[slug]/[capitulo]/`).
 * El sitio sigue siendo 100% estático: `getStaticPaths` materializa estas
 * rutas como archivos JSON en `dist/` durante el build, no como API dinámica.
 *
 * Lo consume la tarjeta compartible ("Mis resaltados") para obtener el texto
 * real de cualquier libro/capítulo sin cargar toda la Biblia en esa página.
 * Por eso el payload es minimal: SOLO `{ verses: [{ number, text }] }` (sin
 * notas ni metadata), lo único que necesita la cita de la tarjeta.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

export const getStaticPaths: GetStaticPaths = async () => {
  const books = await getCollection('books');
  return books.flatMap((entry) =>
    entry.data.chapters.map((chapter) => ({
      // Mismo id de capítulo que la ruta del lector: `label` si existe
      // (Salmos 9a/9b…), si no el número. Es el valor que se guarda en
      // `highlights.chapter`, así que el cliente puede pedir la URL directa.
      params: { slug: entry.id, chapter: chapter.label ?? String(chapter.chapter) },
      props: {
        verses: chapter.verses.map((v) => ({ number: v.number, text: v.text })),
      },
    })),
  );
};

export const GET: APIRoute = ({ props }) => {
  const { verses } = props as { verses: { number: number; text: string }[] };
  return new Response(JSON.stringify({ verses }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
