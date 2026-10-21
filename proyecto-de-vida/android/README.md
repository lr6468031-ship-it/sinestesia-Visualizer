# APK de Proyecto de vida

Paquete independiente `com.proyectodevida.app`, versión y código en `version.json`. Usa Capacitor 7 y Android 6.0 o posterior (API 23), con Android System WebView actualizado (Chromium 105 o posterior). Incluye la aplicación, tema, video, módulos adaptados y licencias. No necesita conexión, cuenta ni permisos de almacenamiento general. La navegación web se mantiene disponible por separado.

## Instalar y trasladar datos

Descargar `proyecto-de-vida.apk` de la publicación `proyecto-de-vida-v1.0.0` del repositorio. Android puede pedir autorización al navegador para instalar aplicaciones descargadas. Abrir el APK y aceptar la instalación.

El navegador y el APK tienen almacenamientos separados. Para trasladar el progreso existente, abrir **Ajustes y respaldo → Descargar mis datos** en la web; después, **Ajustes y respaldo → Importar un respaldo** en el APK y confirmar. El formato JSON y la clave interna se mantienen; no se importan datos automáticamente ni se borran los de la web. Exportar un respaldo antes de desinstalar o borrar datos de Android.

La importación conserva tareas, hábitos, metas, diario y sesiones registradas. No reanuda un cronómetro en curso del respaldo.

La exportación del APK abre el selector de archivos de Android (`ACTION_CREATE_DOCUMENT`); permite elegir dónde guardar el JSON y no solicita acceso a todos los archivos. Cancelar no muestra una confirmación falsa de guardado. La importación usa el selector de archivos existente. El botón Atrás cierra el diálogo, vuelve a Hoy desde otras secciones y minimiza la aplicación desde Hoy.

El cronómetro conserva la hora de finalización: al volver después de suspender o cerrar la aplicación calcula el tiempo real transcurrido y registra la sesión una vez. Esta versión no añade servicio de ejecución continua, notificación ni alarma con la aplicación cerrada.

## Compilar

Requiere Node.js 22, Java 21, SDK de Android 35 y build-tools 35.0.0. Desde la raíz del repositorio:

```sh
npm ci
node --test proyecto-de-vida/tests/*.test.mjs
npm run build:life:android
cd .cache/life-android/android
./gradlew assembleRelease --no-daemon
```

El proyecto se genera en `.cache/life-android/`, con configuración propia; el APK sin firmar está en `android/app/build/outputs/apk/release/app-release-unsigned.apk` dentro de esa carpeta. No descarga ni incluye los modelos de audio del visualizador. `build-info.json` dentro de los archivos del APK registra versión y revisión de las fuentes.

Firmar con `zipalign` y `apksigner` del SDK. Las contraseñas se leen de archivos privados, sin incluirlas en argumentos ni en el repositorio:

```sh
cd app/build/outputs/apk/release
"$ANDROID_HOME/build-tools/35.0.0/zipalign" -P 16 -f 4 app-release-unsigned.apk proyecto-de-vida-aligned.apk
"$ANDROID_HOME/build-tools/35.0.0/apksigner" sign \
  --ks "$LIFE_KEYSTORE" --ks-key-alias proyecto-de-vida \
  --ks-pass "file:$LIFE_STOREPASS_FILE" \
  --out proyecto-de-vida.apk proyecto-de-vida-aligned.apk
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose --print-certs proyecto-de-vida.apk
```

La clave de la primera publicación se conserva fuera del repositorio en `/workspace/proyecto-de-vida-private-signing/`. El responsable de las publicaciones debe guardar una copia privada tanto del almacén de claves como de su contraseña. Nunca subirlos al repositorio ni a los artefactos públicos. Las actualizaciones deben usar la misma clave, el mismo identificador y un `versionCode` mayor para conservar los datos al instalar encima.

## Publicar

`downloads/proyecto-de-vida.apk`, su SHA-256 y `downloads/proyecto-de-vida-release.json` contienen el binario firmado, la revisión exacta de las fuentes y el certificado público. El flujo `Publish Proyecto de vida APK` verifica integridad, firma, identidad, versión y procedencia antes de crear una publicación de GitHub con descarga directa. El flujo nunca contiene ni genera la clave privada.

Las fuentes completas, incluida la integración de Android, se encuentran en este repositorio. Se conservan los créditos y las licencias en el APK y la licencia AGPL-3.0 de la aplicación.
