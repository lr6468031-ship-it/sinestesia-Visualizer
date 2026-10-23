# Actualizar la aplicación ya instalada

La aplicación de referencia para los siguientes cambios es **Proyecto de vida
1.1.3 · Prueba**, código 5. El paquete y su certificado público están fijados en
[`../../.github/life-preview-channel.json`](../../.github/life-preview-channel.json).
No cambiar ninguno al modificar el diseño o las funciones. Android conserva el
almacenamiento al instalar una actualización compatible encima. No desinstalar ni
borrar los datos. Mantener la clave de almacenamiento `proyecto-de-vida-v1` y la
compatibilidad del formato de los registros.

## Firma privada

En este entorno se conserva una copia de la misma clave que firmó la 1.1.3, con
contraseña nueva y permisos privados, en
`/workspace/proyecto-de-vida-preview-private-signing/`:

- `preview.p12`: almacén de claves; alias `proyecto-de-vida-preview`.
- `storepass`: contraseña del almacén y de la clave.

La contraseña del almacén puede cambiar sin cambiar el certificado de la clave.
Los archivos **no están en Git, ni en los APK ni en Artefactos**. Un clon nuevo del
repositorio no basta para recuperarlos. Guardar una copia privada de ambos y
trasladarlos por un canal privado antes de desechar o cambiar este entorno.
Este entorno no ofrece un almacén de secretos persistente configurado ni se ha
configurado la firma en GitHub Secrets.

En otro entorno, indicar las rutas sin publicar los contenidos:

```sh
export LIFE_PREVIEW_KEYSTORE=/ruta/privada/preview.p12
export LIFE_PREVIEW_STOREPASS_FILE=/ruta/privada/storepass
# Solo si la clave tiene una contraseña diferente:
# export LIFE_PREVIEW_KEYPASS_FILE=/ruta/privada/keypass
python3 scripts/sign-life-preview.py --check-key
```

El script comprueba el certificado antes de firmar y no crea claves nuevas como
alternativa. Las contraseñas se leen desde archivos privados.

## Entregar una actualización

1. Modificar las fuentes del subproyecto. Aumentar `name` y `code` en
   `version.json`; el código debe superar al del último APK entregado.
2. Ejecutar las pruebas pertinentes y guardar las fuentes en un commit. Regenerar
   el proyecto Android desde ese commit:

   ```sh
   npm run build:life:android
   node scripts/configure-life-preview.mjs
   cd .cache/life-android/android
   ./gradlew :app:testDebugUnitTest :app:assembleRelease --no-daemon --max-workers=2
   ```

3. Desde la raíz, firmar con la clave conservada:

   ```sh
   python3 scripts/sign-life-preview.py
   ```

   Se comprueban paquete, certificado, versión y revisión de fuentes. El APK, su
   SHA-256 y sus metadatos se escriben en `.cache/life-signed/`. Si se compara con
   otra entrega más reciente, usar `--previous ruta/al/anterior.apk`.
4. Copiar esos tres archivos a `downloads/`, actualizar `latestApk` en el canal y
   los enlaces de descarga en los README. Conservar los APK anteriores. Guardar y
   subir el commit en la rama de trabajo y esperar a que finalice **Build Proyecto
   de vida actualizado**. El artefacto contiene el mismo APK que la descarga directa.
5. Verificar la descarga HTTPS y entregar ese enlace al usuario. Instalar encima
   de la versión de prueba ya instalada, aceptando **Actualizar** en Android.

Validación adicional de una entrega frente a la anterior:

```sh
python3 scripts/life_preview_identity.py nuevo.apk --previous anterior.apk
```

El APK original 1.1.0, paquete `com.proyectodevida.app`, sigue siendo otro canal.
Su clave original no está aquí. La primera instalación de la prueba es separada;
los siguientes cambios de la prueba sí deben mantener su identidad para actualizar
encima. No se trasladan automáticamente los registros entre las dos aplicaciones.
