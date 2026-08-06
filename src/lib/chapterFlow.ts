import type { CollectionEntry } from 'astro:content';

/**
 * Fusiona las tres fuentes de un capítulo (divisiones del libro, secciones
 * editoriales y versículos) en un único flujo ordenado, y resuelve la
 * numeración LOCAL de las notas al pie.
 *
 * Numeración local: las notas se guardan en el libro por su ID global (p. ej.
 * 4821, 4823). Para el lector, cada capítulo re-numera sus notas 1, 2, 3… en el
 * orden de su primera aparición dentro del capítulo. Ese número local es el que
 * se muestra en el superíndice del texto y junto a la nota; el ID global solo se
 * usa para las anclas (`#footnote-<idGlobal>`), que deben ser únicas.
 */

export type BookData = CollectionEntry<'books'>['data'];
export type Chapter = BookData['chapters'][number];
type VerseData = Chapter['verses'][number];

/** Una referencia a nota ya resuelta a su número local dentro del capítulo. */
export interface NoteRef {
  globalId: number;
  localNum: number;
}

export type FlowItem =
  | { kind: 'division'; title: string }
  | { kind: 'section'; title: string; notes: NoteRef[] }
  | { kind: 'verse'; verse: VerseData; notes: NoteRef[] };

/** Nota efectivamente referenciada en el capítulo, lista para el pie. */
export interface ReferencedNote {
  globalId: number;
  localNum: number;
  text: string;
  /** Número del primer versículo que la referenció (destino del enlace "↑"). */
  firstVerse: number;
}

export interface ChapterFlow {
  items: FlowItem[];
  referencedNotes: ReferencedNote[];
}

export function buildChapterFlow(book: BookData, chapter: Chapter): ChapterFlow {
  const chapterNum = chapter.chapter;

  // Divisiones del libro que arrancan en ESTE capítulo, agrupadas por versículo.
  const divisionsByVerse = new Map<number, string[]>();
  for (const d of book.divisions) {
    if (d.startChapter !== chapterNum) continue;
    const list = divisionsByVerse.get(d.startVerse) ?? [];
    list.push(d.title);
    divisionsByVerse.set(d.startVerse, list);
  }

  // Secciones editoriales del capítulo, agrupadas por versículo de inicio.
  const sectionsByVerse = new Map<number, Chapter['sections']>();
  for (const s of chapter.sections) {
    const list = sectionsByVerse.get(s.startVerse) ?? [];
    list.push(s);
    sectionsByVerse.set(s.startVerse, list);
  }

  // Estado de numeración local: se asigna en el orden de recorrido del flujo.
  const localById = new Map<number, number>();
  const firstVerseById = new Map<number, number>();
  const referencedNotes: ReferencedNote[] = [];

  // Resuelve un array de footnoteRefs a NoteRef[], asignando números locales a
  // las notas nuevas. `verseForReturn` es el versículo al que apuntará el "↑".
  function resolveRefs(refs: number[] | undefined, verseForReturn: number): NoteRef[] {
    if (!refs || refs.length === 0) return [];
    const out: NoteRef[] = [];
    for (const globalId of refs) {
      const text = book.footnotes[String(globalId)];
      // Si la nota no tiene texto en el diccionario, la ignoramos (ni marcador
      // ni entrada en el pie) para que texto y notas queden siempre coherentes.
      if (text === undefined) continue;

      let localNum = localById.get(globalId);
      if (localNum === undefined) {
        localNum = localById.size + 1;
        localById.set(globalId, localNum);
        firstVerseById.set(globalId, verseForReturn);
        referencedNotes.push({ globalId, localNum, text, firstVerse: verseForReturn });
      }
      out.push({ globalId, localNum });
    }
    return out;
  }

  const items: FlowItem[] = [];
  const emittedHeadings = new Set<number>(); // versículos cuyos encabezados ya se insertaron

  // Inserta divisiones (encabezado prominente) y secciones (subtítulo) que
  // arrancan en el versículo `n`, antes de renderizar ese versículo.
  function flushHeadings(n: number) {
    if (emittedHeadings.has(n)) return;
    emittedHeadings.add(n);
    for (const title of divisionsByVerse.get(n) ?? []) {
      items.push({ kind: 'division', title });
    }
    for (const s of sectionsByVerse.get(n) ?? []) {
      items.push({ kind: 'section', title: s.title, notes: resolveRefs(s.footnoteRefs, n) });
    }
  }

  for (const verse of chapter.verses) {
    flushHeadings(verse.number);
    items.push({ kind: 'verse', verse, notes: resolveRefs(verse.footnoteRefs, verse.number) });
  }

  // Encabezados cuyo startVerse no coincidió con ningún versículo (datos raros):
  // se emiten al final, en orden de versículo, para no perderlos.
  const leftover = new Set<number>([...divisionsByVerse.keys(), ...sectionsByVerse.keys()]);
  for (const n of [...leftover].sort((a, b) => a - b)) {
    flushHeadings(n);
  }

  return { items, referencedNotes };
}
