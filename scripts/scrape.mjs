/**
 * Scraper de la Biblia Straubinger (bibliastraubinger.com)
 *
 * Descarga la página de un libro (una URL = un libro con todos sus capítulos),
 * y produce un JSON estructurado por libro:
 *
 *   {
 *     book, slug, source,
 *     chapters: [{ chapter, sections: [{title, startVerse}], verses: [{number, text, footnoteRefs}] }],
 *     divisions: [{ title, startChapter, startVerse }],
 *     footnotes: { "<id>": "<texto de la nota>" }
 *   }
 *
 * Claves de la estructura del sitio origen (confirmadas inspeccionando el HTML):
 *  - El HTML es "malformado" (<p> y <h2> sin cerrar). El parser de Cheerio (parse5)
 *    lo normaliza de forma predecible: cada versículo queda como su propio <p> y los
 *    encabezados quedan como hermanos en orden de documento.
 *  - Capítulo:  <h2>Génesis N</h2>            (precedido de <a id="GnN">)
 *  - División (números romanos, metadato):  <h3>I. Desde la Creación...</h3>
 *  - Subtítulo de sección (editorial, metadato):  <h4>Creación del cielo...</h4>
 *  - Versículo:  <p><sup>N</sup> [<sup><a href="#footnote-ID">[..]</a></sup>] texto…</p>
 *      · El número de versículo es un <sup> con texto puramente numérico.
 *      · La referencia a nota es un <sup> que contiene <a href="#footnote-ID">.
 *      · Líneas de poesía / continuación: <p> SIN número → se anexan al versículo actual.
 *  - Notas: al final, tras <h2>Comentarios de Mons. Straubinger</h2>, en un <ol> con
 *      <li id="footnote-ID"> … <a href="#footnote-ref-ID">↑</a></li>
 *      · La asociación nota↔versículo se hace SIEMPRE por el ID del ancla (#footnote-ID),
 *        no por el número que aparece al inicio del texto de la nota (es engañoso).
 *  - Todo lo que viene después del <ol> de notas (spam/pingbacks, "relacionados") queda
 *    fuera de .entry-content o después del bloque de comentarios y se descarta.
 */

import { load } from "cheerio";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "output");
const BASE_URL = "https://bibliastraubinger.com";
const USER_AGENT =
  "biblia-straubinger-scraper/0.1 (uso personal; contacto: andersoncxlau2@hotmail.com)";
const REQUEST_DELAY_MS = 2000; // pausa entre requests: scraping respetuoso

/**
 * Catálogo de los 73 libros (canon católico, con deuterocanónicos), en orden canónico.
 * Los `slug` se extrajeron de los enlaces de https://bibliastraubinger.com/ (verificados).
 *
 * `name`     → nombre para mostrar en el frontend.
 * `heading`  → (opcional) etiqueta tal como aparece en el encabezado de capítulo del sitio
 *              (ej. "Génesis 1"). Solo hace falta cuando ese texto NO coincide con `name`;
 *              si se omite, la detección de capítulos usa `name`. Ver README (⚠ libros con
 *              nombre compuesto como "I de Reyes (1 Samuel)": conviene fijar `heading` tras
 *              inspeccionar su página, p. ej. heading: "I Reyes").
 */
