/**
 * Secuencia de lectura continua: un array plano con TODO lo navegable con los
 * botones anterior/siguiente, en orden de lectura.
 *
 * Para cada libro (en el orden de `bookOrder`, vía `getBookCatalog`): primero su
 * introducción si la tiene, luego cada capítulo en el orden real de `chapterIds`
 * (que respeta el JSON, incluyendo Salmos 9a/9b… — NO se reordena numéricamente).
 *
 * El prólogo NO forma parte de esta secuencia: es un documento aparte, fuera del
 * flujo de lectura continuo.
 */
import { getBookCatalog } from './bookCatalog';

export type SequenceNodeType = 'intro' | 'chapter';

export interface SequenceNode {
  url: string;
  /** Texto legible para el botón, p. ej. "Génesis 1" o "Génesis — Introducción". */
  label: string;
  type: SequenceNodeType;
}

export interface Adjacent {
  prev: SequenceNode | null;
  next: SequenceNode | null;
}

/** Asegura una sola barra final, para comparar URLs de forma consistente. */
function normalize(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

export async function getReadingSequence(): Promise<SequenceNode[]> {
  const catalog = await getBookCatalog();
  const nodes: SequenceNode[] = [];

  for (const book of catalog) {
    if (book.hasIntro) {
      nodes.push({
        url: `/${book.slug}/introduccion/`,
        label: `${book.name} — Introducción`,
        type: 'intro',
      });
    }
    for (const id of book.chapterIds) {
      nodes.push({
        url: `/${book.slug}/${id}/`,
        label: `${book.name} ${id}`,
        type: 'chapter',
      });
    }
  }

  return nodes;
}

/**
 * Vecinos de `currentUrl` en la secuencia de lectura. En los extremos (o si la
 * URL no está en la secuencia) el valor correspondiente es `null`.
 */
export async function getAdjacent(currentUrl: string): Promise<Adjacent> {
  const sequence = await getReadingSequence();
  const target = normalize(currentUrl);
  const i = sequence.findIndex((node) => normalize(node.url) === target);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? sequence[i - 1] : null,
    next: i < sequence.length - 1 ? sequence[i + 1] : null,
  };
}
