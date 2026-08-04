/**
 * El mapa de procesos institucionales.
 *
 * Vive aquí y no dentro de una pantalla porque lo usan dos sitios que tienen que
 * coincidir: la administración de dependencias (a qué proceso pertenece cada
 * una) y el cronograma del programa de auditoría (una sección por proceso).
 *
 * - `value` es lo que guarda la columna `dependencias.gestion`. No se toca: hay
 *   datos escritos con esos valores.
 * - `label` es el nombre del proceso **tal y como aparece en el formato
 *   PE-GS-2.2.1-FOR-7**, que es el que se imprime en el Excel.
 *
 * El orden es el del formato, y es el que siguen las secciones del cronograma.
 *
 * `otras` no es un proceso: es el cajón de las dependencias sin clasificar. Por
 * eso queda fuera de `PROCESOS_CRONOGRAMA`.
 *
 * `tono`  → color de la tarjeta KPI (ver STAT_TONES)
 * `badge` → tono del badge en las tablas (ver STATUS_BADGE_TONES)
 */
export const PROCESOS = [
  {
    value: 'estrategica',
    label: 'Direccionamiento Estratégico',
    corto: 'Estratégico',
    emoji: '🎯',
    tono: 'purple',
    badge: 'accent',
  },
  {
    value: 'academica',
    label: 'Gestión Académica',
    corto: 'Académica',
    emoji: '🎓',
    tono: 'green',
    badge: 'success',
  },
  {
    value: 'investigacion',
    label: 'Gestión de investigación, innovación e interacción social',
    corto: 'Investigación',
    emoji: '🔬',
    tono: 'cyan',
    badge: 'info',
  },
  {
    value: 'cultura',
    label: 'Gestión de cultura y bienestar',
    corto: 'Cultura',
    emoji: '🎨',
    tono: 'pink',
    badge: 'accent',
  },
  {
    value: 'administrativa',
    label: 'Gestión administrativa y financiera',
    corto: 'Administrativa',
    emoji: '💼',
    tono: 'orange',
    badge: 'warning',
  },
  {
    value: 'control',
    label: 'Evaluación y control',
    corto: 'Control',
    emoji: '🔒',
    tono: 'indigo',
    badge: 'info',
  },
  {
    value: 'otras',
    label: 'Otro / sin clasificar',
    corto: 'Otros',
    emoji: '📁',
    tono: 'gray',
    badge: 'neutral',
  },
]

/** Las secciones del cronograma: los procesos reales, sin el cajón. */
export const PROCESOS_CRONOGRAMA = PROCESOS.filter((p) => p.value !== 'otras')

/** El proceso de un valor guardado; cae en «otras» si no se reconoce. */
export const procesoDe = (value) =>
  PROCESOS.find((p) => p.value === (value || 'otras')) ?? PROCESOS.at(-1)