const BOOKS = [
  // --- Antiguo Testamento (46) ---
  // Pentateuco
  { slug: "genesis", name: "Génesis", testament: "AT" },
  { slug: "exodo", name: "Éxodo", testament: "AT" },
  { slug: "levitico", name: "Levítico", testament: "AT" },
  { slug: "numeros", name: "Números", testament: "AT" },
  { slug: "deuteronomio", name: "Deuteronomio", testament: "AT" },
  // Históricos
  { slug: "josue", name: "Josué", testament: "AT" },
  { slug: "jueces", name: "Jueces", testament: "AT" },
  { slug: "rut", name: "Rut", testament: "AT" },
  { slug: "i-de-reyes-1-samuel", name: "I de Reyes (1 Samuel)", heading: "1 Samuel", testament: "AT" },
  { slug: "ii-de-reyes-2-samuel", name: "II de Reyes (2 Samuel)", heading: "2 Samuel", testament: "AT" },
  { slug: "iii-de-reyes-1-reyes", name: "III de Reyes (1 Reyes)", heading: "1 Reyes", testament: "AT" },
  { slug: "iv-de-reyes-2-reyes", name: "IV de Reyes (2 Reyes)", heading: "2 Reyes", testament: "AT" },
  { slug: "i-paralipomenos-1-cronicas", name: "I Paralipómenos (1 Crónicas)", heading: "1 Crónicas", testament: "AT" },
  { slug: "ii-paralipomenos-2-cronicas", name: "II Paralipómenos (2 Crónicas)", heading: "2 Crónicas", testament: "AT" },
  { slug: "esdras", name: "Esdras", testament: "AT" },
  { slug: "nehemias", name: "Nehemías", testament: "AT" },
  { slug: "tobias", name: "Tobías", testament: "AT" },
  { slug: "judit", name: "Judit", testament: "AT" },
  { slug: "ester", name: "Ester", testament: "AT" },
  { slug: "1-macabeos", name: "1 Macabeos", testament: "AT" },
  { slug: "2-macabeos", name: "2 Macabeos", testament: "AT" },
  // Sapienciales / poéticos
  { slug: "job", name: "Job", testament: "AT" },
  { slug: "salmos", name: "Salmos", heading: "Salmo", testament: "AT" },
  { slug: "proverbios", name: "Proverbios", testament: "AT" },
  { slug: "eclesiastes-qoelet", name: "Eclesiastés o Qoélet", heading: "Eclesiastés", testament: "AT" },
  { slug: "cantar-de-los-cantares", name: "Cantar de los Cantares", testament: "AT" },
  { slug: "sabiduria", name: "Sabiduría", testament: "AT" },
  { slug: "eclesiastico-o-ben-sira", name: "Eclesiástico o Ben Sirá", heading: "Eclesiástico", testament: "AT" },
  // Proféticos
  { slug: "isaias", name: "Isaías", testament: "AT" },
  { slug: "jeremias", name: "Jeremías", testament: "AT" },
  { slug: "lamentaciones", name: "Lamentaciones", testament: "AT" },
  { slug: "baruc", name: "Baruc", testament: "AT" },
  { slug: "ezequiel", name: "Ezequiel", testament: "AT" },
  { slug: "daniel", name: "Daniel", testament: "AT" },
  { slug: "oseas", name: "Oseas", testament: "AT" },
  { slug: "joel", name: "Joel", testament: "AT" },
  { slug: "amos", name: "Amós", testament: "AT" },
  { slug: "abdias", name: "Abdías", testament: "AT" },
  { slug: "jonas", name: "Jonás", testament: "AT" },
  { slug: "miqueas", name: "Miqueas", testament: "AT" },
  { slug: "nahum", name: "Nahum", testament: "AT" },
  { slug: "habacuc", name: "Habacuc", testament: "AT" },
  { slug: "sofonias", name: "Sofonías", testament: "AT" },
  { slug: "ageo", name: "Ageo", testament: "AT" },
  { slug: "zacarias", name: "Zacarías", testament: "AT" },
  { slug: "malaquias", name: "Malaquías", testament: "AT" },

  // --- Nuevo Testamento (27) ---
  // Evangelios y Hechos
  { slug: "mateo", name: "Mateo", testament: "NT" },
  { slug: "marcos", name: "Marcos", testament: "NT" },
  { slug: "lucas", name: "Lucas", testament: "NT" },
  { slug: "juan", name: "Juan", testament: "NT" },
  { slug: "hechos-de-los-apostoles", name: "Hechos de los Apóstoles", heading: "Hechos", testament: "NT" },
  // Cartas de San Pablo
  { slug: "romanos", name: "Romanos", testament: "NT" },
  { slug: "1-corintios", name: "1 Corintios", testament: "NT" },
  { slug: "2-corintios", name: "2 Corintios", testament: "NT" },
  { slug: "galatas", name: "Gálatas", testament: "NT" },
  { slug: "efesios", name: "Efesios", testament: "NT" },
  { slug: "filipenses", name: "Filipenses", testament: "NT" },
  { slug: "colosenses", name: "Colosenses", testament: "NT" },
  { slug: "1-tesalonicenses", name: "1 Tesalonicenses", testament: "NT" },
  { slug: "2-tesalonicenses", name: "2 Tesalonicenses", testament: "NT" },
  { slug: "1-timoteo", name: "1 Timoteo", testament: "NT" },
  { slug: "2-timoteo", name: "2 Timoteo", testament: "NT" },
  { slug: "tito", name: "Tito", testament: "NT" },
  { slug: "filemon", name: "Filemón", testament: "NT" },
  { slug: "hebreos", name: "Hebreos", testament: "NT" },
  // Cartas católicas
  { slug: "santiago", name: "Santiago", testament: "NT" },
  { slug: "1-pedro", name: "1 Pedro", testament: "NT" },
  { slug: "2-pedro", name: "2 Pedro", testament: "NT" },
  { slug: "1-juan", name: "1 Juan", testament: "NT" },
  { slug: "2-juan", name: "2 Juan", testament: "NT" },
  { slug: "3-juan", name: "3 Juan", testament: "NT" },
  { slug: "judas", name: "Judas", testament: "NT" },
  // Apocalíptico
  { slug: "apocalipsis", name: "Apocalipsis", testament: "NT" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url, { retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      console.warn(`  intento ${attempt}/${retries} falló: ${err.message}`);
      if (attempt < retries) await sleep(1000 * attempt);
    }
  }
  throw lastErr;
}

