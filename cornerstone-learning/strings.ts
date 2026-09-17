// Spanish copy, in one place.
//
// One locale by design — but structured as a keyed map rather than inline
// literals so a second bundle can be added later without touching render code.

export const S = {
  title: "Clasificación de aprendizaje",
  subtitle: "Quién va adelante este trimestre",

  metricCourses: "Cursos",
  metricHours: "Horas",
  metricXp: "XP",
  metricStreak: "Racha",

  unitCourses: "cursos",
  unitCoursesOne: "curso",
  unitHours: "h",
  unitXp: "XP",
  unitStreak: "semanas",
  unitStreakOne: "semana",

  leader: "Líder",
  podium: "Podio",
  field: "Clasificación",

  tierNext: (n: number, tier: string) => `Faltan ${n} XP para ${tier}`,
  tierMax: "Nivel máximo alcanzado",
  tierLabel: "Nivel",

  streakWeeks: "Últimas 6 semanas",
  streakNone: "Sin racha activa",

  badgesTitle: "Insignias",
  noBadges: "Aún sin insignias",

  drilldownOpen: "Ver cursos completados",
  drilldownClose: "Ocultar cursos",
  completedCourses: "Cursos completados",
  onTime: "A tiempo",
  late: "Fuera de plazo",
  required: "Obligatorio",
  typeOnline: "En línea",
  typeEvent: "Evento",
  modules: (n: number) => (n === 1 ? "1 módulo" : `${n} módulos`),
  noCompletions: "Todavía no ha completado ningún curso",

  demoNote: "Datos de demostración",
  loading: "Cargando clasificación…",
  errorTitle: "No se pudo cargar la clasificación",
  unconfigured: "Configura la URL base y el token de la API en el editor del widget.",

  brandDefault: "Marca corporativa",
} as const;

/** Spanish pluralisation is regular enough for a two-form helper. */
export const plural = (n: number, one: string, many: string): string =>
  (Math.abs(n) === 1 ? one : many);
