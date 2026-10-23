# Proyecto de vida: continuidad de las actualizaciones

Estas instrucciones se aplican al subproyecto `proyecto-de-vida/`, sus scripts
Android y sus descargas. El visualizador Sinestesia es otro producto del repositorio.

El usuario pidió conservar la versión de la flama y que los siguientes cambios de
diseño o funcionamiento se instalen encima de la aplicación ya entregada, sin
desinstalar ni perder registros. La base entregada es **1.1.3 · Prueba**, código 5,
en la rama `fix/flama-habitos-y-tareas`. No volver a entregar como actualización el
APK original 1.1.0 de `downloads/proyecto-de-vida.apk`.

- Mantener `com.proyectodevida.app.preview` y el certificado fijado en
  `.github/life-preview-channel.json`. Incrementar `proyecto-de-vida/android/version.json`
  para cada actualización entregada. Comparar también con el último APK publicado.
- Conservar `proyecto-de-vida-v1` y la compatibilidad de los registros existentes.
  No borrar datos ni recomendar desinstalar como procedimiento de actualización.
- La firma de esta aplicación está fuera del repositorio, en
  `/workspace/proyecto-de-vida-preview-private-signing/` en el entorno actual.
  Los scripts aceptan también rutas privadas mediante `LIFE_PREVIEW_*`.
  **Nunca publicar almacenes de claves, contraseñas ni sus contenidos.**
  Un clon del repositorio no restaura la clave: trasladarla de forma privada al
  cambiar de entorno. Si falta, detener la entrega de un APK incompatible y
  explicar que hace falta recuperar la misma clave; no generar una nueva.
- Comprobar la firma con `python3 scripts/sign-life-preview.py --check-key`.
  Compilar, firmar y validar según `proyecto-de-vida/android/ACTUALIZACIONES.md`.
  GitHub Actions valida las fuentes y el APK firmado guardado; su clave debug
  efímera no debe usarse para distribuir actualizaciones.
- Guardar fuentes, APK firmado, checksum y metadatos de la misma versión; actualizar
  `latestApk` en el canal. Verificar el enlace HTTPS y el artefacto terminado antes
  de entregarlos. No enviar rutas locales como enlace de descarga al teléfono.

La aplicación original `com.proyectodevida.app` tiene otra firma que no está en
este entorno. No afirmar que la versión de prueba la actualiza encima.