const collapse = (s) => s.replace(/\s+/g, " ").trim();

/** Extrae el número de nota de un href/id tipo "#footnote-123" o "footnote-123". */
function footnoteIdFrom(str) {
  const m = /footnote-(\d+)/.exec(str || "");
  return m ? Number(m[1]) : null;
}

/**
 * Parte un <p> en segmentos, recorriendo sus nodos hijos en orden. Un <sup> con texto
 * puramente numérico inicia un nuevo versículo; el resto (texto, <em>, marcadores de
 * nota) se acumula. Devuelve una lista de segmentos:
 *   { number, text, footnoteRefs }   (number === null → continuación del versículo actual)
 *
 * Necesario porque a veces falta el <p> antes de un número de versículo y dos (o más)
 * versículos comparten párrafo (p. ej. Génesis 10,9-10: "…Nimrod”.<sup>10</sup>…").
 */
function parseParagraph($, el) {
  const segments = [];
  let cur = { number: null, text: "", footnoteRefs: [] };
  const push = () => {
    cur.text = collapse(cur.text);
    if (cur.number !== null || cur.text) segments.push(cur);
  };

  // Procesa un <sup>: devuelve true si era un marcador (nota o número de versículo).
  const handleSup = ($sup) => {
    const anchor = $sup.find('a[href^="#footnote-"]').first();
    if (anchor.length) {
      // Marcador de referencia a nota
      const href = anchor.attr("href") || "";
      if (!href.startsWith("#footnote-ref-")) {
        const id = footnoteIdFrom(href);
        if (id !== null && !cur.footnoteRefs.includes(id)) cur.footnoteRefs.push(id);
      }
      return true; // no aporta texto al versículo
    }
    // Corrección de OCR: la "1" inicial del número a veces se reconoció como "l"/"I"
    // (Salmo 33 "l5" → 15; Salmo 40 "l2" → 12). Dentro de un <sup> —que aquí solo contiene
    // números de versículo, nunca texto— es seguro normalizar l/I a 1 cuando va con dígitos.
    let t = collapse($sup.text());
    if (/\d/.test(t)) t = t.replace(/[lI]/g, "1");
    // Número de versículo. Suele ser "N", pero en los salmos con doble numeración
    // (Vulgata/hebreo) el <sup> lleva además la referencia hebrea entre paréntesis:
    // "(10) 1" (Salmo 115). El número LOCAL de Straubinger es el que va fuera del
    // paréntesis; la referencia hebrea se descarta (es derivable y solo estorbaría).
    const m = t.match(/^(?:\(\d+\)\s*)?(\d+)(?:\s*\(\d+\))?$/);
    if (m) {
      // Número de versículo → nuevo segmento.
      push();
      cur = { number: Number(m[1]), text: "", footnoteRefs: [] };
      return true;
    }
    return false; // <sup> no reconocido
  };

  const visit = (node) => {
    if (node.type === "text") {
      cur.text += node.data;
      return;
    }
    if (node.type !== "tag") return;

    if (node.tagName === "sup") {
      const $sup = $(node);
      if (!handleSup($sup)) cur.text += $sup.text(); // <sup> raro: conservar su texto
      return;
    }

    // Enlaces de navegación internos (índice, "Volver al Indice"): descartar. El texto
    // bíblico no lleva anclas internas; las notas se manejan aparte (dentro de <sup>).
    if (node.tagName === "a" && ($(node).attr("href") || "").startsWith("#")) return;

    // Envoltorios de formato: el número de versículo va en cursiva/negrita según el libro
    // —AT: <sup>N</sup>; NT epístolas: <em><sup>N</sup></em>; Evangelios/Hechos:
    // <strong><em><sup>N</sup></em></strong>—. El <em>/<strong> también envuelve texto normal
    // (glosas entre paréntesis, énfasis). Se recorren recursivamente: así el <sup> interior
    // se reconoce a cualquier profundidad y el resto de su texto se conserva.
    if (/^(em|strong|b|i|span)$/.test(node.tagName)) {
      $(node).contents().each((_, child) => visit(child));
      return;
    }

    // <a> externo, otros: conservar su texto
    cur.text += $(node).text();
  };

  $(el)
    .contents()
    .each((_, node) => visit(node));

  push();
  return segments;
}

