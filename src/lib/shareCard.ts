/**
 * Tarjeta compartible: obtención del texto y generación del PNG (Paso 10).
 *
 * Dos responsabilidades, ambas en el cliente:
 *  1. `getPassageText` — trae el texto real de un rango de versículos desde el
 *     endpoint JSON prerenderizado (`/api/verses/[slug]/[chapter].json`), sin
 *     que "Mis resaltados" tenga que cargar toda la Biblia.
 *  2. `generateCardImage` — reescribe la plantilla `ShareCardTemplate` con esa
 *     cita, la ajusta si se desborda, la rasteriza con html-to-image y dispara
 *     la descarga del PNG.
 */
import * as htmlToImage from 'html-to-image';

export type CardFormat = 'square' | 'story';

/** Dimensiones reales en píxeles de cada formato (deben coincidir con el CSS). */
const CARD_SIZE: Record<CardFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

/**
 * Texto de los versículos del rango `[verseStart, verseEnd]` de un capítulo,
 * unidos con un espacio como prosa continua (SIN números de versículo: la
 * tarjeta muestra una cita, no un pasaje numerado).
 *
 * Pide el JSON minimal del endpoint estático y filtra por número. Lanza si la
 * petición falla (el llamador muestra el error y revierte el botón).
 */
export async function getPassageText(
  bookSlug: string,
  chapter: string,
  verseStart: number,
  verseEnd: number,
): Promise<string> {
  const url = `/api/verses/${encodeURIComponent(bookSlug)}/${encodeURIComponent(chapter)}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo obtener el texto (${res.status})`);
  }
  const data = (await res.json()) as { verses: { number: number; text: string }[] };
  return data.verses
    .filter((v) => v.number >= verseStart && v.number <= verseEnd)
    .map((v) => v.text)
    .join(' ')
    .trim();
}

interface GenerateCardOptions {
  /** Texto de la cita (ya unido por getPassageText). */
  passageText: string;
  /** Referencia formateada, p. ej. "Génesis 1:1-2" (viene de formatReference). */
  reference: string;
  /** Formato de salida. */
  format: CardFormat;
  /** Nombre sugerido del archivo, p. ej. "genesis-1-1-2.png". */
  fileName: string;
}

/**
 * Reduce el font-size de la cita en pasos de 0.05rem mientras el bloque de
 * contenido se desborde de su área fija, con un piso de la mitad del tamaño
 * base (no encoge indefinidamente). Compara `scrollHeight` (contenido real)
 * contra `clientHeight` (área disponible) del contenedor `.share-card-inner`.
 */
function fitText(inner: HTMLElement, textEl: HTMLElement) {
  const REM = 16; // 1rem = 16px (font-size raíz por defecto, no se altera).
  const STEP = 0.05; // rem
  // Parte del tamaño base del formato: limpia cualquier ajuste previo.
  textEl.style.fontSize = '';
  const baseRem = parseFloat(getComputedStyle(textEl).fontSize) / REM;
  const minRem = baseRem / 2;

  let sizeRem = baseRem;
  // scrollHeight > clientHeight ⇒ el contenido no cabe en el área fija.
  while (inner.scrollHeight > inner.clientHeight && sizeRem - STEP >= minRem) {
    sizeRem -= STEP;
    textEl.style.fontSize = `${sizeRem}rem`;
  }
}

/**
 * Genera y descarga el PNG de la tarjeta para el resaltado dado, reutilizando
 * el nodo `ShareCardTemplate` ya presente en la página (`[data-share-card]`).
 *
 * Pasos: aplica el formato → escribe cita y referencia → espera a que las
 * fuentes estén listas (para no capturar con la fuente de fallback) → ajusta el
 * tamaño si desborda → rasteriza a PNG → dispara la descarga con un `<a>`.
 */
export async function generateCardImage(options: GenerateCardOptions): Promise<void> {
  const { passageText, reference, format, fileName } = options;

  const card = document.querySelector<HTMLElement>('[data-share-card]');
  if (!card) throw new Error('No se encontró la plantilla de la tarjeta');
  const inner = card.querySelector<HTMLElement>('[data-share-card-inner]')!;
  const textEl = card.querySelector<HTMLElement>('[data-share-card-text]')!;
  const refEl = card.querySelector<HTMLElement>('[data-share-card-ref]')!;

  // Formato (dimensiones + tamaños base vía la clase modificadora).
  card.classList.remove('share-card--square', 'share-card--story');
  card.classList.add(format === 'story' ? 'share-card--story' : 'share-card--square');

  // Contenido dinámico.
  textEl.textContent = passageText;
  refEl.textContent = reference;

  // Las fuentes deben estar cargadas antes de medir y capturar; si no, el
  // layout (y el PNG) usaría el fallback y el ajuste de tamaño sería erróneo.
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  // Ajuste de tamaño una vez que las fuentes reales ya afectan al layout.
  fitText(inner, textEl);

  const { width, height } = CARD_SIZE[format];
  // El nodo ya está a tamaño real en px ⇒ pixelRatio 1 (sin escalar).
  // `backgroundColor` fija fondo negro sólido como red de seguridad (evita
  // cualquier píxel transparente si algo del layout no pintara).
  const dataUrl = await htmlToImage.toPng(card, {
    width,
    height,
    pixelRatio: 1,
    backgroundColor: '#000000',
  });

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Nombre de archivo sugerido a partir de slug/capítulo/rango, p. ej.
 * `genesis-1-1-2.png` (rango) o `genesis-1-1.png` (un solo versículo).
 */
export function cardFileName(
  bookSlug: string,
  chapter: string,
  verseStart: number,
  verseEnd: number,
): string {
  const range = verseStart === verseEnd ? `${verseStart}` : `${verseStart}-${verseEnd}`;
  const safeChapter = chapter.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${bookSlug}-${safeChapter}-${range}.png`;
}
