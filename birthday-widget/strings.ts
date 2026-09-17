import { Bundles } from "../tasks/shared/i18n";

export const AVAILABLE_LOCALES = ["es_MX", "es_ES", "en_US", "de_DE", "fr_FR", "pt_BR"];

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
  de_DE: {
    "widget.title":       "Bevorstehende Geburtstage",
    "state.empty":        "Füge Namen in den Widget-Einstellungen hinzu.",
    "countdown.today":    "Heute!",
    "countdown.tomorrow": "Morgen",
    "countdown.days":     "In {n} Tagen",
  },
  fr_FR: {
    "widget.title":       "Anniversaires à venir",
    "state.empty":        "Ajoutez des noms dans les paramètres du widget.",
    "countdown.today":    "Aujourd'hui !",
    "countdown.tomorrow": "Demain",
    "countdown.days":     "Dans {n} jours",
  },
  pt_BR: {
    "widget.title":       "Aniversários próximos",
    "state.empty":        "Adicione nomes nas configurações do widget.",
    "countdown.today":    "Hoje!",
    "countdown.tomorrow": "Amanhã",
    "countdown.days":     "Em {n} dias",
  },
};

// es_ES is close enough to es_MX for these short strings
BUNDLES.es_ES = { ...BUNDLES.es_MX };
