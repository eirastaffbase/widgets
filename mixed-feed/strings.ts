// i18n bundles for the mixed feed.
//
// `en_US` is the source of truth for the *keys*, per the shared engine's
// `DEFAULT_LOCALE` — but this widget's default *display* locale is `es_MX`
// (see `resolveUiLocale` in mixed-feed.ts): the tenants it targets are
// Spanish-speaking, so an undetectable locale should land on Spanish, not
// English. es_ES is shipped separately from es_MX because the two differ in
// register (tú/ustedes) even where the vocabulary matches.

import { Bundles } from "../tasks/shared/i18n";

export const AVAILABLE_LOCALES = ["es_MX", "es_ES", "en_US", "de_DE"];

export const DEFAULT_UI_LOCALE = "es_MX";

export const BUNDLES: Bundles = {
  en_US: {
    "widget.title": "Feed",

    "filter.all": "All",
    "filter.news": "News",
    "filter.social": "Social",

    "state.loading": "Loading feed…",
    "state.error": "Could not load the feed.",
    "state.empty": "No posts yet.",
    "state.emptyFiltered": "No posts in this filter.",
    "state.configure": "Set the base URL, API token and channel IDs in the widget settings.",
    "state.retry": "Try again",

    "post.pinned": "Pinned",
    "post.read": "Read post",
    "post.readMore": "Read more",
    "post.by": "by {name}",

    "social.like": "Like",
    "social.liked": "Liked",
    "social.comment": "Comment",
    "social.comments": "Comments",
    "social.noComments": "No comments yet. Be the first.",
    "social.commentPlaceholder": "Write a comment…",
    "social.send": "Send",
    "social.commentFailed": "Your comment could not be posted.",

    "compose.placeholder": "What's on your mind today?",
    "compose.title": "Create a post",
    "compose.submit": "Post",
    "compose.cancel": "Cancel",
    "compose.failed": "Your post could not be published.",

    "a11y.close": "Close",
    "a11y.openPost": "Open post",
  },

  es_MX: {
    "widget.title": "Novedades",

    "filter.all": "Todo",
    "filter.news": "Noticias",
    "filter.social": "Social",

    "state.loading": "Cargando publicaciones…",
    "state.error": "No se pudo cargar el contenido.",
    "state.empty": "Aún no hay publicaciones.",
    "state.emptyFiltered": "No hay publicaciones en este filtro.",
    "state.configure": "Configura la URL base, el token de API y los IDs de canal en los ajustes del widget.",
    "state.retry": "Reintentar",

    "post.pinned": "Destacado",
    "post.read": "Ver publicación",
    "post.readMore": "Ver más",
    "post.by": "por {name}",

    "social.like": "Me gusta",
    "social.liked": "Te gusta",
    "social.comment": "Comentar",
    "social.comments": "Comentarios",
    "social.noComments": "Aún no hay comentarios. Sé el primero.",
    "social.commentPlaceholder": "Escribe un comentario…",
    "social.send": "Enviar",
    "social.commentFailed": "No se pudo publicar tu comentario.",

    "compose.placeholder": "¿Qué tienes en mente hoy?",
    "compose.title": "Crear publicación",
    "compose.submit": "Publicar",
    "compose.cancel": "Cancelar",
    "compose.failed": "No se pudo publicar tu contenido.",

    "a11y.close": "Cerrar",
    "a11y.openPost": "Abrir publicación",
  },

  es_ES: {
    "widget.title": "Novedades",

    "filter.all": "Todo",
    "filter.news": "Noticias",
    "filter.social": "Social",

    "state.loading": "Cargando publicaciones…",
    "state.error": "No se ha podido cargar el contenido.",
    "state.empty": "Todavía no hay publicaciones.",
    "state.emptyFiltered": "No hay publicaciones en este filtro.",
    "state.configure": "Configura la URL base, el token de API y los IDs de canal en los ajustes del widget.",
    "state.retry": "Reintentar",

    "post.pinned": "Destacado",
    "post.read": "Ver publicación",
    "post.readMore": "Ver más",
    "post.by": "por {name}",

    "social.like": "Me gusta",
    "social.liked": "Te gusta",
    "social.comment": "Comentar",
    "social.comments": "Comentarios",
    "social.noComments": "Todavía no hay comentarios. Sé el primero.",
    "social.commentPlaceholder": "Escribe un comentario…",
    "social.send": "Enviar",
    "social.commentFailed": "No se ha podido publicar tu comentario.",

    "compose.placeholder": "¿Qué tienes en mente hoy?",
    "compose.title": "Crear publicación",
    "compose.submit": "Publicar",
    "compose.cancel": "Cancelar",
    "compose.failed": "No se ha podido publicar tu contenido.",

    "a11y.close": "Cerrar",
    "a11y.openPost": "Abrir publicación",
  },

  de_DE: {
    "widget.title": "Neuigkeiten",

    "filter.all": "Alle",
    "filter.news": "News",
    "filter.social": "Social",

    "state.loading": "Beiträge werden geladen…",
    "state.error": "Inhalte konnten nicht geladen werden.",
    "state.empty": "Noch keine Beiträge.",
    "state.emptyFiltered": "Keine Beiträge in diesem Filter.",
    "state.configure": "Basis-URL, API-Token und Kanal-IDs in den Widget-Einstellungen hinterlegen.",
    "state.retry": "Erneut versuchen",

    "post.pinned": "Angepinnt",
    "post.read": "Beitrag ansehen",
    "post.readMore": "Mehr lesen",
    "post.by": "von {name}",

    "social.like": "Gefällt mir",
    "social.liked": "Gefällt dir",
    "social.comment": "Kommentieren",
    "social.comments": "Kommentare",
    "social.noComments": "Noch keine Kommentare. Mach den Anfang.",
    "social.commentPlaceholder": "Kommentar schreiben…",
    "social.send": "Senden",
    "social.commentFailed": "Dein Kommentar konnte nicht gepostet werden.",

    "compose.placeholder": "Was beschäftigt dich heute?",
    "compose.title": "Beitrag erstellen",
    "compose.submit": "Posten",
    "compose.cancel": "Abbrechen",
    "compose.failed": "Dein Beitrag konnte nicht veröffentlicht werden.",

    "a11y.close": "Schließen",
    "a11y.openPost": "Beitrag öffnen",
  },
};
