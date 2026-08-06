/**
 * Catálogo de libros para el lector y el modal de selección.
 *
 * Cruza `bookOrder` (orden canónico) × colección `books` (nombre y capítulos) ×
 * colección `intros` (qué libros tienen introducción) y produce el array de
 * `BookItem` que consume `BookPickerModal`. Antes vivía inline en `index.astro`;
 * se extrajo aquí para reusarlo desde `ReaderHeader` y `readingSequence`.
 */
import { getCollection } from 'astro:content';
import { bookOrder } from '../data/bookOrder';

export interface BookItem {
  slug: string;
  name: string;
  testament: 'AT' | 'NT';
  /**
   * Identificadores de los capítulos, en orden. Normalmente "1".."N", pero
   * algunos libros traen etiquetas (Salmos dobles: "9a","9b","113a","113b").
   * Se usan tal cual para el texto de la celda y para el href /[slug]/[id]/.
   */
  chapterIds: string[];
  hasIntro: boolean;
}

/**
 * Devuelve el catálogo completo en orden canónico. Si un slug de `bookOrder` no
 * tiene su JSON en la colección `books`, es un bug y se rompe el build.
 */
export async function getBookCatalog(): Promise<BookItem[]> {
  const booksCol = await getCollection('books');
  const intros = await getCollection('intros');

  const byId = new Map(booksCol.map((b) => [b.id, b]));
  const introSlugs = new Set(
    intros.map((i) => i.data.book).filter((b): b is string => Boolean(b)),
  );

  return bookOrder.map((bo) => {
    const entry = byId.get(bo.slug);
    if (!entry) {
      throw new Error(`bookOrder: no existe el libro "${bo.slug}" en la colección books`);
    }
    return {
      slug: bo.slug,
      name: entry.data.book,
      testament: bo.testament,
      // Ids de capítulo en orden (etiqueta si existe, si no el número).
      chapterIds: entry.data.chapters.map((c) => c.label ?? String(c.chapter)),
      hasIntro: introSlugs.has(bo.slug),
    };
  });
}