/** ¿El id es de una DEFINICIÓN de nota ("footnote-123") y no un back-ref ("footnote-ref-123")? */
function isFootnoteDefId(id) {
  return /^footnote-\d+$/.test(id || "");
}

/** Limpia el texto ya combinado de una nota: quita el prefijo "* N." / "* 17 s." / "* I.". */
function cleanFootnoteText(text) {
  text = collapse(text);
  text = text.replace(/^\*\s*/, ""); // viñeta markdown filtrada
  // prefijo con el versículo/sección inicial: "1.", "26.", "17 s.", "22 s.", "I." … (redundante:
  // la asociación real nota↔versículo se hace por el ID del ancla, no por este número).
  text = text.replace(/^(\d+\s+s\.|\d+\.|[IVXLC]{1,4}\.)\s+/, "");
  return text;
}

/**
 * Extrae el bloque de notas. Soporta los dos formatos observados en el sitio:
 *  - Génesis: <ol><li id="footnote-N"> … <a href="#footnote-ref-N">↑</a></li>…</ol>
 *      (el texto está DENTRO del <li>)
 *  - Éxodo (y demás): <p id="footnote-N"><p>… <a href="#footnote-ref-N">↑</a></p></p>
 *      (parse5 separa los <p> anidados: el <p id> queda vacío y el texto en el hermano
 *       siguiente)
 *
 * Para cada definición (id="footnote-N") se acumula el texto desde ese elemento y sus
 * hermanos siguientes hasta el que contiene su back-ref (<a href="#footnote-ref-N">),
 * que marca el fin de la nota. Esto acota también la última nota y descarta la basura
 * final (spam/pingbacks/"relacionados").
 */
function extractFootnotes($, content) {
  const footnotes = {};
  content
    .find("[id]")
    .filter((_, el) => isFootnoteDefId(el.attribs?.id))
    .each((_, defEl) => {
      const id = Number(defEl.attribs.id.slice("footnote-".length));
      const backRefHref = `#footnote-ref-${id}`;
      let text = "";
      let node = defEl;
      let steps = 0;
      let done = false;
      while (node && !done && steps++ < 200) {
        if (node !== defEl && node.type === "tag" && isFootnoteDefId(node.attribs?.id))
          break; // llegamos a la siguiente definición sin hallar el back-ref
        if (node.type === "text") {
          text += node.data;
        } else if (node.type === "tag") {
          const $n = $(node);
          const hasBackRef =
            (node.tagName === "a" && $n.attr("href") === backRefHref) ||
            $n.find(`a[href="${backRefHref}"]`).length > 0;
          if (hasBackRef) {
            const $clone = $n.clone();
            $clone.find(`a[href="${backRefHref}"]`).remove(); // quita la flecha ↑
            text += " " + $clone.text();
            done = true; // fin de esta nota
          } else {
            text += " " + $n.text();
          }
        }
        node = node.next;
      }
      footnotes[id] = cleanFootnoteText(text);
    });
  return footnotes;
}

