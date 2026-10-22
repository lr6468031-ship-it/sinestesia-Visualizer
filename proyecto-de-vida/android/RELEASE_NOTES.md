Proyecto de vida para Android, versión 1.1.1 (código 3).

- La intensidad de la llama combina tareas y hábitos programados para el día.
- Cada hábito aporta una actividad completada al alcanzar su objetivo; superar
  el objetivo no lo cuenta dos veces.
- Desmarcar una tarea o bajar un hábito por debajo del objetivo reduce la llama.
- Los hábitos en descanso no cuentan como pendientes; se respeta el historial
  de días y objetivos de cada hábito.
- Los textos de la llama muestran actividades e incluyen tareas y hábitos.
- Se conserva el diseño oscuro, la animación y los datos de la versión anterior.

Para instalar encima de 1.1.0 sin perder datos, el APK debe firmarse con la misma
clave original. Esta revisión de las fuentes no sustituye la firma y publicación
del APK. No desinstalar la aplicación para actualizarla.

---

## Notas de la publicación anterior: 1.1.0

Proyecto de vida para Android, versión 1.1.0.

- Hora de inicio para cada rutina, independiente de su duración.
- Avisos a la hora elegida o 5, 10, 15, 30 o 60 minutos antes.
- Notificación con sonido o sonido de alarma, incluso con la pantalla de la aplicación cerrada.
- Repetición en los días seleccionados y cancelación al completar, eliminar o cambiar la rutina.
- Recuperación de horarios tras reiniciar, actualizar el APK y cambiar la zona horaria.
- Calendario mensual con agenda por día y rutinas ordenadas por hora.
- Fecha de inicio y fin de las metas, con franjas de colores de la llama y días restantes.
- Colores aleatorios distintos que se conservan entre aperturas y en los respaldos.
- Tema, llama animada, estadísticas y cronómetros anteriores conservados.

**Actualizar desde 1.0.0:** instala este APK encima del anterior para conservar tus datos. No lo desinstales. El identificador y la firma se mantienen.

**Ejemplo de aviso:** edita Ejercicio → Hora de inicio: 14:00 → Sonido de alarma → A la hora de inicio. Elige sus días y guarda. En Calendario o Ajustes pulsa Activar avisos y, si aparece, Permitir horarios precisos. Android controla el volumen, No molestar y los canales de sonido; puedes revisarlos en Sonido y permisos de Android.

**Instalación nueva:** descarga proyecto-de-vida.apk, ábrelo y permite la instalación si Android lo solicita. Requiere Android 6.0 o posterior y Android System WebView actualizado. Para trasladar datos desde la web: Ajustes y respaldo → Descargar mis datos; después, en el APK → Importar un respaldo.

El calendario y los datos funcionan sin conexión. En la web los avisos requieren que la página permanezca abierta; el APK usa el programador de Android. El cronómetro mantiene su comportamiento y no añade una alarma de finalización de sesión.

Verificaciones: tests de datos y calendario, pruebas de horarios en JVM, tests Android con Robolectric, navegación móvil con Chromium y verificación de firma del APK. No se ha probado en un teléfono físico.

El APK está firmado para instalación directa. proyecto-de-vida.apk.sha256 permite comprobar su integridad. Las fuentes completas de esta versión se incluyen en los archivos de fuentes de la publicación (AGPL-3.0).
