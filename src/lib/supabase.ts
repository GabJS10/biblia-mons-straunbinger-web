/**
 * Cliente de Supabase para el navegador.
 *
 * El sitio es estático (SSG, sin backend propio), así que TODO Supabase corre
 * en el cliente. Por eso se usan variables `PUBLIC_` (Astro las expone al
 * bundle del navegador) con la clave *anon*: es una clave pública por diseño,
 * pensada para exponerse. La seguridad real vive en las políticas RLS del
 * proyecto Supabase, no en ocultar esta clave.
 *
 * Config relevante para OAuth en un sitio estático:
 *   - persistSession: guarda la sesión en localStorage (sobrevive recargas).
 *   - detectSessionInUrl: al volver del login de Google, supabase-js detecta el
 *     `?code=…` en la URL, lo intercambia por una sesión y limpia la URL. Por
 *     eso NO hace falta una ruta/página de callback propia.
 *   - flowType 'pkce': flujo recomendado para clientes públicos (por defecto).
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Falla ruidosamente en desarrollo si falta el .env local, en lugar de un
  // error opaco al primer uso del cliente.
  throw new Error(
    'Faltan PUBLIC_SUPABASE_URL o PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copia .env.example a .env y complétalas con las credenciales de tu proyecto Supabase.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

/**
 * Lanza el login de Google (mismo flujo en todo el sitio: AuthWidget y el
 * resaltado del lector lo comparten en vez de duplicar `signInWithOAuth`).
 * Redirige a Google y de vuelta a la misma página desde la que se invocó.
 */
export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  });
}