/** Parsea el HTML completo de un libro y devuelve la estructura JSON. */
function parseBook(html, { name, heading, slug, url }) {
  const $ = load(html);
  const content = $(".entry-content").first();
  if (!content.length) throw new Error("No se encontró .entry-content");

  // ¿El libro usa el formato del NT (número de versículo en cursiva/negrita:
  // <em><sup>N</sup></em> o <strong><em><sup>N</sup></em></strong>)? Determina cómo se
  // interpretan los <p> sin número (en el NT son subtítulos de sección; en el AT,
  // continuaciones de poesía del versículo previo). Se decide por MAYORÍA, no por mera
  // presencia: en Salmos casi todos los versículos son <sup>N</sup> planos, pero el v1
  // (título/encabezamiento) de muchos salmos va en cursiva —<em><sup>1</sup>—; eso no
  // convierte al libro en NT. `<sup>\d` cuenta todo número en <sup> (incluidos los
  // envueltos); `<em><sup>\d` cuenta solo los envueltos.
  const bodyHtml = content.html() || "";
  const wrappedNums = (bodyHtml.match(/<em>\s*<sup>\s*\d/gi) || []).length;
  const allNums = (bodyHtml.match(/<sup>\s*\d/gi) || []).length;
  const ntFormat = wrappedNums > allNums - wrappedNums; // mayoría envuelta → NT

  // Encabezado de capítulo = "<etiqueta del libro> N". OJO: no todos los capítulos usan
  // <h2>; algunos (p. ej. Génesis 3, 4, 5) vienen como <p>Génesis 3</p>. Por eso se
  // detecta por el TEXTO, no por la etiqueta. Se usa `heading` si está definido (para
  // libros cuyo rótulo de capítulo no coincide con el nombre para mostrar), si no `name`.
  //
  // La coincidencia es por PREFIJO (no texto exacto): cuando tras el <h2> viene un <p> de
  // versículo en vez de un <h4>, el parser HTML deja el <h2> abierto y este se "traga" los
  // versículos como hijos (p. ej. Éxodo 8: <h2>Éxodo 8 1 […] Dijo, pues, Yahvé…</h2>).
  // Por eso, al detectar el encabezado se desciende dentro del elemento para recuperar
  // esos versículos atrapados (ver walk()).
  const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p"]);
  const label = heading || name;
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const chapterHeadingRe = new RegExp(`^${escaped}\\s+(\\d+)\\b`, "i");
  // Algunos libros rotulan algún capítulo como "CAPÍTULO N" en vez de "<Libro> N"
  // (p. ej. Filipenses: el cap. 1 es "CAPÍTULO 1" y el resto "Filipenses 2/3/4").
  // Solo se aplica a encabezados reales (h1–h6), no a <p>, para no confundir con texto.
  const genericChapterRe = /^cap[ií]tulo\s+(\d+)\b/i;
  const isHeadingTag = (t) => /^h[1-6]$/.test(t);

  const chapters = [];
  const divisions = [];
  let chapter = null; // capítulo actual
  let verse = null; // versículo actual (para anexar continuaciones)
  let pendingSection = null; // subtítulo { title, footnoteRefs } a la espera del versículo
  let pendingDivision = null; // <h3> a la espera del próximo capítulo
  let inComments = false; // true tras "Comentarios de Mons. Straubinger"

  // Acumula un subtítulo de sección pendiente (de <h4> o de un <p> sin número). Si ya hay
  // uno en espera (p. ej. <h4> seguido de un título inline), los fusiona en vez de perderlo.
  const addPendingSection = (title, refs = []) => {
    title = collapse(title || "");
    if (!pendingSection) pendingSection = { title: "", footnoteRefs: [] };
    pendingSection.title = collapse(
      pendingSection.title ? `${pendingSection.title} ${title}` : title,
    );
    for (const id of refs)
      if (!pendingSection.footnoteRefs.includes(id)) pendingSection.footnoteRefs.push(id);
  };

  // Anexa texto/notas de continuación al versículo abierto. Si el fragmento empieza por
  // puntuación de cierre (",.;:?!" …), se une sin espacio para no dejar " ," suelto.
  const appendToVerse = (text, refs = []) => {
    if (!verse) return;
    if (text) {
      const sep = /^[,.;:?!»”)\]]/.test(text) ? "" : " ";
      verse.text = collapse(`${verse.text}${sep}${text}`);
    }
    for (const id of refs)
      if (!verse.footnoteRefs.includes(id)) verse.footnoteRefs.push(id);
  };

  const flushVerse = () => {
    if (verse && chapter) chapter.verses.push(verse);
    verse = null;
  };
  const flushChapter = () => {
    flushVerse();
    if (chapter) chapters.push(chapter);
    chapter = null;
  };

  const handleParagraph = (el) => {
    // Un <p> puede contener varios versículos (a veces falta el <p> separador).
    const segs = parseParagraph($, el);
    let hasNumbered = segs.some((s) => s.number !== null);

    // Defecto del origen: a veces el número de versículo (casi siempre el v1) va como TEXTO
    // plano al inicio del <p>, no en <sup> (Salmos 85, 96, 102, 121: "<p>1 <sup>nota…</p>").
    // Si el primer segmento empieza por "N " y ese N es el próximo versículo esperado del
    // capítulo, se promueve a número de versículo para no perder el versículo entero.
    if (!hasNumbered && segs[0]?.number === null) {
      // El número puede ir separado ("3 Oh Dios") o pegado al texto ("3Él solo", Salmo 61):
      // por eso no se exige espacio. El guardián N===esperado evita falsos positivos.
      const m = /^(\d+)\s*/.exec(segs[0].text);
      // Próximo versículo esperado: cuenta también el versículo ABIERTO (aún sin volcar a
      // chapter.verses), si no el último volcado, si no 1 (primer versículo del capítulo).
      const lastNum = verse
        ? verse.number
        : chapter?.verses.length
          ? chapter.verses[chapter.verses.length - 1].number
          : null;
      const expected = lastNum === null ? 1 : lastNum + 1;
      if (m && Number(m[1]) === expected) {
        segs[0].number = expected;
        segs[0].text = segs[0].text.slice(m[0].length);
        hasNumbered = true;
      }
    }

    // Párrafo SIN ningún número: puede ser un subtítulo de sección o una continuación del
    // versículo anterior, y hay que distinguirlos:
    //  · NT + texto que empieza en MAYÚSCULA → SUBTÍTULO de sección en su propio <p> antes
    //    del versículo ("Nacimiento de Jesús."). El origen lo escribe <p>título <p>versículo
    //    y parse5 los separa en hermanos. → sección pendiente (con sus notas).
    //  · resto (AT siempre, o NT que empieza en minúscula/puntuación, p. ej. Mc 4,41
    //    "…entonces" ‖ ", que hasta el viento…") → CONTINUACIÓN (poesía o frase partida en
    //    varios <p>) que pertenece al versículo ANTERIOR. → se anexa al versículo abierto.
    if (!hasNumbered) {
      const text = collapse(segs.map((s) => s.text).join(" "));
      const refs = segs.flatMap((s) => s.footnoteRefs);
      if (!text && !refs.length) return;
      const looksLikeTitle = /^\p{Lu}/u.test(text); // empieza en mayúscula
      if (ntFormat && looksLikeTitle) addPendingSection(text, refs);
      else appendToVerse(text, refs);
      return;
    }

    let seenNumber = false;
    for (const seg of segs) {
      if (seg.number === null && !seenNumber && (seg.text || seg.footnoteRefs.length)) {
        // Texto antes del primer número dentro de un párrafo con versículos: subtítulo
        // inline (p. ej. "Salutación apostólica. ¹ Pablo…" en las epístolas).
        addPendingSection(seg.text, seg.footnoteRefs);
        continue;
      }
      if (seg.number !== null) {
        seenNumber = true;
        // Libros de un solo capítulo (Judas, Abdías, Filemón, 2/3 Juan) no traen
        // encabezado de capítulo, solo un título; sus versículos empiezan directamente.
        // Se crea el capítulo 1 automáticamente al aparecer el primer versículo.
        if (!chapter) chapter = { chapter: 1, sections: [], verses: [] };
        // Nuevo versículo
        flushVerse();
        // Una división <h3> que apareció a mitad de capítulo (sin h2 intermedio)
        if (pendingDivision) {
          divisions.push({
            title: pendingDivision,
            startChapter: chapter.chapter,
            startVerse: seg.number,
          });
          pendingDivision = null;
        }
        verse = {
          number: seg.number,
          text: seg.text,
          footnoteRefs: seg.footnoteRefs,
        };
        if (pendingSection) {
          const section = { title: pendingSection.title, startVerse: seg.number };
          // Nota anclada al subtítulo (p. ej. Filemón "Salutación apostólica [n]"): se
          // conserva en la sección para no dejarla huérfana.
          if (pendingSection.footnoteRefs.length)
            section.footnoteRefs = pendingSection.footnoteRefs;
          chapter.sections.push(section);
          pendingSection = null;
        }
      } else if (verse && (seg.text || seg.footnoteRefs.length)) {
        // Continuación / poesía: anexar al versículo actual
        appendToVerse(seg.text, seg.footnoteRefs);
      }
      // Segmento de preámbulo (sin número y sin versículo abierto) → se ignora
    }
  };

  // Recorrido recursivo en orden de documento. Se desciende en contenedores genéricos
  // (div, etc.) y —clave— dentro de los encabezados de capítulo, para rescatar los
  // versículos que el <h2> haya "atrapado" como hijos (ver nota sobre chapterHeadingRe).
  const walk = (el) => {
    const nodes = $(el).contents().toArray();
    for (const node of nodes) {
      if (inComments) return;
      if (node.type !== "tag") continue;
      const tag = node.tagName;
      const rawText = collapse($(node).text());

      const chMatch =
        HEADING_TAGS.has(tag) && chapterHeadingRe.test(rawText)
          ? chapterHeadingRe.exec(rawText)
          : isHeadingTag(tag) && genericChapterRe.test(rawText)
            ? genericChapterRe.exec(rawText)
            : null;
      if (chMatch) {
        flushChapter();
        // Todo subtítulo/preámbulo acumulado antes del encabezado es front-matter del libro
        // (intro editorial, división en romanos suelta): no es sección de este capítulo. El
        // subtítulo real llega DESPUÉS del <h2>. Se descarta para no contaminar el v1.
        pendingSection = null;
        chapter = { chapter: Number(chMatch[1]), sections: [], verses: [] };
        if (pendingDivision) {
          divisions.push({
            title: pendingDivision,
            startChapter: chapter.chapter,
            startVerse: 1,
          });
          pendingDivision = null;
        }
        walk(node); // rescatar versículos atrapados dentro del propio encabezado
        continue;
      }

      if (tag === "h2" && /Comentarios de Mons/i.test(rawText)) {
        inComments = true; // fin del cuerpo bíblico; lo que sigue son las notas
        return;
      }
      if (tag === "h3") {
        pendingDivision = rawText.replace(/\s+$/, "");
        continue;
      }
      if (tag === "h4") {
        addPendingSection(rawText);
        continue;
      }
      if (tag === "p") {
        handleParagraph(node);
        continue;
      }
      // Contenedor genérico (div, span, etc.): descender
      walk(node);
    }
  };

  walk(content.get(0));
  flushChapter();

  const footnotes = extractFootnotes($, content);

  return { book: name, slug, source: url, chapters, divisions, footnotes };
}

