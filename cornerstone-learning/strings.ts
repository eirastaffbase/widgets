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

  // ── Per-metric chart captions ──
  capCourses: "Cursos completados por persona",
  capHours: "Cómo se reparten las horas entre cursos",
  capXp: "XP acumulado en las últimas 6 semanas",
  capStreak: "Actividad semana a semana",

  // ── Line chart ──
  you: "Tú",
  youLong: "Tú",
  lineYou: "Tu progreso",
  lineOthers: "Compañeros",
  lineLeader: "Líder",
  lineHint: "Pasa el cursor por una persona para resaltar su línea",
  weekLabel: (n: number) => (n === 0 ? "Esta sem." : `-${n} sem.`),
  xpAt: (xp: number, week: string) => `${xp} XP · ${week}`,

  // ── Heatmap ──
  heatHint: "Cada cuadro es una semana",
  heatNone: "Sin actividad",
  heatWeek: (n: number, week: string) => `${n} · ${week}`,

  // ── Catch-up ──
  ctaTitle: "¡Ponte al día!",
  ctaAction: "Haz más cursos",
  ctaGapCourses: (n: number, name: string) =>
    `Te ${n === 1 ? "falta" : "faltan"} ${n} ${n === 1 ? "curso" : "cursos"} para alcanzar a ${name}`,
  ctaGapHours: (n: string, name: string) => `Te faltan ${n} h para alcanzar a ${name}`,
  ctaGapXp: (n: number, name: string) => `Te faltan ${n} XP para alcanzar a ${name}`,
  ctaGapStreak: (n: number, name: string) =>
    `Te ${n === 1 ? "falta" : "faltan"} ${n} ${n === 1 ? "semana" : "semanas"} para alcanzar a ${name}`,
  ctaLeading: "Vas en cabeza. Mantén la racha con un curso más.",
  ctaGeneric: "Suma cursos y escala posiciones en la clasificación.",
  ctaRankOf: (rank: number, total: number) => `Puesto ${rank} de ${total}`,

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
