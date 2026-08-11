# SEÑAL para Android TV — App by Allan

Misma app que la versión LG, empaquetada para Android TV. La interfaz es
**exactamente el mismo HTML/CSS/JS**; lo único que cambia es quién decodifica
el video.

## Por qué híbrida y no WebView pelado

El WebView de Android **no reproduce HLS**. En webOS el `<video>` traga `.m3u8`
nativo y por eso la versión LG no tiene dependencias. En Android, un WebView
solo se quedaría en negro con todos los canales.

Se podría meter `hls.js`, pero eso decodifica por software sobre MSE y en un
TV box barato 1080p se entrecorta. Así que:

```
┌─────────────────────────────────┐
│  WebView  (fondo transparente)  │  ← carrusel, ficha, estados
├─────────────────────────────────┤
│  PlayerView / ExoPlayer         │  ← video, decodificación por hardware
└─────────────────────────────────┘
```

El WebView va **encima** con fondo transparente, así la ficha del canal flota
sobre el video real y no hay que reescribir nada de la UI en Kotlin. Cuando
`app.js` detecta `window.Android`, deja de usar el `<video>` y le pasa la URL
a ExoPlayer. En el LG esa rama simplemente no existe.

## Compilar

1. Abre la carpeta `atv/` en Android Studio (Ladybug o superior).
2. Deja que sincronice Gradle. Puede que te pida actualizar AGP o Kotlin —
   acepta; las versiones fijadas aquí son un punto de partida, no un dogma.
3. `Build → Build Bundle(s)/APK(s) → Build APK(s)`.
4. El APK sale en `app/build/outputs/apk/debug/app-debug.apk`.

## Instalar en el TV box

**A diferencia de webOS, aquí el pendrive sí funciona.** Android TV permite
instalar APKs desde almacenamiento externo.

**Opción pendrive:**
1. Copia el APK a un pendrive, conéctalo al TV box.
2. Instala un explorador de archivos desde Play Store (X-plore, File Commander).
3. Ajustes → Apps → Seguridad → permite instalar apps desconocidas para ese
   explorador.
4. Abre el APK desde el explorador.

**Opción ADB** (más cómoda si vas a iterar):
```bash
# Activa Depuración USB en Ajustes → Sistema → Acerca de → pulsa 7 veces en
# "Compilación", luego Opciones de desarrollador → Depuración por ADB
adb connect 192.168.1.XX:5555
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Control remoto

El D-pad de Android llega al WebView como flechas normales (keyCode 37-40) y
el centro como Enter, así que toda la navegación del carrusel funciona sin
tocar una línea. La única tecla que hay que puentear a mano es ATRÁS:
`KEYCODE_BACK` no llega al WebView, se intercepta en `onKeyDown` y se reenvía
a `window.SENAL.back()`.

| Tecla | Explorador | Reproduciendo |
|---|---|---|
| ◀ ▶ | Canal | Canal |
| ▲ ▼ | Categoría | Canal |
| OK | Ver | Muestra la ficha |
| ATRÁS | Cierra la app | Vuelve al explorador |

## Mantener las dos versiones sincronizadas

Los assets web están duplicados en `app/src/main/assets/web/`. Para no editar
en dos partes:

```bash
cp -r ../senal/index.html ../senal/css ../senal/js ../senal/img \
      app/src/main/assets/web/
```

O mejor, un symlink en tu repo. La lista de canales se regenera igual con
`tools/build.py` del proyecto LG y se copia acá.

## Detalles que importan

**`usesCleartextTraffic="true"`** está activado porque algunas señales sirven
por HTTP plano. Si acotas la lista a solo HTTPS, quítalo.

**`LEANBACK_LAUNCHER`** en el intent-filter y el `banner` de 320×180 son
obligatorios: sin eso la app se instala pero no aparece en la grilla de
Android TV.

**El foco vive siempre en el WebView.** El `PlayerView` está marcado
`isFocusable = false` a propósito; si le dieras foco, el D-pad dejaría de
llegar a la UI web y la navegación por canales se rompería.

**Errores de reproducción:** ExoPlayer reporta el `errorCodeName` real
(`ERROR_CODE_IO_BAD_HTTP_STATUS`, `ERROR_CODE_DECODING_FAILED`, etc.) y se
muestra en pantalla. Cuando un CDN se caiga vas a saber si fue red, códec o
un 403, en vez de un "algo falló" genérico.

**Media3 1.4.1** es la versión fijada. Android Studio te va a sugerir una más
nueva; subirla es seguro, la API de `ExoPlayer.Builder` y `MediaItem` no ha
cambiado.
