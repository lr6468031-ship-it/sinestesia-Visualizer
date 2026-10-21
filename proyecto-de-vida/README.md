# Proyecto de vida

Aplicación personal en español con metas por áreas de vida, tareas vinculadas, hábitos diarios numéricos, objetivos con historial, diario, mapa de constancia, sugerencias de prioridad y sesiones de concentración. Interfaz móvil y de escritorio. Persistencia local, importación y exportación de JSON, caché sin conexión mediante un service worker limitado a esta aplicación.

## Ejecutar y validar

No necesita npm ni servicios externos. Desde el directorio padre:

```sh
python -m http.server 8003 --bind 127.0.0.1
node --test proyecto-de-vida/tests/*.test.mjs
```

Abrir `/proyecto-de-vida/` en el navegador. Para el uso sin conexión se necesita HTTPS o localhost y una primera carga conectada. `npm run build:web` del repositorio incluye esta aplicación en `dist/proyecto-de-vida/`.

## Datos

Los datos personales permanecen en `localStorage` del dispositivo, bajo `proyecto-de-vida-v1`; no se transmiten a los proyectos de referencia ni a un servidor. No hay cuentas, sincronización remota ni recuperación de contraseña. Exportar un respaldo antes de borrar los datos del navegador. Las importaciones se validan y requieren confirmación antes de reemplazar datos. Antes de importar se conserva adicionalmente una copia local en `proyecto-de-vida-v1-antes-de-importar`.

La duración de las tareas se elige con tres barras táctiles: horas (0–24), minutos (0–60) y segundos (0–60). La vista previa normaliza 60 segundos o minutos; la duración total máxima es de 24 horas y la mínima de un segundo. Las tareas anteriores conservan sus minutos al abrirse y pueden editarse con los nuevos controles.

El botón ▶ de cada tarea inicia una cuenta atrás con su duración guardada, independiente de la duración de concentración libre. El temporizador muestra horas, minutos y segundos restantes y transcurridos, usa una fecha de finalización y conserva pausa/reanudación al recargar. Registra una sesión una sola vez, con los segundos efectivamente transcurridos (sin redondear sesiones cortas a minutos completos). Los descansos no suman concentración. No completa automáticamente una tarea. Al terminar con la aplicación cerrada, registra la sesión la próxima vez que se abre. Los respaldos anteriores siguen siendo compatibles.

Las tareas pueden programarse una sola vez o repetirse los días seleccionados de lunes a domingo. Cada fecha tiene su propio registro de completada o eliminada. Los cambios de horario conservan lo registrado anteriormente. Las tareas eliminadas se pueden restaurar desde Estadísticas; al detener una repetición no se generan pendientes futuros. Los registros eliminados definitivamente en versiones anteriores no pueden reconstruirse.

Los hábitos permiten elegir días de la semana. Los días de descanso no rompen las rachas. La llama cuenta días activos con al menos una actividad completada. Las gráficas de cumplimiento combinan tareas y hábitos programados: menos de 40% rojo, 40–79% amarillo y 80–100% verde. Las tareas eliminadas no se cuentan como completadas. Los cambios de objetivo se aplican desde la fecha actual y no modifican objetivos de días previos. El día se calcula según el calendario local del navegador, sin convertirlo implícitamente a UTC. Los cálculos entre fechas usan mediodía UTC para evitar desplazamientos por el horario de verano.

## Reutilización real

Esta aplicación adapta herramientas específicas de cuatro repositorios. No es una integración de sus servidores ni una redistribución de sus aplicaciones completas. Véase [THIRD_PARTY.md](THIRD_PARTY.md) para fuentes, versiones, modificaciones y licencias.

El código de `proyecto-de-vida/` se distribuye bajo GNU AGPL versión 3. Se incluyen las licencias originales de las adaptaciones. Esta licencia corresponde a esta aplicación independiente; no cambia la licencia del visualizador que la aloja en otra ruta. Código fuente completo disponible en:
https://github.com/lr6468031-ship-it/sinestesia-Visualizer/tree/main/proyecto-de-vida

## Llama animada

`life-flame.mjs` usa un bucle limpio del video `XRecorder_20261021_01.mp4` aportado por el usuario como referencia. Así conserva las membranas, los colores y los destellos originales. Se recortan los controles de la grabación, se excluyen los momentos con indicadores superpuestos, se elimina el audio y se suaviza la unión del bucle. El clip H.264 de 360 × 636 y su imagen estática se incluyen en `assets/`; no se carga contenido de otros sitios.

El número de tareas completadas en la fecha elegida controla tres parámetros independientes: tamaño (32–100%), velocidad de reproducción (0,7–2,5×) e intensidad de luz (0,62–1,8×). Los tres aumentan gradualmente con las tareas completadas y descienden al desmarcarlas. El brillo y la velocidad se mantienen durante toda la animación, se recuperan al recargar y no dependen de añadir tareas pendientes o de completar hábitos.

El mismo elemento de video se conserva al registrar tareas y navegar para evitar reinicios. Se pausa fuera de pantalla, con la pestaña oculta y al navegar a otra sección. Con movimiento reducido se muestra la imagen estática con el tamaño y la luz correspondientes. Si el navegador solicita una interacción para reproducir, aparece «Animar llama»; si no puede cargar el clip, se mantiene un respaldo de filamentos sobre Canvas 2D con los mismos parámetros de progreso.

El service worker almacena el clip completo y admite solicitudes de rangos de bytes para reproducción, desplazamiento y repetición sin conexión en navegadores móviles. No cambia tareas, hábitos, sesiones, rachas ni respaldos.