/**
 * Detecta anomalías de numeración de versículos (huecos y duplicados) POR CAPÍTULO.
 * Estas suelen ser defectos del sitio origen (números omitidos o mal escritos), no del
 * parser. Se reportan para revisión manual; el scraper NO renumera para no desalinear
 * el texto con su número real.
 */
function numberingAnomalies(book) {
  const out = [];
  for (const c of book.chapters) {
    const nums = c.verses.map((v) => v.number);
    const gaps = [];
    const dups = [];
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] === nums[i - 1]) dups.push(nums[i]);
      else if (nums[i] !== nums[i - 1] + 1)
        gaps.push(`${nums[i - 1]}→${nums[i]}`);
    }
    if (gaps.length || dups.length)
      out.push({ chapter: c.chapter, gaps, dups });
  }
  return out;
}

/** Estadísticas útiles para validar el resultado. */
function summarize(book) {
  const verses = book.chapters.reduce((n, c) => n + c.verses.length, 0);
  const refs = book.chapters.reduce(
    (n, c) => n + c.verses.reduce((m, v) => m + v.footnoteRefs.length, 0),
    0,
  );
  const footnoteIds = Object.keys(book.footnotes).map(Number);
  const referenced = new Set(
    book.chapters.flatMap((c) => [
      ...c.verses.flatMap((v) => v.footnoteRefs),
      // notas ancladas a subtítulos de sección (p. ej. Filemón "Salutación apostólica [n]")
      ...c.sections.flatMap((s) => s.footnoteRefs || []),
    ]),
  );
  const orphanRefs = [...referenced].filter((id) => !(id in book.footnotes));
  const unusedNotes = footnoteIds.filter((id) => !referenced.has(id));
  return {
    chapters: book.chapters.length,
    verses,
    footnoteRefs: refs,
    footnotes: footnoteIds.length,
    divisions: book.divisions.length,
    sections: book.chapters.reduce((n, c) => n + c.sections.length, 0),
    orphanRefs, // refs en el texto sin nota correspondiente (debería estar vacío)
    unusedNotes, // notas sin ninguna referencia en el texto (debería estar vacío)
    numberingAnomalies: numberingAnomalies(book), // huecos/duplicados (defectos del origen)
  };
}

