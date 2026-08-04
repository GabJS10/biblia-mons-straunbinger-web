# Scraper — Biblia Straubinger

Extrae el texto y las notas de Mons. Straubinger desde
[bibliastraubinger.com](https://bibliastraubinger.com/) y genera un JSON
estructurado por libro. Fase 0 del proyecto (ver `../PLANNING.md`).

## Uso

```bash
pnpm scrape            # por defecto: Génesis (prueba)
pnpm scrape genesis    # un libro concreto por slug
pnpm scrape --all      # todos los libros del catálogo BOOKS
```

El JSON se escribe en `scripts/output/<slug>.json`.

> El catálogo `BOOKS` en `scrape.mjs` contiene los **73 libros** (canon católico, con
> deuterocanónicos) en orden canónico. Los slugs se extrajeron y verificaron contra los
> enlaces de la home. Hay una pausa de 2 s entre requests (scraping respetuoso).
>
> **`heading` (opcional)**: el encabezado de capítulo se detecta por texto (`"Génesis 1"`).
> Si el rótulo que usa el sitio en los encabezados de un libro no coincide con su `name`
> —típico en los de nombre compuesto: `I de Reyes (1 Samuel)`, `I Paralipómenos
> (1 Crónicas)`, `Eclesiastés o Qoélet`, etc.— añade a esa entrada un campo `heading` con
> el texto real (p. ej. `heading: "I Reyes"`) tras inspeccionar su página. Si el conteo de
> capítulos sale mal para un libro, esta es casi siempre la causa.

## Formato de salida

```jsonc
{
  "book": "Génesis",
  "slug": "genesis",
  "source": "https://bibliastraubinger.com/genesis/",
  "chapters": [
    {
      "chapter": 1,
      "sections": [                      // subtítulos editoriales (metadato)
        { "title": "Creación del cielo y de la tierra.", "startVerse": 1 }
        // footnoteRefs: [n] opcional, si el subtítulo llevaba una nota (p. ej. Filemón)
      ],
      "verses": [
        { "number": 1, "text": "Al principio creó Dios…", "footnoteRefs": [1] }
      ]
    }
  ],
  "divisions": [                          // divisiones en números romanos (metadato)
    { "title": "I. Desde la Creación…", "startChapter": 1, "startVerse": 1 }
  ],
  "footnotes": {                          // notas indexadas por ID de ancla
    "1": "Al principio, es decir, cuando no existía aún nada…"
  }
}
```

Las notas se guardan aparte, indexadas por el **ID del ancla** (`#footnote-N`), que
es como el origen asocia realmente nota↔versículo. El número que aparece al inicio del
texto de cada nota (p. ej. `1.`, `17 s.`) es solo el versículo donde empieza y puede
ser engañoso, por eso se descarta. Una nota puede cubrir varios versículos.

## Control de calidad

Al terminar cada libro, el scraper imprime un resumen y avisa de:

- `orphanRefs`: referencias en el texto sin nota correspondiente (debería ser 0). Cuando
  aparece, suele ser un **enlace de nota roto en el origen** (p. ej. Levítico enlaza a
  `footnote-723`, que no existe en su página). El scraper conserva la ref y solo avisa.
- `unusedNotes`: notas sin ninguna referencia en el texto (debería ser 0).
- **numeración irregular**: huecos o números de versículo duplicados **dentro** de un
  capítulo. Casi siempre son **defectos del propio sitio origen** (números omitidos o
  mal escritos), no del parser. El scraper es fiel al origen y **no** renumera, para no
  desalinear el texto con su número real.

Anomalías conocidas en Génesis (defectos del origen, verificados contra el HTML crudo):

| Cap. | Defecto del origen                          |
| ---- | ------------------------------------------- |
| 17   | salta 24 → 26 (falta marcador del v25)      |
| 24   | v48 mal etiquetado como "49" (49 duplicado) |
| 27   | salta 18 → 20 (falta v19)                   |
| 39   | v18 mal etiquetado como "16"                |
| 42   | salta 31 → 33 (falta v32)                   |
| 43   | salta 13 → 15 (falta v14)                   |

Conviene cotejar estos casos con el PDF original antes de publicar.

## Notas de implementación

El HTML del origen es "malformado" (`<p>` y `<h2>` sin cerrar) e **inconsistente entre
libros**. Cheerio (parse5) lo normaliza de forma predecible, y el parser cubre las
variantes observadas:

- **Encabezados de capítulo**: se detectan por **texto** (`Génesis N`, por prefijo), no
  por etiqueta. La mayoría son `<h2>` pero algunos vienen como `<p>` plano (Génesis 3, 4,
  5) o como `<h2>CAPÍTULO N` genérico (p. ej. Filipenses 1). Ver el campo `heading` (arriba)
  para libros cuyo rótulo difiere del nombre. Los libros de un solo capítulo (Abdías,
  Filemón, 2/3 Juan, Judas) no traen encabezado: se crea el capítulo 1 automáticamente al
  aparecer el primer versículo.
- **Formato del número de versículo (AT vs NT)**: en el AT es `<sup>N</sup>` plano; en el
  NT va envuelto en cursiva/negrita —epístolas `<em><sup>N</sup></em>`, Evangelios y Hechos
  `<strong><em><sup>N</sup></em></strong>`—. El parser recorre los envoltorios
  (`<em>`/`<strong>`/…) de forma recursiva, así que reconoce el `<sup>` a cualquier
  profundidad. El formato se detecta una vez por libro **por mayoría** (no por mera
  presencia): en Salmos casi todos los versículos son `<sup>N</sup>` planos pero el v1
  (encabezamiento) de muchos salmos va en cursiva —`<em><sup>1</sup>`—; eso no lo convierte
  en NT.
- **Salmos — doble numeración y salmos partidos**: por la numeración Vulgata/Septuaginta,
  algunos salmos aparecen partidos en dos (rótulos `Salmo 9 a` / `Salmo 9 b (10)`, `Salmo
  113 a (114)` / `Salmo 113 b (115)`), por lo que hay **152** capítulos aunque el máximo sea
  150 (los números 9 y 113 salen dos veces). En los salmos con referencia hebrea, el `<sup>`
  del versículo trae **ambos** números: `<sup>(10) 1</sup>` → se usa el número LOCAL de
  Straubinger (el que va fuera del paréntesis) y se descarta la referencia hebrea.
- **Número de versículo como texto plano** (defecto del origen): a veces el número no va en
  `<sup>` sino como texto al inicio del `<p>`, separado (`<p>1 <sup>nota…`, Salmos 85, 96,
  102, 121) o **pegado** al texto (`<p>3Él solo es mi roca…`, Salmo 61). Se recupera si el
  `<p>` empieza por un número y ese número es el próximo versículo esperado del capítulo
  (contando también el versículo aún abierto); si no coincide, se conserva como está.
- **OCR del número de versículo** (`l`/`I` → `1`): en varios salmos el "1" inicial del número
  se reconoció como letra ("l") — `<sup>l5</sup>` (Salmo 33 v15), `<sup>l2</sup>` (Salmo 40
  v12). Como dentro de un `<sup>` solo hay números de versículo, se normaliza `l`/`I` a `1`
  cuando el marcador contiene dígitos, y así el versículo (y su texto) no se pierde.
- **Saltos de numeración que SÍ son defectos reales**: los que quedan tras lo anterior son
  del origen y se conservan sin tocar: versículos sin ningún marcador (Salmo 37, falta el 7),
  números fuera de orden (Salmo 76 «…8, 7…»; Salmo 108 «…28, 27…») o duplicados (Salmo 71,
  dos v18). Se reportan en el QA para cotejar con el PDF, pero no se renumeran.
- **Subtítulos de sección**: en el AT vienen como `<h4>`. En el NT van **inline**, en su
  propio `<p>` antes del versículo (`<p>Nacimiento de Jesús. <p><sup>18</sup>…`), que parse5
  separa en hermanos. Se guardan como `sections` (metadato) con su `startVerse`; si el
  subtítulo llevaba una nota (p. ej. Filemón «Salutación apostólica [n]»), esa referencia se
  conserva en `footnoteRefs` de la sección para no dejarla huérfana.
- **Párrafos sin número — sección vs continuación**: un `<p>` sin número puede ser un
  subtítulo NT o una **continuación** del versículo anterior (poesía o frase partida en
  varios `<p>`: Gn 1,27 «a imagen de Dios lo creó;» / «varón y mujer los creó.», o Mc 4,41
  «…entonces» ‖ «, Éste, que aun el viento…»). Se distingue así: en el AT siempre es
  continuación; en el NT es subtítulo solo si el texto **empieza en mayúscula**, si no es
  continuación. El front-matter del libro (intro editorial, división en romanos suelta) que
  aparece antes del primer `<h2>` se descarta al llegar al encabezado.
- **Versículos atrapados en el encabezado**: si tras un `<h2>` viene directamente un `<p>`
  de versículo (en vez de un `<h4>`), el parser HTML deja el `<h2>` abierto y este absorbe
  los versículos como hijos (p. ej. Éxodo 8). Por eso el recorrido es **recursivo** y
  desciende dentro del encabezado para rescatarlos.
- **Varios versículos por párrafo**: cada `<p>` se parte en segmentos por cada `<sup>`
  numérico; a veces falta el `<p>` separador y dos versículos comparten párrafo (Gn 10,9-10).
- **Notas — dos formatos**: Génesis usa `<ol><li id="footnote-N">…</li>`; los demás libros
  (Éxodo, etc.) usan `<p id="footnote-N"><p>…</p></p>`, que parse5 separa dejando el
  `<p id>` vacío y el texto en el hermano siguiente. El extractor acumula el texto desde el
  elemento con `id="footnote-N"` hasta su back-ref `#footnote-ref-N` (que también acota la
  última nota y descarta la basura final).
- **Enlaces de navegación** ("Volver al Índice", índices internos): se descartan (el texto
  bíblico no lleva anclas internas; las notas van dentro de `<sup>`).
