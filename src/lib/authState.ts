/**
 * Estado de sesión compartido para las islas del cliente.
 *
 * El sitio es multipágina (MPA): cada navegación recarga el documento y con él
 * todas las islas. Antes, cada isla (`AuthWidget`, `HighlightPicker`,
 * `RangeSelectionToolbar`, `HighlightsManager`) llamaba por su cuenta a
 * `supabase.auth.getSession()` Y registraba su propio `onAuthStateChange`. Como
 * `onAuthStateChange` emite un evento `INITIAL_SESSION` al suscribirse, el
 * callback se disparaba DOS veces por carga (una por `getSession`, otra por el
 * `INITIAL_SESSION`), duplicando el trabajo dependiente de la sesión (p. ej. el
 * fetch de resaltados del capítulo).
 *
 * Este módulo centraliza eso: registra UNA sola suscripción a Supabase y avisa
 * a los subscriptores solo cuando el USUARIO cambia (o en el primer estado
 * conocido). Los `TOKEN_REFRESHED` con el mismo usuario NO re-notifican, así que
 * ya no se recargan datos en cada refresco de token.
 *
 * Reutiliza el cliente singleton de `./supabase` (no cambia su config de auth).
 */
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type SessionCallback = (session: Session | null) => void;

const subscribers = new Set<SessionCallback>();
let currentSession: Session | null = null;
let currentUserId: string | null = null;
/** `true` cuando ya se resolvió el estado inicial (llegó `INITIAL_SESSION`). */
let ready = false;
let initialized = false;

/** Registra la ÚNICA suscripción a Supabase, la primera vez que se necesita. */
function ensureInit() {
  if (initialized) return;
  initialized = true;

  // `onAuthStateChange` emite `INITIAL_SESSION` al registrarse: cubre el estado
  // inicial sin una llamada extra a `getSession()`.
  supabase.auth.onAuthStateChange((_event, session) => {
    const uid = session?.user?.id ?? null;
    const first = !ready;
    const userChanged = uid !== currentUserId;

    currentSession = session;
    currentUserId = uid;
    ready = true;

    // Notificar solo en el primer estado o cuando cambia el usuario. Un
    // refresco de token (mismo usuario) no dispara trabajo redundante.
    if (first || userChanged) {
      for (const cb of subscribers) cb(currentSession);
    }
  });
}

/**
 * Se suscribe a la sesión de Supabase. Invoca `cb` con la sesión actual (una
 * vez que se conoce) y en cada cambio de usuario. Devuelve una función para
 * cancelar la suscripción.
 */
export function subscribeSession(cb: SessionCallback): () => void {
  ensureInit();
  subscribers.add(cb);
  // Si el estado inicial ya se resolvió, entregar de inmediato; si no, este
  // subscriptor recibirá el primer `INITIAL_SESSION` como el resto.
  if (ready) cb(currentSession);
  return () => {
    subscribers.delete(cb);
  };
}

/**
 * Igual que `subscribeSession`, pero entrega solo el id de usuario. Azúcar para
 * las islas que únicamente necesitan saber quién está logueado.
 */
export function subscribeUser(cb: (userId: string | null) => void): () => void {
  return subscribeSession((session) => cb(session?.user?.id ?? null));
}
