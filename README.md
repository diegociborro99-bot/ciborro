# Escritorio

Un portfolio con forma de sistema operativo: arranque, fondo vivo, escritorio
limpio, ventanas que se arrastran, anclan y redimensionan, dock con
magnificación, buscador general, consola con árbol de archivos, galería con
visor, reproductor, reloj mundial, un gato que persigue el cursor y un
minijuego.

Y detrás, lo que hace falta para que sea tu sitio de verdad: una API, una base
de datos, un panel para subir fotos y una cadena de imagen pensada para
originales en 4K.

```
frontend/   React + Vite + Tailwind v4 — el escritorio
backend/    Fastify + Postgres (Drizzle) + Cloudflare R2 — API, panel y fotos
Dockerfile  compila el frontend y lo sirve junto con la API: un solo servicio
```

---

## Lo importante: las fotos

Un JPEG de 4K son 8–15 MB. Servirlo tal cual para pintar una miniatura de 200
píxeles es lo que hace que un portfolio de fotos vaya lento y cueste dinero.
Aquí no pasa por ningún lado:

- **Al subir**, de cada original salen versiones a **400, 800, 1280, 1920, 2560
  y 3840 px** en **AVIF, WebP y JPEG** — 18 archivos por foto. Nunca se agranda:
  si el original tiene 3000 px, el de 3840 no se genera.
- **Al mirar**, el navegador recibe un `<picture>` con `srcset` y `sizes` y coge
  el formato que entiende y el ancho que necesita. Una miniatura de la rejilla
  pide el de 400; el visor, el de 1920 o 2560. Medido: la rejilla descarga
  ~15 KB por foto donde el original pesaba 9 MB.
- **Mientras carga**, se ve un **LQIP**: la misma foto a 24 px en base64 dentro
  del JSON. No es una petición, aparece con la página, y se disuelve cuando
  entra la buena. El hueco está reservado con `aspect-ratio`, así que la página
  no da saltos.
- **En el visor**, la anterior y la siguiente se van cargando por detrás en
  cuanto el navegador está ocioso, para que pasar de una a otra sea instantáneo.
- **Los archivos no los sirve Node**: viven en Cloudflare R2 y salen por su CDN
  con un año de caché. R2 no cobra la salida de datos, que es justo lo que
  dispara la factura cuando sirves fotos grandes.

---

## Desplegar en Railway

### 1. Cloudflare R2

1. Panel de Cloudflare → **R2** → **Create bucket**. Llámalo, por ejemplo,
   `escritorio-fotos`.
2. En el bucket → **Settings** → **Public access**: actívalo. Te da un dominio
   `…r2.dev`, o conecta un subdominio tuyo (`fotos.tudominio.com`), que es mejor.
3. **R2** → **Manage API tokens** → **Create API token**, permiso *Object Read &
   Write* sobre ese bucket. Apunta el **Access Key ID** y el **Secret**.
4. El **Account ID** está en la barra lateral del panel de R2.

### 2. El servicio

1. Sube este repo a GitHub. El remoto ya está puesto
   (`diegociborro99-bot/ciborro`), así que basta con crearlo y empujar:

   ```bash
   gh repo create diegociborro99-bot/ciborro --private   # si no existe todavía
   git push -u origin main
   ```
2. Railway → **New Project** → **Deploy from GitHub repo** → elige el repo.
   Detecta el `Dockerfile` y no hay que configurar build.
3. En el proyecto: **+ New** → **Database** → **Add PostgreSQL**.
4. En el servicio web → **Variables**:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `ADMIN_PASSWORD` | la contraseña con la que subirás fotos |
   | `JWT_SECRET` | `openssl rand -base64 48` |
   | `R2_ACCOUNT_ID` | de Cloudflare |
   | `R2_ACCESS_KEY_ID` | del token |
   | `R2_SECRET_ACCESS_KEY` | del token |
   | `R2_BUCKET` | `escritorio-fotos` |
   | `R2_PUBLIC_URL` | `https://fotos.tudominio.com` (sin barra final) |
   | `MAX_UPLOAD_MB` | `60` (opcional) |

5. **Settings** → **Networking** → **Generate Domain**, o pon el tuyo.

Las tablas se crean solas al arrancar; no hay paso de migración manual. El
`healthcheck` apunta a `/api/health`, así que Railway reinicia el contenedor si
deja de responder.

### 3. Tus fotos

Entra en **`https://tu-sitio/admin`** con `ADMIN_PASSWORD` y arrástralas ahí.
Van de una en una: convertir un 4K a AVIF consume CPU y lanzarlas todas a la vez
sólo consigue tumbar un contenedor pequeño. Cuenta ~5–10 s por foto.

