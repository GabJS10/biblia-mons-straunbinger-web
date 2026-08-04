import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const footnoteRefs = z.array(z.number());

// Colección `books`: un JSON por libro (73 en total), generados por el scraper de la fase 0.
// El loader `glob` deriva el `id` del nombre de archivo (genesis.json -> id "genesis").
const books = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/books' }),
  schema: z.object({
    book: z.string(),
    slug: z.string(),
    source: z.url(),
    chapters: z.array(
      z.object({
        chapter: z.number(),
        sections: z
          .array(
            z.object({
              title: z.string(),
              startVerse: z.number(),
              // Opcional: solo algunas secciones traen referencias a notas.
              footnoteRefs: footnoteRefs.optional(),
            }),
          )
          .default([]),
        verses: z.array(
          z.object({
            number: z.number(),
            text: z.string(),
            footnoteRefs: footnoteRefs.default([]),
          }),
        ),
      }),
    ),
    divisions: z
      .array(
        z.object({
          title: z.string(),
          startChapter: z.number(),
          startVerse: z.number(),
        }),
      )
      .default([]),
    // Diccionario { "<idNumérico>": "<texto de la nota>" }.
    footnotes: z.record(z.string(), z.string()).default({}),
  }),
});

// Colección `intros`: contenido editorial en Markdown.
// Sin `book` -> prólogo general de toda la Biblia; con `book` -> intro de ese libro.
const intros = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/intros' }),
  schema: z.object({
    title: z.string(),
    book: z.string().optional(),
  }),
});

export const collections = { books, intros };
