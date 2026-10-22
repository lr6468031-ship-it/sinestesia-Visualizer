# Proyecto de vida

Aplicación personal en español con metas por áreas de vida, tareas vinculadas, hábitos diarios numéricos, objetivos con historial, diario, mapa de constancia, sugerencias de prioridad y sesiones de concentración. Interfaz móvil y de escritorio. Persistencia local, importación y exportación de JSON, caché sin conexión mediante un service worker limitado a esta aplicación.

## Ejecutar y validar

No necesita npm ni servicios externos. Desde el directorio padre:

```sh
python -m http.server 8003 --bind 127.0.0.1
node --test proyecto-de-vida/tests/*.test.mjs
```

Abrir `/proyecto-de-vida/` en el navegador. Para el uso sin conexión se necesita HTTPS o localhost y una primera carga conectada. `npm run build:web` del repositorio incluye esta aplicación en `dist/proyecto-de-vida/`.

## Descargar la versión actualizada

La actualización **1.1.3 de prueba** se genera en GitHub Actions mediante
**Build Proyecto de vida actualizado**, rama `fix/flama-habitos-y-tareas`.
Su artefacto se llama `proyecto-de-vida-1.1.3-prueba`. La publicación firmada
original de `downloads/proyecto-de-vida.apk` sigue siendo 1.1.0.

La prueba se instala aparte, como **Proyecto de vida 1.1.3 · Prueba**, y conserva
la aplicación original en el teléfono. Para llevar los registros: exportar un
respaldo desde la original e importarlo en la prueba. Detalles y compilación en
[Android](android/README.md).

## Versión Android

El APK independiente incluye todos los archivos para funcionar sin conexión desde el primer inicio. Compilación, firma, instalación y traslado de datos de la web: [android/README.md](android/README.md). Se instala como **Proyecto de vida** (`com.proyectodevida.app`).

## Calendario, fechas y recordatorios

La sección **Calendario** muestra un mes de lunes a domingo y la agenda del día elegido. Cada meta tiene fecha de inicio, fecha de fin opcional y un color aleatorio de la paleta de la llama. Los colores son únicos, se favorece la separación visual entre ellos y se guardan con la meta. Las franjas cubren cada día del período, incluidos inicio y fin; la leyenda indica el tiempo restante. Las metas anteriores reciben un color una sola vez. Las fechas sin hora se tratan como días del calendario local, sin convertirlos a UTC.

Cada rutina permite elegir una **hora de inicio** independiente de su duración y un aviso: sin recordatorio, notificación con sonido o sonido de alarma. Se puede avisar a esa hora o 5, 10, 15, 30 o 60 minutos antes. Se respetan los días de repetición, la fecha de inicio, los registros completados y eliminados, y el fin de una serie. Las nuevas opciones se incluyen en los respaldos de versión 1 y los respaldos anteriores siguen siendo compatibles.

En Android los horarios quedan guardados en el dispositivo y se programan con AlarmManager, sin depender del cronómetro ni de JavaScript en segundo plano. Se recuperan tras reiniciar, actualizar la aplicación o cambiar la hora o zona horaria. **Activar avisos** solicita notificaciones en Android 13 o posterior; **Permitir horarios precisos** abre el permiso de alarmas y recordatorios en Android 12 o posterior. Sin ese permiso se usa la programación aproximada de Android y se informa en la interfaz. El modo de alarma usa una notificación con el sonido de alarma del teléfono; los canales se controlan desde **Sonido y permisos de Android**.

La web comprueba avisos mientras permanece abierta y puede mostrar notificaciones si tiene permiso. El APK permite avisos con la pantalla de la aplicación cerrada. Los ajustes de sonido, No molestar, ahorro de energía y el estado de detención forzada de Android siguen bajo el control del usuario y del sistema.

## Datos personales y compatibilidad

