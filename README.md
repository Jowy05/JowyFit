# JowyFit

**JowyFit es una app de fitness gratuita** para entrenar fuerza, apuntar lo que comes y ver cómo cambia tu cuerpo. Sin cuentas, sin anuncios y sin servidores: todo se queda en tu móvil. En castellano, català e English.

- **Web y demo:** https://jowy05.github.io/JowyFit/
- **Android (APK):** https://github.com/Jowy05/JowyFit/releases/latest/download/JowyFit.apk
- **iPhone y iPad:** abre la web en Safari y elige «Añadir a pantalla de inicio».

## ¿Puedo usarla, copiarla o cambiarla?

Sí. Cualquiera puede usar JowyFit, copiar su código y modificarlo, **siempre que diga quién la hizo**: hay que dejar el aviso de autoría (Joel, Jowy05) y el enlace a este repositorio. Lo que **no se puede es venderla** ni usarla para ganar dinero. Así lo dice la licencia [PolyForm Noncommercial 1.0.0](LICENSE).

El código está en las ramas [`prod`](https://github.com/Jowy05/JowyFit/tree/prod) (lo publicado) y [`Studio`](https://github.com/Jowy05/JowyFit/tree/Studio) (en lo que se trabaja).

---

## Cómo está hecho (para programadores)

App de entrenamiento de fuerza, comida aproximada y seguimiento del cuerpo. Todo se queda en el móvil: sin cuentas ni servidores.

- **React 19 + TypeScript estricto + Vite.** Sin librería de estado: la base de datos local es la fuente de verdad.
- **Dexie (IndexedDB)** para los datos; las pantallas se actualizan solas con `useLiveQuery`.
- **Capacitor** para el APK de Android (Health Connect, notificaciones, escáner ML Kit, archivos en Documentos).
- **PWA** para iPhone, iPad y ordenador (se instala desde Safari y funciona sin conexión).
- **pdf-lib** para el informe en PDF, **fflate** para las copias de seguridad.

### Ponerla en marcha

```bash
npm i
npm run repdb          # descarga el catálogo de ejercicios de RepDB (no va en el repositorio)
npm run dev            # servidor de desarrollo: la app está en /app.html
npm run build          # comprueba los tipos y compila la web en dist/
```

APK de Android (necesita el SDK de Android y el JDK 21):

```bash
npm run build:android  # compila solo la app, con app.html como index.html (no vale npm run build)
npx cap sync android   # (o las dos cosas de una vez: npm run android)
cd android
./gradlew assembleRelease   # con JAVA_HOME apuntando al JDK 21
```

La firma sale de `android/keystore.properties`, que no está en el repositorio. Sin él, `./gradlew assembleDebug` saca un APK de pruebas. La versión del APK es la de `package.json`.

### Las tres páginas

| Página | Qué es |
|---|---|
| `index.html` | La landing (`src/landing/`). Un script en el `<head>` manda directamente a la app si ya está instalada. |
| `app.html` | La app (`src/main.tsx`). |
| `Demo.html` | La demo guiada con capturas (`src/demo/`). |

### Mapa de `src/`

| Carpeta | Qué hay |
|---|---|
| `app/` | Armazón: arranque, navegación (`nav.tsx`), qué componente pinta cada pantalla (`rutas.tsx`) y tareas de fondo (`servicios.ts`). |
| `pantallas/<pestaña>/` | Las pantallas y hojas de cada pestaña (inicio, rutina, entreno, comida, progreso, perfil, alta, instalar). |
| `ui/` | Componentes compartidos, avisos, gráficas, tema, tutorial y todo el CSS (`ui/estilos/`). |
| `datos/` | La base (`db.ts`, `tipos.ts`), lecturas (`consultas.ts`, `hooks.ts`, `repos.ts`), escrituras (`acciones/`), copias y su validación. |
| `dominio/` | Lógica pura sin React ni base: generador de rutinas, progresión, tendencias, comida, energía, fechas y formatos. |
| `informe/` | Informe en PDF: `calculo/` saca los números y textos, `pdf/` solo los dibuja. |
| `plataforma/` | Lo que cambia entre Android y la web (`capacidades()`, avisos, Health Connect, escáner, archivos). Se importa siempre desde su `index.ts`. |
| `catalogo/` | Catálogo de ejercicios de RepDB: carga, búsqueda, nombres y clasificación. |
| `i18n/` | Idiomas de la app: `t()` y los diccionarios de catalán e inglés. |
| `landing/`, `demo/` | La landing y la demo, sin React, con sus propios textos e idiomas. |

Lo leído de la base sale como `Guardado<T>` (`src/datos/tipos.ts`): el `id` que Dexie tipa opcional ya está, así que las rutas llevan `id: number` sin comprobarlo otra vez.

Dos reglas que comprueba `tests/capas.test.ts`: las pantallas, `ui/` y `app/` nunca importan `datos/db` (leen con `datos/consultas` o `datos/hooks` y escriben con `datos/acciones`), y no preguntan en qué plataforma están: preguntan qué se puede hacer con `capacidades()`.

Los códigos de los comentarios (`// INI-01`, `// SES-04`, «§5 del diseño»…) son los de los documentos de diseño originales, que no están en el repositorio.

### Recetas

**Una pantalla nueva**
1. Su código y sus datos en `Rutas` (`src/app/nav.tsx`). El código se llama como el componente (`'fin-entreno'` → `FinEntreno`) y el de las hojas inferiores empieza por `hoja-` (`'hoja-empezar'` → `HojaEmpezar`). Las pestañas (`ini`, `rut`, `com`, `pro`, `per`) son otra cosa: `RAIZ` dice qué pantalla abre cada una.
2. Su componente en `PANTALLAS` u `HOJAS` de `src/app/rutas.tsx`, cargado con `perezosa(() => import(...))`.
3. Su CSS en `src/ui/estilos/pantallas/<pestaña>.css` (o uno nuevo, importado en `src/main.tsx` en su sitio: el orden de la cascada importa).
4. Sus textos con `t()` y sus traducciones en la zona de la pestaña (`src/i18n/{ca,en}/<zona>.ts`).

**Un campo nuevo en la base**
1. El campo en su tipo de `src/datos/tipos.ts`.
2. Si hay que buscar por él, una versión nueva de Dexie en `src/datos/db.ts` con el índice (las versiones viejas se quedan).
3. Su regla en `src/datos/validarCopia.ts`: al recuperar una copia, los campos que no conoce se quitan.
4. El campo relleno en `tests/copias-completa.test.ts` (los tipos `Required<…>` no compilan hasta que está).

**Un texto nuevo**: ver «Idiomas», justo abajo.

**Pasar las pruebas**

| Orden | Qué prueba |
|---|---|
| `npm test` | Unitarias (vitest): dominio, consultas y acciones de la base, copias y su seguridad, informe (cálculo y PDF), plataforma (web, iPhone y nativa simulada), navegación, tutorial, capas y la cobertura de idiomas. |
| `npm run typecheck` | Solo los tipos. |
| `npm run e2e` | La app compilada (antes, `npm run build`) usada como una persona en Edge o Chrome sin ventana: alta, entreno, comida, progreso, copias, idiomas, sin conexión… (`npm run e2e:dev`, contra el servidor de desarrollo). |
| `npm run e2e:iphone` | La app en WebKit (el motor de Safari) con pantalla de iPhone, con Playwright. |
| `npm run e2e:landing` | La landing y la demo: el botón correcto según el navegador, idiomas, sin errores ni desbordes. |
| `node scripts/e2e/seguridad.mjs` | La política de seguridad (CSP), la pantalla de rescate y copias de ataque. Necesita una copia de datos propia en `.cache/`. |

Un escenario suelto: `node scripts/e2e/correr.mjs --build entreno` (los que contengan «entreno»). `correr.mjs` arranca el servidor y el navegador y pasa los escenarios; cada zona tiene los suyos en `scripts/e2e/escenarios/` y lo que comparten (pulsar, ver, alta, leer la base…) está en `scripts/e2e/ayudantes.mjs`.

Las unitarias de `dominio/` e `informe/` se llaman como el módulo que prueban (`tests/tendencias.test.ts` → `src/dominio/tendencias.ts`, `tests/informe-dia.test.ts` → `src/informe/calculo/dia.ts`); los datos de ejemplo del informe están en `tests/informe-ejemplo.ts`.

### Idiomas

La app sale en castellano (el original, por defecto), catalán e inglés; se elige en Ajustes → Apariencia → Idioma. Va al estilo gettext: **la clave es el texto en castellano exacto**, que se queda en el código; el catalán y el inglés son diccionarios por zona en `src/i18n/{ca,en}/<zona>.ts` (comun, inicio, entreno, rutina, comida, progreso, perfil, informe) que se cargan antes de pintar.

- `t('Faltan {n} g', { n: num(falta) })`: la frase entera con sus `{variables}`, nunca trozos pegados ni `t(\`…${x}…\`)`. Los números se pasan ya formateados (`num`, `kg`, `miles`).
- `tn(n, '{n} serie', '{n} series')` para plurales; `tc('máquina', 'Ocupado')` si el mismo castellano se traduce distinto según dónde sale (clave `máquina|Ocupado`); `tr('Toca <b>Hecho</b>', { b: s => <b>{s}</b> })` (`src/i18n/jsx.tsx`) para frases con negritas o iconos.
- `tk('Pecho')` en listas y constantes del nivel del módulo (se evalúan antes de cargar el idioma): solo marca el texto, y se traduce al pintarlo con `t(x)`.
- Las funciones de `dominio/` también llaman a `t()` a propósito: con gettext el texto ya sale traducido de donde se escribe, sin pasar claves por las pantallas.
- `tests/i18n-cobertura.test.ts` es estricta: falla si un texto no está en catalán o en inglés, si sobra una clave, si una traducción cambia las `{variables}` o si un `.tsx` pinta castellano sin `t()`.

Tono: de tú, frases cortas y palabras de la calle (la usan personas que no saben de gimnasios). Catalán del IEC, variante central; inglés de EE. UU., sencillo. Comillas « » en castellano y catalán, “ ” en inglés. Lo que sale en pantalla se llama igual en todas partes (app, landing y demo):

| Castellano | Català | English |
|---|---|---|
| Entreno · Serie · Descanso | Entrenament · Sèrie · Descans | Workout · Set · Rest |
| Hoy te toca · Hecho · Saltar | Avui et toca · Fet · Saltar | Today's workout · Done · Skip |
| Ajustes · Copia de seguridad | Configuració · Còpia de seguretat | Settings · Backup |
| Semana suave · Récord · ¿Voy bien? | Setmana suau · Rècord · Vaig bé? | Easy week · Personal best (PB) · Am I on track? |
| Pendientes de hoy · Picoteo | Pendents d'avui · Pica-pica | Today's to-dos · Snacks |

No se traducen: JowyFit, Health Connect, Open Food Facts, RepDB, Safari, App Store, Google Play y los nombres de librerías y licencias.

## Créditos

Exercise data by [RepDB](https://repdb.co) (repdb.co) — free tier. The dataset is not redistributed in this repository.

## Licencias

- El **código** de esta app tiene licencia PolyForm Noncommercial 1.0.0 (ver `LICENSE`): úsalo, cópialo y cámbialo dando crédito, pero sin venderlo.
- Los **datos de ejercicios** son de RepDB (plan gratuito) y tienen su propia licencia: no se incluyen en el repositorio; se descargan al compilar con `npm run repdb`, y quien compile la app acepta la licencia de RepDB.
- Los **datos de alimentos** se consultan en Open Food Facts (licencia ODbL).
- Fuentes Barlow y JetBrains Mono (SIL OFL 1.1), iconos Phosphor (MIT) y el resto de librerías con sus licencias (ver Créditos dentro de la app).
