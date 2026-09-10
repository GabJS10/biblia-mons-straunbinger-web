# Plan: Biblia Straubinger → App nativa iOS/Android (Capacitor) con lectura offline

## Context

El proyecto es un lector de la Biblia (traducción de Mons. Straubinger) construido en **Astro 7 como sitio 100% estático (SSG)**, sin adaptador ni backend propio. Todo Supabase (auth con Google + resaltados/colecciones) corre en el cliente con la clave anon y RLS. El contenido son 73 libros en JSON (colección `books`) prerenderizados a una página HTML por capítulo, más un endpoint JSON estático por capítulo. Fuentes self-hosted (`@fontsource`), CSS plano con variables de tema (claro/oscuro/lectura).

**Hallazgo clave del análisis:** la web **ya es mobile-first y responsive** — `viewport` meta presente, unidades fluidas (`rem`/`clamp`/`auto-fill`), áreas táctiles de ~44px en todos los controles, diálogos a pantalla completa y hojas inferiores en móvil, barra de navegación que colapsa en pantallas angostas, sin interacciones solo-hover. Por tanto **no hay que "hacerla responsive"**: eso está hecho.

**Objetivo (confirmado con el usuario):** empaquetarla como **app nativa para Play Store / App Store con Capacitor**, con **lectura offline completa** del texto bíblico (los resaltados/auth siguen requiriendo conexión).

**Por qué Capacitor encaja:** un build estático de Astro se empaqueta entero dentro del binario nativo y se sirve desde un servidor local (`localhost`) del WebView. Es decir, **todas** las páginas de capítulos + fuentes + JSON viajan dentro de la app ⇒ **la lectura offline completa es prácticamente automática**. El trabajo real está en (1) integrar Capacitor, (2) arreglar el login de Google en un WebView nativo, (3) degradar con gracia lo que depende de red, y (4) pulir detalles nativos (safe areas, status bar, botón atrás, íconos/splash).

> ⚠️ **Restricción de plataforma:** este equipo es **Linux**. Android se puede compilar y firmar aquí (Android Studio/Gradle funcionan en Linux). **iOS requiere macOS + Xcode** para generar el `.ipa` — no se puede compilar iOS en Linux. Opciones para iOS: una Mac, o CI con runner macOS (GitHub Actions macOS, Codemagic, Ionic Appflow). Todo el código de este plan es igual para ambas plataformas; solo el paso final de compilación/subida de iOS necesita macOS.

---

## Approach

Trabajo incremental por fases. Nada de esto cambia la web: la versión de navegador sigue funcionando idéntica; el código nativo se activa solo con `Capacitor.isNativePlatform()`.

### Fase A — Andamiaje Capacitor
1. Dependencias: `@capacitor/core`, `@capacitor/cli` (dev), `@capacitor/android`, `@capacitor/ios`, y plugins `@capacitor/app`, `@capacitor/browser`, `@capacitor/status-bar`, `@capacitor/splash-screen`. Assets: `@capacitor/assets` (dev, para generar íconos/splash).
2. `capacitor.config.ts` en la raíz:
   - `appId`: propongo `com.gabrielballesteros.bibliastraubinger` (confirmable).
   - `appName`: `Biblia Straubinger`.
   - `webDir: 'dist'` (salida del build de Astro).
   - `server.androidScheme: 'https'` (recomendado; hace que Android sirva desde `https://localhost`, coherente con iOS y con Supabase/PKCE).
3. `pnpm build` → `npx cap add android` (+ `npx cap add ios` cuando haya Mac) → `npx cap sync`. Se crean carpetas `android/` e `ios/` (nativas, versionadas o gitignoreadas según preferencia).
4. Scripts en `package.json`: `"cap:sync": "astro build && cap sync"`, `"android": "cap open android"`, etc.

### Fase B — Login de Google en WebView (el punto crítico)
El flujo actual (`src/lib/supabase.ts` → `signInWithGoogle`) usa `redirectTo: window.location.href` + `detectSessionInUrl`. En el WebView nativo la app vive en `https://localhost`, así que ese redirect no vuelve a la app. Solución con **deep link por esquema propio** (reutiliza la OAuth de Supabase existente, sin plugin nativo de Google):