Los datos personales permanecen en `localStorage` del dispositivo, bajo `proyecto-de-vida-v1`; no se transmiten a los proyectos de referencia ni a un servidor. No hay cuentas, sincronización remota ni recuperación de contraseña. Exportar un respaldo antes de borrar los datos del navegador. Las importaciones se validan y requieren confirmación antes de reemplazar datos. Antes de importar se conserva adicionalmente una copia local en `proyecto-de-vida-v1-antes-de-importar`.

La duración de las tareas se elige con tres barras táctiles: horas (0–24), minutos (0–60) y segundos (0–60). La vista previa normaliza 60 segundos o minutos; la duración total máxima es de 24 horas y la mínima de un segundo. Las tareas anteriores conservan sus minutos al abrirse y pueden editarse con los nuevos controles.

El botón ▶ de cada tarea inicia una cuenta atrás con su duración guardada, independiente de la duración de concentración libre. El temporizador muestra horas, minutos y segundos restantes y transcurridos, usa una fecha de finalización y conserva pausa/reanudación al recargar. Registra una sesión una sola vez, con los segundos efectivamente transcurridos (sin redondear sesiones cortas a minutos completos). Los descansos no suman concentración. No completa automáticamente una tarea. Al terminar con la aplicación cerrada, registra la sesión la próxima vez que se abre. Los respaldos anteriores siguen siendo compatibles.

Las tareas pueden programarse una sola vez o repetirse los días seleccionados de lunes a domingo. Cada fecha tiene su propio registro de completada o eliminada. Los cambios de horario conservan lo registrado anteriormente. Las tareas eliminadas se pueden restaurar desde Estadísticas; al detener una repetición no se generan pendientes futuros. Los registros eliminados definitivamente en versiones anteriores no pueden reconstruirse.

Los hábitos permiten elegir días de la semana. Los días de descanso no rompen las rachas. La llama cuenta días activos con al menos una actividad completada. Las gráficas de cumplimiento combinan tareas y hábitos programados: menos de 40% rojo, 40–79% amarillo y 80–100% verde. Las tareas eliminadas no se cuentan como completadas. Los cambios de objetivo se aplican desde la fecha actual y no modifican objetivos de días previos. El día se calcula según el calendario local del navegador, sin convertirlo implícitamente a UTC. Los cálculos entre fechas usan mediodía UTC para evitar desplazamientos por el horario de verano.

## Reutilización real

Esta aplicación adapta herramientas específicas de cuatro repositorios. No es una integración de sus servidores ni una redistribución de sus aplicaciones completas. Véase [THIRD_PARTY.md](THIRD_PARTY.md) para fuentes, versiones, modificaciones y licencias.

El código de `proyecto-de-vida/` se distribuye bajo GNU AGPL versión 3. Se incluyen las licencias originales de las adaptaciones. Esta licencia corresponde a esta aplicación independiente; no cambia la licencia del visualizador que la aloja en otra ruta. Código fuente completo disponible en:
https://github.com/lr6468031-ship-it/sinestesia-Visualizer/tree/main/proyecto-de-vida

## Plazo y avance de los hábitos

Las metas o tareas del día se cumplen en una fecha concreta. Un hábito tiene un
objetivo por día programado y puede repetirse durante un plazo elegido en días o
semanas, con inicio y fin inclusivos. Por ejemplo, diez días desde el 1 terminan
el 10. Solo los días de práctica seleccionados cuentan en el total; los días de
descanso quedan fuera.

Cada hábito muestra por separado su objetivo de hoy y su avance acumulado:
días cumplidos, total programado, porcentaje alcanzado y cuánto falta. Los días
futuros no se cuentan como cumplidos. Una cantidad parcial no completa el día,
y superar el objetivo no lo cuenta dos veces. Un día de diez cumplido equivale
al 10% del hábito, mientras dos tareas del día y ese hábito cumplidos pueden
llevar la flama al 100% del día.

El plazo debe incluir las fechas con registros al editarlo. Los hábitos antiguos
sin fin siguen funcionando; pueden recibir un plazo al editarlos. Los nuevos
campos son opcionales en el respaldo de versión 1. Los días y objetivos anteriores
se conservan en el historial. Al terminar el plazo el hábito deja de entrar en los
planes diarios posteriores y sigue visible con su avance en Hábitos.

