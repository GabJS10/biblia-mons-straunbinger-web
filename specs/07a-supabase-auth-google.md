# Paso 7a — Autenticación con Supabase (Google OAuth)

Primer paso de la Fase 7 (cuenta de usuario). Integra Supabase **solo para
autenticación** con Google OAuth, manteniendo el sitio **estático** (SSG, sin
SSR ni backend propio): toda la auth corre en el cliente. Es el primero de tres
prompts; aquí se resuelve únicamente **auth + sesión**.

**Fuera de alcance (Pasos 7b/7c):** el esquema de resaltados/colecciones, el tap
para resaltar versículos y la página de gestión. Este paso no crea tablas ni
políticas RLS todavía.

## Dependencia y cliente

- **`@supabase/supabase-js`** (`2.112.2`), fijado en `package.json` y con el
  lockfile (`pnpm-lock.yaml`) commiteado.
- **`src/lib/supabase.ts`** — cliente único para el navegador:
  - Lee `import.meta.env.PUBLIC_SUPABASE_URL` y
    `import.meta.env.PUBLIC_SUPABASE_ANON_KEY`. El prefijo `PUBLIC_` es
    intencional: Astro solo expone al bundle del cliente las variables con ese
    prefijo, y la clave *anon* es pública por diseño (la seguridad real vive en
    las políticas RLS del proyecto, que llegarán en 7b).
  - Lanza un error claro si faltan las variables (falla ruidosamente en dev en
    vez de un error opaco al primer uso).
  - Opciones de auth pensadas para un sitio estático:
    - `persistSession: true` → la sesión se guarda en `localStorage` y sobrevive
      recargas y navegación entre páginas (cada página es un documento nuevo).
    - `autoRefreshToken: true` → refresco silencioso del token.
    - `detectSessionInUrl: true` + `flowType: 'pkce'` → maneja el callback de
      OAuth automáticamente (ver más abajo).

## Componente de sesión — `src/components/AuthWidget.astro`

Isla flotante con el **mismo patrón que `ThemeToggle`** (TypeScript vanilla +
`position: fixed`, sin frameworks). Lenguaje visual de la Fase 6: `var(--font-sans)`
(Inter), tokens de `themes.css`, sin rellenos sólidos, bordes finos de 1px y
`backdrop-filter: blur`.

- **Sin sesión:** botón "Iniciar sesión con Google" con un **ícono neutro de
  acceso** (SVG inline tipo *log-in*, no el logo de Google — se evita replicar
  marca registrada). Al hacer click:
  `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } })`,
  para volver a la misma página tras el login.
- **Con sesión:** botón-avatar circular que muestra la imagen de Google
  (`user_metadata.avatar_url` / `.picture`) o, si no existe/no carga, la
  **inicial** del nombre o correo. Al pulsarlo abre un **menú** simple con el
  correo y "Cerrar sesión" (`supabase.auth.signOut()`). El menú se cierra al
  hacer click fuera o con `Escape`.
- **Reactividad sin recargar:** `supabase.auth.onAuthStateChange` re-renderiza al
  iniciar/cerrar sesión. El estado inicial se lee con `getSession()`.
- **Sin parpadeo:** el widget arranca `hidden` y se revela solo tras resolverse
  la sesión, evitando el flash "iniciar sesión" → avatar en usuarios ya
  autenticados.
- **Accesibilidad:** botones nativos; el avatar usa `aria-haspopup="menu"` +
  `aria-expanded`; anillos `:focus-visible`. En pantallas estrechas (≤30rem) el
  botón de login deja solo el ícono (el texto queda como etiqueta accesible).

### Posición junto al `ThemeToggle`

Ambos en el mismo eje vertical (`top: 0.75rem`). El `ThemeToggle` sigue en
`right: 0.75rem` (2.75rem de ancho); el `AuthWidget` se ancla a su izquierda con
`right: calc(0.75rem + 2.75rem + 0.5rem)` y crece hacia la izquierda, así nunca
se superponen. No colisiona con el `BookPickerModal` por la misma razón que el
toggle: el `<dialog>` nativo ocupa el *top layer* y su `::backdrop` cubre las
islas flotantes.

## Integración global — `Layout.astro`

`<AuthWidget />` se incluye **una sola vez** en `<body>`, junto a
`<ThemeToggle />` y antes del `<slot />`, por lo que aparece en todas las páginas
sin tocarlas individualmente.

## Callback de OAuth — sin ruta propia

No se necesitó ninguna página de callback. Con `detectSessionInUrl: true` y
`flowType: 'pkce'` (por defecto), Google redirige de vuelta a la página con un
`?code=…`; `supabase-js` lo detecta al cargar, lo intercambia por una sesión y
**limpia la URL** automáticamente. Basta con que la URL de retorno esté permitida
en la configuración de Supabase (ver abajo).

## Variables de entorno

El usuario debe tener un `.env` local (ya está en `.gitignore`; **no** se
commitea). Se añadió **`.env.example`** documentando las dos variables sin
valores:

| Variable | Dónde obtenerla en el dashboard de Supabase |
| --- | --- |
| `PUBLIC_SUPABASE_URL` | Project Settings → API → **Project URL** |
| `PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → API keys → clave **anon / public** |

> El `.env` local del usuario ya estaba configurado con estos valores; este paso
> no puede crearlo por él.

## Configuración requerida en Supabase (por el usuario)

Se asume que el proyecto ya existe y que el proveedor **Google** está habilitado
en *Authentication → Providers*. Además:

- **Authentication → URL Configuration → Redirect URLs:** incluir la URL de
  desarrollo `http://localhost:4321` (y, más adelante, la URL de producción).
  Como el widget usa `redirectTo: window.location.href`, conviene un patrón que
  cubra las rutas internas, p. ej. `http://localhost:4321/**`.
- **Site URL:** apuntarla a la URL principal del sitio.

## Estructura de archivos

```
src/
  lib/
    supabase.ts                       # NUEVO — cliente de navegador (anon key)
  components/
    AuthWidget.astro                  # NUEVO — isla flotante de sesión
  layouts/
    Layout.astro                      # MOD — incluye <AuthWidget /> global
.env.example                          # NUEVO — documenta las 2 variables PUBLIC_
package.json / pnpm-lock.yaml         # MOD — @supabase/supabase-js
```

## Verificación realizada

- `pnpm astro check` → **0 errores, 0 warnings, 0 hints**.
- `pnpm astro build` → OK, **1347 páginas**, sin warnings.
- `[data-auth]` aparece **exactamente 1 vez** por página (verificado en `index`,
  `genesis/1`, `prologo`).
- `.env` presente en `.gitignore`; `.env.example` sin valores reales.

### Cómo probar manualmente el login/logout

1. Con un `.env` válido, `astro dev --background` (ver `CLAUDE.md`) → sitio en
   `http://localhost:4321`.
2. En la esquina superior derecha, a la izquierda del toggle de tema, aparece
   "Iniciar sesión con Google". Click → redirige al consentimiento de Google.
3. Tras aceptar, Google vuelve al sitio; la URL se limpia sola y el widget pasa a
   mostrar el **avatar** (imagen de Google o inicial) sin recargar manualmente.
4. Recargar la página o navegar a `/genesis/1/`: la sesión persiste (avatar
   sigue visible), gracias a `persistSession` en `localStorage`.
5. Click en el avatar → menú con el correo y "Cerrar sesión". Click en cerrar →
   vuelve al botón de login, también sin recargar.
6. Teclado: `Tab` hasta el widget (anillo de foco visible), `Enter`/`Espacio`
   activan login/menú, `Escape` cierra el menú.
```
