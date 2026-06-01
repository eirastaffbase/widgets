/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// ../shared/i18n.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared i18n engine for the Staffbase task widgets.
//
// Imported by each widget via a relative path (e.g. `../shared/i18n`). webpack
// inlines it into each bundle — there is no runtime/package dependency.
//
// Design rules:
//  - Dependency-free, ES2015-compatible (matches each widget's tsconfig target).
//  - DOM/browser globals are accessed defensively (guarded) so the module is
//    safe to load in any widget context.
//  - The default/source locale is always `en_US`. For `en_US` (or any unmatched
//    locale) the helpers resolve to the exact source strings — so a widget that
//    only ships an `en_US` bundle behaves identically to having no i18n at all.
// ─────────────────────────────────────────────────────────────────────────────
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const DEFAULT_LOCALE = "en_US";
// Language prefixes that render right-to-left (from the Staffbase locale table:
// every entry flagged `direction: right_to_left`).
const RTL_LANGS = ["ar", "fa", "he", "ur", "ps"];
/** Split a raw locale string into a normalized `{ lang, region }`. */
function parts(raw) {
    // Accept `en-US`, `en_US`, `EN`, `zh-hk`, etc.
    const cleaned = (raw || "").trim().replace(/-/g, "_");
    const seg = cleaned.split("_");
    const lang = (seg[0] || "").toLowerCase();
    const region = (seg[1] || "").toUpperCase();
    return { lang, region };
}
/** Normalize any locale string to canonical `lang_REGION` (or just `lang`). */
function normalizeLocale(raw) {
    const { lang, region } = parts(raw);
    if (!lang)
        return "";
    return region ? lang + "_" + region : lang;
}
/**
 * Resolve a requested locale against the set of bundles we actually ship.
 * Match order: exact → same-language → DEFAULT_LOCALE.
 *
 *   resolveLocale("es_MX", ["en_US","es_ES"]) -> "es_ES"
 *   resolveLocale("de-DE", ["en_US","de_DE"]) -> "de_DE"
 *   resolveLocale("pt_PT", ["en_US","de_DE"]) -> "en_US"
 */
function resolveLocale(raw, available) {
    const norm = normalizeLocale(raw);
    if (!norm)
        return DEFAULT_LOCALE;
    // Exact (compare normalized on both sides so casing/dashes don't matter).
    for (const a of available) {
        if (normalizeLocale(a) === norm)
            return a;
    }
    // Same language, any region.
    const lang = parts(norm).lang;
    for (const a of available) {
        if (parts(a).lang === lang)
            return a;
    }
    return DEFAULT_LOCALE;
}
/** True when the locale's language renders right-to-left. */
function isRtl(locale) {
    return RTL_LANGS.indexOf(parts(locale).lang) !== -1;
}
/**
 * Pick the best locale for the current viewer.
 * Priority: explicit `configLocale` (authoritative Staffbase user locale) →
 * `navigator.language` (browser fallback) → DEFAULT_LOCALE.
 *
 * `configLocale` is read by the widget from `GET /api/users/{id}` → config.locale
 * (the only field that reflects the user's Staffbase language). It is passed in
 * rather than fetched here so this module stays free of auth/transport concerns.
 */
function detectLocale(opts) {
    const navLang = typeof navigator !== "undefined"
        ? navigator.language || ""
        : "";
    const candidates = [opts.configLocale || "", navLang];
    for (const c of candidates) {
        if (!c)
            continue;
        const r = resolveLocale(c, opts.available);
        // resolveLocale returns DEFAULT when nothing matched; only accept a
        // candidate if it actually produced a non-default match OR the default is
        // genuinely the best (its own language).
        if (r !== DEFAULT_LOCALE || parts(c).lang === parts(DEFAULT_LOCALE).lang) {
            return r;
        }
    }
    return resolveLocale(DEFAULT_LOCALE, opts.available);
}
/**
 * Build a translation function bound to `locale`.
 * Lookup order per key: requested locale → DEFAULT_LOCALE → the key itself.
 * Missing translations therefore degrade to English, never to blank/broken UI.
 *
 *   const t = makeT(STRINGS, "de_DE");
 *   t("refresh") // German if present, else English, else "refresh"
 */