## Orden del día

En Hoy, **Tareas del día** aparece encima de **Plan del día**. La primera sección
muestra los conteos y la lista de tareas de la fecha elegida, incluidas las
vinculadas a metas. El plan inferior muestra la semana, el porcentaje compartido
con la flama y todos los hábitos programados para esa fecha. El selector de fecha
y los botones de la semana actualizan ambas secciones y la flama a la vez.
Las tareas de otros días quedan en una sección separada de pendientes.

## Llama animada

`life-flame.mjs` usa un bucle limpio del video `XRecorder_20261021_01.mp4` aportado por el usuario como referencia. Así conserva las membranas, los colores y los destellos originales. Se recortan los controles de la grabación, se excluyen los momentos con indicadores superpuestos, se elimina el audio y se suaviza la unión del bucle. El clip H.264 de 360 × 636 y su imagen estática se incluyen en `assets/`; no se carga contenido de otros sitios.

La proporción de tareas y hábitos completados en el plan del día controla el tamaño, la velocidad y la luz. Al 0% parte de tamaño 32%, velocidad 0,7× y luz 0,62×; al 50% conserva el aspecto intermedio de referencia (86%, 2× y 1,5×); al 100% alcanza tamaño completo, velocidad 3,4×, luz 2,7× y una aureola luminosa azul y naranja. La aureola aparece de forma gradual por encima del 50%. La última actividad (tarea o hábito) añade un impulso sostenido de velocidad, luz y resplandor para que el 100% se distinga de un plan casi terminado. Los aumentos son continuos y se mantienen, incluso al recargar; desmarcar una tarea o bajar un hábito por debajo de su objetivo reduce suavemente la energía. Tanto 1 de 1 como 10 de 10 actividades alcanzan el máximo.

La llama, el porcentaje del plan y el punto de la gráfica usan el mismo cálculo para la fecha seleccionada: tareas de esa fecha y hábitos programados para ese día. Una tarea vinculada a una meta cuenta una sola vez; la meta no se suma como una segunda actividad. Cada hábito se completa al alcanzar su objetivo vigente; los avances parciales no cuentan como completados ni superar el objetivo lo cuenta dos veces. Las tareas eliminadas y los hábitos en descanso se excluyen del plan activo. Un plan vacío conserva la llama inicial y no se considera completado. Las tareas atrasadas de otras fechas se muestran aparte y no alteran el porcentaje del día elegido, aunque se completen después. El cumplimiento por período suma las mismas actividades de cada fecha.

El mismo elemento de video se conserva al registrar tareas y navegar para evitar reinicios. Se pausa fuera de pantalla, con la pestaña oculta y al navegar a otra sección. Con movimiento reducido se muestra la imagen estática con el tamaño y la luz correspondientes. Si el navegador solicita una interacción para reproducir, aparece «Animar llama»; si no puede cargar el clip, se mantiene un respaldo de filamentos sobre Canvas 2D con los mismos parámetros de progreso.

El service worker almacena el clip completo y admite solicitudes de rangos de bytes para reproducción, desplazamiento y repetición sin conexión en navegadores móviles. No cambia tareas, hábitos, sesiones, rachas ni respaldos.

## Tema de la llama

`flame-theme.css` aplica la paleta de la llama a todas las pantallas: azul oscuro de fondo, superficies azul profundo, texto blanco azulado, navegación cian y acciones en naranja y dorado. Incluye formularios, controles de duración, días de la semana, diario, temporizador, estadísticas, avisos y diálogos. Los estados de cumplimiento conservan sus significados rojo, amarillo y verde; el mapa de constancia usa una escala azul–cian.

La barra del navegador, el manifiesto y los iconos de instalación comparten la paleta. El tema se incluye en la caché sin conexión. El cambio es visual; los datos, las tareas, los cronómetros y los niveles de la llama se conservan.
