// ─────────────────────────────────────────────────────────────────────────────
// The synthetic course catalogue.
//
// Lifted from the Cornerstone mock so the imagery and copy match what the demo
// audience has already seen. This is the *only* source of truth for scoring:
// every metric the widget shows is derived from a learner's set of completions
// against this catalogue, so the numbers can never contradict each other.
//
// These courses are not read from Cornerstone. See `demo.ts`.
// ─────────────────────────────────────────────────────────────────────────────

import { Badge, BadgeId, Course, Tier } from "./types";

export const COURSES: Course[] = [
  {
    id: 1,
    title: "Fundamentos de liderazgo",
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=300",
    type: "online",
    minutes: 60,
    required: true,
    dueDate: "Vence en 3 días",
    description: "Domina las habilidades esenciales para liderar equipos de manera efectiva. Incluye comunicación, empatía y pensamiento estratégico.",
    modules: ["Introducción al liderazgo", "Estilos de comunicación", "Resolución de conflictos"],
  },
  {
    id: 2,
    title: "Gestión de producto 101",
    image: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=300",
    type: "online",
    minutes: 45,
    required: false,
    dueDate: "20 de enero",
    description: "Una introducción al ciclo de vida del producto, desde la idea hasta el lanzamiento. Aprende a definir requerimientos y colaborar con ingeniería.",
    modules: ["Ciclo de vida del producto", "Historias de usuario", "Hoja de ruta"],
  },
  {
    id: 3,
    title: "Capacitación en vivo: Seguridad",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=300",
    type: "event",
    minutes: 480,
    required: true,
    dueDate: "28 de enero",
    description: "Capacitación presencial de seguridad para el personal de almacén y operaciones. La asistencia es obligatoria.",
    modules: ["Sesión de la mañana", "Manejo de equipo", "Protocolos de emergencia"],
  },
  {
    id: 4,
    title: "Comunicación entre culturas",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=300",
    type: "event",
    minutes: 180,
    required: false,
    dueDate: "14 de febrero",
    description: "Aprende a desenvolverte entre diferencias culturales dentro de un entorno laboral global.",
    modules: ["Dimensiones culturales", "Señales no verbales", "Casos de estudio"],
  },
  {
    id: 5,
    title: "Privacidad de datos 2026",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=300",
    type: "online",
    minutes: 60,
    required: true,
    dueDate: "Vence en 3 días",
    description: "Aprende a manejar datos personales de forma responsable y comprende los principios clave de GDPR y CCPA para proteger la privacidad y cumplir con la normativa.",
    modules: ["Datos personales", "Responsabilidades de GDPR y CCPA", "Buenas prácticas de privacidad"],
  },
  {
    id: 6,
    title: "Seguridad de la información",
    image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=300",
    type: "online",
    minutes: 45,
    required: true,
    dueDate: "20 de enero",
    description: "Protección de los activos de la empresa frente a amenazas cibernéticas. Phishing, seguridad de contraseñas e ingeniería social.",
    modules: ["Concientización sobre phishing", "Higiene de contraseñas", "Reporte de incidentes"],
  },
  {
    id: 7,
    title: "Excel avanzado",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=300",
    type: "online",
    minutes: 120,
    required: false,
    dueDate: "Opcional",
    description: "Lleva tus hojas de cálculo al siguiente nivel con tablas dinámicas, BUSCARV y macros.",
    modules: ["Fórmulas", "Tablas dinámicas", "Macros"],
  },
];

/** Required compliance work is worth the most, live events next, self-paced
 *  e-learning least — so the ranking rewards the courses the business actually
 *  cares about rather than whoever clicked through the most short modules. */
export const XP = {
  required: 50,
  event: 25,
  online: 10,
  /** Bonus for finishing before the deadline. */
  onTime: 15,
};

export function courseXp(required: boolean, type: "online" | "event", onTime: boolean): number {
  const base = required ? XP.required : type === "event" ? XP.event : XP.online;
  return base + (onTime ? XP.onTime : 0);
}

/** Thresholds are spaced so a plausible demo field spans three tiers — a ladder
 *  where everyone sits in the same bucket communicates nothing. */
export const TIERS: Tier[] = [
  { id: "bronce", label: "Bronce", from: 0, to: 120 },
  { id: "plata", label: "Plata", from: 120, to: 260 },
  { id: "oro", label: "Oro", from: 260, to: 420 },
  { id: "platino", label: "Platino", from: 420, to: Infinity },
];

export const BADGES: { [K in BadgeId]: Badge } = {
  madrugador: {
    id: "madrugador",
    label: "Madrugador",
    description: "Terminó al menos 3 cursos antes de la fecha límite",
  },
  maratonista: {
    id: "maratonista",
    label: "Maratonista",
    description: "Completó 3 cursos en una misma semana",
  },
  cumplidor: {
    id: "cumplidor",
    label: "Cumplidor",
    description: "Completó toda la formación obligatoria",
  },
  explorador: {
    id: "explorador",
    label: "Explorador",
    description: "Combinó cursos en línea y eventos presenciales",
  },
  imparable: {
    id: "imparable",
    label: "Imparable",
    description: "Cuatro semanas seguidas aprendiendo",
  },
};

/** Number of weeks in the streak spark row. */
export const SPARK_WEEKS = 6;

export const REQUIRED_COUNT = COURSES.filter(c => c.required).length;