Si son muchas, desde tu máquina:

```bash
ADMIN_PASSWORD=… SITE=https://tu-sitio.up.railway.app \
  node backend/scripts/import-folder.js ~/Fotos/seleccion
```

En el panel se editan título, sitio y año, se reordena la galería arrastrando
las tarjetas, y se borran las fichas de ejemplo de un botón.

> **Sin R2.** Si no pones las claves, las fotos van al disco del servidor y las
> sirve Node en `/fotos`. Vale para desarrollo. En Railway el disco se borra en
> cada despliegue salvo que montes un volumen y apuntes `STORAGE_DIR` ahí.

---

## En local

```bash
docker compose up -d                     # Postgres en el 5432
cp .env.example backend/.env             # y rellena lo que quieras
npm run install:all
npm run db:migrate                       # crea las tablas
npm run db:seed                          # contenido de ejemplo (opcional)
npm run dev                              # API + panel  → :3000
npm run dev:web                          # el escritorio → :5173
```

`npm run build` compila el frontend y lo deja en `backend/public`, que es de
donde lo sirve el servidor; `npm start` levanta el conjunto en un solo puerto.

**Sin backend también funciona.** `cd frontend && npm run build` genera un
`dist/` estático que puedes subir a Vercel, Netlify o GitHub Pages: si no hay
API, el sitio tira del contenido de `frontend/src/data/content.js`. Con
`SINGLE_FILE=1 npm run build` sale un único `index.html` autocontenido.

---

## Poner tu contenido

Lo que **no** son fotos vive en **`frontend/src/data/content.js`**: nombre, bio,
enlaces, proyectos, pistas del reproductor y relojes de la barra. Si hay base de
datos, lo que esté en ella manda y este archivo queda de red de seguridad (y de
contenido inicial, con `npm run db:seed`).

- **Saludo manuscrito**: `owner.greeting`. Están dibujadas las letras de "hola";
  con cualquier otra palabra se usa una rúbrica genérica. Para dibujar otra,
  añade sus trazos a `WORDS` en `frontend/src/components/Handwriting.jsx`
  (caja 340×200, línea base y=150, altura de x y=92, altura de asta y=34).
- **Fotos sin backend**: copia los archivos en `frontend/public/photos/` y pon
  `src: '/photos/tu-archivo.jpg'`. Mientras no haya `src` se dibuja un marcador
  generado por código, así que el sitio nunca se ve roto. `ratio` es alto/ancho:
  1 cuadrada, 1.25 vertical, 0.66 apaisada.

---

## Qué sabe hacer el escritorio

**Escritorio** — arranque con la firma escribiéndose (una vez por sesión, se
salta pulsando), fondo con manchas de color a la deriva y una luz que sigue al
cursor, menú contextual con el botón derecho. El escritorio arranca **vacío**:
no hay iconos sueltos, todo se abre desde el dock.

**Ventanas** — arrastrar por la barra de título; soltar en el borde izquierdo o
derecho las ancla a media pantalla y arriba las maximiza, con guía previa;
redimensionado por los ocho lados y esquinas; minimizar se encoge hacia su icono
del dock; y la disposición se guarda entre visitas.

**Galería** — columnas que se recomponen con el ancho real de la ventana,
filtros por año y por sitio, y visor con zoom, arrastre, gesto lateral, ficha de
la foto, pase de diapositivas y tira de miniaturas.

**Consola** — un árbol de archivos de verdad construido desde tu contenido, que
se recorre con `ls`, `cd`, `pwd`, `cat`, `find` y `abrir`. `cat` sobre una foto
dibuja su miniatura con bloques de color. Tab completa comandos y rutas, la
sugerencia en gris se acepta con `→`, y hay historial con las flechas.

**Buscador (⌘K o `/`)** — fotos, apps, proyectos, enlaces y acciones en un solo
sitio, con coincidencia sin tildes y navegación por teclado.

**Vista general (`F`)** — reparte las ventanas abiertas en rejilla; al elegir una
vuelven exactamente a donde estaban. No se les cambia el tamaño, se escalan, así
que el contenido no se recompone.

**Juego** — los gatos se comportan como una manada (separación, alineación y
cohesión): empujando por un lado se mueven juntos, persiguiéndolos se
desparraman. Dentro de la alfombra se acomodan, y al rato se aburren y se van.
Rondas con más gatos y muebles que estorban, y mejor tiempo guardado.

