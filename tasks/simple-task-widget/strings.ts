// i18n bundles for simple-task-widget.
// en_US is the canonical source; de_DE / ar_SA mirror the other task widgets so
// locale + RTL detection behave consistently. Missing keys fall back to en_US.
import { Bundles } from "../shared/i18n";

export const STRINGS: Bundles = {
  en_US: {
    loading: "Loading…",
    empty: "No tasks to show",
    noneConfigured: "No tasks configured yet.",
    errorToggle: "Couldn't update the task. Please try again.",
    toggleTask: "Toggle task",
  },
  de_DE: {
    loading: "Wird geladen…",
    empty: "Keine Aufgaben vorhanden",
    noneConfigured: "Noch keine Aufgaben konfiguriert.",
    errorToggle: "Aufgabe konnte nicht aktualisiert werden. Bitte erneut versuchen.",
    toggleTask: "Aufgabe umschalten",
  },
  ar_SA: {
    loading: "جارٍ التحميل…",
    empty: "لا توجد مهام لعرضها",
    noneConfigured: "لم يتم تكوين أي مهام بعد.",
    errorToggle: "تعذّر تحديث المهمة. يرجى المحاولة مرة أخرى.",
    toggleTask: "تبديل المهمة",
  },
};