async function scrapeBook(bookMeta) {
  const url = `${BASE_URL}/${bookMeta.slug}/`;
  console.log(`\n→ ${bookMeta.name}  (${url})`);
  const html = await fetchHtml(url);
  const book = parseBook(html, { ...bookMeta, url });
  const stats = summarize(book);
  const { orphanRefs, unusedNotes, numberingAnomalies: anoms, ...counts } = stats;
  console.log("  ", JSON.stringify(counts));
  if (orphanRefs.length)
    console.warn("  ⚠ refs sin nota:", orphanRefs.slice(0, 10));
  if (unusedNotes.length)
    console.warn("  ⚠ notas sin uso:", unusedNotes.slice(0, 10));
  if (anoms.length) {
    console.warn(`  ⚠ numeración irregular (defectos del origen) en ${anoms.length} cap.:`);
    for (const a of anoms) {
      const parts = [];
      if (a.gaps.length) parts.push(`saltos ${a.gaps.join(", ")}`);
      if (a.dups.length) parts.push(`duplicados ${a.dups.join(", ")}`);
      console.warn(`      cap. ${a.chapter}: ${parts.join(" | ")}`);
    }
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const outPath = resolve(OUTPUT_DIR, `${bookMeta.slug}.json`);
  await writeFile(outPath, JSON.stringify(book, null, 2), "utf8");
  console.log(`  ✓ guardado en ${outPath}`);
  return book;
}

async function main() {
  const args = process.argv.slice(2);
  const runAll = args.includes("--all");
  const slugs = args.filter((a) => !a.startsWith("--"));

  let targets;
  if (runAll) targets = BOOKS;
  else if (slugs.length) targets = BOOKS.filter((b) => slugs.includes(b.slug));
  else targets = BOOKS.filter((b) => b.slug === "genesis"); // por defecto: prueba con Génesis

  if (!targets.length) {
    console.error(
      `Sin objetivos. Slugs disponibles: ${BOOKS.map((b) => b.slug).join(", ")}`,
    );
    process.exit(1);
  }

  for (let i = 0; i < targets.length; i++) {
    await scrapeBook(targets[i]);
    if (i < targets.length - 1) await sleep(REQUEST_DELAY_MS);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