**Enlaces** — la URL refleja lo que tienes delante: `#fotos/5` abre el visor en
esa foto, `#consola` abre la consola.

**En móvil** — el dock se encoge para caber entero. Un toque en el fondo manda al
gato hacia ese punto, y en el minijuego el toque funciona como una palmada.

**Atajos** — `⌘K` · `/` buscar — `F` vista general — `?` chuleta — `1`–`7` abrir
u ocultar cada app — `⌘W` cerrar la de delante — `← →` moverse entre fotos —
`+ − 0` zoom — `I` ficha — `espacio` pase — `Esc` salir.

**Tema** — claro y oscuro desde la barra superior, el menú contextual, la consola
o el buscador; se guarda en `localStorage` y por defecto sigue al sistema. Los
colores son variables CSS en `frontend/src/index.css` — cambiando `--accent`
cambia todo el sitio.

---

## Estructura

```
frontend/src/
  App.jsx                 escritorio, atajos, menús, buscador y montaje
  data/content.js         TU CONTENIDO (respaldo si no hay API)
  lib/content.jsx         pide /api/content y cae al archivo de arriba si no hay
  hooks/
    usePointerDrag.js     arrastre con Pointer Events (ratón, dedo, lápiz)
    useWindows.js         ventanas: foco, anclaje, memoria de posición
  components/
    Window.jsx            marco, barra de título, redimensionado 8 lados
    Photo.jsx             <picture> con AVIF/WebP/JPEG, srcset y desenfoque previo
    MenuBar.jsx  Dock.jsx  ContextMenu.jsx
    CommandPalette.jsx  Toasts.jsx  Shortcuts.jsx  Wallpaper.jsx  Boot.jsx
    WorldClock.jsx        reloj mundial (Intl, sin dependencias)
    Cat.jsx               oneko: mascota que persigue el cursor
    Handwriting.jsx       firma que se dibuja sola
  apps/
    Gallery.jsx  About.jsx  Projects.jsx  Notes.jsx
    Player.jsx            aparato con pantalla LCD y rueda giratoria
    HerdGame.jsx          minijuego de pastorear gatos
    Terminal.jsx          consola con árbol de archivos

backend/src/
  server.js               un servicio: API + panel + la web compilada
  db/schema.js            fotos, versiones, proyectos, pistas, ajustes
  db/migrate.js           crea el esquema al arrancar (idempotente)
  lib/images.js           sharp: variantes, LQIP, orientación EXIF
  lib/storage.js          R2 si hay claves, disco si no
  routes/content.js       GET /api/content — todo el sitio en una petición
  routes/admin.js         sesión, subida, edición, borrado, orden
  admin/index.html        el panel, una página suelta fuera del bundle público
  scripts/seed.js         siembra content.js en la base
  scripts/import-folder.js  sube una carpeta entera al sitio desplegado
```

---

## Antes de subirlo a GitHub

`.gitignore` deja fuera `node_modules/`, `dist/`, `backend/public/`, `backend/data/`
y **cualquier `.env`** — sólo viaja `.env.example`. Las contraseñas y las claves
de R2 viven en las variables de Railway, nunca en el repo. Si alguna vez llegas a
subir una por error, no basta con borrarla en un commit posterior: hay que rotarla
en Cloudflare y cambiar `ADMIN_PASSWORD` y `JWT_SECRET`.

Hay CI en `.github/workflows/ci.yml`: en cada push compila el escritorio, revisa
que el servidor parsea y construye la imagen de Docker. Si el build de Docker
falla ahí, fallará también en Railway — mejor enterarse antes.

## Créditos y licencias

Este repositorio no lleva licencia: **todos los derechos reservados**. El código
es de Diego y las fotos, más todavía. Que se pueda leer no quiere decir que se
pueda reutilizar.

El gestor de ventanas, el dock, el buscador, la consola, el reloj, el
reproductor, el juego, la galería y la firma manuscrita están escritos a mano en
este repo, sin librerías de animación ni de arrastre.

El gato es **oneko**: el sprite (`frontend/src/assets/oneko.gif`), el reparto de
fotogramas y la máquina de estados vienen de
[oneko.js](https://github.com/adryd325/oneko.js) de adryd, bajo licencia MIT — el
texto está en `frontend/src/assets/oneko-LICENSE.txt` y tiene que viajar con el
código. A su vez es un port del *neko* japonés de 1989.

## Accesibilidad

Todo lo interactivo es un elemento nativo con `aria-label`, el foco de teclado se
ve, y `prefers-reduced-motion` desactiva las animaciones.
