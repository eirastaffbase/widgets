import { Bundles } from "../tasks/shared/i18n";

export const AVAILABLE_LOCALES = ["en_US", "es_MX"];

export const BUNDLES: Bundles = {
  en_US: {
    "widget.title":       "Upcoming Birthdays",
    "state.empty":        "Add names in the widget settings to get started.",
    "countdown.today":    "Today!",
    "countdown.tomorrow": "Tomorrow",
    "countdown.days":     "In {n} days",
  },
  es_MX: {
    "widget.title":       "Próximos cumpleaños",
    "state.empty":        "Agrega nombres en la configuración del widget para comenzar.",
    "countdown.today":    "¡Hoy!",
    "countdown.tomorrow": "Mañana",
    "countdown.days":     "En {n} días",
  },
};
