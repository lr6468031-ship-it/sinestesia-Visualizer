# Créditos y herramientas adaptadas

Proyecto de vida es una aplicación independiente que reutiliza funciones concretas. No conecta cuentas ni ejecuta las aplicaciones completas de los siguientes proyectos.

| Proyecto | Versión revisada | Fuente utilizada | Uso y modificaciones | Licencia |
| --- | --- | --- | --- | --- |
| [LifeOS](https://github.com/lifeos-app/lifeos) | `3009bf6` | `src/lib/progression.ts` | En `vendor/lifeos.mjs`: extracción del cálculo de progreso de tareas y promedio de objetivos; se sustituye la consulta Supabase por arreglos locales. | MIT, Copyright (c) 2026 LifeOS Contributors |
| [Super Productivity](https://github.com/super-productivity/super-productivity) | `7183763` | `src/app/ui/duration/ms-to-clock-string.pipe.ts` | En `vendor/super-productivity.mjs`: función de formato de duración; se eliminan tipos TypeScript y el wrapper Angular. Usada por el temporizador. | MIT, Copyright (c) 2018 Johannes Millan |
| [Beaver Habits](https://github.com/daya0576/beaverhabits) | `332a453` | `beaverhabits/frontend/components.py`, `CalendarHeatmap.generate_calendar_days` | En `vendor/beaverhabits.mjs`: port de Python a JavaScript con semanas de lunes a domingo y fechas civiles UTC. Usado por el mapa de constancia. | BSD 3-Clause, Copyright (c) 2024 Henry Zhu |
| [Neohabit](https://github.com/Vsein/Neohabit) | `3f7d8d5` | `frontend/src/utils/binarySearch.js` | En `vendor/neohabit.mjs`: función de búsqueda binaria sin cambios, salvo encabezado. Se usa para obtener el objetivo de un hábito vigente en una fecha y conservar el historial. | GNU AGPL v3 |

Las licencias completas se encuentran en `vendor/*-LICENSE.txt`. Por incorporar código AGPL, la aplicación independiente de esta carpeta se ofrece bajo AGPL v3 (archivo `LICENSE`) y su código fuente completo se ofrece desde el diálogo «Acerca del proyecto».

El diseño, los flujos de interfaz, el almacenamiento, la validación de respaldos, la planificación por prioridad y las pruebas de esta aplicación son código nuevo. No se incluye inteligencia artificial ni se requieren claves de API. La sugerencia de prioridades usa prioridad, antigüedad y un presupuesto de tiempo explícito.

## Referencia visual de la llama

`assets/life-flame-loop.mp4` y `assets/life-flame-poster.webp` se adaptan del video `XRecorder_20261021_01.mp4` proporcionado por el usuario para reproducir ese movimiento en esta aplicación. El material visual no se presenta como una simulación original. La adaptación elimina audio y controles, recorta el encuadre y prepara un bucle. El código que controla el tamaño, la velocidad, el brillo y el uso sin conexión es propio de esta aplicación. Véase `assets/README.md` para los detalles del recorte.
