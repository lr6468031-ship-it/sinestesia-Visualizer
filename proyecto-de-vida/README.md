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

`life-flame.mjs` dibuja membranas translúcidas de luz azul y naranja, pliegues con remolinos ascendentes, destellos que recorren el flujo y pequeñas brasas sobre Canvas 2D. Un campo de ruido continuo compartido por las capas da cohesión al movimiento sin mover todas las líneas de la misma forma. La malla se calcula una vez por cuadro y se reutiliza para superficies y bordes; la resolución se reduce si el dispositivo pierde fluidez.

El tamaño aumenta de forma gradual y acotada con las tareas completadas en la fecha elegida; crear tareas pendientes no infla la llama. La altura y el ancho crecen juntos, manteniendo la forma vertical dentro del lienzo. Completar una tarea produce un impulso breve de luz que se desvanece suavemente; cambiar de día no lo dispara. También cuenta las tareas puntuales que se completan después de su fecha prevista. La animación conserva el mismo lienzo al registrar tareas para que el crecimiento sea continuo. Se pausa fuera de pantalla, con la pestaña oculta y al navegar a otra sección; respeta la preferencia de movimiento reducido. No altera tareas, hábitos, rachas ni respaldos.
