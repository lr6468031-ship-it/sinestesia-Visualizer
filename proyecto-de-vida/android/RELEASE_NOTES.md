# APK de Proyecto de vida

Paquete independiente `com.proyectodevida.app`, versión y código en `version.json`. Usa Capacitor 7 y Android 6.0 o posterior (API 23), con Android System WebView actualizado (Chromium 105 o posterior). Incluye la aplicación, tema, video, módulos adaptados y licencias. No necesita conexión, cuenta ni permisos de almacenamiento general. La navegación web se mantiene disponible por separado.

## Actualización 1.1.3 en preparación

Las fuentes actuales usan `versionCode` 5. La flama, el plan y la gráfica comparten
el cumplimiento de tareas y hábitos de la fecha seleccionada. Tareas del día
aparece encima de Plan del día. Los hábitos permiten plazos en días o semanas y
muestran su avance acumulado aparte del porcentaje diario de la flama. La publicación 1.1.0 citada a continuación es la anterior; no contiene
esta corrección. Para publicar 1.1.3, compilar y firmar con la clave original,
comprobar el certificado y actualizar los metadatos y archivos de `downloads/`.
No sustituir la firma ni desinstalar la aplicación para aplicar la corrección.

## Instalar y trasladar datos

Descargar `proyecto-de-vida.apk` de la publicación `proyecto-de-vida-v1.1.0` del repositorio. Android puede pedir autorización al navegador para instalar aplicaciones descargadas. Abrir el APK y aceptar la instalación.

El navegador y el APK tienen almacenamientos separados. Para trasladar el progreso existente, abrir **Ajustes y respaldo → Descargar mis datos** en la web; después, **Ajustes y respaldo → Importar un respaldo** en el APK y confirmar. El formato JSON y la clave interna se mantienen; no se importan datos automáticamente ni se borran los de la web. Exportar un respaldo antes de desinstalar o borrar datos de Android.

La importación conserva tareas, hábitos, metas, diario y sesiones registradas. No reanuda un cronómetro en curso del respaldo.

Para actualizar desde 1.0.0, instalar 1.1.0 encima del APK anterior: usa el mismo identificador y certificado, con código de versión 2. No hace falta desinstalar ni trasladar los datos de nuevo.

## Horarios y avisos

En la rutina se elige **Hora de inicio**, **Cómo avisarme** y **Cuándo avisarme**. Para ejercicio a las 14:00: elegir `14:00`, **Sonido de alarma** y **A la hora de inicio**. La duración de la actividad sigue controlando únicamente el cronómetro. En Calendario y Ajustes se pueden activar las notificaciones y permitir los horarios precisos. El canal de alarma utiliza el sonido de alarma del teléfono mediante una notificación de prioridad alta; el canal normal usa el sonido de notificación.

Se guarda el plan en SharedPreferences privado y se usa una sola alarma del sistema para la próxima hora, aunque haya varias rutinas. El receptor entrega los avisos coincidentes, impide duplicados y vuelve a programar la siguiente fecha. Usa días y horas locales, con ajustes del calendario para el horario de verano, sin repetir cada 24 horas en milisegundos. Los receptores recuperan el plan al reiniciar, cambiar fecha/zona horaria y actualizar el APK. Completar o eliminar una ocurrencia cancela ese día; el resto de la repetición se mantiene. Desactivar el recordatorio o detener una serie cancela los avisos correspondientes.

Android 13 o posterior requiere permiso de notificaciones. Android 12 o posterior puede requerir autorización de alarmas exactas; al no tenerla se usa `setAndAllowWhileIdle` y la interfaz informa que Android puede retrasar la hora. No se solicita acceso a calendario, contactos ni archivos generales. La reproducción respeta los canales de notificación, volumen y No molestar del sistema. Detener la aplicación mediante **Forzar detención** impide que Android entregue avisos hasta volver a abrirla.

La exportación del APK abre el selector de archivos de Android (`ACTION_CREATE_DOCUMENT`); permite elegir dónde guardar el JSON y no solicita acceso a todos los archivos. Cancelar no muestra una confirmación falsa de guardado. La importación usa el selector de archivos existente. El botón Atrás cierra el diálogo, vuelve a Hoy desde otras secciones y minimiza la aplicación desde Hoy.

El cronómetro conserva la hora de finalización: al volver después de suspender o cerrar la aplicación calcula el tiempo real transcurrido y registra la sesión una vez. Los recordatorios de inicio de las rutinas se programan por separado con AlarmManager y pueden avisar con la aplicación cerrada. El cronómetro no añade una alarma de finalización de sesión.

## Compilar

Requiere Node.js 22, Java 21, SDK de Android 35 y build-tools 35.0.0. Desde la raíz del repositorio:

```sh
npm ci
node --test proyecto-de-vida/tests/*.test.mjs
npm run build:life:android
cd .cache/life-android/android
./gradlew testDebugUnitTest assembleRelease --no-daemon
```

El proyecto se genera en `.cache/life-android/`, con configuración propia; el APK sin firmar está en `android/app/build/outputs/apk/release/app-release-unsigned.apk` dentro de esa carpeta. No descarga ni incluye los modelos de audio del visualizador. `build-info.json` dentro de los archivos del APK registra versión y revisión de las fuentes.

Los tests Robolectric ejercitan programación sin Activity ni WebView, reinicio, duplicados, permisos exactos de Android 13, canales de sonido, cancelación y cambios de rutina. `tests/ReminderTimeTest.java` también puede ejecutarse como una prueba JVM independiente para fechas locales, cambio de horario de verano y anticipos que cruzan medianoche. La validación se realiza en JVM y Chromium; no sustituye una prueba en un teléfono físico y sus ajustes de batería.

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