1. En `signInWithGoogle`, ramificar con `Capacitor.isNativePlatform()`:
   - **Web:** comportamiento actual (sin cambios).
   - **Nativo:** `signInWithOAuth({ provider:'google', options:{ redirectTo: 'com.gabrielballesteros.bibliastraubinger://login-callback', skipBrowserRedirect: true } })`, y abrir `data.url` con `Browser.open(...)` (navegador del sistema, requisito de Google para OAuth).
2. Registrar un listener global (nuevo `src/lib/nativeAuth.ts`, cargado como isla en `Layout.astro` solo en nativo): `App.addListener('appUrlOpen', ...)` → extraer el `code` de la URL de vuelta, llamar `supabase.auth.exchangeCodeForSession(code)`, cerrar el navegador (`Browser.close()`).
3. Registrar el esquema `com.gabrielballesteros.bibliastraubinger://` como deep link en iOS (`Info.plist` `CFBundleURLTypes`) y Android (`intent-filter` en `AndroidManifest.xml`). Capacitor documenta ambos.
4. **Config en consolas (no es código):** añadir ese esquema a **Supabase → Auth → URL Configuration → Redirect URLs**. La redirección de Google apunta a Supabase (ya configurado); no hace falta tocar Google Cloud salvo que se migre a login nativo.
5. *Alternativa (mejor UX, más setup, opcional a futuro):* plugin de Google Sign-In nativo + `supabase.auth.signInWithIdToken(...)`; evita el salto al navegador pero exige client IDs por plataforma (iOS + Android con SHA-1) en Google Cloud. Se documenta como opción, no se implementa en v1.

### Fase C — Offline completo + degradación con gracia
- **Texto bíblico offline:** automático al empaquetar (todo `dist/` viaja en la app). Verificar que **nada** de la lectura dependa de red: el share-card hace `fetch('/api/verses/.../.json')` (`src/lib/shareCard.ts`) pero esos JSON están bundleados y se sirven desde `localhost` ⇒ offline OK. Fuentes `@fontsource` bundleadas ⇒ OK.
- **Degradar Supabase sin conexión:** hoy la capa de datos lanza (`throw error`) en cada fallo (`src/lib/highlights.ts`). Las islas que cargan resaltados al abrir un capítulo (`HighlightPicker`, `RangeSelectionToolbar`) deben **atrapar** el fallo de red y seguir mostrando el texto sin romper la página (try/catch + estado "sin conexión" silencioso; no cachear resaltados en v1, según decisión del usuario). Revisar los puntos donde se invocan al montar.

### Fase D — Pulido nativo
- **Safe areas / notch:** cambiar el viewport a `width=device-width, initial-scale=1, viewport-fit=cover` en `src/layouts/Layout.astro`, y aplicar `env(safe-area-inset-*)` a los elementos `position: fixed` en esquinas: `ThemeToggle` (`src/components/ThemeToggle.astro`), `AuthWidget` (`src/components/AuthWidget.astro`), y la barra/flechas de `ChapterNav` (`src/components/ChapterNav.astro`) para que no queden bajo el notch, la status bar ni el home indicator.
- **`100vh` en iOS:** cambiar `min-height: 100vh` (`src/styles/global.css`) por `100dvh` (con fallback a `100vh`) para evitar el salto por la barra dinámica de Safari/WebView.
- **Status bar acorde al tema:** con `@capacitor/status-bar`, fijar estilo (claro/oscuro) al iniciar y **actualizarlo cuando cambia el tema** — engancharlo donde `ThemeToggle` escribe `data-theme` (los 3 temas: light/dark/reading → mapear a `Style.Light`/`Style.Dark`).
- **Botón atrás de Android:** `App.addListener('backButton', ...)` → `history.back()` si hay historial; si no, minimizar/salir. (En el listener nativo de Fase B.)
- **Selección de texto vs. resaltado:** la app tiene selección custom de rangos (`RangeSelectionToolbar`). Verificar en dispositivo que el callout nativo de iOS no compita; ajustar `-webkit-touch-callout`/`user-select` solo si estorba.
- **Íconos y splash:** generarlos con `@capacitor/assets` a partir de un PNG/SVG de alta resolución derivado de `public/favicon.svg` (hoy solo hay favicons chicos; hará falta un master ≥1024px).

### Fase E — Build y distribución
- **Android (en este Linux):** `astro build && cap sync android && cap open android` → generar App Bundle firmado (`.aab`) en Android Studio → subir a Play Console.
- **iOS (necesita macOS):** en una Mac, `cap open ios` → firmar con cuenta de Apple Developer en Xcode → Archive → subir a App Store Connect. Alternativa sin Mac: CI con runner macOS.

