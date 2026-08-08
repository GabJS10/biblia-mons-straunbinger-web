/**
 * Capa de datos para resaltados y colecciones (Paso 7b).
 *
 * Aísla las consultas a Supabase de la UI del `HighlightPicker`. Todo corre en
 * el navegador con el cliente anon + la sesión del usuario; las políticas RLS
 * (ver la migración `..._create_highlights_and_collections.sql`) garantizan que
 * cada usuario solo toca sus propias filas, así que aquí NO se filtra por
 * `user_id` en los select (RLS lo hace); sí se envía `user_id` en insert/upsert
 * porque la política `with check` lo exige.
 *
 * Las colecciones se cachean en memoria durante la sesión de navegación: la
 * lista se reutiliza en cualquier capítulo sin refetch. El caché vive mientras
 * el documento no se recargue (cada navegación a otra página es un documento
 * nuevo y vuelve a pedir; es el trade-off aceptado en el paso).
 */
import { supabase } from './supabase';
import type { Database } from '../types/supabase';

export type Collection = Database['public']['Tables']['collections']['Row'];
export type Highlight = Database['public']['Tables']['highlights']['Row'];

// Caché en memoria de las colecciones del usuario (sesión de navegación).
let collectionsCache: Collection[] | null = null;

/** Colecciones del usuario, cacheadas. `force` re-consulta ignorando el caché. */
export async function getCollections(force = false): Promise<Collection[]> {
  if (collectionsCache && !force) return collectionsCache;
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  collectionsCache = data ?? [];
  return collectionsCache;
}

/** Invalida el caché (p. ej. al cerrar sesión). */
export function clearCollectionsCache() {
  collectionsCache = null;
}

/** Crea una colección y la añade al caché para que aparezca sin refetch. */
export async function createCollection(name: string, userId: string): Promise<Collection> {
  const { data, error } = await supabase
    .from('collections')
    .insert({ name, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  if (collectionsCache) collectionsCache.push(data);
  return data;
}

/** Resaltados del usuario para UN capítulo concreto (no todo su historial). */
export async function getChapterHighlights(
  bookSlug: string,
  chapter: string,
): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from('highlights')
    .select('*')
    .eq('book_slug', bookSlug)
    .eq('chapter', chapter);
  if (error) throw error;
  return data ?? [];
}

/**
 * Crea o actualiza el resaltado de un versículo (upsert sobre la constraint
 * única `user_id, book_slug, chapter, verse_number`). Sirve tanto para resaltar
 * por primera vez como para reasignar la colección de uno ya existente.
 */
export async function upsertHighlight(input: {
  userId: string;
  bookSlug: string;
  chapter: string;
  verseNumber: number;
  collectionId: string | null;
}): Promise<Highlight> {
  const { data, error } = await supabase
    .from('highlights')
    .upsert(
      {
        user_id: input.userId,
        book_slug: input.bookSlug,
        chapter: input.chapter,
        verse_number: input.verseNumber,
        collection_id: input.collectionId,
      },
      { onConflict: 'user_id,book_slug,chapter,verse_number' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Elimina un resaltado por su id. */
export async function deleteHighlight(id: string): Promise<void> {
  const { error } = await supabase.from('highlights').delete().eq('id', id);
  if (error) throw error;
}

/**
 * TODOS los resaltados del usuario (cualquier libro/capítulo), para la página
 * "Mis resaltados". RLS filtra por usuario; se ordenan por `created_at`
 * descendente (más recientes primero) para el render agrupado.
 */
export async function getAllHighlights(): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from('highlights')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Renombra una colección y refresca el caché en memoria. */
export async function renameCollection(id: string, name: string): Promise<Collection> {
  const { data, error } = await supabase
    .from('collections')
    .update({ name })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  if (collectionsCache) {
    const cached = collectionsCache.find((c) => c.id === id);
    if (cached) cached.name = data.name;
  }
  return data;
}

/**
 * Borra una colección. Por el `on delete set null` del esquema, sus highlights
 * NO se borran: quedan sueltos (collection_id = null) automáticamente, sin
 * lógica extra aquí. Se quita del caché en memoria.
 */
export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase.from('collections').delete().eq('id', id);
  if (error) throw error;
  if (collectionsCache) {
    collectionsCache = collectionsCache.filter((c) => c.id !== id);
  }
}

/**
 * Mueve un resaltado existente a otra colección (o a "sin colección" con
 * `collectionId = null`) actualizando su `collection_id`.
 */
export async function moveHighlight(
  highlightId: string,
  collectionId: string | null,
): Promise<Highlight> {
  const { data, error } = await supabase
    .from('highlights')
    .update({ collection_id: collectionId })
    .eq('id', highlightId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