// ─────────────────────────────────────────────────────────────────────────────
// On-demand content translation (Phase B "Translate" button).
//
// Free-text user content (task titles, descriptions, custom type names,
// comments) is translated on demand via Staffbase's POST /api/translations.
// Items are batched into one request as indexed <p> tags — the endpoint
// preserves tags and translates only text nodes, so we map results back by
// index. Transport/auth is supplied by the caller via `send` so this module
// stays free of endpoint/auth concerns.
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function unescHtml(s) {
    return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
/**
 * Translate a set of strings in a single batched request.
 * Returns a map of original-text → translated-text (only for non-empty inputs).
 * On any failure the map is empty (caller falls back to originals).
 *
 * `send(payload)` must POST the payload to /api/translations and resolve with
 * the translated `contents.value` string.
 */
function translateMap(texts, send) {
    return __awaiter(this, void 0, void 0, function* () {
        const map = {};
        const uniq = [];
        const seen = {};
        for (const raw of texts) {
            const t = (raw || "").trim();
            if (t && !seen[t]) {
                seen[t] = true;
                uniq.push(t);
            }
        }
        if (!uniq.length)
            return map;
        const payload = uniq.map((t, i) => `<p data-i="${i}">${escHtml(t)}</p>`).join("");
        let resp;
        try {
            resp = yield send(payload);
        }
        catch (_) {
            return map;
        }
        const re = /<p data-i="(\d+)">([\s\S]*?)<\/p>/g;
        let m;
        while ((m = re.exec(resp))) {
            const i = parseInt(m[1], 10);
            if (uniq[i] != null)
                map[uniq[i]] = unescHtml(m[2]);
        }
        return map;
    });
}
function makeT(bundles, locale) {
    const primary = bundles[locale] || {};
    const fallback = bundles[DEFAULT_LOCALE] || {};
    return function t(key) {
        if (primary[key] != null)
            return primary[key];
        if (fallback[key] != null)
            return fallback[key];
        return key;
    };
}

;// ./strings.ts
const STRINGS = {
    en_US: {
        auditForm: "Audit Form",
        auditQuestions: "Audit Questions",
        clickToEdit: "Click to edit",
        yourNamePlaceholder: "Your name",
        loadingYourName: "Loading your name…",
        storeAuditorDetails: "Store & Auditor Details",
        searchStorePlaceholder: "Search {store}…",
        loading: "Loading…",
        auditDate: "Audit Date",
        auditorName: "Auditor Name",
        auditorNotes: "Auditor Notes",
        auditorNotesPlaceholder: "Context for this audit session…",
        enterYourName: "Please enter your name.",
        noQuestions: "No questions",
        pass: "Pass",
        fail: "Fail",
        na: "N/A",
        poor: "Poor",
        excellent: "Excellent",
        reset: "Reset",
        start: "Start",
        taskWillBeGenerated: "Task will be generated",
        noFailures: "No failures",
        allPassedOrNa: "All answered questions passed or were marked N/A.",
        assignTo: "Assign to",
        groups: "Groups",
        people: "People",
        searchPlaceholder: "Search…",
        auditSummary: "Audit Summary",
        passing: "Passing",
        failing: "Failing",
        date: "Date",
        tasksFlagged: "Tasks flagged",
        notes: "Notes",
        categoryBreakdown: "Category Breakdown",
        tasksToCreate: "Tasks to Create",
        working: "Working…",
        noPeopleFound: "No people found",
        noGroupsFound: "No groups found",
        submitCreateTasks: "Submit & Create Tasks",
        submitting: "Submitting…",
        auditSubmittedMsg: 'Audit submitted! "{name}" created with {n} tasks.',
        edit: "edit",
        loadingStore: "Loading {store}…",
        selectStore: "Select a {store}…",
        optional: "(optional)",
        attachPhotoFile: "Attach photo or file",
        loadingQuestions: "Loading questions…",
        beginAudit: "Begin Audit",
        nOfMAnswered: "{a} of {b} answered",
        setup: "Setup",
        prev: "Prev",
        viewOverview: "View Overview",
        next: "Next",
        stop: "Stop",
        addPhoto: "Add photo",
        nPts: "{n} pts",
        critical: "Critical",
        autoTask: "Auto-task",
        dueLabel: "Due:",
        immediately: "Immediately",
        unassigned: "— Unassigned —",
        withinDays: "Within {d}d",
        auditor: "Auditor",
        scoreSummary: "{e} / {t} pts · {a} of {c} answered",
        nThreshold: "{n}% threshold",
        back: "Back",
    },
    de_DE: {
        auditForm: "Audit-Formular",
        auditQuestions: "Audit-Fragen",
        clickToEdit: "Zum Bearbeiten klicken",
        yourNamePlaceholder: "Ihr Name",
        loadingYourName: "Ihr Name wird geladen…",
        storeAuditorDetails: "Store- und Prüferdetails",
        searchStorePlaceholder: "{store} suchen…",
        loading: "Wird geladen…",
        auditDate: "Audit-Datum",
        auditorName: "Name des Prüfers",
        auditorNotes: "Prüfernotizen",
        auditorNotesPlaceholder: "Kontext für diese Audit-Sitzung…",
        enterYourName: "Bitte geben Sie Ihren Namen ein.",
        noQuestions: "Keine Fragen",
        pass: "Bestanden",
        fail: "Durchgefallen",
        na: "N/V",
        poor: "Schlecht",
        excellent: "Ausgezeichnet",
        reset: "Zurücksetzen",
        start: "Start",
        taskWillBeGenerated: "Aufgabe wird erstellt",
        noFailures: "Keine Mängel",
        allPassedOrNa: "Alle beantworteten Fragen wurden bestanden oder als N/V markiert.",
        assignTo: "Zuweisen an",
        groups: "Gruppen",
        people: "Personen",
        searchPlaceholder: "Suchen…",
        auditSummary: "Audit-Zusammenfassung",
        passing: "Bestanden",
        failing: "Nicht bestanden",
        date: "Datum",
        tasksFlagged: "Markierte Aufgaben",
        notes: "Notizen",
        categoryBreakdown: "Kategorienaufschlüsselung",
        tasksToCreate: "Zu erstellende Aufgaben",
        working: "Wird bearbeitet…",
        noPeopleFound: "Keine Personen gefunden",
        noGroupsFound: "Keine Gruppen gefunden",
        submitCreateTasks: "Senden & Aufgaben erstellen",
        submitting: "Wird gesendet…",
        auditSubmittedMsg: 'Audit gesendet! „{name}“ mit {n} Aufgaben erstellt.',
        edit: "bearbeiten",
        loadingStore: "{store} werden geladen…",
        selectStore: "{store} auswählen…",
        optional: "(optional)",
        attachPhotoFile: "Foto oder Datei anhängen",
        loadingQuestions: "Fragen werden geladen…",
        beginAudit: "Audit beginnen",
        nOfMAnswered: "{a} von {b} beantwortet",
        setup: "Einrichtung",
        prev: "Zurück",
        viewOverview: "Übersicht anzeigen",
        next: "Weiter",
        stop: "Stopp",
        addPhoto: "Foto hinzufügen",
        nPts: "{n} Pkt.",
        critical: "Kritisch",
        autoTask: "Auto-Aufgabe",
        dueLabel: "Fällig:",
        immediately: "Sofort",
        unassigned: "— Nicht zugewiesen —",
        withinDays: "Innerhalb {d} T",
        auditor: "Prüfer",
        scoreSummary: "{e} / {t} Pkt. · {a} von {c} beantwortet",
        nThreshold: "{n}% Schwelle",
        back: "Zurück",
    },
    ar_SA: {
        auditForm: "نموذج التدقيق",
        auditQuestions: "أسئلة التدقيق",
        clickToEdit: "انقر للتعديل",
        yourNamePlaceholder: "اسمك",
        loadingYourName: "جارٍ تحميل اسمك…",
        storeAuditorDetails: "تفاصيل المتجر والمدقّق",
        searchStorePlaceholder: "ابحث في {store}…",
        loading: "جارٍ التحميل…",
        auditDate: "تاريخ التدقيق",
        auditorName: "اسم المدقّق",
        auditorNotes: "ملاحظات المدقّق",
        auditorNotesPlaceholder: "سياق جلسة التدقيق هذه…",
        enterYourName: "الرجاء إدخال اسمك.",
        noQuestions: "لا توجد أسئلة",
        pass: "ناجح",
        fail: "راسب",
        na: "غير منطبق",
        poor: "ضعيف",
        excellent: "ممتاز",
        reset: "إعادة تعيين",
        start: "بدء",
        taskWillBeGenerated: "سيتم إنشاء مهمة",
        noFailures: "لا توجد إخفاقات",
        allPassedOrNa: "نجحت جميع الأسئلة المُجابة أو تم تحديدها كغير منطبقة.",
        assignTo: "إسناد إلى",
        groups: "المجموعات",
        people: "الأشخاص",
        searchPlaceholder: "بحث…",
        auditSummary: "ملخص التدقيق",
        passing: "ناجح",
        failing: "غير ناجح",
        date: "التاريخ",
        tasksFlagged: "المهام المُحدَّدة",
        notes: "ملاحظات",
        categoryBreakdown: "تفصيل حسب الفئة",
        tasksToCreate: "المهام المطلوب إنشاؤها",
        working: "جارٍ العمل…",
        noPeopleFound: "لم يتم العثور على أشخاص",
        noGroupsFound: "لم يتم العثور على مجموعات",
        submitCreateTasks: "إرسال وإنشاء المهام",
        submitting: "جارٍ الإرسال…",
        auditSubmittedMsg: 'تم إرسال التدقيق! تم إنشاء «{name}» مع {n} مهام.',
        edit: "تعديل",
        loadingStore: "جارٍ تحميل {store}…",
        selectStore: "اختر {store}…",
        optional: "(اختياري)",
        attachPhotoFile: "إرفاق صورة أو ملف",
        loadingQuestions: "جارٍ تحميل الأسئلة…",
        beginAudit: "بدء التدقيق",
        nOfMAnswered: "{a} من {b} تمت الإجابة عليها",
        setup: "الإعداد",
        prev: "السابق",
        viewOverview: "عرض النظرة العامة",
        next: "التالي",
        stop: "إيقاف",
        addPhoto: "إضافة صورة",
        nPts: "{n} نقطة",
        critical: "حرج",
        autoTask: "مهمة تلقائية",
        dueLabel: "الاستحقاق:",
        immediately: "فورًا",
        unassigned: "— غير مُسنَد —",
        withinDays: "خلال {d} يوم",
        auditor: "المدقّق",
        scoreSummary: "{e} / {t} نقطة · {a} من {c} تمت الإجابة عليها",
        nThreshold: "عتبة {n}%",
        back: "رجوع",
    },
    es_ES: {
        auditForm: "Formulario de auditoría",
        auditQuestions: "Preguntas sobre auditoría",
        clickToEdit: "Haz clic para editar",
        yourNamePlaceholder: "Tu nombre",
        loadingYourName: "Cargando tu nombre...",
        storeAuditorDetails: "Detalles de la Tienda y el Auditor",
        searchStorePlaceholder: "Registrar {store}...",
        loading: "Cargando...",
        auditDate: "Fecha de la auditoría",
        auditorName: "Nombre del auditor",
        auditorNotes: "Notas del auditor",
        auditorNotesPlaceholder: "Contexto de esta sesión de auditoría...",
        enterYourName: "Por favor, introduzca su nombre.",
        noQuestions: "Sin preguntas",
        pass: "Paso",
        fail: "Fallo",
        na: "N/A",
        poor: "Pobre",
        excellent: "Excelente",
        reset: "Reinicio",
        start: "Comienzo",
        taskWillBeGenerated: "Se generará la tarea",
        noFailures: "Sin fallos",
        allPassedOrNa: "Todas las preguntas respondidas aprobaron o fueron marcadas como N/A.",
        assignTo: "Asignar a",
        groups: "Grupos",
        people: "Personas",
        searchPlaceholder: "Buscar...",
        auditSummary: "Resumen de la auditoría",
        passing: "Fallecimiento",
        failing: "Fracaso",
        date: "Fecha",
        tasksFlagged: "Tareas marcadas",
        notes: "Notas",
        categoryBreakdown: "Desglose por categorías",
        tasksToCreate: "Tareas para crear",
        working: "Trabajando...",
        noPeopleFound: "No se encontró a nadie",
        noGroupsFound: "No se han encontrado grupos",
        submitCreateTasks: "Enviar y crear tareas",
        submitting: "Entregando...",
        auditSubmittedMsg: "¡Auditoría enviada! &#34;{name}&#34; creado con {n} tareas.",
        edit: "editar",
        loadingStore: "Cargando {store}...",
        selectStore: "Elige un {store}...",
        optional: "(opcional)",
        attachPhotoFile: "Adjuntar foto o archivo",
        loadingQuestions: "Cargando preguntas...",
        beginAudit: "Inicio de la auditoría",
        nOfMAnswered: "{a} de {b} respondido",
        setup: "Configuración",
        prev: "Anterior",
        viewOverview: "Ver visión general",
        next: "Siguiente",
        stop: "¡Para",
        addPhoto: "Añadir foto",
        nPts: "{n} pacientes",
        critical: "Crítica",
        autoTask: "Auto-tarea",
        dueLabel: "Fecha límite:",
        immediately: "Inmediatamente",
        unassigned: "— Sin asignar —",
        withinDays: "Dentro de {d}",
        auditor: "Auditor",
        scoreSummary: "{e} / {t} puntos · {a} de {c} respondió",
        nThreshold: "umbral del {n}%",
        back: "Atrás",
    },
    fr_FR: {
        auditForm: "Formulaire d’audit",
        auditQuestions: "Questions d’audit",
        clickToEdit: "Cliquez pour modifier",
        yourNamePlaceholder: "Ton nom",
        loadingYourName: "Chargement de ton nom...",
        storeAuditorDetails: "Détails du magasin et de l’auditeur",
        searchStorePlaceholder: "Fouillez {store}...",
        loading: "Chargement...",
        auditDate: "Date de l’audit",
        auditorName: "Nom de l’auditeur",
        auditorNotes: "Notes de l’auditeur",
        auditorNotesPlaceholder: "Contexte pour cette session d’audit...",
        enterYourName: "Veuillez entrer votre nom.",
        noQuestions: "Pas de questions",
        pass: "Pass",
        fail: "Échec",
        na: "N/A",
        poor: "Pauvre",
        excellent: "Excellent",
        reset: "Réinitialisation",
        start: "Début",
        taskWillBeGenerated: "La tâche sera générée",
        noFailures: "Aucune défaillance",
        allPassedOrNa: "Toutes les questions répondues ont été réussies ou ont été marquées N/A.",
        assignTo: "Assigner à",
        groups: "Groupes",
        people: "Personnalités",
        searchPlaceholder: "Chercher...",
        auditSummary: "Résumé de l’audit",
        passing: "Passage",
        failing: "Échec",
        date: "Date",
        tasksFlagged: "Tâches signalées",
        notes: "Notes",
        categoryBreakdown: "Répartition par catégorie",
        tasksToCreate: "Tâches à créer",
        working: "Travailler...",
        noPeopleFound: "Aucune personne trouvée",
        noGroupsFound: "Aucun groupe trouvé",
        submitCreateTasks: "Soumettre et créer des tâches",
        submitting: "Soumettre...",
        auditSubmittedMsg: "Audit soumis ! « {name} » créé avec {n} tâches.",
        edit: "Édition",
        loadingStore: "Chargement {store}...",
        selectStore: "Sélectionnez un {store}...",
        optional: "(optionnel)",
        attachPhotoFile: "Joindre photo ou fichier",
        loadingQuestions: "Questions de chargement...",
        beginAudit: "Début de l’audit",
        nOfMAnswered: "{a} de {b} répondu",
        setup: "Mise en place",
        prev: "Précédent",
        viewOverview: "Voir l’aperçu",
        next: "Suivant",
        stop: "Arrête",
        addPhoto: "Ajouter la photo",
        nPts: "{n} PTS",
        critical: "Critique",
        autoTask: "Auto-tâche",
        dueLabel: "À rendre :",
        immediately: "Immédiatement",
        unassigned: "— Non assigné —",
        withinDays: "Dans {d}",
        auditor: "Auditeur",
        scoreSummary: "{e} / {t} pts · {a} de {c} répondu",
        nThreshold: "Seuil de {n} %",
        back: "Retour",
    },
    nl_NL: {
        auditForm: "Auditformulier",
        auditQuestions: "Auditvragen",
        clickToEdit: "Klik om te bewerken",
        yourNamePlaceholder: "Jouw naam",
        loadingYourName: "Laad je naam...",
        storeAuditorDetails: "Winkel- en auditorgegevens",
        searchStorePlaceholder: "Zoek {store}...",
        loading: "Laden...",
        auditDate: "Datum van de audit",
        auditorName: "Naam van de auditor",
        auditorNotes: "Aantekeningen van de Auditor",
        auditorNotesPlaceholder: "Context voor deze auditsessie...",
        enterYourName: "Voer alstublieft uw naam in.",
        noQuestions: "Geen vragen",
        pass: "Pas",
        fail: "Mislukt",
        na: "N.v.t.",
        poor: "Arme",
        excellent: "Uitstekend",
        reset: "Reset",
        start: "Start",
        taskWillBeGenerated: "De taak wordt gegenereerd",
        noFailures: "Geen mislukkingen",
        allPassedOrNa: "Alle beantwoorde vragen zijn geslaagd of werden als N.v.t. gemarkeerd.",
        assignTo: "Toewijzen aan",
        groups: "Groepen",
        people: "Mensen",
        searchPlaceholder: "Zoek...",
        auditSummary: "Auditsamenvatting",
        passing: "Overlijden",
        failing: "Falen",
        date: "Datum",
        tasksFlagged: "Taken gemarkeerd",
        notes: "Noten",
        categoryBreakdown: "Categorie-opsplitsing",
        tasksToCreate: "Taken om te creëren",
        working: "Aan het werk...",
        noPeopleFound: "Geen mensen gevonden",
        noGroupsFound: "Geen groepen gevonden",
        submitCreateTasks: "Taken indienen en aanmaken",
        submitting: "Indienen...",
        auditSubmittedMsg: "Audit ingediend! &#34;{name}&#34; gemaakt met {n} taken.",
        edit: "Bewerking",
        loadingStore: "Laad {store}...",
        selectStore: "Kies een {store}...",
        optional: "(optioneel)",
        attachPhotoFile: "Voeg foto of bestand bij",
        loadingQuestions: "Vragen laden...",
        beginAudit: "Start met audit",
        nOfMAnswered: "{a} van {b} antwoordde",
        setup: "Opstelling",
        prev: "Vorige",
        viewOverview: "Bekijk Overzicht",
        next: "Volgende",
        stop: "Stop",
        addPhoto: "Foto toevoegen",
        nPts: "{n} patiënten",
        critical: "Kritisch",
        autoTask: "Auto-task",
        dueLabel: "Deadline:",
        immediately: "Onmiddellijk",
        unassigned: "— Niet toegewezen —",
        withinDays: "Binnen {d}d",
        auditor: "Auditor",
        scoreSummary: "{e} / {t} pts · {a} van {c} antwoordde",
        nThreshold: "{n}% drempel",
        back: "Achteruit",
    },
    zh_CN: {
        auditForm: "审计表格",
        auditQuestions: "审计问题",
        clickToEdit: "点击编辑",
        yourNamePlaceholder: "你的名字",
        loadingYourName: "加载你的名字......",
        storeAuditorDetails: "门店与审计员详情",
        searchStorePlaceholder: "搜查{store}......",
        loading: "加载中......",
        auditDate: "审计日期",
        auditorName: "审计员姓名",
        auditorNotes: "审计员笔记",
        auditorNotesPlaceholder: "这次审计会议的背景......",
        enterYourName: "请输入您的名字。",
        noQuestions: "没有任何疑问",
        pass: "山口",
        fail: "失败",
        na: "无",
        poor: "可怜",
        excellent: "太好了",
        reset: "重置",
        start: "开始",
        taskWillBeGenerated: "任务将被生成",
        noFailures: "没有故障",
        allPassedOrNa: "所有已答题或均已通过或标记为不适用。",
        assignTo: "分配到",
        groups: "团体",
        people: "人物",
        searchPlaceholder: "搜索......",
        auditSummary: "审计摘要",
        passing: "通过",
        failing: "失败",
        date: "日期",
        tasksFlagged: "标记任务",
        notes: "注释",
        categoryBreakdown: "类别分类",
        tasksToCreate: "需要创建的任务",
        working: "工作......",
        noPeopleFound: "未发现任何人",
        noGroupsFound: "未找到组",
        submitCreateTasks: "提交与创建任务",
        submitting: "臣服......",
        auditSubmittedMsg: "审计提交！“{name}”由{n}任务创建。",
        edit: "编辑",
        loadingStore: "正在加载{store}......",
        selectStore: "选择一个{store}......",
        optional: "（可选）",
        attachPhotoFile: "附上照片或文件",
        loadingQuestions: "加载问题......",
        beginAudit: "开始审计",
        nOfMAnswered: "{a} {b}回答",
        setup: "设置",
        prev: "前期",
        viewOverview: "查看概览",
        next: "下一个",
        stop: "停下",
        addPhoto: "添加照片",
        nPts: "{n}点",
        critical: "批判",
        autoTask: "自动任务",
        dueLabel: "到期：",
        immediately: "立刻",
        unassigned: "——未分配——",
        withinDays: "在{d}d",
        auditor: "审计长",
        scoreSummary: "{e} / {t}分·{a}人回答{c}",
        nThreshold: "{n}%门槛",
        back: "返回",
    },
    ja_JP: {
        auditForm: "監査フォーム",
        auditQuestions: "監査に関する質問",
        clickToEdit: "編集",
        yourNamePlaceholder: "君の名前",
        loadingYourName: "名前を読み込みます...",
        storeAuditorDetails: "店舗および監査人詳細",
        searchStorePlaceholder: "{store}を捜索...",
        loading: "読み込み中...",
        auditDate: "監査日",
        auditorName: "監査官名",
        auditorNotes: "監査人ノート",
        auditorNotesPlaceholder: "この監査セッションの背景は...",
        enterYourName: "お名前を入力してください。",
        noQuestions: "質問はなし",
        pass: "パス",
        fail: "失敗",
        na: "該当なし",
        poor: "かわいそうに",
        excellent: "素晴らしい",
        reset: "リセット",
        start: "開始",
        taskWillBeGenerated: "タスクが生成されます",
        noFailures: "失敗はありません",
        allPassedOrNa: "すべての問題に答えた問題は合格または該当なしとマークされていました。",
        assignTo: "割り当て",
        groups: "グループ",
        people: "人々",
        searchPlaceholder: "捜索...",
        auditSummary: "監査概要",
        passing: "パス",
        failing: "失敗",
        date: "日付",
        tasksFlagged: "フラグが立ったタスク",
        notes: "注記",
        categoryBreakdown: "カテゴリー内訳",
        tasksToCreate: "作成すべきタスク",
        working: "仕事中...",
        noPeopleFound: "誰も見つかりませんでした",
        noGroupsFound: "グループは見つかりませんでした",
        submitCreateTasks: "タスクの送信と作成",
        submitting: "服従...",
        auditSubmittedMsg: "監査提出!「{name}」は{n}タスクで作成されました。",
        edit: "編集",
        loadingStore: "読み込み{store}...",
        selectStore: "{store}を選んで...",
        optional: "(任意)",
        attachPhotoFile: "写真またはファイルを添付してください",
        loadingQuestions: "質問を読み込み中...",
        beginAudit: "監査開始",
        nOfMAnswered: "{a}{b}が答えた",
        setup: "セットアップ",
        prev: "前回",
        viewOverview: "概要を見る",
        next: "次",
        stop: "やめて",
        addPhoto: "写真を追加",
        nPts: "{n}点",
        critical: "重要な点",
        autoTask: "オートタスク",
        dueLabel: "期限:",
        immediately: "すぐに",
        unassigned: "— 未割り当て —",
        withinDays: "{d}d",
        auditor: "監査官",
        scoreSummary: "{e} / {t} pts ·{a}{c}が答えた",
        nThreshold: "{n}%の閾値",
        back: "戻る",
    },
    th_TH: {
        auditForm: "แบบฟอร์มการตรวจสอบ",
        auditQuestions: "คําถามเกี่ยวกับการตรวจสอบ",
        clickToEdit: "คลิกเพื่อแก้ไข",
        yourNamePlaceholder: "ชื่อของคุณ",
        loadingYourName: "กําลังโหลดชื่อของคุณ...",
        storeAuditorDetails: "รายละเอียดร้านค้าและผู้ตรวจสอบบัญชี",
        searchStorePlaceholder: "ค้นหา{store}...",
        loading: "กําลังโหลด...",
        auditDate: "วันที่ตรวจสอบ",
        auditorName: "ชื่อผู้สอบบัญชี",
        auditorNotes: "หมายเหตุผู้สอบบัญชี",
        auditorNotesPlaceholder: "บริบทสําหรับเซสชันการตรวจสอบนี้...",
        enterYourName: "กรุณากรอกชื่อของคุณ",
        noQuestions: "ไม่มีคําถาม",
        pass: "ผ่าน",
        fail: "ล้มเหลว",
        na: "ไม่มี",
        poor: "แย่",
        excellent: "ดีเยี่ยม",
        reset: "รีเซ็ต",
        start: "เริ่มต้น",
        taskWillBeGenerated: "งานจะถูกสร้างขึ้น",
        noFailures: "ไม่มีความล้มเหลว",
        allPassedOrNa: "คําถามที่ตอบทั้งหมดผ่านหรือถูกทําเครื่องหมายว่า N/A",
        assignTo: "มอบหมายให้",
        groups: "กลุ่ม",
        people: "บุคลากร",
        searchPlaceholder: "ค้นหา...",
        auditSummary: "สรุปการตรวจสอบ",
        passing: "ผ่าน",
        failing: "ล้มเหลว",
        date: "วันที่",
        tasksFlagged: "งานที่ถูกตั้งค่าสถานะ",
        notes: "หมายเหตุ",
        categoryBreakdown: "รายละเอียดหมวดหมู่",
        tasksToCreate: "งานที่ต้องสร้าง",
        working: "ทํางาน...",
        noPeopleFound: "ไม่พบบุคคล",
        noGroupsFound: "ไม่พบกลุ่ม",
        submitCreateTasks: "ส่งและสร้างงาน",
        submitting: "กําลังส่ง...",
        auditSubmittedMsg: "ส่งการตรวจสอบแล้ว! &#34;{name}&#34; ที่สร้างขึ้นด้วยงาน{n}",
        edit: "แก้ไข",
        loadingStore: "กําลังโหลด{store}...",
        selectStore: "เลือก{store}...",
        optional: "(ไม่บังคับ)",
        attachPhotoFile: "แนบรูปภาพหรือไฟล์",
        loadingQuestions: "กําลังโหลดคําถาม...",
        beginAudit: "เริ่มการตรวจสอบ",
        nOfMAnswered: "{a} จาก {b} ตอบ",
        setup: "การติดตั้ง",
        prev: "ก่อนหน้า",
        viewOverview: "ดูภาพรวม",
        next: "ต่อไป",
        stop: "หยุด",
        addPhoto: "เพิ่มรูปภาพ",
        nPts: "{n} คะแนน",
        critical: "วิกฤต",
        autoTask: "งานอัตโนมัติ",
        dueLabel: "ครบกําหนด:",
        immediately: "ทันที",
        unassigned: "- ไม่ได้มอบหมาย -",
        withinDays: "ภายใน {d} วัน",
        auditor: "ผู้สอบบัญชี",
        scoreSummary: "{e} / {t} คะแนน · {a} จาก {c} ตอบ",
        nThreshold: "เกณฑ์ {n}%",
        back: "ย้อนกลับ",
    },
    es_MX: {
        auditForm: "Formulario de auditoría",
        auditQuestions: "Preguntas sobre auditoría",
        clickToEdit: "Haz clic para editar",
        yourNamePlaceholder: "Tu nombre",
        loadingYourName: "Cargando tu nombre...",
        storeAuditorDetails: "Detalles de la Tienda y el Auditor",
        searchStorePlaceholder: "Registrar {store}...",
        loading: "Cargando...",
        auditDate: "Fecha de la auditoría",
        auditorName: "Nombre del auditor",
        auditorNotes: "Notas del auditor",
        auditorNotesPlaceholder: "Contexto de esta sesión de auditoría...",
        enterYourName: "Por favor, introduzca su nombre.",
        noQuestions: "Sin preguntas",
        pass: "Paso",
        fail: "Fallo",
        na: "N/A",
        poor: "Pobre",
        excellent: "Excelente",
        reset: "Reinicio",
        start: "Comienzo",
        taskWillBeGenerated: "Se generará la tarea",
        noFailures: "Sin fallos",
        allPassedOrNa: "Todas las preguntas respondidas aprobaron o fueron marcadas como N/A.",
        assignTo: "Asignar a",
        groups: "Grupos",
        people: "Personas",
        searchPlaceholder: "Buscar...",
        auditSummary: "Resumen de la auditoría",
        passing: "Fallecimiento",
        failing: "Fracaso",
        date: "Fecha",
        tasksFlagged: "Tareas marcadas",
        notes: "Notas",
        categoryBreakdown: "Desglose por categorías",
        tasksToCreate: "Tareas para crear",
        working: "Trabajando...",
        noPeopleFound: "No se encontró a nadie",
        noGroupsFound: "No se han encontrado grupos",
        submitCreateTasks: "Enviar y crear tareas",
        submitting: "Entregando...",
        auditSubmittedMsg: "¡Auditoría enviada! &#34;{name}&#34; creado con {n} tareas.",
        edit: "editar",
        loadingStore: "Cargando {store}...",
        selectStore: "Elige un {store}...",
        optional: "(opcional)",
        attachPhotoFile: "Adjuntar foto o archivo",
        loadingQuestions: "Cargando preguntas...",
        beginAudit: "Inicio de la auditoría",
        nOfMAnswered: "{a} de {b} respondido",
        setup: "Configuración",
        prev: "Anterior",
        viewOverview: "Ver visión general",
        next: "Siguiente",
        stop: "¡Para",
        addPhoto: "Añadir foto",
        nPts: "{n} pacientes",
        critical: "Crítica",
        autoTask: "Auto-tarea",
        dueLabel: "Fecha límite:",
        immediately: "Inmediatamente",
        unassigned: "— Sin asignar —",
        withinDays: "Dentro de {d}",
        auditor: "Auditor",
        scoreSummary: "{e} / {t} puntos · {a} de {c} respondió",
        nThreshold: "umbral del {n}%",
        back: "Atrás",
    },
    vi_VN: {
        auditForm: "Biểu mẫu kiểm toán",
        auditQuestions: "Câu hỏi kiểm toán",
        clickToEdit: "Bấm để chỉnh sửa",
        yourNamePlaceholder: "Tên của bạn",
        loadingYourName: "Đang tải tên của bạn...",
        storeAuditorDetails: "Chi tiết cửa hàng & kiểm toán viên",
        searchStorePlaceholder: "Tìm kiếm {store}...",
        loading: "Đang tải...",
        auditDate: "Ngày kiểm toán",
        auditorName: "Tên kiểm toán viên",
        auditorNotes: "Ghi chú kiểm toán viên",
        auditorNotesPlaceholder: "Bối cảnh cho phiên kiểm toán này...",
        enterYourName: "Vui lòng nhập tên của bạn.",
        noQuestions: "Không có câu hỏi",
        pass: "Vượt qua",
        fail: "Không thành công",
        na: "Không có",
        poor: "Nghèo",
        excellent: "Thông minh",
        reset: "Xóa và làm lại",
        start: "Bắt đầu",
        taskWillBeGenerated: "Nhiệm vụ sẽ được tạo",
        noFailures: "Không thất bại",
        allPassedOrNa: "Tất cả các câu hỏi đã trả lời đều đạt hoặc được đánh dấu N/A.",
        assignTo: "Gán cho",
        groups: "Nhóm",
        people: "Con người",
        searchPlaceholder: "Tìm kiếm...",
        auditSummary: "Tóm tắt kiểm toán",
        passing: "Vượt qua",
        failing: "Không thành công",
        date: "Ngày",
        tasksFlagged: "Nhiệm vụ được gắn cờ",
        notes: "Ghi chú",
        categoryBreakdown: "Phân tích danh mục",
        tasksToCreate: "Nhiệm vụ cần tạo",
        working: "Đang làm việc...",
        noPeopleFound: "Không tìm thấy người",
        noGroupsFound: "Không tìm thấy nhóm nào",
        submitCreateTasks: "Gửi và tạo nhiệm vụ",
        submitting: "Đang gửi...",
        auditSubmittedMsg: "Kiểm toán đã gửi! &#34;{name}&#34; được tạo ra với các nhiệm vụ {n}.",
        edit: "Chỉnh sửa",
        loadingStore: "Đang tải {store}...",
        selectStore: "Chọn một {store}...",
        optional: "(tùy chọn)",
        attachPhotoFile: "Đính kèm ảnh hoặc tệp",
        loadingQuestions: "Đang tải câu hỏi...",
        beginAudit: "Bắt đầu kiểm tra",
        nOfMAnswered: "{a} của {b} đã trả lời",
        setup: "Thành lập",
        prev: "Trước",
        viewOverview: "Xem tổng quan",
        next: "Kế tiếp",
        stop: "Dừng lại",
        addPhoto: "Thêm ảnh",
        nPts: "{n} điểm",
        critical: "Quan trọng",
        autoTask: "Tự động tác vụ",
        dueLabel: "Đến hạn:",
        immediately: "Ngay lập tức",
        unassigned: "- Chưa được chỉ định -",
        withinDays: "Trong vòng {d}",
        auditor: "Kiểm toán viên",
        scoreSummary: "{e} / {t} điểm · {a} của {c} đã trả lời",
        nThreshold: "Ngưỡng {n}%",
        back: "Quay lại",
    },
    ko_KR: {
        auditForm: "감사 양식",
        auditQuestions: "감사 질문",
        clickToEdit: "클릭하여 편집하기",
        yourNamePlaceholder: "네 이름",
        loadingYourName: "이름 불러오는 중...",
        storeAuditorDetails: "매장 및 감사인 상세 정보",
        searchStorePlaceholder: "수색{store}...",
        loading: "로딩 중...",
        auditDate: "감사일",
        auditorName: "감사인 이름",
        auditorNotes: "감사관 노트",
        auditorNotesPlaceholder: "이번 감사 세션의 배경...",
        enterYourName: "이름을 입력해 주세요.",
        noQuestions: "질문 없어",
        pass: "고개",
        fail: "실패",
        na: "해당 없음",
        poor: "불쌍하네요",
        excellent: "훌륭해",
        reset: "리셋",
        start: "시작",
        taskWillBeGenerated: "과제가 생성될 것입니다",
        noFailures: "고장 없음",
        allPassedOrNa: "모든 답변이 합격되었거나 해당 문제로 표시되지 않았습니다.",
        assignTo: "할당",
        groups: "그룹",
        people: "인물",
        searchPlaceholder: "수색...",
        auditSummary: "감사 요약",
        passing: "통과",
        failing: "실패",
        date: "날짜",
        tasksFlagged: "과제 표시됨",
        notes: "주석",
        categoryBreakdown: "카테고리 분류",
        tasksToCreate: "만들 과제",
        working: "일하는 중...",
        noPeopleFound: "사람 찾지 못했다",
        noGroupsFound: "그룹 찾기 어떠",
        submitCreateTasks: "제출 및 작업 생성",
        submitting: "복종...",
        auditSubmittedMsg: "감사 제출! &#34;{name}&#34;은 {n} 작업으로 생성됩니다.",
        edit: "수정",
        loadingStore: "로딩 {store}...",
        selectStore: "{store} 선택하세요...",
        optional: "(선택 사항)",
        attachPhotoFile: "사진이나 파일을 첨부하세요",
        loadingQuestions: "질문 로딩...",
        beginAudit: "감사 시작",
        nOfMAnswered: "{a} {b} 대답했다",
        setup: "설정",
        prev: "이전",
        viewOverview: "개요 보기",
        next: "다음",
        stop: "멈춰",
        addPhoto: "사진 추가하세요",
        nPts: "{n}",
        critical: "비평",
        autoTask: "자동 작업",
        dueLabel: "기한:",
        immediately: "즉시",
        unassigned: "— 배정되지 않음 —",
        withinDays: "{d} 내에서",
        auditor: "감사관",
        scoreSummary: "{e} / {t} 점 · {c} {a} 대답했다",
        nThreshold: "{n}% 임계값",
        back: "뒤로",
    },
    tl_PH: {
        auditForm: "Form ng Pag-audit",
        auditQuestions: "Mga Tanong sa Pag-audit",
        clickToEdit: "Mag-click upang baguhin",
        yourNamePlaceholder: "Ang iyong pangalan",
        loadingYourName: "I-load ang Iyong Pangalan ...",
        storeAuditorDetails: "Mga Detalye ng Tindahan at Auditor",
        searchStorePlaceholder: "Hanapin {store} ...",
        loading: "Naglo-load...",
        auditDate: "Petsa ng Pag-audit",
        auditorName: "Pangalan ng Auditor",
        auditorNotes: "Mga Tala ng Auditor",
        auditorNotesPlaceholder: "Konteksto para sa sesyon ng pag-audit na ito ...",
        enterYourName: "Mangyaring ipasok ang iyong pangalan.",
        noQuestions: "Walang mga tanong",
        pass: "Pumasa",
        fail: "Nabigo",
        na: "N / A",
        poor: "Mahirap",
        excellent: "Napakahusay",
        reset: "I-reset",
        start: "Simulan",
        taskWillBeGenerated: "Ang gawain ay nabuo",
        noFailures: "Walang mga pagkabigo",
        allPassedOrNa: "Lahat ng sagot sa tanong ay pumasa o minarkahan ng N/A.",
        assignTo: "Magtalaga sa",
        groups: "Mga Grupo",
        people: "Mga Tao",
        searchPlaceholder: "Paghahanap...",
        auditSummary: "Buod ng Audit",
        passing: "Pagpasa",
        failing: "Pagkabigo",
        date: "Petsa",
        tasksFlagged: "Mga gawain na na-flag",
        notes: "Mga Tala",
        categoryBreakdown: "Pagkasira ng Kategorya",
        tasksToCreate: "Mga Gawain na Lumikha",
        working: "Nagtatrabaho ...",
        noPeopleFound: "Walang natagpuan na tao",
        noGroupsFound: "Walang natagpuang grupo",
        submitCreateTasks: "Isumite at Lumikha ng Mga Gawain",
        submitting: "Pagsusumite...",
        auditSubmittedMsg: "Isinumite ang audit! &#34;{name}&#34; na nilikha gamit ang {n} mga gawain.",
        edit: "baguhin",
        loadingStore: "Pag-load {store} ...",
        selectStore: "Pumili ng isang {store} ...",
        optional: "(opsyonal)",
        attachPhotoFile: "Ilakip ang larawan o file",
        loadingQuestions: "Naglo-load ng mga katanungan ...",
        beginAudit: "Simulan ang Pag-audit",
        nOfMAnswered: "{a} ng {b} ang sumagot",
        setup: "Pag-setup",
        prev: "Nakaraan",
        viewOverview: "Tingnan ang Pangkalahatang-ideya",
        next: "Susunod",
        stop: "Tumigil",
        addPhoto: "Email Address *",
        nPts: "{n} pts",
        critical: "Kritikal",
        autoTask: "Awtomatikong gawain",
        dueLabel: "Dahil sa:",
        immediately: "Agad",
        unassigned: "— Hindi nakatalaga —",
        withinDays: "Sa loob ng {d}d",
        auditor: "Auditor",
        scoreSummary: "{e} / {t} pts · {a} ng {c} ang sumagot",
        nThreshold: "{n}% threshold",
        back: "Bumalik",
    },
    pt_BR: {
        auditForm: "Formulário de Auditoria",
        auditQuestions: "Perguntas de Auditoria",
        clickToEdit: "Clique para editar",
        yourNamePlaceholder: "Seu nome",
        loadingYourName: "Carregando seu nome...",
        storeAuditorDetails: "Detalhes de Loja e Auditor",
        searchStorePlaceholder: "Procurem {store}...",
        loading: "Carregando...",
        auditDate: "Data da Auditoria",
        auditorName: "Nome do Auditor",
        auditorNotes: "Notas do Auditor",
        auditorNotesPlaceholder: "Contexto para esta sessão de auditoria...",
        enterYourName: "Por favor, insira seu nome.",
        noQuestions: "Sem perguntas",
        pass: "Passe",
        fail: "Fracasso",
        na: "N/A",
        poor: "Pobre",
        excellent: "Excelente",
        reset: "Reiniciar",
        start: "Comece",
        taskWillBeGenerated: "A tarefa será gerada",
        noFailures: "Sem falhas",
        allPassedOrNa: "Todas as perguntas respondidas passaram ou foram marcadas N/A.",
        assignTo: "Atribuir a",
        groups: "Grupos",
        people: "Pessoas",
        searchPlaceholder: "Procurar...",
        auditSummary: "Resumo da Auditoria",
        passing: "Passagem",
        failing: "Fracasso",
        date: "Data",
        tasksFlagged: "Tarefas sinalizadas",
        notes: "Notas",
        categoryBreakdown: "Distribuição por Categorias",
        tasksToCreate: "Tarefas a Criar",
        working: "Trabalhando...",
        noPeopleFound: "Nenhuma pessoa encontrada",
        noGroupsFound: "Nenhum grupo encontrado",
        submitCreateTasks: "Enviar e Criar Tarefas",
        submitting: "Submetendo...",
        auditSubmittedMsg: "Auditoria enviada! &#34;{name}&#34; criado com {n} tarefas.",
        edit: "Editar",
        loadingStore: "Carregando {store}...",
        selectStore: "Escolha um {store}...",
        optional: "(opcional)",
        attachPhotoFile: "Anexe foto ou arquivo",
        loadingQuestions: "Carregando perguntas...",
        beginAudit: "Início da Auditoria",
        nOfMAnswered: "{a} de {b} respondido",
        setup: "Configuração",
        prev: "Anterior",
        viewOverview: "Ver Visão Geral",
        next: "Próximo",
        stop: "Pare",
        addPhoto: "Adicionar foto",
        nPts: "{n} Pts",
        critical: "Crítica",
        autoTask: "Auto-tarefa",
        dueLabel: "Prazo:",
        immediately: "Imediatamente",
        unassigned: "— Não atribuído —",
        withinDays: "Dentro de {d}",
        auditor: "Auditor",
        scoreSummary: "{e} / {t} pts · {a} de {c} respondido",
        nThreshold: "Limiar de {n}%",
        back: "Voltar",
    },
    ht_HT: {
        auditForm: "Fòm odit",
        auditQuestions: "Kesyon odit",
        clickToEdit: "Klike sou pou edite",
        yourNamePlaceholder: "Non ou",
        loadingYourName: "Loading non ou...",
        storeAuditorDetails: "Store & Odit Detay",
        searchStorePlaceholder: "Rechèch {store}...",
        loading: "Chaje ...",
        auditDate: "Dat odit",
        auditorName: "Non oditè",
        auditorNotes: "Nòt Odit",
        auditorNotesPlaceholder: "Context pou sesyon odit sa a...",
        enterYourName: "Tanpri antre non ou.",
        noQuestions: "Pa gen kesyon",
        pass: "Pase",
        fail: "Echwe",
        na: "NAN/A",
        poor: "Pòv",
        excellent: "Ekselan",
        reset: "Reyajiste",
        start: "Kòmanse",
        taskWillBeGenerated: "Travay yo pral pwodwi",
        noFailures: "Pa gen echèk",
        allPassedOrNa: "Tout kesyon reponn yo te pase oswa yo te make N / A.",
        assignTo: "Asiyen a",
        groups: "Gwoup yo",
        people: "Moun",
        searchPlaceholder: "Rechèch...",
        auditSummary: "Rezime odit",
        passing: "Pase",
        failing: "Echwe",
        date: "Dat",
        tasksFlagged: "Travay ki make",
        notes: "Nòt yo",
        categoryBreakdown: "Kategori pann",
        tasksToCreate: "Travay yo kreye",
        working: "Travay ...",
        noPeopleFound: "Pa gen moun ki te jwenn",
        noGroupsFound: "Pa gen gwoup yo te jwenn",
        submitCreateTasks: "Soumèt & Kreye Travay",
        submitting: "Soumèt ...",
        auditSubmittedMsg: "Odit soumèt! &#34;{name}&#34; kreye ak {n} travay.",
        edit: "modifye",
        loadingStore: "Loading {store}...",
        selectStore: "Chwazi yon {store}...",
        optional: "(si ou vle)",
        attachPhotoFile: "Tache foto oswa dosye",
        loadingQuestions: "Chaje kesyon ...",
        beginAudit: "Kòmanse Odit",
        nOfMAnswered: "{a} nan {b} reponn",
        setup: "Konfigirasyon",
        prev: "Prev",
        viewOverview: "View Apèsi sou lekòl la",
        next: "Next",
        stop: "Rete",
        addPhoto: "Ajoute foto",
        nPts: "{n} pts",
        critical: "Kritik",
        autoTask: "Oto-travay",
        dueLabel: "Akòz:",
        immediately: "Imedyatman",
        unassigned: "— Ki pa asiyen —",
        withinDays: "Nan {d} d",
        auditor: "Oditè",
        scoreSummary: "{e} / {t} pts · {a} nan {c} reponn",
        nThreshold: "{n}% papòt",
        back: "Do",
    },
};

;// ./audit-widget.ts
var audit_widget_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};


// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzlqYwqZ6gaq-nwDbIQ0M1spl77Qu5_fZtOwytNYYAsBKC_baY7WGUOEmM60Y6edInr/exec";
const DEFAULT_API_TOKEN = "NjljMjU3N2JjZmFjZWYxMzc4MzIzYTNkOkp6VEpkaGlfclRyRDk4bjlBZ2pIdXFkcmI3UjQhdl1LTm1RV1hwOHBIdUd+Unl3clk7MjYhSS1JdiprLGdOaVI=";
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY = "#da2e32";
const DEFAULT_ACCENT = "#da2e32";
const DEFAULT_THRESHOLD = "90";
const DUMMY_QUESTIONS = [
    { id: "EXT-001", cat: "Exterior", text: "Parking lot is free of trash and debris", type: "pf", pts: 3, critical: false, task: true, passCriteria: "No visible litter or debris", taskTitle: "Clean parking lot", taskRole: "Crew Member", taskPriority: "High", taskDue: 1 },
    { id: "DR-001", cat: "Dining Room", text: "All tables are clean and sanitized", type: "pf", pts: 3, critical: false, task: true, passCriteria: "Sanitized per protocol", taskTitle: "Sanitize all dining room tables", taskRole: "Crew Member", taskPriority: "High", taskDue: 1 },
    { id: "ST-001", cat: "Serving Table", text: "Hot food holding temps are within range (≥140°F)", type: "temp", pts: 5, critical: true, task: true, passCriteria: "≥140°F hot holding, ≥165°F cooking", taskTitle: "Adjust holding temp — FOOD SAFETY RISK", taskRole: "Manager", taskPriority: "Critical", taskDue: 0 },
    { id: "BOH-001", cat: "Back of House", text: "Walk-in cooler temps within range (35–41°F)", type: "temp", pts: 5, critical: true, task: true, passCriteria: "35–41°F walk-in range", taskTitle: "Adjust cooler temp — FOOD SAFETY RISK", taskRole: "Manager", taskPriority: "Critical", taskDue: 0 },
    { id: "DT-001", cat: "Drive-Thru", text: "Time a drive-thru order from window to handoff", type: "time", pts: 5, critical: false, task: false, passCriteria: "between 60 and 90 seconds", taskTitle: "", taskRole: "", taskPriority: "", taskDue: 0, timeUnit: "sec" },
];
// ── Config schema ─────────────────────────────────────────────────────────────
const configurationSchema = {
    properties: {
        appsscripturl: { type: "string", title: "Apps Script URL", default: DEFAULT_APPS_SCRIPT_URL },
        apitoken: { type: "string", title: "API Token", default: DEFAULT_API_TOKEN },
        baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
        primarycolor: { type: "string", title: "Primary Color", default: DEFAULT_PRIMARY },
        accentcolor: { type: "string", title: "Accent Color", default: DEFAULT_ACCENT },
        backgroundcolor: { type: "string", title: "Background Color", default: "" },
        storelabelsingular: { type: "string", title: "Store Label (singular)", default: "Store" },
        storelabelplural: { type: "string", title: "Store Label (plural)", default: "Stores" },
        passthreshold: { type: "string", title: "Pass Threshold (%)", default: DEFAULT_THRESHOLD },
    },
};
const uiSchema = {
    apitoken: { "ui:widget": "password", "ui:help": "Staffbase Basic auth token" },
    appsscripturl: { "ui:help": "Deployed Google Apps Script URL returning audit questions" },
    baseurl: { "ui:help": "Staffbase API base URL" },
    primarycolor: { "ui:widget": "color" },
    accentcolor: { "ui:widget": "color" },
    backgroundcolor: { "ui:widget": "color", "ui:help": "Leave blank for transparent" },
    storelabelsingular: { "ui:help": "e.g. Store, Location, Branch" },
    storelabelplural: { "ui:help": "e.g. Stores, Locations, Branches" },
    passthreshold: { "ui:help": "Score % required to pass (default 90)" },
};
// ── Color utilities ───────────────────────────────────────────────────────────
function hexToRgb(hex) {
    const h = (hex.replace("#", "") + "000000").slice(0, 6);
    return `${parseInt(h.slice(0, 2), 16) || 0},${parseInt(h.slice(2, 4), 16) || 0},${parseInt(h.slice(4, 6), 16) || 0}`;
}
function contrastColor(hex) {
    const h = (hex.replace("#", "") + "000000").slice(0, 6);
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.179 ? "#1a1a1a" : "#ffffff";
}
function fuzzyMatchGroup(role, groups) {
    const rl = role.toLowerCase();
    const exact = groups.find(g => g.name.toLowerCase().includes(rl) || rl.includes(g.name.toLowerCase()));
    if (exact)
        return exact.id;
    const words = rl.split(/\s+/);
    let best = 0, bestId = null;
    for (const g of groups) {
        const gl = g.name.toLowerCase();
        const hits = words.filter(w => w.length > 2 && gl.includes(w)).length;
        if (hits > best) {
            best = hits;
            bestId = g.id;
        }
    }
    return bestId;
}
// ── Widget factory ────────────────────────────────────────────────────────────
const factory = (BaseBlockClass, widgetApi) => {
    return class AuditWidget extends BaseBlockClass {
        constructor() { super(); }
        renderBlock(container) {
            return audit_widget_awaiter(this, void 0, void 0, function* () {
                const appsScriptUrl = this.getAttribute("appsscripturl") || DEFAULT_APPS_SCRIPT_URL;
                const apiToken = this.getAttribute("apitoken") || DEFAULT_API_TOKEN;
                const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/$/, "");
                const primaryColor = this.getAttribute("primarycolor") || DEFAULT_PRIMARY;
                const accentColor = this.getAttribute("accentcolor") || DEFAULT_ACCENT;
                const bgColor = this.getAttribute("backgroundcolor") || "";
                const storeS = this.getAttribute("storelabelsingular") || "Store";
                const storeP = this.getAttribute("storelabelplural") || "Stores";
                const passThreshold = parseFloat(this.getAttribute("passthreshold") || DEFAULT_THRESHOLD);
                const primaryRgb = hexToRgb(primaryColor);
                const accentRgb = hexToRgb(accentColor);
                const primaryText = contrastColor(primaryColor);
                const p = "aw";
                // ── Locale / i18n ──────────────────────────────────────────────────
                // `tr` (not `t`) to avoid clashing with task/loop vars named `t`.
                let locale = DEFAULT_LOCALE;
                let tr = makeT(STRINGS, locale);
                // ── State ──────────────────────────────────────────────────────────
                let questions = [];
                let categories = [];
                let installations = [];
                let allGroups = [];
                let selectedInstId = "";
                let activeCat = "";
                let auditorName = "";
                let nameLoaded = false;
                let installationsLoaded = false;
                let questionsLoaded = false;
                let auditDate = new Date().toISOString().split("T")[0];
                let auditNotes = "";
                let auditNoteFiles = []; // attachments added to the audit summary task
                // Secret demo autofill (tap same Pass button 5×)
                let demoQid = "";
                let demoCount = 0;
                let demoTimer;
                const responses = {};
                const taskGroupOverrides = {};
                const taskUserOverrides = {};
                const taskAssignType = {};
                const taskFiles = {}; // per-question photo attachments
                let allUsers = [];
                let defaultUserId = ""; // Nicole Adams fallback
                let step = "setup";
                let cleanupStoreDropdown = null;
                // per-task group picker open state
                const openGroupPicker = {};
                // callback so fetchAll can refresh store opts without re-rendering setup
                let refreshStoreOptsCallback = null;
                // ── HTML skeleton ──────────────────────────────────────────────────
                container.innerHTML = `
        <style>
          .${p}{--primary:${primaryColor};--primary-rgb:${primaryRgb};--accent-rgb:${accentRgb};--primary-text:${primaryText};--accent:${accentColor};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;--shadow-sm:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04);--shadow-md:0 4px 16px rgba(0,0,0,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);background:${bgColor || "transparent"};padding:20px;overscroll-behavior:contain}
          .${p} *,.${p} *::before,.${p} *::after{box-sizing:border-box;margin:0;padding:0}
          .${p}-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
          .${p}-title{font-size:18px;font-weight:800;color:var(--dark);display:flex;align-items:center;gap:10px}
          .${p}-title-dot{width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));flex-shrink:0}
          .${p}-card{background:#fff;border-radius:var(--r-lg);box-shadow:var(--shadow-sm);border:1px solid var(--border);border-inline-start:3px solid var(--primary);margin-bottom:12px;overflow:visible}
          .${p}-card-head{display:flex;align-items:center;gap:10px;padding:14px 18px 12px;border-bottom:1px solid var(--border)}
          .${p}-step{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));color:var(--primary-text);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
          .${p}-card-title{font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--dark);flex:1}
          .${p}-card-body{padding:16px 18px}
          .${p}-label{display:block;font-size:12px;font-weight:600;color:var(--gray);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px}
          .${p}-input,.${p}-select{width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:var(--r-md);font-size:14px;font-family:inherit;color:var(--dark);background:#fafafa;transition:border-color .15s,box-shadow .15s}
          .${p}-input::placeholder{color:var(--gray-lt)}
          .${p}-input:focus,.${p}-select:focus{outline:none;border-color:var(--primary);background:#fff;box-shadow:0 0 0 3px rgba(var(--primary-rgb),.1)}
          .${p}-input[type="date"]{-webkit-appearance:none;appearance:none;text-align:start;min-height:44px;padding-inline-end:40px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center}
          .${p}-input[type="date"]::-webkit-date-and-time-value{text-align:start}
          .${p}-input[type="date"]::-webkit-calendar-picker-indicator{opacity:0;position:absolute;right:0;width:40px;height:100%;cursor:pointer}
          .${p}-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
          @media(max-width:480px){.${p}-row{grid-template-columns:1fr}}
          .${p}-field{display:flex;flex-direction:column;gap:5px}

          /* ── Auditor name display (click-to-edit) ── */
          .${p}-name-display{min-height:42px;padding:10px 13px;border:1.5px solid transparent;border-radius:var(--r-md);font-size:14px;color:var(--dark);display:flex;align-items:center;gap:8px;cursor:pointer;transition:border-color .15s,background .15s}
          .${p}-name-display:hover{border-color:var(--border);background:#fafafa}
          .${p}-name-display:hover .${p}-name-edit-hint{opacity:1}
          .${p}-name-text{flex:1;font-size:14px;font-weight:500}
          .${p}-name-edit-hint{font-size:11px;color:var(--gray-lt);opacity:0;transition:opacity .15s;white-space:nowrap}
          .${p}-name-loading{min-height:42px;padding:10px 13px;display:flex;align-items:center;gap:8px;color:var(--gray-lt);font-size:13px}

          .${p}-prog-label{font-size:11px;color:var(--gray-lt);margin-bottom:5px;display:flex;justify-content:space-between}
          .${p}-prog-wrap{background:#f3f4f6;border-radius:3px;height:5px;overflow:hidden;margin-bottom:14px}
          .${p}-prog-fill{height:100%;border-radius:3px;transition:width .3s ease;background:linear-gradient(90deg,var(--primary),var(--accent))}

          /* ── Category tabs ── */
          .${p}-cat-tabs-wrap{position:relative;flex:1;overflow:hidden}
          .${p}-cat-tabs{display:flex;gap:0;overflow-x:auto;scrollbar-width:none;border-bottom:2px solid var(--border);will-change:transform;-webkit-overflow-scrolling:touch}
          .${p}-cat-tabs::-webkit-scrollbar{display:none}
          .${p}-cat-tab{flex-shrink:0!important;min-width:200px!important;padding:10px 14px!important;font-size:11px!important;font-weight:600!important;color:var(--gray)!important;cursor:pointer!important;border-bottom:2.5px solid transparent!important;border-inline-start:none!important;border-inline-end:none!important;border-top:none!important;margin-bottom:-2px!important;white-space:nowrap!important;background:none!important;font-family:inherit!important;transition:color .15s,border-color .15s,background .15s!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;width:auto!important;line-height:normal!important;border-radius:var(--r-sm) var(--r-sm) 0 0!important}
          .${p}-cat-tab:hover{background:rgba(var(--accent-rgb),.07)!important;color:var(--accent)!important}
          .${p}-cat-tab.active{background:rgba(var(--primary-rgb),.07)!important;color:var(--primary)!important;border-bottom-color:var(--primary)!important}
          .${p}-cat-tab-name{font-size:11px!important;font-weight:600!important;line-height:1!important}
          .${p}-cat-tab-score{font-size:10px!important;font-weight:500!important;opacity:.7!important;line-height:1!important}
          .${p}-cat-badge{display:inline-flex;align-items:center;justify-content:center;background:var(--error);color:#fff;border-radius:9px;font-size:9px;font-weight:700;padding:1px 5px;margin-inline-start:4px}

          /* scroll arrows */
          .${p}-tabs-arrow{position:absolute;top:0;bottom:2px;width:36px;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;z-index:10;transition:opacity .2s;pointer-events:none;opacity:0}
          .${p}-tabs-arrow.visible{pointer-events:auto;opacity:1}
          .${p}-tabs-arrow-left{left:0;background:linear-gradient(to right,#fff 60%,transparent);color:var(--gray);padding-inline-start:4px;justify-content:flex-start}
          .${p}-tabs-arrow-right{right:0;background:linear-gradient(to left,#fff 60%,transparent);color:var(--gray);padding-inline-end:4px;justify-content:flex-end}
          .${p}-tabs-arrow:hover{color:var(--primary)}

          .${p}-question{border-bottom:1px solid var(--border);padding:14px 0}
          .${p}-question:last-child{border-bottom:none}
          .${p}-q-header{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px}
          .${p}-q-id{background:#f3f4f6;color:var(--gray);font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid var(--border);flex-shrink:0;margin-top:2px;white-space:nowrap}
          .${p}-q-text{font-size:14px;line-height:1.4;flex:1}
          .${p}-q-criteria{font-size:11px;color:var(--gray-lt);margin-bottom:8px;padding-inline-start:2px;display:flex;align-items:flex-start;gap:4px;line-height:1.4}
          .${p}-q-chips{display:flex;gap:5px;margin-bottom:10px;flex-wrap:wrap}
          .${p}-chip{font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;display:inline-flex;align-items:center;gap:3px}
          .${p}-chip-pts{background:#eef2ff;color:#3730a3}
          .${p}-chip-crit{background:rgba(196,30,58,.08);color:var(--error);border:1px solid rgba(196,30,58,.2)}
          .${p}-chip-task{background:#fffbeb;color:#92400e;border:1px solid #fde68a}
          .${p}-pf-row{display:flex;gap:8px}
          .${p}-pf-btn{flex:1!important;padding:9px 6px!important;border-radius:var(--r-md)!important;font-size:13px!important;font-weight:600!important;cursor:pointer!important;border:1.5px solid var(--border)!important;background:#fafafa!important;color:var(--gray)!important;font-family:inherit!important;transition:all .15s!important;text-align:center!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:4px!important;width:auto!important;line-height:normal!important}
          .${p}-pf-btn:hover{background:rgba(var(--primary-rgb),.07)!important;border-color:var(--primary)!important;color:var(--primary)!important}
          .${p}-pf-btn[data-val="pass"]:hover{background:rgba(46,125,74,.08)!important;border-color:var(--success)!important;color:var(--success)!important}
          .${p}-pf-btn[data-val="fail"]:hover{background:rgba(196,30,58,.08)!important;border-color:var(--error)!important;color:var(--error)!important}
          .${p}-pf-btn.pass{background:rgba(46,125,74,.08)!important;border-color:var(--success)!important;color:var(--success)!important}
          .${p}-pf-btn.pass:hover{background:var(--success)!important;border-color:var(--success)!important;color:#fff!important}
          .${p}-pf-btn.fail{background:rgba(196,30,58,.08)!important;border-color:var(--error)!important;color:var(--error)!important}
          .${p}-pf-btn.fail:hover{background:var(--error)!important;border-color:var(--error)!important;color:#fff!important}
          .${p}-pf-btn.na{background:#f3f4f6!important;border-color:#9ca3af!important;color:var(--gray)!important}
          .${p}-pf-btn.na:hover{background:#9ca3af!important;border-color:#9ca3af!important;color:#fff!important}
          .${p}-rating-row{display:flex;gap:6px}
          .${p}-rating-btn{flex:1!important;padding:9px 4px!important;border-radius:var(--r-md)!important;font-size:13px!important;font-weight:700!important;cursor:pointer!important;border:1.5px solid var(--border)!important;background:#fafafa!important;color:var(--gray)!important;font-family:inherit!important;transition:all .15s!important;text-align:center!important;display:block!important;width:auto!important;line-height:normal!important}
          .${p}-rating-btn.low{background:rgba(196,30,58,.08)!important;border-color:var(--error)!important;color:var(--error)!important}
          .${p}-rating-btn.mid{background:#fffbeb!important;border-color:#d97706!important;color:#d97706!important}
          .${p}-rating-btn.hi{background:rgba(46,125,74,.08)!important;border-color:var(--success)!important;color:var(--success)!important}
          .${p}-rating-hint{display:flex;justify-content:space-between;font-size:10px;color:var(--gray-lt);margin-top:4px}
          .${p}-temp-input{width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:var(--r-md);font-size:18px;font-weight:700;font-family:inherit;color:var(--dark);background:#fafafa;text-align:center;transition:border-color .15s,background .15s}
          .${p}-temp-input:focus{outline:none;border-color:var(--primary);background:#fff}
          .${p}-temp-input.ok{border-color:var(--success);background:rgba(46,125,74,.05)}
          .${p}-temp-input.bad{border-color:var(--error);background:rgba(196,30,58,.05)}
          .${p}-temp-hint{font-size:11px;color:var(--gray-lt);margin-top:5px;line-height:1.4;text-align:center}
          /* ── Stopwatch dial ─────────────────────────────────────────── */
          .${p}-timer{display:flex;flex-direction:column;align-items:center;gap:12px;margin:6px 0 12px}
          .${p}-dial-wrap{position:relative;width:148px;height:148px;flex-shrink:0}
          .${p}-crown{position:absolute;top:-3px;left:50%;width:16px;height:11px;background:var(--gray-lt);border-radius:4px 4px 2px 2px;transform:translateX(-50%);box-shadow:inset 0 -2px 0 rgba(0,0,0,.08);transition:background .3s;z-index:1}
          .${p}-dial-wrap.${p}-st-pass .${p}-crown{background:var(--success)}
          .${p}-dial-wrap.${p}-st-fail .${p}-crown{background:var(--error)}
          .${p}-dial-wrap.running .${p}-crown{background:var(--primary)}
          .${p}-dial{width:148px;height:148px;transform:rotate(-90deg);overflow:visible}
          .${p}-dial circle{fill:none}
          .${p}-dial-ticks{stroke:var(--gray-lt);stroke-width:5;stroke-dasharray:1.2 4.874;opacity:.4}
          .${p}-dial-track{stroke:#eceef1;stroke-width:9}
          .${p}-dial-zone{stroke:rgba(46,125,74,.22);stroke-width:9;stroke-linecap:round}
          .${p}-dial-prog{stroke:var(--gray-lt);stroke-width:9;stroke-linecap:round;
            transition:stroke-dasharray .25s linear,stroke .35s ease}
          .${p}-dial-wrap.running .${p}-dial-prog{stroke:var(--primary);filter:drop-shadow(0 0 5px rgba(var(--primary-rgb),.35))}
          .${p}-dial-wrap.${p}-st-pass .${p}-dial-prog{stroke:var(--success)!important;filter:drop-shadow(0 0 6px rgba(46,125,74,.45))}
          .${p}-dial-wrap.${p}-st-fail .${p}-dial-prog{stroke:var(--error)!important;filter:drop-shadow(0 0 6px rgba(196,30,58,.45))}
          .${p}-dial-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;pointer-events:none}
          .${p}-timer-display{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:800;color:var(--dark);letter-spacing:.5px;font-variant-numeric:tabular-nums;line-height:1}
          .${p}-dial-wrap.running .${p}-timer-display{color:var(--primary)}
          .${p}-dial-wrap.${p}-st-pass .${p}-timer-display{color:var(--success)}
          .${p}-dial-wrap.${p}-st-fail .${p}-timer-display{color:var(--error)}
          .${p}-timer-status{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;padding:3px 9px;border-radius:20px;white-space:nowrap}
          .${p}-timer-status.${p}-st-pass{background:rgba(46,125,74,.12);color:var(--success)}
          .${p}-timer-status.${p}-st-fail{background:rgba(196,30,58,.12);color:var(--error)}
          .${p}-timer-status.${p}-st-pending{background:#f1f2f4;color:var(--gray)}
          .${p}-timer-goal{font-size:11px;color:var(--gray-lt);text-align:center;margin:-4px 0 10px}
          .${p}-timer-btn{width:auto!important;margin:0!important;display:inline-flex!important;align-items:center;justify-content:center;gap:6px;padding:9px 22px!important;border-radius:999px!important;font-family:inherit!important;font-size:13px!important;font-weight:700!important;line-height:normal!important;cursor:pointer;border:none!important;background:var(--primary)!important;color:#fff!important;transition:filter .15s,transform .1s,box-shadow .15s;box-shadow:0 2px 10px rgba(var(--primary-rgb),.3);-webkit-tap-highlight-color:transparent;touch-action:manipulation}
          .${p}-timer-btn:hover{filter:brightness(1.05)}
          .${p}-timer-btn:active{transform:scale(.95)}
          .${p}-timer-btn.stop{background:var(--error)!important;box-shadow:0 2px 10px rgba(196,30,58,.3)}
          .${p}-timer-btn.ghost{background:#fff!important;border:1.5px solid var(--border)!important;color:var(--gray)!important;font-weight:600!important;box-shadow:none}
          .${p}-timer-actions{display:flex;gap:10px;justify-content:center}
          @media(max-width:600px){
            .${p}-dial-wrap,.${p}-dial{width:140px;height:140px}
            .${p}-timer-display{font-size:28px}
          }
          .${p}-task-flag{background:#fffbeb;border:1px solid #fde68a;border-radius:var(--r-md);padding:10px 12px;margin-top:10px;display:none}
          .${p}-task-flag.show{display:block}
          .${p}-task-flag-title{font-size:12px;font-weight:700;color:#92400e;margin-bottom:4px;display:flex;align-items:center;gap:5px}
          .${p}-task-flag p{font-size:12px;color:#78350f;line-height:1.4}
          .${p}-score-big{font-size:42px;font-weight:800;line-height:1;margin-bottom:4px}
          .${p}-score-bar-wrap{background:#f3f4f6;border-radius:4px;height:8px;overflow:hidden;margin:12px 0 4px}
          .${p}-score-bar{height:100%;border-radius:4px;transition:width .6s ease}
          .${p}-meta-grid{background:#f9fafb;border-radius:var(--r-md);padding:12px;display:grid;gap:6px;font-size:12px;color:var(--gray);margin-bottom:16px}
          .${p}-meta-row{display:flex;justify-content:space-between;align-items:center}

          /* category breakdown — 3-col grid so count is always truly centered */
          .${p}-cat-row{display:grid;grid-template-columns:1fr 80px 60px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px}
          .${p}-cat-row:last-child{border-bottom:none}
          .${p}-cat-row-name{text-align:start}
          .${p}-cat-row-count{text-align:center;font-size:12px;color:var(--gray-lt)}
          .${p}-cat-row-pct{text-align:end;font-weight:700}

          .${p}-fail-item{padding:12px 0;border-bottom:1px solid var(--border)}
          .${p}-fail-item:last-child{border-bottom:none}
          .${p}-fail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px}
          .${p}-fail-title{font-size:14px;font-weight:700}
          .${p}-fail-meta{font-size:11px;color:var(--gray-lt);margin-bottom:8px}
          .${p}-photo{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;font-size:12px;font-weight:600;color:#92400e;background:rgba(255,255,255,.55);border:1.5px dashed #fbbf24;border-radius:8px;cursor:pointer;font-family:inherit;padding:11px 12px;margin-top:10px;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:all .15s}
          .${p}-photo-input{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0 0 0 0);pointer-events:none}
          .${p}-note-file{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0 0 0 0);pointer-events:none}
          .${p}-note-attach{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;font-weight:600;color:var(--gray);background:#fafafa;border:1.5px dashed var(--border);border-radius:var(--r-md);padding:8px 12px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:all .15s}
          .${p}-note-attach:hover{border-color:var(--primary);color:var(--primary)}
          .${p}-note-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
          .${p}-note-chip{display:inline-flex;align-items:center;gap:5px;max-width:200px;font-size:11px;font-weight:600;background:rgba(var(--primary-rgb),.08);color:var(--primary);border-radius:12px;padding:3px 4px 3px 9px}
          .${p}-note-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .${p}-note-chip button{width:auto!important;margin:0!important;border:none!important;background:none!important;cursor:pointer;color:inherit;padding:1px!important;display:flex!important}
          .${p}-photo:hover,.${p}-photo:active{background:#fff;border-color:#f59e0b;color:#78350f}
          .${p}-photo-line{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
          .${p}-photo-chip{display:inline-flex;align-items:center;gap:4px;max-width:160px;font-size:11px;font-weight:600;background:rgba(var(--primary-rgb),.07);color:var(--primary);border-radius:10px;padding:1px 7px}
          .${p}-photo-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .${p}-photo-chip button{border:none;background:none;cursor:pointer;color:inherit;padding:0;display:flex;opacity:.7}
          .${p}-photo-chip button:hover{opacity:1}
          .${p}-thumbs{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
          .${p}-thumb{width:48px;height:48px;border-radius:8px;overflow:hidden;border:1px solid var(--border);background:#f3f4f6;flex:0 0 auto}
          .${p}-thumb img{width:100%;height:100%;object-fit:cover;display:block}
          .${p}-prio{font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;flex-shrink:0}
          .${p}-prio-critical{background:rgba(196,30,58,.1);color:var(--error)}
          .${p}-prio-high{background:rgba(163,45,45,.08);color:#a32d2d}
          .${p}-prio-medium{background:#fffbeb;color:#92400e}
          .${p}-prio-low{background:rgba(46,125,74,.08);color:var(--success)}
          .${p}-btn{padding:10px 16px!important;border:none!important;border-radius:var(--r-md)!important;font-size:13px!important;font-weight:700!important;font-family:inherit!important;cursor:pointer!important;display:inline-flex!important;align-items:center!important;gap:7px!important;transition:all .2s!important;white-space:nowrap!important;width:auto!important;line-height:normal!important}
          .${p}-btn:disabled{opacity:.4!important;cursor:not-allowed!important}
          .${p}-btn-primary{background:var(--primary)!important;color:var(--primary-text)!important;box-shadow:0 3px 10px rgba(var(--primary-rgb),.3)!important}
          .${p}-btn-primary:hover:not(:disabled){background:var(--primary)!important;color:var(--primary-text)!important;filter:brightness(.88)!important;transform:translateY(-1px)!important}
          .${p}-btn-ghost{background:#f3f4f6!important;color:var(--gray)!important;border:1.5px solid var(--border)!important}
          .${p}-btn-ghost:hover:not(:disabled){background:rgba(var(--primary-rgb),.05)!important;border-color:var(--primary)!important;color:var(--primary)!important}
          .${p}-btn-full{width:100%;justify-content:center}
          .${p}-nav{display:flex;gap:8px;margin-top:8px}
          .${p}-nav>.${p}-btn{flex:1;justify-content:center}
          .${p}-submit-prog{display:none;background:#fff;border-radius:var(--r-md);padding:14px 16px;border:1px solid var(--border);margin-top:12px}
          .${p}-submit-prog-meta{display:flex;justify-content:space-between;font-size:12px;color:var(--gray);margin-bottom:7px}
          .${p}-submit-bar-wrap{height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden}
          .${p}-submit-bar-fill{height:100%;width:0%;background:linear-gradient(90deg,var(--primary),color-mix(in srgb,var(--primary) 60%,#ff6b00));border-radius:3px;transition:width .3s ease}
          .${p}-submit-log{margin-top:10px;max-height:90px;overflow-y:auto;font-size:12px}
          .${p}-log-item{padding:3px 0;border-bottom:1px solid #f3f4f6;color:var(--gray)}
          .${p}-log-item.ok{color:var(--success)}
          .${p}-log-item.err{color:var(--error)}
          .${p}-banner{display:none;padding:10px 14px;border-radius:var(--r-md);margin-bottom:12px;font-size:13px;line-height:1.5}
          .${p}-banner.error{background:rgba(196,30,58,.08);border:1px solid rgba(196,30,58,.25);color:var(--error)}
          .${p}-banner.info{background:rgba(var(--primary-rgb),.06);border:1px solid rgba(var(--primary-rgb),.2);color:var(--primary)}
          .${p}-banner.success{background:rgba(46,125,74,.08);border:1px solid rgba(46,125,74,.25);color:var(--success)}
          .${p}-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(var(--primary-rgb),.22);border-top-color:var(--accent);animation:${p}-spin .7s linear infinite;display:inline-block;flex-shrink:0}
          @keyframes ${p}-spin{to{transform:rotate(360deg)}}
          .${p}-state{padding:36px 20px;text-align:center;color:var(--gray-lt);font-size:13px}
          .${p}-state strong{display:block;color:var(--gray);font-size:14px;margin-bottom:4px}
          .${p}-group-lbl{font-size:11px;font-weight:600;color:var(--gray);text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px}

          /* ── Per-task group picker (tasks-integration-widget style) ── */
          .${p}-gp-wrap{position:relative}
          .${p}-gp-trigger{width:100%;min-height:40px;padding:8px 32px 8px 11px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fafafa;cursor:pointer;display:flex;align-items:center;position:relative;transition:border-color .15s,background .15s;font-size:13px;font-family:inherit;color:var(--dark);text-align:start}
          .${p}-gp-trigger:hover,.${p}-gp-trigger.open{border-color:var(--primary);background:#fff}
          .${p}-gp-trigger::after{content:'▾';position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--gray-lt);pointer-events:none;font-size:12px}
          .${p}-gp-ph{color:var(--gray-lt)}
          .${p}-gp-dropdown{display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1.5px solid var(--primary);border-radius:var(--r-md);box-shadow:var(--shadow-md);overflow:hidden;z-index:300}
          .${p}-gp-dropdown.show{display:block;animation:${p}-gpdd .15s ease}
          @keyframes ${p}-gpdd{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
          .${p}-gp-search{padding:8px 10px;border-bottom:1px solid var(--border)}
          .${p}-gp-search input{width:100%;padding:6px 9px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:12px;font-family:inherit;background:#fafafa;color:var(--dark);outline:none}
          .${p}-gp-search input:focus{border-color:var(--primary);background:#fff}
          .${p}-gp-list{max-height:180px;overflow-y:auto}
          .${p}-gp-opt{padding:9px 12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:13px;border-bottom:1px solid #f3f4f6;transition:background .1s;color:var(--dark)}
          .${p}-gp-opt:last-child{border-bottom:none}
          .${p}-gp-opt:hover{background:rgba(var(--primary-rgb),.05)}
          .${p}-gp-opt.sel{background:rgba(var(--primary-rgb),.06);font-weight:600;color:var(--primary)}
          .${p}-gp-none{padding:16px;text-align:center;color:var(--gray-lt);font-size:12px}

          .${p}-ms-wrap{position:relative}
          .${p}-ms-trigger{width:100%;min-height:42px;padding:8px 36px 8px 11px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fafafa;cursor:pointer;display:flex;align-items:center;position:relative;transition:border-color .15s,background .15s;font-size:14px;font-family:inherit;color:var(--dark)}
          .${p}-ms-trigger:hover,.${p}-ms-trigger.open{border-color:var(--accent);background:#fff}
          .${p}-ms-trigger::after{content:'▾';position:absolute;right:11px;top:50%;transform:translateY(-50%);color:var(--gray-lt);pointer-events:none;font-size:13px}
          .${p}-ms-ph{color:var(--gray-lt)}
          .${p}-ms-dropdown{display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1.5px solid var(--primary);border-radius:var(--r-md);box-shadow:var(--shadow-md);overflow:hidden;z-index:200}
          .${p}-ms-dropdown.show{display:block;animation:${p}-dd .15s ease}
          @keyframes ${p}-dd{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
          .${p}-dd-search{padding:9px 10px;border-bottom:1px solid var(--border)}
          .${p}-dd-search input{width:100%;padding:7px 10px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:inherit;background:#fafafa;color:var(--dark);outline:none}
          .${p}-dd-search input:focus{border-color:var(--primary);background:#fff}
          .${p}-dd-list{max-height:210px;overflow-y:auto}
          .${p}-dd-opt{padding:10px 12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:13px;border-bottom:1px solid #f3f4f6;transition:background .1s;color:var(--dark)}
          .${p}-dd-opt:last-child{border-bottom:none}
          .${p}-dd-opt:hover{background:rgba(var(--accent-rgb),.07)}
          .${p}-dd-opt.sel{background:rgba(var(--primary-rgb),.06);font-weight:600;color:var(--primary)}
          .${p}-dd-msg{padding:20px;text-align:center;color:var(--gray-lt);font-size:13px}

          /* ── touch-action to eliminate 300ms tap delay ── */
          .${p}-pf-btn,.${p}-rating-btn,.${p}-cat-tab,.${p}-btn,.${p}-gp-trigger,.${p}-ms-trigger,.${p}-tabs-arrow,.${p}-gp-opt,.${p}-dd-opt{touch-action:manipulation}

          /* ── Assign tabs (user + group) in generate step ── */
          .${p}-ap-tabs{display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:8px}
          .${p}-ap-tab{flex:1!important;padding:7px 10px!important;border:none!important;border-bottom:2.5px solid transparent!important;margin-bottom:-2px!important;font-size:12px!important;font-weight:600!important;background:none!important;color:var(--gray)!important;cursor:pointer!important;text-align:center!important;transition:color .15s,border-color .15s!important;font-family:inherit!important;touch-action:manipulation!important;display:block!important;line-height:normal!important;width:auto!important;border-radius:0!important}
          .${p}-ap-tab:hover{color:var(--dark)!important}
          .${p}-ap-tab.active{color:var(--primary)!important;border-bottom-color:var(--primary)!important;background:none!important}
        
          /* RTL: flip horizontal directional arrows */
          [dir="rtl"] .aw-tabs-arrow{transform:scaleX(-1)}
        </style>

        <div class="${p}">
          <div class="${p}-header">
            <div class="${p}-title"><span class="${p}-title-dot"></span><span id="${p}-title-text">${tr("auditForm")}</span></div>
            <span class="${p}-spin" id="${p}-hspin" style="display:none"></span>
          </div>
          <div class="${p}-banner" id="${p}-banner"></div>
          <div id="${p}-content"></div>
        </div>
      `;
                const contentEl = container.querySelector(`#${p}-content`);
                const bannerEl = container.querySelector(`#${p}-banner`);
                const hspinEl = container.querySelector(`#${p}-hspin`);
                // ── Helpers ───────────────────────────────────────────────────────
                const apiOpts = (extra) => (Object.assign(Object.assign({}, extra), { credentials: "omit", headers: { Authorization: `Basic ${apiToken}`, "Content-Type": "application/json" } }));
                function esc(s) { return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
                function showBanner(t, msg) { bannerEl.className = `${p}-banner ${t}`; bannerEl.style.display = "block"; bannerEl.textContent = msg; }
                function hideBanner() { bannerEl.style.display = "none"; }
                // ── Attachments (Staffbase media TUS upload) ──────────────────────
                const MEDIA_MAX = 25 * 1024 * 1024; // 25 MB
                function b64utf8(s) { let o = ""; for (const b of new TextEncoder().encode(s))
                    o += String.fromCharCode(b); return btoa(o); }
                function uploadMedia(file) {
                    return audit_widget_awaiter(this, void 0, void 0, function* () {
                        const create = yield fetch(`${baseUrl}/media/tus`, {
                            method: "POST", credentials: "omit",
                            headers: { Authorization: `Basic ${apiToken}`, "Tus-Resumable": "1.0.0", "Upload-Length": String(file.size), "Upload-Metadata": `filename ${b64utf8(file.name)},filetype ${b64utf8(file.type || "application/octet-stream")}` },
                        });
                        if (create.status !== 201)
                            throw new Error(`upload init failed (${create.status})`);
                        const loc = create.headers.get("Location");
                        if (!loc)
                            throw new Error("no upload URL");
                        const buf = yield file.arrayBuffer();
                        const CHUNK = 5 * 1024 * 1024;
                        let offset = 0;
                        let media = null;
                        while (offset < buf.byteLength) {
                            const end = Math.min(offset + CHUNK, buf.byteLength);
                            const res = yield fetch(loc, { method: "PATCH", credentials: "omit", headers: { Authorization: `Basic ${apiToken}`, "Tus-Resumable": "1.0.0", "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" }, body: buf.slice(offset, end) });
                            if (!res.ok)
                                throw new Error(`upload failed (${res.status})`);
                            offset = end;
                            try {
                                media = yield res.clone().json();
                            }
                            catch (_) { }
                        }
                        if (!(media === null || media === void 0 ? void 0 : media.id))
                            throw new Error("no media id");
                        return media.id;
                    });
                }
                function prioClass(pr) {
                    if (pr === "Critical")
                        return `${p}-prio-critical`;
                    if (pr === "High")
                        return `${p}-prio-high`;
                    if (pr === "Medium")
                        return `${p}-prio-medium`;
                    return `${p}-prio-low`;
                }
                // ── SVG icons ─────────────────────────────────────────────────────
                const iCheck = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                const iX = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
                const iFlag = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
                const iWarn = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
                const iSend = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
                const iStore = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
                const iUser = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                const iPrev = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
                const iNext = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
                const iPencil = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
                const iCamera = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
                const iTimer = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><line x1="12" y1="13" x2="12" y2="9"/><line x1="9" y1="2" x2="15" y2="2"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="18.5" y1="6.5" x2="20" y2="5"/></svg>`;
                const iXsmall = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
                function photoChips(qid) {
                    const files = taskFiles[qid] || [];
                    return files.map((f, i) => `<span class="${p}-photo-chip"><span>${esc(f.name)}</span><button type="button" data-qid="${esc(qid)}" data-idx="${i}">${iXsmall}</button></span>`).join("");
                }
                function photoThumbs(qid) {
                    const files = taskFiles[qid] || [];
                    if (!files.length)
                        return "";
                    const tiles = files.map(f => {
                        const url = URL.createObjectURL(f);
                        return `<span class="${p}-thumb" title="${esc(f.name)}"><img src="${url}" alt="${esc(f.name)}"></span>`;
                    }).join("");
                    return `<div class="${p}-thumbs">${tiles}</div>`;
                }
                // ── Category icon bank ────────────────────────────────────────────
                function catIcon(cat) {
                    const c = cat.toLowerCase();
                    const s = `width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
                    if (/exterior|parking|outside|facade|building/.test(c))
                        return `<svg ${s}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`;
                    if (/dining|seating|lounge|lobby/.test(c))
                        return `<svg ${s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
                    if (/serving|station|counter/.test(c))
                        return `<svg ${s}><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>`;
                    if (/back of house|boh|kitchen|prep|cook/.test(c))
                        return `<svg ${s}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/></svg>`;
                    if (/restroom|bathroom|toilet|hygiene/.test(c))
                        return `<svg ${s}><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`;
                    if (/drive.?thru|drive.?through|window|dtx/.test(c))
                        return `<svg ${s}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;
                    if (/staff|employee|team|crew|personnel|associate/.test(c))
                        return `<svg ${s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
                    if (/safety|health|food safe/.test(c))
                        return `<svg ${s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
                    if (/storage|cooler|freezer|refriger|walk.?in/.test(c))
                        return `<svg ${s}><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
                    if (/register|pos|checkout|cashier|payment|cash/.test(c))
                        return `<svg ${s}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
                    if (/equipment|machine|hvac|electric/.test(c))
                        return `<svg ${s}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M2 12h2m16 0h2M12 2v2m0 16v2"/></svg>`;
                    if (/thermometer|temp/.test(c))
                        return `<svg ${s}><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`;
                    if (/order|accuracy/.test(c))
                        return `<svg ${s}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;
                    if (/protein|marinated|meat/.test(c))
                        return `<svg ${s}><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`;
                    // default: clipboard
                    return `<svg ${s}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`;
                }
                // ── Question logic ────────────────────────────────────────────────
                function isPass(q, val) {
                    if (!val)
                        return null;
                    if (q.type === "pf" || q.type === "time")
                        return val === "pass";
                    if (q.type === "rating")
                        return parseInt(val) >= 3;
                    if (q.type === "temp") {
                        const n = parseFloat(val);
                        const isCooler = q.id.startsWith("BOH") || q.text.toLowerCase().includes("cooler");
                        return isCooler ? (n >= 35 && n <= 41) : n >= 140;
                    }
                    return null;
                }
                function getScore() {
                    let earned = 0, total = 0, answered = 0;
                    for (const q of questions) {
                        total += q.pts;
                        const r = isPass(q, responses[q.id] || "");
                        if (r !== null) {
                            answered++;
                            if (r)
                                earned += q.pts;
                        }
                    }
                    return { earned, total, answered, count: questions.length };
                }
                function failedTasks() {
                    return questions.filter(q => {
                        if (!q.task)
                            return false;
                        return isPass(q, responses[q.id] || "") === false;
                    });
                }
                // Secret demo: fill only the UNANSWERED items (pass), then fail a few at random.
                function demoFill() {
                    const cooler = (q) => q.id.startsWith("BOH") || q.text.toLowerCase().includes("cooler");
                    const setPass = (q) => {
                        if (q.type === "rating")
                            responses[q.id] = "5";
                        else if (q.type === "temp")
                            responses[q.id] = cooler(q) ? "38" : "165";
                        else
                            responses[q.id] = "pass";
                    };
                    const setFail = (q) => {
                        if (q.type === "rating")
                            responses[q.id] = "1";
                        else if (q.type === "temp")
                            responses[q.id] = cooler(q) ? "60" : "95";
                        else
                            responses[q.id] = "fail";
                    };
                    const remaining = questions.filter(q => !responses[q.id]);
                    if (!remaining.length) {
                        showBanner("info", "Everything's already filled in.");
                        return;
                    }
                    remaining.forEach(setPass);
                    const n = Math.min(remaining.length, 2 + Math.floor(Math.random() * 3)); // 2–4 fails
                    [...remaining].sort(() => Math.random() - 0.5).slice(0, n).forEach(setFail);
                    showBanner("info", `Demo: auto-filled ${remaining.length} remaining item${remaining.length !== 1 ? "s" : ""} ✨`);
                    renderAudit();
                }
                // ── Time-task stopwatch ───────────────────────────────────────────
                const timeState = {};
                let timerTick = null;
                function curElapsed(s) { return s.running ? s.elapsed + (Date.now() - s.startAt) : s.elapsed; }
                function fmtTimer(ms) { const t = Math.floor(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; }
                function ensureTick() {
                    const anyRunning = Object.keys(timeState).some(k => timeState[k].running);
                    if (anyRunning && !timerTick) {
                        timerTick = setInterval(() => {
                            for (const qid in timeState) {
                                if (!timeState[qid].running)
                                    continue;
                                updateTimerUI(qid);
                            }
                        }, 250);
                    }
                    else if (!anyRunning && timerTick) {
                        clearInterval(timerTick);
                        timerTick = null;
                    }
                }
                // Parse a time goal from the question's pass criteria / text, e.g. "under 3 min",
                // "within 90s", "at least 30 seconds", "between 1 and 2 min". Returns seconds.
                function parseTimeTarget(q) {
                    const src = `${q.passCriteria || ""} ${q.text || ""}`.toLowerCase();
                    const toSec = (n, u) => { if (/^m/.test(u))
                        return n * 60; if (!u && q.timeUnit === "min")
                        return n * 60; return n; };
                    const nums = [...src.matchAll(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m)?/g)].map(m => toSec(parseFloat(m[1]), m[2] || ""));
                    if (!nums.length)
                        return null;
                    if (/(between|\bto\b|[-–]\s*\d|range)/.test(src) && nums.length >= 2) {
                        return { kind: "range", lo: Math.min(nums[0], nums[1]), hi: Math.max(nums[0], nums[1]) };
                    }
                    if (/\b(over|more than|at least|above|greater|min(?:imum)?|no less than|longer than)\b|≥|>/.test(src))
                        return { kind: "over", lo: nums[0], hi: 0 };
                    if (/\b(under|less than|within|below|fewer|max(?:imum)?|no more than|faster than|at most)\b|≤|</.test(src))
                        return { kind: "under", lo: 0, hi: nums[0] };
                    if (nums.length >= 2)
                        return { kind: "range", lo: Math.min(nums[0], nums[1]), hi: Math.max(nums[0], nums[1]) };
                    return { kind: "under", lo: 0, hi: nums[0] }; // a lone number reads as "within X"
                }
                function timeStatus(elapsedSec, t) {
                    if (t.kind === "under")
                        return elapsedSec <= t.hi ? { state: "pass", label: "On track" } : { state: "fail", label: "Over goal" };
                    if (t.kind === "over")
                        return elapsedSec >= t.lo ? { state: "pass", label: "Goal met" } : { state: "pending", label: "Keep going" };
                    if (elapsedSec < t.lo)
                        return { state: "pending", label: "Too early" };
                    return elapsedSec <= t.hi ? { state: "pass", label: "In range" } : { state: "fail", label: "Over range" };
                }
                // ── Stopwatch dial geometry ───────────────────────────────────────
                const DIAL_R = 54, DIAL_C = 2 * Math.PI * DIAL_R;
                // Full-circle scale (seconds) the dial represents — leaves headroom past
                // the goal so the sweep can visibly run "over".
                function dialScale(t) {
                    if (!t)
                        return 60;
                    if (t.kind === "over")
                        return Math.max(t.lo * 1.25, 1);
                    return Math.max(t.hi * 1.25, 1); // under + range key off hi
                }
                // The highlighted goal-zone arc as {start,frac} fractions of the circle.
                function dialZone(t, scale) {
                    if (!t)
                        return { start: 0, frac: 0 };
                    if (t.kind === "under")
                        return { start: 0, frac: Math.min(t.hi / scale, 1) };
                    if (t.kind === "over") {
                        const s = Math.min(t.lo / scale, 1);
                        return { start: s, frac: 1 - s };
                    }
                    return { start: Math.min(t.lo / scale, 1), frac: Math.min((t.hi - t.lo) / scale, 1) };
                }
                const dash = (frac) => `${Math.max(frac, 0) * DIAL_C} ${DIAL_C}`;
                function goalLabel(t) {
                    if (t.kind === "under")
                        return `Goal: under ${fmtTimer(t.hi * 1000)}`;
                    if (t.kind === "over")
                        return `Goal: at least ${fmtTimer(t.lo * 1000)}`;
                    return `Goal: ${fmtTimer(t.lo * 1000)}–${fmtTimer(t.hi * 1000)}`;
                }
                // Live-update a running timer's display, color, and status pill without a full re-render.
                function updateTimerUI(qid) {
                    const s = timeState[qid];
                    if (!s)
                        return;
                    const ms = curElapsed(s);
                    const disp = contentEl.querySelector(`.${p}-timer-display[data-qid="${qid}"]`);
                    if (disp)
                        disp.textContent = fmtTimer(ms);
                    const q = questions.find(x => x.id === qid);
                    const tgt = q ? parseTimeTarget(q) : null;
                    const prog = contentEl.querySelector(`.${p}-dial-prog[data-qid="${qid}"]`);
                    const wrap = contentEl.querySelector(`.${p}-dial-wrap[data-qid="${qid}"]`);
                    // Sweep the progress arc.
                    if (prog)
                        prog.setAttribute("stroke-dasharray", dash(Math.min((ms / 1000) / dialScale(tgt), 1)));
                    if (!tgt)
                        return;
                    const st = timeStatus(Math.floor(ms / 1000), tgt);
                    const cls = [`${p}-st-pass`, `${p}-st-fail`, `${p}-st-pending`];
                    // State class on the wrap drives dial/crown/text/zone colors.
                    if (wrap) {
                        wrap.classList.remove(...cls);
                        wrap.classList.add(`${p}-st-${st.state}`);
                    }
                    const pill = contentEl.querySelector(`.${p}-timer-status[data-qid="${qid}"]`);
                    if (pill) {
                        pill.textContent = st.label;
                        pill.classList.remove(...cls);
                        pill.classList.add(`${p}-st-${st.state}`);
                    }
                }
                // ── Sheet parsing ─────────────────────────────────────────────────
                function normalizeType(t) {
                    const l = t.toLowerCase();
                    if (l.includes("pass") && l.includes("fail"))
                        return "pf";
                    if (l.includes("rating") || l.includes("1–5") || l.includes("1-5"))
                        return "rating";
                    if (l.includes("temp"))
                        return "temp";
                    if (l.includes("time"))
                        return "time";
                    return "pf";
                }
                function parseRows(rows) {
                    if (!rows || rows.length < 3)
                        return [];
                    let hIdx = -1;
                    for (let i = 0; i < Math.min(5, rows.length); i++) {
                        const hasId = rows[i].some((c) => /question\s*id/i.test(String(c || "")));
                        const hasCat = rows[i].some((c) => /category/i.test(String(c || "")));
                        if (hasId && hasCat) {
                            hIdx = i;
                            break;
                        }
                    }
                    if (hIdx < 0)
                        return [];
                    const hdrs = rows[hIdx].map((c) => String(c || "").toLowerCase().trim());
                    const col = (...names) => { for (const n of names) {
                        const i = hdrs.findIndex(h => h.includes(n));
                        if (i >= 0)
                            return i;
                    } return -1; };
                    const iId = col("question id");
                    const iCat = col("category");
                    const iText = col("checklist item", "checklist", "question /");
                    const iType = col("response type", "type");
                    const iPts = col("weight", "pts", "point");
                    const iCrit = col("pass criteria", "criteria", "pass crit");
                    const iTask = col("generate task", "auto-task");
                    const iTitle = col("task title");
                    const iRole = col("assignee role", "task role", "role");
                    const iDue = col("task due", "due");
                    const iPrio = col("task priority", "priority");
                    const iActive = col("active");
                    const out = [];
                    for (let i = hIdx + 1; i < rows.length; i++) {
                        const r = rows[i];
                        if (!r || !r.length)
                            continue;
                        const av = iActive >= 0 ? String(r[iActive] || "").toLowerCase() : "yes";
                        if (av === "false" || av === "no" || av === "0")
                            continue;
                        const text = iText >= 0 ? String(r[iText] || "").trim() : "";
                        if (!text)
                            continue;
                        out.push({
                            id: iId >= 0 ? String(r[iId] || `Q${i}`) : `Q${i}`,
                            cat: iCat >= 0 ? String(r[iCat] || "General").trim() : "General",
                            text,
                            type: iType >= 0 ? normalizeType(String(r[iType] || "")) : "pf",
                            timeUnit: iType >= 0 && /time/i.test(String(r[iType] || "")) ? (/min/i.test(String(r[iType] || "")) ? "min" : "sec") : undefined,
                            pts: iPts >= 0 ? parseInt(String(r[iPts] || "1")) || 1 : 1,
                            critical: false,
                            passCriteria: iCrit >= 0 ? String(r[iCrit] || "").trim() : "",
                            task: iTask >= 0 ? /true|yes/i.test(String(r[iTask] || "")) : false,
                            taskTitle: iTitle >= 0 ? String(r[iTitle] || "").trim() : text,
                            taskRole: iRole >= 0 ? String(r[iRole] || "").trim() : "",
                            taskPriority: iPrio >= 0 ? String(r[iPrio] || "Medium").trim() : "Medium",
                            taskDue: iDue >= 0 ? parseInt(String(r[iDue] || "1")) || 1 : 1,
                        });
                    }
                    return out;
                }
                // ── Data fetch ────────────────────────────────────────────────────
                function fetchAll() {
                    return audit_widget_awaiter(this, void 0, void 0, function* () {
                        hspinEl.style.display = "";
                        // ① Profile — fires immediately, updates name in-place
                        const profileP = (() => audit_widget_awaiter(this, void 0, void 0, function* () {
                            let profId = "";
                            try {
                                const prof = yield widgetApi.getUserInformation();
                                profId = prof.id || "";
                                auditorName = (`${prof.firstName || ""} ${prof.lastName || ""}`).trim() || profId || "";
                            }
                            catch (_) { }
                            nameLoaded = true;
                            // Resolve locale (needs the user id) and re-render in the right language.
                            applyLocale(profId);
                            if (step === "setup") {
                                const loadingEl = contentEl.querySelector(`#${p}-name-loading`);
                                if (loadingEl) {
                                    const disp = document.createElement("div");
                                    disp.className = `${p}-name-display`;
                                    disp.id = `${p}-name-display`;
                                    disp.title = "Click to edit";
                                    disp.innerHTML = `<span class="${p}-name-text" id="${p}-name-text">${esc(auditorName || "—")}</span><span class="${p}-name-edit-hint">${iPencil} edit</span>`;
                                    loadingEl.replaceWith(disp);
                                    bindNameEdit(disp);
                                }
                            }
                        }))();
                        // ② Installations + groups + users — parallel
                        const instGroupP = (() => audit_widget_awaiter(this, void 0, void 0, function* () {
                            try {
                                const [instRes, grpRes, userRes] = yield Promise.all([
                                    fetch(`${baseUrl}/installations?limit=200`, apiOpts()),
                                    fetch(`${baseUrl}/groups/search?limit=100&sort=name_ASC`, apiOpts()),
                                    fetch(`${baseUrl}/users?limit=200`, apiOpts()),
                                ]);
                                if (instRes.ok) {
                                    const d = yield instRes.json();
                                    installations = (d.data || d)
                                        .filter((i) => i.pluginID === "tasks" || i.pluginId === "tasks")
                                        .map((i) => { var _a, _b, _c; return ({ id: i.id, title: ((_c = (_b = (_a = i.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) || i.title || i.name || i.id }); })
                                        .sort((a, b) => a.title.localeCompare(b.title));
                                }
                                if (grpRes.ok) {
                                    const d = yield grpRes.json();
                                    // /groups/search returns { entries: [ { data: { id, config.localization.en_US.name, type } } ] }
                                    const parseEntry = (e) => {
                                        var _a, _b, _c, _d, _e, _f;
                                        const inner = e.data || e;
                                        const name = ((_c = (_b = (_a = inner.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.name) || ((_f = (_e = (_d = inner.config) === null || _d === void 0 ? void 0 : _d.localization) === null || _e === void 0 ? void 0 : _e.en_US) === null || _f === void 0 ? void 0 : _f.title) || inner.name || inner.title || inner.id;
                                        return { id: inner.id, name };
                                    };
                                    const raw = d.entries || d.data || d.results || d.items || (Array.isArray(d) ? d : []);
                                    allGroups = raw.map(parseEntry).filter((g) => g.id && g.name).sort((a, b) => a.name.localeCompare(b.name));
                                }
                                // Always also fetch /groups as a supplement (catches any groups missed by search)
                                try {
                                    const fb = yield fetch(`${baseUrl}/groups?limit=200`, apiOpts());
                                    if (fb.ok) {
                                        const d = yield fb.json();
                                        const fbGroups = (d.data || []).map((g) => { var _a, _b, _c, _d, _e, _f; return ({ id: g.id, name: ((_c = (_b = (_a = g.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) || ((_f = (_e = (_d = g.config) === null || _d === void 0 ? void 0 : _d.localization) === null || _e === void 0 ? void 0 : _e.en_US) === null || _f === void 0 ? void 0 : _f.name) || g.name || g.id }); }).filter((g) => g.id && g.name);
                                        // Merge — deduplicate by id
                                        const seen = new Set(allGroups.map((g) => g.id));
                                        for (const g of fbGroups) {
                                            if (!seen.has(g.id)) {
                                                allGroups.push(g);
                                                seen.add(g.id);
                                            }
                                        }
                                        allGroups.sort((a, b) => a.name.localeCompare(b.name));
                                    }
                                }
                                catch (_) { }
                                if (userRes.ok) {
                                    const d = yield userRes.json();
                                    allUsers = (d.data || []).map((u) => { var _a, _b; return ({ id: u.id, name: (`${u.firstName || ""} ${u.lastName || ""}`).trim() || u.id, avatar: ((_b = (_a = u.avatar) === null || _a === void 0 ? void 0 : _a.icon) === null || _b === void 0 ? void 0 : _b.url) || "" }); }).filter((u) => u.name).sort((a, b) => a.name.localeCompare(b.name));
                                    // Store Nicole Adams as default assignee fallback
                                    const nicole = allUsers.find(u => u.name.toLowerCase().includes("nicole") && u.name.toLowerCase().includes("adams"));
                                    if (nicole)
                                        defaultUserId = nicole.id;
                                }
                            }
                            catch (_) { }
                            installationsLoaded = true;
                            // Update store trigger in-place if setup is showing
                            if (step === "setup") {
                                const trigEl = contentEl.querySelector(`#${p}-trigger`);
                                if (trigEl && !selectedInstId)
                                    trigEl.innerHTML = `<span class="${p}-ms-ph">Select a ${esc(storeS)}…</span>`;
                                if (refreshStoreOptsCallback)
                                    refreshStoreOptsCallback("");
                            }
                        }))();
                        // ③ Questions — 10s timeout, then dummy fallback
                        const questionsP = (() => audit_widget_awaiter(this, void 0, void 0, function* () {
                            try {
                                const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 14000));
                                const sr = yield Promise.race([fetch(appsScriptUrl), timeout]);
                                if (sr.ok) {
                                    const data = yield sr.json();
                                    const raw = data.data || data;
                                    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
                                        const key = Object.keys(raw).find(k => k.includes("Audit Questions"));
                                        if (key) {
                                            const parsed = parseRows(raw[key]);
                                            if (parsed.length > 0)
                                                questions = parsed;
                                        }
                                    }
                                    else if (Array.isArray(data.questions)) {
                                        questions = data.questions;
                                    }
                                }
                            }
                            catch (_) { }
                            if (!questions.length)
                                questions = [...DUMMY_QUESTIONS];
                            const seen = new Set();
                            categories = [];
                            for (const q of questions) {
                                if (!seen.has(q.cat)) {
                                    seen.add(q.cat);
                                    categories.push(q.cat);
                                }
                            }
                            activeCat = categories[0] || "";
                            questionsLoaded = true;
                            // Enable Begin button in-place
                            if (step === "setup") {
                                const beginBtn = contentEl.querySelector(`#${p}-begin`);
                                if (beginBtn) {
                                    beginBtn.disabled = false;
                                    beginBtn.innerHTML = `${iCheck} Begin Audit`;
                                }
                            }
                        }))();
                        yield Promise.all([profileP, instGroupP, questionsP]);
                        hspinEl.style.display = "none";
                    });
                }
                // ── Render dispatch ───────────────────────────────────────────────
                function render() {
                    if (step === "setup")
                        renderSetup();
                    else if (step === "audit")
                        renderAudit();
                    else if (step === "generate")
                        renderGenerate();
                }
                // Resolve the viewer's locale (config.locale → navigator → en_US), rebind
                // `tr`, set text direction, and re-render the current step. Runs once.
                let localeApplied = false;
                function applyLocale(userId) {
                    return audit_widget_awaiter(this, void 0, void 0, function* () {
                        var _a;
                        if (localeApplied)
                            return;
                        localeApplied = true;
                        const available = Object.keys(STRINGS);
                        let configLocale = "";
                        try {
                            if (userId) {
                                const r = yield fetch(`${baseUrl}/users/${userId}`, apiOpts());
                                if (r.ok) {
                                    const u = yield r.json();
                                    configLocale = ((_a = u === null || u === void 0 ? void 0 : u.config) === null || _a === void 0 ? void 0 : _a.locale) || "";
                                }
                            }
                        }
                        catch (_) { }
                        locale = detectLocale({ configLocale, available });
                        tr = makeT(STRINGS, locale);
                        try {
                            container.setAttribute("dir", isRtl(locale) ? "rtl" : "ltr");
                        }
                        catch (_) { }
                        const titleEl = container.querySelector(`#${p}-title-text`);
                        if (titleEl)
                            titleEl.textContent = tr("auditForm");
                        render();
                    });
                }
                // ── Name click-to-edit binder (shared by renderSetup + in-place update) ──
                function bindNameEdit(nameDisplay) {
                    nameDisplay.addEventListener("click", function onClick() {
                        const input = document.createElement("input");
                        input.type = "text";
                        input.className = `${p}-input`;
                        input.id = `${p}-aname`;
                        input.value = auditorName;
                        input.placeholder = "Your name";
                        nameDisplay.replaceWith(input);
                        input.focus();
                        input.select();
                        const save = () => {
                            auditorName = input.value.trim();
                            const nd = document.createElement("div");
                            nd.className = `${p}-name-display`;
                            nd.id = `${p}-name-display`;
                            nd.title = "Click to edit";
                            nd.innerHTML = `<span class="${p}-name-text">${esc(auditorName || "—")}</span><span class="${p}-name-edit-hint">${iPencil} edit</span>`;
                            input.replaceWith(nd);
                            bindNameEdit(nd);
                        };
                        input.addEventListener("blur", save);
                        input.addEventListener("keydown", (e) => { if (e.key === "Enter") {
                            e.preventDefault();
                            input.blur();
                        } });
                    });
                }
                // ── Step 1: Setup ─────────────────────────────────────────────────
                function renderSetup() {
                    if (cleanupStoreDropdown) {
                        cleanupStoreDropdown();
                        cleanupStoreDropdown = null;
                    }
                    refreshStoreOptsCallback = null;
                    const selInst = installations.find(i => i.id === selectedInstId);
                    const triggerInner = selInst
                        ? `<span style="color:var(--dark);font-size:14px">${esc(selInst.title)}</span>`
                        : `<span class="${p}-ms-ph">${!installationsLoaded ? tr("loadingStore").replace("{store}", esc(storeP.toLowerCase())) : tr("selectStore").replace("{store}", esc(storeS))}</span>`;
                    // Auditor name field: spinner while loading, click-to-edit display after
                    const nameFieldHtml = nameLoaded
                        ? `<div class="${p}-name-display" id="${p}-name-display" title="${tr("clickToEdit")}">
               <span class="${p}-name-text" id="${p}-name-text">${esc(auditorName || "—")}</span>
               <span class="${p}-name-edit-hint">${iPencil} ${tr("edit")}</span>
             </div>`
                        : `<div class="${p}-name-loading" id="${p}-name-loading">
               <span class="${p}-spin"></span>
               <span>${tr("loadingYourName")}</span>
             </div>`;
                    contentEl.innerHTML = `
          <div class="${p}-card">
            <div class="${p}-card-head"><span class="${p}-step">1</span><span class="${p}-card-title">${tr("storeAuditorDetails")}</span></div>
            <div class="${p}-card-body">
              <div class="${p}-row">
                <div class="${p}-field">
                  <label class="${p}-label">${esc(storeS)}</label>
                  <div class="${p}-ms-wrap">
                    <div class="${p}-ms-trigger" id="${p}-trigger">${triggerInner}</div>
                    <div class="${p}-ms-dropdown" id="${p}-dropdown">
                      <div class="${p}-dd-search"><input type="text" id="${p}-search" placeholder="${tr("searchStorePlaceholder").replace("{store}", esc(storeP.toLowerCase()))}"></div>
                      <div class="${p}-dd-list" id="${p}-opts"><div class="${p}-dd-msg">${tr("loading")}</div></div>
                    </div>
                  </div>
                </div>
                <div class="${p}-field">
                  <label class="${p}-label">${tr("auditDate")}</label>
                  <input type="date" class="${p}-input" id="${p}-adate" value="${auditDate}">
                </div>
              </div>
              <div class="${p}-row full" style="grid-template-columns:1fr">
                <div class="${p}-field">
                  <label class="${p}-label">${tr("auditorName")}</label>
                  ${nameFieldHtml}
                </div>
              </div>
              <div class="${p}-row full" style="grid-template-columns:1fr;margin-bottom:12px">
                <div class="${p}-field">
                  <label class="${p}-label">${tr("auditorNotes")} <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px;color:var(--gray-lt)">${tr("optional")}</span></label>
                  <textarea class="${p}-input" id="${p}-anotes" rows="2" placeholder="${tr("auditorNotesPlaceholder")}" style="resize:none;line-height:1.5">${esc(auditNotes)}</textarea>
                  <label class="${p}-note-attach" for="${p}-note-file">${iCamera} ${tr("attachPhotoFile")}</label>
                  <input type="file" id="${p}-note-file" class="${p}-note-file" multiple>
                  <div class="${p}-note-chips" id="${p}-note-chips"></div>
                </div>
              </div>
              <button type="button" class="${p}-btn ${p}-btn-primary ${p}-btn-full" id="${p}-begin" ${!questionsLoaded ? "disabled" : ""}>${!questionsLoaded ? `<span class="${p}-spin" style="border-top-color:#fff;border-color:rgba(255,255,255,.3)"></span> ${tr("loadingQuestions")}` : `${iCheck} ${tr("beginAudit")}`}</button>
            </div>
          </div>`;
                    // ── Bind click-to-edit name (if already loaded) ───────────────
                    if (nameLoaded) {
                        const nameDisplay = contentEl.querySelector(`#${p}-name-display`);
                        if (nameDisplay)
                            bindNameEdit(nameDisplay);
                    }
                    const trigger = contentEl.querySelector(`#${p}-trigger`);
                    const dropdown = contentEl.querySelector(`#${p}-dropdown`);
                    const searchInp = contentEl.querySelector(`#${p}-search`);
                    const optsList = contentEl.querySelector(`#${p}-opts`);
                    function renderOpts(filter = "") {
                        if (!installationsLoaded) {
                            optsList.innerHTML = `<div class="${p}-dd-msg">Loading ${esc(storeP.toLowerCase())}…</div>`;
                            return;
                        }
                        if (!installations.length) {
                            optsList.innerHTML = `<div class="${p}-dd-msg">No ${esc(storeP.toLowerCase())} found</div>`;
                            return;
                        }
                        const matches = installations.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()));
                        if (!matches.length) {
                            optsList.innerHTML = `<div class="${p}-dd-msg">No ${esc(storeP.toLowerCase())} found</div>`;
                            return;
                        }
                        optsList.innerHTML = matches.map(s => `
            <div class="${p}-dd-opt${s.id === selectedInstId ? " sel" : ""}" data-id="${esc(s.id)}" data-title="${esc(s.title)}">
              <span>${esc(s.title)}</span>
              ${s.id === selectedInstId ? iCheck : ""}
            </div>`).join("");
                        optsList.querySelectorAll(`.${p}-dd-opt`).forEach((opt) => {
                            opt.addEventListener("click", () => {
                                const el = opt;
                                selectedInstId = el.dataset.id || "";
                                trigger.innerHTML = `<span style="color:var(--dark);font-size:14px">${esc(el.dataset.title || "")}</span>`;
                                dropdown.classList.remove("show");
                                trigger.classList.remove("open");
                                renderOpts(searchInp.value);
                            });
                        });
                    }
                    refreshStoreOptsCallback = renderOpts;
                    trigger.addEventListener("click", () => {
                        dropdown.classList.toggle("show");
                        trigger.classList.toggle("open");
                        if (dropdown.classList.contains("show")) {
                            searchInp.focus();
                            renderOpts(searchInp.value);
                        }
                    });
                    searchInp.addEventListener("input", () => renderOpts(searchInp.value));
                    const outsideClick = (e) => {
                        if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
                            dropdown.classList.remove("show");
                            trigger.classList.remove("open");
                        }
                    };
                    document.addEventListener("click", outsideClick);
                    cleanupStoreDropdown = () => document.removeEventListener("click", outsideClick);
                    renderOpts();
                    // Auditor note attachments
                    const noteFile = contentEl.querySelector(`#${p}-note-file`);
                    const noteChips = contentEl.querySelector(`#${p}-note-chips`);
                    const renderNoteChips = () => {
                        if (!noteChips)
                            return;
                        noteChips.innerHTML = auditNoteFiles.map((f, i) => `<span class="${p}-note-chip"><span>${esc(f.name)}</span><button type="button" data-idx="${i}">${iXsmall}</button></span>`).join("");
                        noteChips.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
                            const idx = parseInt(b.dataset.idx || "-1", 10);
                            if (idx >= 0) {
                                auditNoteFiles.splice(idx, 1);
                                renderNoteChips();
                            }
                        }));
                    };
                    noteFile === null || noteFile === void 0 ? void 0 : noteFile.addEventListener("change", () => {
                        for (const f of Array.from(noteFile.files || [])) {
                            if (f.size > MEDIA_MAX) {
                                showBanner("error", `"${f.name}" is over 25 MB.`);
                                continue;
                            }
                            auditNoteFiles.push(f);
                        }
                        noteFile.value = "";
                        renderNoteChips();
                    });
                    renderNoteChips();
                    contentEl.querySelector(`#${p}-begin`).addEventListener("click", () => {
                        var _a, _b;
                        // Read auditor name from whichever element is currently rendered
                        const nameInput = contentEl.querySelector(`#${p}-aname`);
                        const nameText = contentEl.querySelector(`#${p}-name-text`);
                        if (nameInput)
                            auditorName = nameInput.value.trim();
                        else if (nameText)
                            auditorName = ((_a = nameText.textContent) === null || _a === void 0 ? void 0 : _a.trim()) === "—" ? "" : (((_b = nameText.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || "");
                        auditDate = contentEl.querySelector(`#${p}-adate`).value;
                        auditNotes = contentEl.querySelector(`#${p}-anotes`).value.trim();
                        if (!selectedInstId) {
                            showBanner("error", `Please select a ${storeS}.`);
                            return;
                        }
                        if (!auditorName) {
                            showBanner("error", tr("enterYourName"));
                            return;
                        }
                        hideBanner();
                        step = "audit";
                        renderAudit();
                    });
                }
                // ── Step 2: Questions ─────────────────────────────────────────────
                function renderAudit() {
                    const sc = getScore();
                    const pct = sc.count > 0 ? Math.round((sc.answered / sc.count) * 100) : 0;
                    const catQs = questions.filter(q => q.cat === activeCat);
                    const idx = categories.indexOf(activeCat);
                    const isFirst = idx === 0, isLast = idx === categories.length - 1;
                    const tabsHtml = categories.map(cat => {
                        const catQsList = questions.filter(q => q.cat === cat);
                        const answered = catQsList.filter(q => responses[q.id]).length;
                        const fails = catQsList.filter(q => isPass(q, responses[q.id] || "") === false).length;
                        const badge = fails > 0 ? `<span class="${p}-cat-badge">${fails}</span>` : "";
                        const score = `<span class="${p}-cat-tab-score">${answered}/${catQsList.length}</span>`;
                        return `<div role="button" tabindex="0" class="${p}-cat-tab${cat === activeCat ? " active" : ""}" data-cat="${esc(cat)}">${catIcon(cat)}<span class="${p}-cat-tab-name">${esc(cat)}${badge}</span>${score}</div>`;
                    }).join("");
                    const qHtml = catQs.map(renderQuestion).join("");
                    contentEl.innerHTML = `
          <div style="margin-bottom:14px">
            <div class="${p}-prog-label"><span>${tr("nOfMAnswered").replace("{a}", String(sc.answered)).replace("{b}", String(sc.count))}</span><span style="font-weight:700;color:var(--dark)">${pct}%</span></div>
            <div class="${p}-prog-wrap"><div class="${p}-prog-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="${p}-card">
            <div class="${p}-card-head" style="padding:0;border-bottom:none;overflow:hidden">
              <div class="${p}-cat-tabs-wrap" id="${p}-tabs-wrap">
                <div class="${p}-cat-tabs" id="${p}-cat-tabs" style="padding:0 4px">${tabsHtml}</div>
                <div class="${p}-tabs-arrow ${p}-tabs-arrow-left" id="${p}-tabs-left">‹</div>
                <div class="${p}-tabs-arrow ${p}-tabs-arrow-right" id="${p}-tabs-right">›</div>
              </div>
            </div>
            <div class="${p}-card-body" id="${p}-qwrap">
              ${qHtml || `<div class="${p}-state"><strong>${tr("noQuestions")}</strong></div>`}
            </div>
          </div>
          <div class="${p}-nav">
            <button type="button" class="${p}-btn ${p}-btn-ghost" id="${p}-prev">${iPrev} ${isFirst ? tr("setup") : tr("prev")}</button>
            ${isLast
                        ? `<button type="button" class="${p}-btn ${p}-btn-primary" id="${p}-gen">${iFlag} ${tr("viewOverview")}</button>`
                        : `<button type="button" class="${p}-btn ${p}-btn-primary" id="${p}-next">${tr("next")} ${iNext}</button>`}
          </div>`;
                    // ── Scroll arrows ──────────────────────────────────────────────
                    const tabsEl = contentEl.querySelector(`#${p}-cat-tabs`);
                    const arrowLeft = contentEl.querySelector(`#${p}-tabs-left`);
                    const arrowRight = contentEl.querySelector(`#${p}-tabs-right`);
                    function updateArrows() {
                        const sl = tabsEl.scrollLeft;
                        const maxSl = tabsEl.scrollWidth - tabsEl.clientWidth;
                        arrowLeft.classList.toggle("visible", sl > 4);
                        arrowRight.classList.toggle("visible", maxSl > 4 && sl < maxSl - 4);
                    }
                    tabsEl.addEventListener("scroll", updateArrows, { passive: true });
                    // initial arrow state + scroll active tab into view
                    requestAnimationFrame(() => {
                        updateArrows();
                        const activeTab = tabsEl.querySelector(`.${p}-cat-tab.active`);
                        if (activeTab)
                            activeTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                    });
                    arrowLeft.addEventListener("click", () => { tabsEl.scrollBy({ left: -220, behavior: "smooth" }); });
                    arrowRight.addEventListener("click", () => { tabsEl.scrollBy({ left: 220, behavior: "smooth" }); });
                    // ── Tab + nav events ───────────────────────────────────────────
                    contentEl.querySelectorAll(`.${p}-cat-tab`).forEach(btn => {
                        btn.addEventListener("click", () => {
                            activeCat = btn.dataset.cat || activeCat;
                            renderAudit();
                        });
                    });
                    const prevBtn = contentEl.querySelector(`#${p}-prev`);
                    prevBtn.addEventListener("click", () => {
                        if (isFirst) {
                            step = "setup";
                            renderSetup();
                        }
                        else {
                            activeCat = categories[idx - 1];
                            renderAudit();
                        }
                    });
                    const nextBtn = contentEl.querySelector(`#${p}-next`);
                    if (nextBtn)
                        nextBtn.addEventListener("click", () => { activeCat = categories[idx + 1]; renderAudit(); });
                    const genBtn = contentEl.querySelector(`#${p}-gen`);
                    if (genBtn)
                        genBtn.addEventListener("click", () => {
                            hideBanner();
                            for (const q of failedTasks()) {
                                if (taskGroupOverrides[q.id] || taskUserOverrides[q.id])
                                    continue; // already assigned
                                if (q.taskRole) {
                                    const m = fuzzyMatchGroup(q.taskRole, allGroups);
                                    if (m) {
                                        taskGroupOverrides[q.id] = m;
                                        taskAssignType[q.id] = "group";
                                        continue;
                                    }
                                }
                                // No group match — fall back to Nicole Adams (or any default user)
                                if (defaultUserId) {
                                    taskUserOverrides[q.id] = defaultUserId;
                                    taskAssignType[q.id] = "user";
                                }
                            }
                            step = "generate";
                            renderGenerate();
                        });
                    bindControls();
                }
                function renderQuestion(q) {
                    const val = responses[q.id] || "";
                    const passed = isPass(q, val);
                    const showFlag = q.task && passed === false;
                    let ctrl = "";
                    if (q.type === "pf") {
                        ctrl = `<div class="${p}-pf-row">
            <button type="button" class="${p}-pf-btn${val === "pass" ? " pass" : ""}" data-qid="${esc(q.id)}" data-val="pass">${tr("pass")}</button>
            <button type="button" class="${p}-pf-btn${val === "fail" ? " fail" : ""}" data-qid="${esc(q.id)}" data-val="fail">${tr("fail")}</button>
            <button type="button" class="${p}-pf-btn${val === "na" ? " na" : ""}" data-qid="${esc(q.id)}" data-val="na">${tr("na")}</button>
          </div>`;
                    }
                    else if (q.type === "rating") {
                        const rv = val ? parseInt(val) : 0;
                        ctrl = `<div class="${p}-rating-row">${[1, 2, 3, 4, 5].map(n => {
                            let cls = "";
                            if (rv === n)
                                cls = n <= 2 ? "low" : n === 3 ? "mid" : "hi";
                            return `<button type="button" class="${p}-rating-btn${cls ? " " + cls : ""}" data-qid="${esc(q.id)}" data-val="${n}">${n}</button>`;
                        }).join("")}</div><div class="${p}-rating-hint"><span>${tr("poor")}</span><span>${tr("excellent")}</span></div>`;
                    }
                    else if (q.type === "temp") {
                        const isCooler = q.id.startsWith("BOH") || q.text.toLowerCase().includes("cooler");
                        const hint = isCooler ? "35–41°F (walk-in cooler)" : "≥140°F (hot holding) · ≥165°F (cooking)";
                        let tcls = "";
                        if (val) {
                            const n = parseFloat(val);
                            tcls = (isCooler ? (n >= 35 && n <= 41) : n >= 140) ? " ok" : " bad";
                        }
                        ctrl = `<input type="number" class="${p}-temp-input${tcls}" inputmode="decimal" placeholder="°F" value="${esc(val)}" data-qid="${esc(q.id)}" data-dtype="temp">
                <div class="${p}-temp-hint">${hint}</div>`;
                    }
                    else if (q.type === "time") {
                        const s = timeState[q.id] || { elapsed: 0, running: false, startAt: 0 };
                        const tgt = parseTimeTarget(q);
                        const st = tgt ? timeStatus(Math.floor(curElapsed(s) / 1000), tgt) : null;
                        const scale = dialScale(tgt);
                        const zone = tgt ? dialZone(tgt, scale) : { start: 0, frac: 0 };
                        const progFrac = Math.min((curElapsed(s) / 1000) / scale, 1);
                        const stCls = st ? ` ${p}-st-${st.state}` : "";
                        ctrl = `
            <div class="${p}-timer">
              <div class="${p}-dial-wrap${s.running ? " running" : ""}${stCls}" data-qid="${esc(q.id)}">
                <div class="${p}-crown"></div>
                <svg class="${p}-dial" viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="${p}-dial-ticks" cx="60" cy="60" r="58"/>
                  <circle class="${p}-dial-track" cx="60" cy="60" r="${DIAL_R}"/>
                  ${zone.frac > 0 ? `<circle class="${p}-dial-zone" cx="60" cy="60" r="${DIAL_R}" stroke-dasharray="${dash(zone.frac)}" stroke-dashoffset="${-zone.start * DIAL_C}"/>` : ""}
                  <circle class="${p}-dial-prog" data-qid="${esc(q.id)}" cx="60" cy="60" r="${DIAL_R}" stroke-dasharray="${dash(progFrac)}"/>
                </svg>
                <div class="${p}-dial-center">
                  <div class="${p}-timer-display" data-qid="${esc(q.id)}">${fmtTimer(curElapsed(s))}</div>
                  ${st ? `<span class="${p}-timer-status ${p}-st-${st.state}" data-qid="${esc(q.id)}">${st.label}</span>` : ""}
                </div>
              </div>
              <div class="${p}-timer-actions">
                <button type="button" class="${p}-timer-btn${s.running ? " stop" : ""}" data-qid="${esc(q.id)}" data-tact="toggle">${s.running ? tr("stop") : tr("start")}</button>
                <button type="button" class="${p}-timer-btn ghost" data-qid="${esc(q.id)}" data-tact="reset">${tr("reset")}</button>
              </div>
            </div>
            ${tgt ? `<div class="${p}-timer-goal">${goalLabel(tgt)}</div>` : ""}
            <div class="${p}-pf-row">
              <button type="button" class="${p}-pf-btn${val === "pass" ? " pass" : ""}" data-qid="${esc(q.id)}" data-val="pass">Pass</button>
              <button type="button" class="${p}-pf-btn${val === "fail" ? " fail" : ""}" data-qid="${esc(q.id)}" data-val="fail">Fail</button>
              <button type="button" class="${p}-pf-btn${val === "na" ? " na" : ""}" data-qid="${esc(q.id)}" data-val="na">N/A</button>
            </div>`;
                    }
                    const flagHtml = showFlag && q.taskTitle ? `
          <div class="${p}-task-flag show">
            <div class="${p}-task-flag-title">${iFlag} ${tr("taskWillBeGenerated")}</div>
            <p style="font-size:12px;color:#78350f;line-height:1.4;margin:0"><strong>${esc(q.taskTitle)}</strong> · ${esc(q.taskRole)} · ${esc(q.taskPriority)} · ${tr("dueLabel")} ${q.taskDue === 0 ? tr("immediately") : `${q.taskDue}d`}</p>
            <label class="${p}-photo" data-qid="${esc(q.id)}" for="${p}-pfin-${esc(q.id)}">${iCamera} ${tr("addPhoto")}</label>
            <input type="file" accept="image/*" multiple id="${p}-pfin-${esc(q.id)}" class="${p}-photo-input" data-qid="${esc(q.id)}">
            <div class="${p}-photo-line" data-qid="${esc(q.id)}">${photoChips(q.id)}</div>
          </div>` : "";
                    const iCheck2 = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                    return `<div class="${p}-question" data-qid="${esc(q.id)}">
          <div class="${p}-q-header"><span class="${p}-q-id">${esc(q.id)}</span><span class="${p}-q-text">${esc(q.text)}</span></div>
          ${q.passCriteria ? `<div class="${p}-q-criteria">${iCheck2} ${esc(q.passCriteria)}</div>` : ""}
          <div class="${p}-q-chips">
            <span class="${p}-chip ${p}-chip-pts">${tr("nPts").replace("{n}", String(q.pts))}</span>
            ${q.critical ? `<span class="${p}-chip ${p}-chip-crit">${iWarn} ${tr("critical")}</span>` : ""}
            ${q.task ? `<span class="${p}-chip ${p}-chip-task">${iFlag} ${tr("autoTask")}</span>` : ""}
          </div>
          ${ctrl}${flagHtml}
        </div>`;
                }
                // root defaults to the whole audit (initial render); refreshQuestion passes just the
                // re-rendered question so we don't stack duplicate listeners on the other questions
                // (which previously made the secret demo fire across different items).
                function bindControls(root = contentEl) {
                    root.querySelectorAll(`.${p}-pf-btn`).forEach((btn) => {
                        btn.addEventListener("click", () => {
                            const { qid, val } = btn.dataset;
                            responses[qid] = val;
                            refreshQuestion(qid);
                            // Secret demo: tap the SAME "Pass" button 5× quickly → auto-fill audit.
                            if (val === "pass") {
                                if (demoQid === qid)
                                    demoCount++;
                                else {
                                    demoQid = qid;
                                    demoCount = 1;
                                }
                                clearTimeout(demoTimer);
                                demoTimer = setTimeout(() => { demoCount = 0; demoQid = ""; }, 2500);
                                if (demoCount >= 5) {
                                    demoCount = 0;
                                    demoQid = "";
                                    demoFill();
                                }
                            }
                            else {
                                demoCount = 0;
                                demoQid = "";
                            }
                        });
                    });
                    root.querySelectorAll(`.${p}-rating-btn`).forEach((btn) => {
                        btn.addEventListener("click", () => {
                            const { qid, val } = btn.dataset;
                            responses[qid] = val;
                            refreshQuestion(qid);
                        });
                    });
                    root.querySelectorAll(`[data-dtype="temp"]`).forEach((inp) => {
                        inp.addEventListener("change", () => {
                            const qid = inp.dataset.qid;
                            responses[qid] = inp.value;
                            refreshQuestion(qid);
                        });
                    });
                    // Time-task stopwatch controls
                    root.querySelectorAll(`.${p}-timer-btn`).forEach((btn) => {
                        btn.addEventListener("click", () => {
                            const el = btn;
                            const qid = el.dataset.qid;
                            const act = el.dataset.tact;
                            const s = timeState[qid] || (timeState[qid] = { elapsed: 0, running: false, startAt: 0 });
                            if (act === "toggle") {
                                if (s.running) {
                                    s.elapsed = curElapsed(s);
                                    s.running = false;
                                    // On stop, let the timer decide Pass/Fail against the goal (if any).
                                    const q = questions.find(x => x.id === qid);
                                    const tgt = q ? parseTimeTarget(q) : null;
                                    if (tgt) {
                                        const st = timeStatus(Math.floor(s.elapsed / 1000), tgt);
                                        responses[qid] = st.state === "pass" ? "pass" : "fail";
                                    }
                                }
                                else {
                                    s.startAt = Date.now();
                                    s.running = true;
                                }
                            }
                            else if (act === "reset") {
                                s.elapsed = 0;
                                s.running = false;
                                responses[qid] = "";
                            }
                            ensureTick();
                            refreshQuestion(qid);
                        });
                    });
                    // Photo attach inside the "Task will be generated" flag
                    root.querySelectorAll(`.${p}-photo`).forEach((btn) => {
                        const qid = btn.dataset.qid;
                        const input = root.querySelector(`.${p}-photo-input[data-qid="${qid}"]`);
                        const line = root.querySelector(`.${p}-photo-line[data-qid="${qid}"]`);
                        const refreshChips = () => {
                            if (!line)
                                return;
                            line.innerHTML = photoChips(qid);
                            line.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
                                const idx = parseInt(b.dataset.idx || "-1", 10);
                                if (idx >= 0 && taskFiles[qid]) {
                                    taskFiles[qid].splice(idx, 1);
                                    refreshChips();
                                }
                            }));
                        };
                        // No click handler needed — the <label for> opens the picker natively
                        // (far more reliable on mobile than input.click() on a hidden input).
                        input === null || input === void 0 ? void 0 : input.addEventListener("change", () => {
                            const ok = [];
                            for (const f of Array.from(input.files || [])) {
                                if (f.size > MEDIA_MAX) {
                                    showBanner("error", `"${f.name}" is over 25 MB.`);
                                    continue;
                                }
                                ok.push(f);
                            }
                            if (ok.length) {
                                (taskFiles[qid] = taskFiles[qid] || []).push(...ok);
                                refreshChips();
                            }
                            input.value = "";
                        });
                        refreshChips();
                    });
                }
                function refreshQuestion(qid) {
                    const q = questions.find(x => x.id === qid);
                    if (!q)
                        return;
                    const el = contentEl.querySelector(`.${p}-question[data-qid="${qid}"]`);
                    if (!el)
                        return;
                    el.outerHTML = renderQuestion(q);
                    // Re-bind ONLY the replaced question (not the whole audit) to avoid stacking listeners.
                    const fresh = contentEl.querySelector(`.${p}-question[data-qid="${qid}"]`);
                    if (fresh)
                        bindControls(fresh);
                    const sc = getScore();
                    const pct = sc.count > 0 ? Math.round((sc.answered / sc.count) * 100) : 0;
                    const fill = contentEl.querySelector(`.${p}-prog-fill`);
                    const lbl = contentEl.querySelector(`.${p}-prog-label`);
                    if (fill)
                        fill.style.width = `${pct}%`;
                    if (lbl)
                        lbl.innerHTML = `<span>${sc.answered} of ${sc.count} answered</span><span style="font-weight:700;color:var(--dark)">${pct}%</span>`;
                    categories.forEach(cat => {
                        const fails = questions.filter(q => q.cat === cat && isPass(q, responses[q.id] || "") === false).length;
                        const tab = contentEl.querySelector(`.${p}-cat-tab[data-cat="${cat}"]`);
                        if (!tab)
                            return;
                        let badge = tab.querySelector(`.${p}-cat-badge`);
                        if (fails > 0) {
                            if (badge)
                                badge.textContent = String(fails);
                            else
                                tab.insertAdjacentHTML("beforeend", `<span class="${p}-cat-badge">${fails}</span>`);
                        }
                        else
                            badge === null || badge === void 0 ? void 0 : badge.remove();
                    });
                }
                // ── Step 3: Generate / Review ─────────────────────────────────────
                function renderGenerate() {
                    const sc = getScore();
                    const pct = sc.total > 0 && sc.answered > 0 ? Math.round((sc.earned / sc.total) * 100) : 0;
                    const passing = pct >= passThreshold;
                    const ft = failedTasks();
                    const inst = installations.find(i => i.id === selectedInstId);
                    const scoreColor = passing ? "var(--success)" : "var(--error)";
                    // Category breakdown — 3-col grid for true centering
                    const catRows = categories.map(cat => {
                        const qs = questions.filter(q => q.cat === cat);
                        const earned = qs.reduce((a, q) => a + (isPass(q, responses[q.id] || "") ? q.pts : 0), 0);
                        const tot = qs.reduce((a, q) => a + q.pts, 0);
                        const ans = qs.filter(q => isPass(q, responses[q.id] || "") !== null).length;
                        const cp = tot > 0 && ans > 0 ? Math.round((earned / tot) * 100) : null;
                        const col = cp === null ? "var(--gray-lt)" : cp >= passThreshold ? "var(--success)" : "var(--error)";
                        return `<div class="${p}-cat-row">
            <span class="${p}-cat-row-name">${esc(cat)}</span>
            <span class="${p}-cat-row-count">${ans}/${qs.length}</span>
            <span class="${p}-cat-row-pct" style="color:${col}">${cp !== null ? cp + "%" : "—"}</span>
          </div>`;
                    }).join("");
                    // Failed tasks with per-task group picker
                    const failHtml = ft.length === 0
                        ? `<div class="${p}-state"><strong>${tr("noFailures")}</strong>${tr("allPassedOrNa")}</div>`
                        : ft.map(q => {
                            const gid = taskGroupOverrides[q.id] || "";
                            const uid = taskUserOverrides[q.id] || "";
                            const atype = taskAssignType[q.id] || "group";
                            const selGroup = allGroups.find(g => g.id === gid);
                            const selUser = allUsers.find(u => u.id === uid);
                            const selLabel = atype === "user" && selUser
                                ? `<span style="color:var(--dark)">${esc(selUser.name)}</span>`
                                : atype === "group" && selGroup
                                    ? `<span style="color:var(--dark)">${esc(selGroup.name)}</span>`
                                    : `<span class="${p}-gp-ph">${tr("unassigned")}</span>`;
                            const due = q.taskDue === 0 ? tr("immediately") : tr("withinDays").replace("{d}", String(q.taskDue));
                            return `<div class="${p}-fail-item">
              <div class="${p}-fail-head">
                <div class="${p}-fail-title">${esc(q.taskTitle || q.text)}</div>
                <span class="${p}-prio ${prioClass(q.taskPriority)}">${esc(q.taskPriority)}</span>
              </div>
              <div class="${p}-fail-meta">${esc(q.id)} · ${tr("dueLabel")} ${due}</div>
              <div class="${p}-group-lbl">${tr("assignTo")}</div>
              <div class="${p}-gp-wrap" data-qid="${esc(q.id)}">
                <button type="button" class="${p}-gp-trigger" data-qid="${esc(q.id)}">${selLabel}</button>
                <div class="${p}-gp-dropdown" data-qid="${esc(q.id)}">
                  <div style="padding:8px 10px 0">
                    <div class="${p}-ap-tabs">
                      <div role="button" tabindex="0" class="${p}-ap-tab${atype === "group" ? " active" : ""}" data-qid="${esc(q.id)}" data-tab="group">${tr("groups")}</div>
                      <div role="button" tabindex="0" class="${p}-ap-tab${atype === "user" ? " active" : ""}" data-qid="${esc(q.id)}" data-tab="user">${tr("people")}</div>
                    </div>
                  </div>
                  <div class="${p}-gp-search"><input type="text" placeholder="${tr("searchPlaceholder")}" data-qid="${esc(q.id)}"></div>
                  <div class="${p}-gp-list" data-qid="${esc(q.id)}" data-tab="${atype}"></div>
                </div>
              </div>
              ${photoThumbs(q.id)}
            </div>`;
                        }).join("");
                    contentEl.innerHTML = `
          <div class="${p}-card">
            <div class="${p}-card-head"><span class="${p}-step">${iCheck}</span><span class="${p}-card-title">${tr("auditSummary")}</span></div>
            <div class="${p}-card-body">
              <div style="text-align:center;padding:6px 0 14px">
                <div class="${p}-score-big" style="color:${scoreColor}">${pct}%</div>
                <div style="font-size:14px;font-weight:700;color:${scoreColor};margin-top:2px">${passing ? tr("passing") : tr("failing")}</div>
                <div style="font-size:12px;color:var(--gray-lt);margin-top:4px">${tr("scoreSummary").replace("{e}", String(sc.earned)).replace("{t}", String(sc.total)).replace("{a}", String(sc.answered)).replace("{c}", String(sc.count))}</div>
                <div class="${p}-score-bar-wrap"><div class="${p}-score-bar" style="width:${pct}%;background:${scoreColor}"></div></div>
                <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--gray-lt);margin-top:2px"><span>0%</span><span style="color:${scoreColor}">${tr("nThreshold").replace("{n}", String(passThreshold))}</span><span>100%</span></div>
              </div>
              <div class="${p}-meta-grid">
                <div class="${p}-meta-row"><span>${iStore} ${esc(storeS)}</span><span style="font-weight:600">${esc((inst === null || inst === void 0 ? void 0 : inst.title) || "—")}</span></div>
                <div class="${p}-meta-row"><span>${iUser} ${tr("auditor")}</span><span>${esc(auditorName)}</span></div>
                <div class="${p}-meta-row"><span>${tr("date")}</span><span>${esc(auditDate)}</span></div>
                <div class="${p}-meta-row"><span>${tr("tasksFlagged")}</span><span style="font-weight:700;color:${ft.length > 0 ? "var(--error)" : "var(--success)"}">${ft.length}</span></div>
                ${auditNotes ? `<div class="${p}-meta-row" style="flex-direction:column;align-items:flex-start;gap:3px"><span style="color:var(--gray-lt);font-size:11px;text-transform:uppercase;letter-spacing:.3px">${tr("notes")}</span><span style="line-height:1.5">${esc(auditNotes)}</span></div>` : ""}
              </div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray-lt);margin-bottom:8px">${tr("categoryBreakdown")}</div>
              ${catRows}
            </div>
          </div>

          ${ft.length > 0 ? `
          <div class="${p}-card">
            <div class="${p}-card-head"><span class="${p}-step">${iFlag}</span><span class="${p}-card-title">${tr("tasksToCreate")} <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px;color:var(--gray-lt)">(${ft.length})</span></span></div>
            <div class="${p}-card-body">${failHtml}</div>
          </div>` : ""}

          <div class="${p}-nav">
            <button type="button" class="${p}-btn ${p}-btn-ghost" id="${p}-back">${iPrev} ${tr("back")}</button>
            <button type="button" class="${p}-btn ${p}-btn-primary" id="${p}-submit">${iSend} ${tr("submitCreateTasks")}</button>
          </div>
          <div class="${p}-submit-prog" id="${p}-sprog">
            <div class="${p}-submit-prog-meta"><span id="${p}-slabel">${tr("working")}</span><span id="${p}-spct">0%</span></div>
            <div class="${p}-submit-bar-wrap"><div class="${p}-submit-bar-fill" id="${p}-sfill"></div></div>
            <div class="${p}-submit-log" id="${p}-slog"></div>
          </div>`;
                    // ── Assign picker logic (groups + people) ─────────────────────
                    function renderGpList(qid, filter = "") {
                        const list = contentEl.querySelector(`.${p}-gp-list[data-qid="${qid}"]`);
                        if (!list)
                            return;
                        const tab = (taskAssignType[qid] || "group");
                        list.dataset.tab = tab;
                        const fl = filter.toLowerCase();
                        if (tab === "user") {
                            const selId = taskUserOverrides[qid] || "";
                            const opts = [{ id: "", name: "— No assignee —", avatar: "" }, ...allUsers].filter(u => !fl || u.name.toLowerCase().includes(fl));
                            if (!opts.length) {
                                list.innerHTML = `<div class="${p}-gp-none">${tr("noPeopleFound")}</div>`;
                                return;
                            }
                            list.innerHTML = opts.map(u => `
              <div class="${p}-gp-opt${u.id === selId ? " sel" : ""}" data-uid="${esc(u.id)}" data-uname="${esc(u.name)}" data-dtype="user" data-qid="${esc(qid)}">
                <span>${esc(u.name)}</span>
                ${u.id === selId ? iCheck : ""}
              </div>`).join("");
                        }
                        else {
                            const selId = taskGroupOverrides[qid] || "";
                            const opts = [{ id: "", name: "— No group —" }, ...allGroups].filter(g => !fl || g.name.toLowerCase().includes(fl));
                            if (!opts.length) {
                                list.innerHTML = `<div class="${p}-gp-none">${tr("noGroupsFound")}</div>`;
                                return;
                            }
                            list.innerHTML = opts.map(g => `
              <div class="${p}-gp-opt${g.id === selId ? " sel" : ""}" data-gid="${esc(g.id)}" data-gname="${esc(g.name)}" data-dtype="group" data-qid="${esc(qid)}">
                <span>${esc(g.name)}</span>
                ${g.id === selId ? iCheck : ""}
              </div>`).join("");
                        }
                        list.querySelectorAll(`.${p}-gp-opt`).forEach((opt) => {
                            opt.addEventListener("click", () => {
                                const el = opt;
                                const qid2 = el.dataset.qid;
                                const dtype = el.dataset.dtype;
                                taskAssignType[qid2] = dtype;
                                let label = `<span class="${p}-gp-ph">${tr("unassigned")}</span>`;
                                if (dtype === "user") {
                                    const uid = el.dataset.uid || "";
                                    const uname = el.dataset.uname || "";
                                    taskUserOverrides[qid2] = uid;
                                    if (uid)
                                        label = `<span style="color:var(--dark)">${esc(uname)}</span>`;
                                }
                                else {
                                    const gid = el.dataset.gid || "";
                                    const gname = el.dataset.gname || "";
                                    taskGroupOverrides[qid2] = gid;
                                    if (gid)
                                        label = `<span style="color:var(--dark)">${esc(gname)}</span>`;
                                }
                                const trigger2 = contentEl.querySelector(`.${p}-gp-trigger[data-qid="${qid2}"]`);
                                if (trigger2)
                                    trigger2.innerHTML = label;
                                const dd = contentEl.querySelector(`.${p}-gp-dropdown[data-qid="${qid2}"]`);
                                if (dd)
                                    dd.classList.remove("show");
                                trigger2 === null || trigger2 === void 0 ? void 0 : trigger2.classList.remove("open");
                                renderGpList(qid2, "");
                            });
                        });
                    }
                    // Wire up each per-task picker
                    const closeAllPickers = (exceptQid) => {
                        contentEl.querySelectorAll(`.${p}-gp-dropdown.show`).forEach((dd) => {
                            var _a;
                            const ddEl = dd;
                            if (ddEl.dataset.qid !== exceptQid) {
                                ddEl.classList.remove("show");
                                (_a = contentEl.querySelector(`.${p}-gp-trigger[data-qid="${ddEl.dataset.qid}"]`)) === null || _a === void 0 ? void 0 : _a.classList.remove("open");
                            }
                        });
                    };
                    ft.forEach(q => {
                        const trigger3 = contentEl.querySelector(`.${p}-gp-trigger[data-qid="${q.id}"]`);
                        const dd3 = contentEl.querySelector(`.${p}-gp-dropdown[data-qid="${q.id}"]`);
                        const search3 = contentEl.querySelector(`.${p}-gp-search input[data-qid="${q.id}"]`);
                        if (!trigger3 || !dd3)
                            return;
                        renderGpList(q.id, "");
                        trigger3.addEventListener("click", (e) => {
                            e.stopPropagation();
                            const isOpen = dd3.classList.contains("show");
                            closeAllPickers(isOpen ? undefined : q.id);
                            dd3.classList.toggle("show");
                            trigger3.classList.toggle("open");
                            if (dd3.classList.contains("show"))
                                search3 === null || search3 === void 0 ? void 0 : search3.focus();
                        });
                        search3 === null || search3 === void 0 ? void 0 : search3.addEventListener("input", () => renderGpList(q.id, (search3 === null || search3 === void 0 ? void 0 : search3.value) || ""));
                        search3 === null || search3 === void 0 ? void 0 : search3.addEventListener("click", (e) => e.stopPropagation());
                        dd3.addEventListener("click", (e) => e.stopPropagation());
                        // Tab switching (Groups / People)
                        dd3.querySelectorAll(`.${p}-ap-tab[data-qid="${q.id}"]`).forEach((tab) => {
                            tab.addEventListener("click", (e) => {
                                e.stopPropagation();
                                const t = tab.dataset.tab;
                                taskAssignType[q.id] = t;
                                if (search3)
                                    search3.value = "";
                                // update active tab appearance
                                dd3.querySelectorAll(`.${p}-ap-tab`).forEach((tb) => tb.classList.toggle("active", tb.dataset.tab === t));
                                renderGpList(q.id, "");
                            });
                        });
                    });
                    document.addEventListener("click", () => closeAllPickers());
                    contentEl.querySelector(`#${p}-back`).addEventListener("click", () => {
                        step = "audit";
                        activeCat = categories[categories.length - 1] || categories[0];
                        renderAudit();
                    });
                    contentEl.querySelector(`#${p}-submit`).addEventListener("click", submitAudit);
                }
                // ── Submit ────────────────────────────────────────────────────────
                function submitAudit() {
                    return audit_widget_awaiter(this, void 0, void 0, function* () {
                        var _a, _b;
                        const submitBtn = contentEl.querySelector(`#${p}-submit`);
                        const progEl = contentEl.querySelector(`#${p}-sprog`);
                        const sFill = contentEl.querySelector(`#${p}-sfill`);
                        const sLabel = contentEl.querySelector(`#${p}-slabel`);
                        const sPct = contentEl.querySelector(`#${p}-spct`);
                        const sLog = contentEl.querySelector(`#${p}-slog`);
                        submitBtn.disabled = true;
                        submitBtn.innerHTML = `<span class="${p}-spin" style="border-top-color:#fff;border-color:rgba(255,255,255,.3)"></span> ${tr("submitting")}`;
                        progEl.style.display = "block";
                        sLog.innerHTML = "";
                        hideBanner();
                        const ft = failedTasks();
                        const sc = getScore();
                        const pct = sc.total > 0 && sc.answered > 0 ? Math.round((sc.earned / sc.total) * 100) : 0;
                        const passing = pct >= passThreshold;
                        const inst = installations.find(i => i.id === selectedInstId);
                        const now = new Date();
                        const listName = `Audit — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
                        const totalOps = 1 + 1 + ft.length;
                        let done = 0;
                        function setProgress(n, label) {
                            const pc = Math.round((n / totalOps) * 100);
                            sFill.style.width = `${pc}%`;
                            sPct.textContent = `${pc}%`;
                            sLabel.textContent = label;
                        }
                        function logLine(text, cls = "") {
                            const d = document.createElement("div");
                            d.className = `${p}-log-item ${cls}`;
                            d.textContent = text;
                            sLog.appendChild(d);
                            sLog.scrollTop = sLog.scrollHeight;
                        }
                        try {
                            setProgress(0, "Creating task list…");
                            const listRes = yield fetch(`${baseUrl}/tasks/${selectedInstId}/lists`, Object.assign(Object.assign({ method: "POST" }, apiOpts()), { body: JSON.stringify({ name: listName, color: passing ? "#2E7D4A" : "#C41E3A" }) }));
                            if (!listRes.ok)
                                throw new Error(`List creation failed (${listRes.status})`);
                            const listData = yield listRes.json();
                            const listId = (_a = listData.id) !== null && _a !== void 0 ? _a : (_b = listData.data) === null || _b === void 0 ? void 0 : _b.id;
                            if (!listId)
                                throw new Error("No list ID in response");
                            done++;
                            logLine(`Created list: ${listName}`, "ok");
                            const catBreakdown = {};
                            for (const cat of categories) {
                                const qs = questions.filter(q => q.cat === cat);
                                const earned = qs.reduce((a, q) => a + (isPass(q, responses[q.id] || "") ? q.pts : 0), 0);
                                const tot = qs.reduce((a, q) => a + q.pts, 0);
                                catBreakdown[cat] = { earned, total: tot, pct: tot > 0 ? Math.round((earned / tot) * 100) : 0 };
                            }
                            const blob = JSON.stringify({
                                score: pct, passing, auditor: auditorName, date: auditDate,
                                notes: auditNotes || undefined,
                                store: (inst === null || inst === void 0 ? void 0 : inst.title) || selectedInstId, storeId: selectedInstId,
                                taskCount: ft.length, categories: catBreakdown,
                            });
                            setProgress(done, "Creating audit summary task…");
                            const sysRes = yield fetch(`${baseUrl}/tasks/${selectedInstId}/task`, Object.assign(Object.assign({ method: "POST" }, apiOpts()), { body: JSON.stringify({
                                    title: `Audit — ${(inst === null || inst === void 0 ? void 0 : inst.title) || selectedInstId} — ${pct}% — ${passing ? "Passing" : "Failing"}`,
                                    description: `[type: audit-result]\n${blob}`,
                                    status: "OPEN", priority: "Priority_3", taskListId: listId,
                                }) }));
                            done++;
                            if (sysRes.ok) {
                                logLine("Created audit summary task", "ok");
                                // Attach auditor note files to the summary task.
                                if (auditNoteFiles.length) {
                                    try {
                                        const created = yield sysRes.json();
                                        const sysId = created === null || created === void 0 ? void 0 : created.id;
                                        if (sysId) {
                                            const ids = [];
                                            for (const f of auditNoteFiles) {
                                                try {
                                                    ids.push(yield uploadMedia(f));
                                                }
                                                catch (_) { }
                                            }
                                            if (ids.length) {
                                                yield fetch(`${baseUrl}/tasks/${selectedInstId}/task/${sysId}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ attachmentIds: ids }) }));
                                                logLine(`  ↳ attached ${ids.length} note file${ids.length > 1 ? "s" : ""}`, "ok");
                                            }
                                        }
                                    }
                                    catch (_) {
                                        logLine("  ↳ note attach failed", "err");
                                    }
                                }
                            }
                            else
                                logLine(`Warning: summary task failed (${sysRes.status})`, "err");
                            for (let i = 0; i < ft.length; i++) {
                                const q = ft[i];
                                setProgress(done, `Task ${i + 1}/${ft.length}…`);
                                const due = q.taskDue === 0
                                    ? new Date().toISOString()
                                    : new Date(Date.now() + q.taskDue * 86400000).toISOString().split("T")[0] + "T00:00:00.000Z";
                                const prio = q.taskPriority === "Critical" || q.taskPriority === "High" ? "Priority_1" : q.taskPriority === "Medium" ? "Priority_2" : "Priority_3";
                                try {
                                    const body = {
                                        title: q.taskTitle || q.text,
                                        description: `Audit finding: ${q.id} — FAIL: ${q.text}\nAudit: ${listName}\nAuditor: ${auditorName}\nSeverity: ${q.taskPriority}`,
                                        status: "OPEN", priority: prio, taskListId: listId, dueDate: due,
                                    };
                                    const atype = taskAssignType[q.id] || "group";
                                    const gid2 = taskGroupOverrides[q.id] || "";
                                    const uid2 = taskUserOverrides[q.id] || "";
                                    if (atype === "user" && uid2)
                                        body.assigneeIds = [uid2];
                                    else if (gid2)
                                        body.groupIds = [gid2];
                                    const r = yield fetch(`${baseUrl}/tasks/${selectedInstId}/task`, Object.assign(Object.assign({ method: "POST" }, apiOpts()), { body: JSON.stringify(body) }));
                                    if (r.ok) {
                                        logLine(`✓ ${q.taskTitle || q.text}`, "ok");
                                        const files = taskFiles[q.id] || [];
                                        if (files.length) {
                                            try {
                                                const created = yield r.json();
                                                const newId = (created === null || created === void 0 ? void 0 : created.id) || (created === null || created === void 0 ? void 0 : created.taskId);
                                                if (newId) {
                                                    const ids = [];
                                                    for (const f of files) {
                                                        try {
                                                            ids.push(yield uploadMedia(f));
                                                        }
                                                        catch (_) { }
                                                    }
                                                    if (ids.length) {
                                                        yield fetch(`${baseUrl}/tasks/${selectedInstId}/task/${newId}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ attachmentIds: ids }) }));
                                                        logLine(`  ↳ attached ${ids.length} photo${ids.length > 1 ? "s" : ""}`, "ok");
                                                    }
                                                }
                                            }
                                            catch (_) {
                                                logLine(`  ↳ photo attach failed`, "err");
                                            }
                                        }
                                    }
                                    else
                                        logLine(`✗ ${q.taskTitle || q.text} (${r.status})`, "err");
                                }
                                catch (_) {
                                    logLine(`✗ ${q.taskTitle || q.text} (network error)`, "err");
                                }
                                done++;
                                yield new Promise(res => setTimeout(res, 50));
                            }
                            setProgress(totalOps, "Done!");
                            showBanner("success", tr("auditSubmittedMsg").replace("{name}", listName).replace("{n}", String(ft.length + 1)));
                        }
                        catch (e) {
                            showBanner("error", `Submission failed: ${e.message}`);
                            logLine(`Error: ${e.message}`, "err");
                        }
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = `${iSend} Submit &amp; Create Tasks`;
                    });
                }
                // ── Init ──────────────────────────────────────────────────────────
                renderSetup();
                fetchAll();
            });
        }
        static get observedAttributes() {
            return ["appsscripturl", "apitoken", "baseurl", "primarycolor", "accentcolor", "backgroundcolor", "storelabelsingular", "storelabelplural", "passthreshold"];
        }
    };
};
// ── Block registration ────────────────────────────────────────────────────────
const blockDefinition = {
    name: "audit-widget", label: "Audit Widget",
    attributes: ["appsscripturl", "apitoken", "baseurl", "primarycolor", "accentcolor", "backgroundcolor", "storelabelsingular", "storelabelplural", "passthreshold"],
    factory, configurationSchema, uiSchema, blockLevel: "block", iconUrl: "",
};
window.defineBlock({ blockDefinition, author: "Staffbase", version: "1.0.0" });

/******/ })()
;