Los pasos detallados de publicación están en la sección [Guía de publicación](#guía-de-publicación) más abajo.

---

## Guía de publicación

Publicar es un proceso **aparte del empaquetado**: Capacitor solo genera el proyecto nativo; la publicación se hace en la consola de cada tienda. Esta guía cubre **Google Play** (que se puede hacer desde este Linux) en detalle, y **App Store** de forma resumida (necesita macOS).

### Google Play Store

#### 1. Requisitos previos (una sola vez)
- **Cuenta de Google Play Console**: pago único de **25 USD**. Google exige **verificación de identidad** (documento oficial) y datos de contacto verificados; para cuentas de organización, además un **número D-U-N-S**.
- **Android Studio** instalado (funciona en Linux).
- **Política de privacidad en una URL pública** — **obligatoria** en esta app porque usa **login de Google** y guarda datos del usuario (resaltados en Supabase). Sin esa URL, Google rechaza la ficha. Puede alojarse en el mismo dominio del sitio web.

#### 2. Generar el artefacto firmado (`.aab`)
Play exige **Android App Bundle** (`.aab`), no `.apk`.
1. `pnpm build && npx cap sync android`
2. `npx cap open android` (abre Android Studio).
3. Ajustar la versión en `android/app/build.gradle`:
   - `versionCode` — entero que **debe subir en cada release** (1, 2, 3…).
   - `versionName` — versión visible para el usuario (p. ej. `1.0.0`).
4. **Build → Generate Signed Bundle / APK → Android App Bundle** (o por CLI: `cd android && ./gradlew bundleRelease`).

#### 3. Firma de la app (paso delicado)
- La primera vez creas un **keystore**:
  `keytool -genkey -v -keystore biblia.keystore -alias biblia -keyalg RSA -keysize 2048 -validity 10000`
- **Activar Play App Signing (recomendado):** Google custodia la clave de firma final y tú subes con una *upload key*. Si algún día pierdes tu keystore, no te quedas sin poder actualizar la app.
- ⚠️ **Guarda el keystore y sus contraseñas fuera del repositorio y con backup.** Sin Play App Signing, perder el keystore significa **no poder volver a actualizar** esa app nunca.

#### 4. Crear y completar la ficha en Play Console
- Crear la app: nombre (**Biblia Straubinger**), idioma por defecto, tipo *app*, gratuita.
- **Ficha de tienda (store listing):**
  - Descripción corta y larga.
  - Ícono **512×512** px.
  - Gráfico destacado (feature graphic) **1024×500** px.
  - **Capturas de pantalla:** mínimo 2 de teléfono; recomendable añadir de tablet de 7" y 10".
  - Categoría (p. ej. *Libros y obras de consulta* / *Estilo de vida*).
- **Cuestionarios obligatorios antes de publicar:**
  - **Clasificación de contenido** (cuestionario IARC).
  - **Público objetivo y contenido** (si va o no dirigida a menores).
  - **Seguridad de los datos (Data Safety):** declarar que se recogen **email/identidad** (login Google) y **contenido del usuario** (resaltados/colecciones). Debe coincidir con lo que la app realmente hace.
  - **URL de la política de privacidad.**

#### 5. Subir el `.aab` a un canal (track) y desplegar
Orden habitual: **Internal testing → Closed testing → Open testing → Production.**

> ⚠️ **Requisito reciente clave:** las cuentas de desarrollador **individuales** creadas desde finales de 2023 deben ejecutar un **test cerrado con al menos 12 testers durante 14 días seguidos** antes de poder solicitar acceso a Producción. No es opcional para cuentas personales nuevas. (Las cuentas de organización pueden tener condiciones distintas.)

Recomendado para esta app: subir primero a **Internal testing** y validar ahí el flujo de login por deep link en un `.aab` de **release** (no solo debug).

#### 6. Revisión de Google
Tras enviar a revisión, tarda desde unas horas hasta varios días. Si aprueban, la app queda publicada en el canal elegido.

#### Consideraciones específicas de esta app
- El **login por deep link** (Fase B) debe funcionar en el build de *release*, no solo en debug: probarlo en *Internal testing* antes que nada.
- **`targetSdkVersion`:** Google sube el mínimo requerido cada año; Capacitor 7 ya apunta a un nivel reciente, pero conviene verificarlo antes de subir.
- El **Data Safety form** debe reflejar Supabase (auth Google + resaltados). Mantenerlo sincronizado si cambian los datos que se recogen.

### App Store (iOS) — resumen

Flujo totalmente distinto y **requiere macOS + Xcode**:
1. **Cuenta Apple Developer**: **99 USD/año**.
2. En una Mac: `npx cap open ios` → configurar *Signing & Capabilities* (equipo de desarrollo, bundle id = `appId`).
3. Registrar el bundle id y crear la app en **App Store Connect**.
4. **Product → Archive** en Xcode → subir el build a App Store Connect.
5. Completar ficha: capturas por tamaño de dispositivo, descripción, **política de privacidad** y el cuestionario **App Privacy** (equivalente al Data Safety de Google).
6. Enviar a revisión de Apple (suele ser más estricta que Google).
- Sin Mac: usar un runner **macOS en CI** (GitHub Actions, Codemagic, Ionic Appflow) para el archive y la subida.

---

## Critical files

- **Nuevos:** `capacitor.config.ts` (raíz); `src/lib/nativeAuth.ts` (listeners `appUrlOpen` + `backButton` + init status bar); carpetas nativas `android/` e `ios/` (generadas por `cap add`).
- **Modificados:**
  - `package.json` — deps de Capacitor + scripts de build/sync.
  - `src/lib/supabase.ts` — rama nativa en `signInWithGoogle` (deep link + `skipBrowserRedirect`).
  - `src/layouts/Layout.astro` — `viewport-fit=cover`; cargar la isla `nativeAuth` solo en nativo.
  - `src/styles/global.css` — `100dvh`; utilidades de safe-area si conviene centralizarlas.
  - `src/components/ThemeToggle.astro`, `AuthWidget.astro`, `ChapterNav.astro` — `env(safe-area-inset-*)` en los `position: fixed`; hook de status bar en el toggle de tema.
  - `src/components/HighlightPicker.astro`, `RangeSelectionToolbar.astro` — try/catch en las cargas de Supabase para degradar offline.
- **Config externa (no código):** Supabase Auth Redirect URLs (añadir el esquema deep link).

## Reutilizar lo existente (no reinventar)
- La responsividad, áreas táctiles ~44px, diálogos móviles y `--verse-font-scale` **ya están**: no tocar salvo el safe-area.
- El flujo OAuth PKCE de `src/lib/supabase.ts` se **reutiliza**; solo se añade la rama nativa. `signInWithGoogle` ya es el punto único compartido por `AuthWidget` y el lector.
- El endpoint estático `api/verses/[slug]/[chapter].json.ts` ya sirve offline; no crear caché nuevo para el share-card.

## Verification (end-to-end)
1. **Build:** `pnpm build` genera `dist/` sin errores; `npx cap sync` copia sin warnings de assets faltantes.
2. **Android en dispositivo/emulador:** `cap run android`.
   - Lectura completa: navegar libro → capítulo → prev/next, abrir varios libros. **Activar modo avión** y comprobar que **todo el texto, fuentes y notas siguen disponibles** (offline completo).
   - Login: tocar "Iniciar sesión" → abre navegador del sistema → Google → **vuelve a la app** y queda autenticado (deep link + `exchangeCodeForSession`).
   - Resaltados: con conexión, resaltar un versículo y verlo en "Mis resaltados". En modo avión, abrir un capítulo y confirmar que **el texto no se rompe** aunque la carga de resaltados falle.
   - Nativo: status bar acorde a cada tema; contenido no tapado por notch/status bar; botón atrás de Android navega correctamente.
3. **iOS (en macOS):** repetir 2 en simulador/dispositivo; validar especialmente safe areas (notch/home indicator) y el retorno del deep link OAuth.
4. **Regresión web:** `pnpm dev` — la versión de navegador funciona igual que antes (rama no-nativa intacta).

## Decisiones abiertas (confirmar en implementación)
- `appId` definitivo (propuesto `com.gabrielballesteros.bibliastraubinger`).
- ¿Versionar `android/` e `ios/` en git o gitignorearlas y regenerarlas? (Recomiendo versionarlas para preservar config nativa/firmas de proyecto.)
- Cuenta de Apple Developer + acceso a una Mac/CI macOS para el `.ipa`.
