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

;// ../shared/theming.ts
// Shared theming helper — pulls brand colors from the Staffbase theming API.
//
// Used by the "Use Theme Colors" config option across the task widgets. We fetch
// with the same Basic-auth API token the widgets already use (the session cookie
// is unreliable inside the native mobile apps, so token auth is preferred here).
//
// GET {baseUrl}/theming/themes/{themeId}  ->
//   { globalTheme: { customColors: [ {id, color}, ... ], interfaceColor },
//     desktopTheme: { components: { navigation: { accentColor }, ... } } }
//
// Note: a color field (e.g. navigation.accentColor) may hold either a literal
// hex ("#FF6720") OR an *id* that references one of globalTheme.customColors
// ("legacy-text-color"), so we resolve references against the customColors map.
var theming_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const isHex = (s) => /^#[0-9a-fA-F]{3,8}$/.test(s);
// Pure white/black are useless as an accent (invisible on light UIs / harsh),
// so we treat them as "no usable accent" and fall through to the next candidate.
const isNeutralExtreme = (s) => {
    const x = s.replace("#", "").toLowerCase();
    return x === "ffffff" || x === "fff" || x === "000000" || x === "000";
};
function fetchThemeColors(baseUrl_1, apiToken_1) {
    return theming_awaiter(this, arguments, void 0, function* (baseUrl, apiToken, themeId = "primary") {
        var _a, _b, _c, _d, _e;
        try {
            const res = yield fetch(`${baseUrl}/theming/themes/${themeId}`, {
                headers: { Authorization: `Basic ${apiToken}`, Accept: "application/json" },
            });
            if (!res.ok)
                return {};
            const data = yield res.json();
            // Build id -> hex map from customColors.
            const customs = {};
            for (const c of ((_a = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _a === void 0 ? void 0 : _a.customColors) || []) {
                if (c && c.id && c.color)
                    customs[c.id] = c.color;
            }
            // Resolve a value that's either a hex or a customColors id reference.
            const resolve = (v) => {
                if (!v)
                    return "";
                if (v[0] === "#")
                    return v;
                return customs[v] || "";
            };
            // Primary: the brand color, falling back to legacy bg / interface color.
            let primary = resolve("primary-brand-color") ||
                customs["legacy-background-color"] ||
                (typeof ((_b = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _b === void 0 ? void 0 : _b.interfaceColor) === "string" ? data.globalTheme.interfaceColor : "");
            // Accent: nav accent, then secondary brand, then primary — skipping any
            // unresolved / pure-white-or-black value (which wouldn't read as an accent).
            let accent = resolve((_e = (_d = (_c = data === null || data === void 0 ? void 0 : data.desktopTheme) === null || _c === void 0 ? void 0 : _c.components) === null || _d === void 0 ? void 0 : _d.navigation) === null || _e === void 0 ? void 0 : _e.accentColor);
            if (!isHex(accent) || isNeutralExtreme(accent) || accent.toLowerCase() === String(primary).toLowerCase()) {
                accent = resolve("secondary-brand-color");
            }
            if (!isHex(accent) || isNeutralExtreme(accent))
                accent = String(primary);
            return {
                primary: isHex(String(primary)) ? String(primary) : undefined,
                accent: isHex(String(accent)) ? String(accent) : undefined,
            };
        }
        catch (_f) {
            return {};
        }
    });
}

;// ./strings.ts
const STRINGS = {
    en_US: {
        myTasks: "My Tasks",
        auditResults: "Audit Results",
        newTask: "New task",
        refresh: "Refresh",
        translateBtn: "Translate",
        showOriginal: "Show original",
        translating: "Translating…",
        auditHistory: "Audit History",
        scrollLeft: "Scroll left",
        scrollRight: "Scroll right",
        allTypes: "All Types",
        nTypes: "{n} types",
        noTypeLabel: "No Type",
        open: "Open",
        done: "Done",
        both: "Both",
        close: "Close",
        noPreview: "No preview available — use Download",
        groups: "Groups",
        people: "People",
        loading: "Loading…",
        unassign: "Unassign",
        reassign: "Reassign",
        assign: "Assign",
        save: "Save",
        clearAll: "Clear",
        nSelected: "{n} selected",
        noneSelected: "None selected",
        notifyAssignedText: "You were assigned a new task: {title}",
        notifyGroupAssignedText: "Your group {group} was assigned a task: {title}",
        add: "Add",
        send: "Send",
        noCommentsYet: "No comments yet. Be the first to comment.",
        noAttachments: "No attachments",
        remove: "Remove",
        noAuditsFound: "No audits found",
        selectAudit: "Select an audit above.",
        noFailureTasks: "No failure tasks in this audit.",
        noTasksAssigned: "No tasks assigned to you in this audit.",
        allTasksComplete: "All tasks completed for this audit!",
        nTasksMarkedDone: "{n} tasks marked done",
        nTasksFlagged: "{n} tasks flagged",
        showOtherTasks: "Show {n} other tasks in this audit",
        hideOtherTasks: "Hide {n} other tasks in this audit",
        myTasksN: "My tasks ({n})",
        allCaughtUp: "No open tasks — all caught up!",
        notes: "Notes",
        attachments: "Attachments",
        categoryBreakdown: "Category breakdown",
        noGroupAssigned: "No group assigned",
        noIndividualAssignee: "No individual assignee",
        group: "Group",
        person: "Person",
        searchPeopleGroups: "Search people or groups…",
        auditFinding: "Audit Finding",
        description: "Description",
        noDescription: "No description",
        comments: "Comments",
        addComment: "Add a comment…",
        attachFile: "Attach file",
        noTaskSpaces: "No task spaces found",
        noTaskSpacesHint: "Make sure at least one Tasks installation exists.",
        failedToLoad: "Failed to load tasks",
        noTasksFound: "No tasks found",
        allCaughtUpPersonal: "No open tasks — you're all caught up!",
        noCompletedTasks: "No completed tasks yet",
        auditEmptyHint: "Submit an audit using the Audit Widget to see results here.",
        noMatches: "No matches",
        createFailedPrefix: "Couldn't create task:",
        newTaskHeading: "New Task",
        title: "Title",
        titlePlaceholder: "What needs to be done?",
        descriptionPlaceholder: "Add details (optional)",
        list: "List",
        type: "Type",
        newTypePlaceholder: "New type name",
        noType: "— No type —",
        createNewType: "+ Create new type…",
        dueDate: "Due date",
        dueLabel: "Due",
        overdueLabel: "Overdue",
        priority: "Priority",
        normal: "Normal",
        medium: "Medium",
        high: "High",
        critical: "Critical",
        recurring: "Recurring",
        cancel: "Cancel",
        createTask: "Create Task",
        creating: "Creating…",
        debug: "Debug",
        copy: "Copy",
        clear: "Clear",
        hide: "Hide",
        copied: "Copied!",
        copyFailed: "Copy failed",
        hideCompleted: "Hide completed",
        showCompletedN: "Show completed ({n})",
        markAsOpen: "Mark as open",
        markAsDone: "Mark as done",
        passing: "Passing",
        failing: "Failing",
        notScored: "Not scored",
    },
    de_DE: {
        myTasks: "Meine Aufgaben",
        auditResults: "Audit-Ergebnisse",
        newTask: "Neue Aufgabe",
        refresh: "Aktualisieren",
        translateBtn: "Übersetzen",
        showOriginal: "Original anzeigen",
        translating: "Wird übersetzt…",
        auditHistory: "Audit-Verlauf",
        scrollLeft: "Nach links scrollen",
        scrollRight: "Nach rechts scrollen",
        allTypes: "Alle Typen",
        nTypes: "{n} Typen",
        noTypeLabel: "Kein Typ",
        open: "Offen",
        done: "Erledigt",
        both: "Beide",
        close: "Schließen",
        noPreview: "Keine Vorschau verfügbar – Download verwenden",
        groups: "Gruppen",
        people: "Personen",
        loading: "Wird geladen…",
        unassign: "Zuweisung aufheben",
        reassign: "Neu zuweisen",
        assign: "Zuweisen",
        add: "Hinzufügen",
        send: "Senden",
        noCommentsYet: "Noch keine Kommentare. Schreiben Sie den ersten Kommentar.",
        noAttachments: "Keine Anhänge",
        remove: "Entfernen",
        noAuditsFound: "Keine Audits gefunden",
        selectAudit: "Wählen Sie oben ein Audit aus.",
        noFailureTasks: "Keine Fehleraufgaben in diesem Audit.",
        noTasksAssigned: "Ihnen sind in diesem Audit keine Aufgaben zugewiesen.",
        allTasksComplete: "Alle Aufgaben für dieses Audit abgeschlossen!",
        nTasksMarkedDone: "{n} Aufgaben als erledigt markiert",
        nTasksFlagged: "{n} Aufgaben markiert",
        showOtherTasks: "{n} weitere Aufgaben in diesem Audit anzeigen",
        hideOtherTasks: "{n} weitere Aufgaben in diesem Audit ausblenden",
        myTasksN: "Meine Aufgaben ({n})",
        allCaughtUp: "Keine offenen Aufgaben – alles erledigt!",
        notes: "Notizen",
        attachments: "Anhänge",
        categoryBreakdown: "Kategorienaufschlüsselung",
        noGroupAssigned: "Keine Gruppe zugewiesen",
        noIndividualAssignee: "Keine Einzelperson zugewiesen",
        group: "Gruppe",
        person: "Person",
        searchPeopleGroups: "Personen oder Gruppen suchen…",
        auditFinding: "Audit-Feststellung",
        description: "Beschreibung",
        noDescription: "Keine Beschreibung",
        comments: "Kommentare",
        addComment: "Kommentar hinzufügen…",
        attachFile: "Datei anhängen",
        noTaskSpaces: "Keine Aufgabenbereiche gefunden",
        noTaskSpacesHint: "Stellen Sie sicher, dass mindestens eine Aufgaben-Installation vorhanden ist.",
        failedToLoad: "Aufgaben konnten nicht geladen werden",
        noTasksFound: "Keine Aufgaben gefunden",
        allCaughtUpPersonal: "Keine offenen Aufgaben – alles erledigt!",
        noCompletedTasks: "Noch keine erledigten Aufgaben",
        auditEmptyHint: "Reichen Sie ein Audit über das Audit-Widget ein, um hier Ergebnisse zu sehen.",
        noMatches: "Keine Treffer",
        createFailedPrefix: "Aufgabe konnte nicht erstellt werden:",
        newTaskHeading: "Neue Aufgabe",
        title: "Titel",
        titlePlaceholder: "Was ist zu tun?",
        descriptionPlaceholder: "Details hinzufügen (optional)",
        list: "Liste",
        type: "Typ",
        newTypePlaceholder: "Name des neuen Typs",
        noType: "— Kein Typ —",
        createNewType: "+ Neuen Typ erstellen…",
        dueDate: "Fälligkeitsdatum",
        dueLabel: "Fällig",
        overdueLabel: "Überfällig",
        priority: "Priorität",
        normal: "Normal",
        medium: "Mittel",
        high: "Hoch",
        critical: "Kritisch",
        recurring: "Wiederkehrend",
        cancel: "Abbrechen",
        createTask: "Aufgabe erstellen",
        creating: "Wird erstellt…",
        debug: "Debug",
        copy: "Kopieren",
        clear: "Leeren",
        hide: "Ausblenden",
        copied: "Kopiert!",
        copyFailed: "Kopieren fehlgeschlagen",
        hideCompleted: "Erledigte ausblenden",
        showCompletedN: "Erledigte anzeigen ({n})",
        markAsOpen: "Als offen markieren",
        markAsDone: "Als erledigt markieren",
        passing: "Bestanden",
        failing: "Nicht bestanden",
        notScored: "Nicht bewertet",
    },
    ar_SA: {
        myTasks: "مهامي",
        auditResults: "نتائج التدقيق",
        newTask: "مهمة جديدة",
        refresh: "تحديث",
        translateBtn: "ترجمة",
        showOriginal: "إظهار الأصل",
        translating: "جارٍ الترجمة…",
        auditHistory: "سجل التدقيق",
        scrollLeft: "التمرير لليسار",
        scrollRight: "التمرير لليمين",
        allTypes: "جميع الأنواع",
        nTypes: "{n} أنواع",
        noTypeLabel: "بلا نوع",
        open: "مفتوحة",
        done: "مكتملة",
        both: "كلاهما",
        close: "إغلاق",
        noPreview: "لا تتوفر معاينة — استخدم التنزيل",
        groups: "المجموعات",
        people: "الأشخاص",
        loading: "جارٍ التحميل…",
        unassign: "إلغاء التعيين",
        reassign: "إعادة التعيين",
        assign: "تعيين",
        add: "إضافة",
        send: "إرسال",
        noCommentsYet: "لا توجد تعليقات بعد. كن أول من يعلّق.",
        noAttachments: "لا توجد مرفقات",
        remove: "إزالة",
        noAuditsFound: "لم يتم العثور على عمليات تدقيق",
        selectAudit: "اختر عملية تدقيق من الأعلى.",
        noFailureTasks: "لا توجد مهام إخفاق في هذا التدقيق.",
        noTasksAssigned: "لم تُسنَد إليك أي مهام في هذا التدقيق.",
        allTasksComplete: "تم إكمال جميع المهام لهذا التدقيق!",
        nTasksMarkedDone: "{n} مهام تم وضع علامة الإنجاز عليها",
        nTasksFlagged: "{n} مهام تم تحديدها",
        showOtherTasks: "إظهار {n} مهام أخرى في هذا التدقيق",
        hideOtherTasks: "إخفاء {n} مهام أخرى في هذا التدقيق",
        myTasksN: "مهامي ({n})",
        allCaughtUp: "لا توجد مهام مفتوحة — كل شيء منجز!",
        notes: "ملاحظات",
        attachments: "المرفقات",
        categoryBreakdown: "تفصيل حسب الفئة",
        noGroupAssigned: "لم يتم تعيين مجموعة",
        noIndividualAssignee: "لم يتم تعيين شخص",
        group: "مجموعة",
        person: "شخص",
        searchPeopleGroups: "ابحث عن أشخاص أو مجموعات…",
        auditFinding: "ملاحظة التدقيق",
        description: "الوصف",
        noDescription: "لا يوجد وصف",
        comments: "التعليقات",
        addComment: "أضف تعليقًا…",
        attachFile: "إرفاق ملف",
        noTaskSpaces: "لم يتم العثور على مساحات مهام",
        noTaskSpacesHint: "تأكد من وجود تثبيت واحد للمهام على الأقل.",
        failedToLoad: "فشل تحميل المهام",
        noTasksFound: "لم يتم العثور على مهام",
        allCaughtUpPersonal: "لا توجد مهام مفتوحة — أنجزت كل شيء!",
        noCompletedTasks: "لا توجد مهام مكتملة بعد",
        auditEmptyHint: "أرسل عملية تدقيق باستخدام أداة التدقيق لرؤية النتائج هنا.",
        noMatches: "لا توجد نتائج",
        createFailedPrefix: "تعذّر إنشاء المهمة:",
        newTaskHeading: "مهمة جديدة",
        title: "العنوان",
        titlePlaceholder: "ما الذي يجب إنجازه؟",
        descriptionPlaceholder: "أضف تفاصيل (اختياري)",
        list: "القائمة",
        type: "النوع",
        newTypePlaceholder: "اسم النوع الجديد",
        noType: "— بلا نوع —",
        createNewType: "+ إنشاء نوع جديد…",
        dueDate: "تاريخ الاستحقاق",
        dueLabel: "الاستحقاق",
        overdueLabel: "متأخرة",
        priority: "الأولوية",
        normal: "عادية",
        medium: "متوسطة",
        high: "عالية",
        critical: "حرجة",
        recurring: "متكررة",
        cancel: "إلغاء",
        createTask: "إنشاء مهمة",
        creating: "جارٍ الإنشاء…",
        debug: "تصحيح الأخطاء",
        copy: "نسخ",
        clear: "مسح",
        hide: "إخفاء",
        copied: "تم النسخ!",
        copyFailed: "فشل النسخ",
        hideCompleted: "إخفاء المكتملة",
        showCompletedN: "إظهار المكتملة ({n})",
        markAsOpen: "وضع علامة مفتوحة",
        markAsDone: "وضع علامة منجزة",
        passing: "ناجح",
        failing: "غير ناجح",
        notScored: "غير مُقيَّم",
    },
    es_ES: {
        myTasks: "Mis tareas",
        auditResults: "Resultados de la auditoría",
        newTask: "Nueva tarea",
        refresh: "Actualizar",
        translateBtn: "Traducir",
        showOriginal: "Original del programa",
        translating: "Traduciendo...",
        auditHistory: "Historial de auditorías",
        scrollLeft: "Desplego a la izquierda",
        scrollRight: "Desplázate a la derecha",
        allTypes: "Todo Tipo",
        nTypes: "{n} tipos",
        noTypeLabel: "Sin tipo",
        open: "Abierto",
        done: "Hecho",
        both: "Ambos",
        close: "Cierre",
        noPreview: "No hay vista previa disponible — usar Descargar",
        groups: "Grupos",
        people: "Personas",
        loading: "Cargando...",
        unassign: "Desasignación",
        reassign: "Reasignación",
        assign: "Asignar",
        add: "Añadir",
        send: "Envía",
        noCommentsYet: "Aún no hay comentarios. Sé el primero en comentar.",
        noAttachments: "Sin accesorios",
        remove: "Eliminar",
        noAuditsFound: "No se han encontrado auditorías",
        selectAudit: "Selecciona una auditoría arriba.",
        noFailureTasks: "No hay tareas fallidas en esta auditoría.",
        noTasksAssigned: "No se te asignan tareas en esta auditoría.",
        allTasksComplete: "¡Todas las tareas completadas para esta auditoría!",
        nTasksMarkedDone: "{n} tareas marcadas como realizadas",
        nTasksFlagged: "{n} tareas marcadas",
        showOtherTasks: "Mostrar {n} otras tareas en esta auditoría",
        hideOtherTasks: "Ocultar {n} otras tareas en esta auditoría",
        myTasksN: "Mis tareas ({n})",
        allCaughtUp: "¡No hay tareas pendientes — todo puesto al día!",
        notes: "Notas",
        attachments: "Accesorios",
        categoryBreakdown: "Desglose por categorías",
        noGroupAssigned: "No hay grupo asignado",
        noIndividualAssignee: "No hay asignado individual",
        group: "Grupo",
        person: "Persona",
        searchPeopleGroups: "Busca personas o grupos...",
        auditFinding: "Hallazgo de auditoría",
        description: "Descripción",
        noDescription: "Sin descripción",
        comments: "Comentarios",
        addComment: "Añadir un comentario...",
        attachFile: "Adjuntar archivo",
        noTaskSpaces: "No se han encontrado espacios de tareas",
        noTaskSpacesHint: "Asegúrate de que exista al menos una instalación de Tasks.",
        failedToLoad: "No se han cargado tareas",
        noTasksFound: "No se han encontrado tareas",
        allCaughtUpPersonal: "¡No hay tareas pendientes — ya estáis al día!",
        noCompletedTasks: "Aún no he completado ninguna tarea",
        auditEmptyHint: "Envía una auditoría usando el Widget de Auditoría para ver los resultados aquí.",
        noMatches: "Sin partidos",
        createFailedPrefix: "No se pudo crear la tarea:",
        newTaskHeading: "Nueva tarea",
        title: "Título",
        titlePlaceholder: "¿Qué hay que hacer?",
        descriptionPlaceholder: "Añadir detalles (opcional)",
        list: "Lista",
        type: "Tipo",
        newTypePlaceholder: "Nuevo nombre tipo",
        noType: "— No hay tipo —",
        createNewType: "+ Crear un nuevo tipo...",
        dueDate: "Fecha prevista de parto",
        dueLabel: "Debido",
        overdueLabel: "Tarde",
        priority: "Prioridad",
        normal: "Normal",
        medium: "Medio",
        high: "Alto",
        critical: "Crítica",
        recurring: "Recurrentes",
        cancel: "Cancelar",
        createTask: "Crear tarea",
        creating: "Crear...",
        debug: "Depuración",
        copy: "Copiado",
        clear: "¡Libre",
        hide: "Escóndete",
        copied: "¡Copiado!",
        copyFailed: "Copia fallida",
        hideCompleted: "Escondite completado",
        showCompletedN: "Espectáculo finalizado ({n})",
        markAsOpen: "Marca como abierto",
        markAsDone: "Marca como hecho",
        passing: "Fallecimiento",
        failing: "Fracaso",
        notScored: "No puntuado",
    },
    fr_FR: {
        myTasks: "Mes tâches",
        auditResults: "Résultats de l’audit",
        newTask: "Nouvelle tâche",
        refresh: "Rafraîchissement",
        translateBtn: "Traduire",
        showOriginal: "Série originale",
        translating: "Traduction...",
        auditHistory: "Historique de l’audit",
        scrollLeft: "Scroller à gauche",
        scrollRight: "Faites défiler à droite",
        allTypes: "Tous types",
        nTypes: "{n} types",
        noTypeLabel: "Pas de type",
        open: "Ouvre",
        done: "Marché conclu",
        both: "Les deux",
        close: "Fermer",
        noPreview: "Aucun aperçu disponible — utiliser Télécharger",
        groups: "Groupes",
        people: "Personnalités",
        loading: "Chargement...",
        unassign: "Désaffectation",
        reassign: "Réaffectation",
        assign: "Assigner",
        add: "Ajouter",
        send: "Envoyer",
        noCommentsYet: "Pas encore de commentaires. Soyez le premier à commenter.",
        noAttachments: "Pas d’attaches",
        remove: "Retirer",
        noAuditsFound: "Aucun audit n’a été trouvé",
        selectAudit: "Sélectionnez un audit ci-dessus.",
        noFailureTasks: "Aucune défaillance dans cet audit.",
        noTasksAssigned: "Aucune tâche qui vous est assignée dans cet audit.",
        allTasksComplete: "Toutes les tâches accomplies pour cet audit !",
        nTasksMarkedDone: "{n} tâches marquées comme accomplies",
        nTasksFlagged: "{n} tâches signalées",
        showOtherTasks: "Montrez {n} autres tâches dans cet audit",
        hideOtherTasks: "Cacher {n} autres tâches dans cet audit",
        myTasksN: "Mes tâches ({n})",
        allCaughtUp: "Aucune tâche en cours — tout est à jour !",
        notes: "Notes",
        attachments: "Accessoires",
        categoryBreakdown: "Répartition par catégorie",
        noGroupAssigned: "Aucun groupe assigné",
        noIndividualAssignee: "Aucun assigné individuel",
        group: "Groupe",
        person: "Personne",
        searchPeopleGroups: "Fouillez des personnes ou des groupes...",
        auditFinding: "Constatation de l’audit",
        description: "Description",
        noDescription: "Aucune description",
        comments: "Commentaires",
        addComment: "Ajouter un commentaire...",
        attachFile: "Joindre fichier",
        noTaskSpaces: "Aucun espace de tâche trouvé",
        noTaskSpacesHint: "Assurez-vous qu’il existe au moins une installation de Tasks.",
        failedToLoad: "Échec du chargement des tâches",
        noTasksFound: "Aucune tâche trouvée",
        allCaughtUpPersonal: "Pas de tâches en cours — vous êtes à jour !",
        noCompletedTasks: "Aucune tâche terminée pour l’instant",
        auditEmptyHint: "Soumettez un audit en utilisant le widget d’audit pour voir les résultats ici.",
        noMatches: "Pas de matchs",
        createFailedPrefix: "Impossible de créer une tâche :",
        newTaskHeading: "Nouvelle tâche",
        title: "Titre",
        titlePlaceholder: "Que faut-il faire ?",
        descriptionPlaceholder: "Ajouter les détails (optionnel)",
        list: "Liste",
        type: "Type",
        newTypePlaceholder: "Nouveau nom de type",
        noType: "— Pas de type —",
        createNewType: "+ Créer un nouveau type...",
        dueDate: "Date d’accouchement",
        dueLabel: "Due",
        overdueLabel: "En retard",
        priority: "Priorité",
        normal: "Normal",
        medium: "Moyen",
        high: "Haut",
        critical: "Critique",
        recurring: "Récurrents",
        cancel: "Annuler",
        createTask: "Créer une tâche",
        creating: "Créer...",
        debug: "Débogage",
        copy: "Bien reçu",
        clear: "Clair",
        hide: "Cache-toi",
        copied: "Copié !",
        copyFailed: "Copie échouée",
        hideCompleted: "Cachette terminée",
        showCompletedN: "Émission terminée ({n})",
        markAsOpen: "Marquez comme ouvert",
        markAsDone: "Marque comme fait",
        passing: "Passage",
        failing: "Échec",
        notScored: "Non marqué",
    },
    nl_NL: {
        myTasks: "Mijn taken",
        auditResults: "Auditresultaten",
        newTask: "Nieuwe taak",
        refresh: "Verversen",
        translateBtn: "Vertalen",
        showOriginal: "Originele show",
        translating: "Vertalen...",
        auditHistory: "Auditgeschiedenis",
        scrollLeft: "Scroll naar links",
        scrollRight: "Scroll naar rechts",
        allTypes: "Alle typen",
        nTypes: "{n} types",
        noTypeLabel: "Geen Type",
        open: "Open",
        done: "Klaar",
        both: "Beide",
        close: "Sluit",
        noPreview: "Geen preview beschikbaar — gebruik Download",
        groups: "Groepen",
        people: "Mensen",
        loading: "Laden...",
        unassign: "Niet toewijzen",
        reassign: "Herplaatsen",
        assign: "Toewijzen",
        add: "Voeg toe",
        send: "Verzenden",
        noCommentsYet: "Nog geen opmerkingen. Wees de eerste die reageert.",
        noAttachments: "Geen gehechtheden",
        remove: "Verwijder",
        noAuditsFound: "Geen audits gevonden",
        selectAudit: "Selecteer hierboven een audit.",
        noFailureTasks: "Geen fouttaken in deze audit.",
        noTasksAssigned: "Geen taken toegewezen aan u in deze audit.",
        allTasksComplete: "Alle taken voltooid voor deze audit!",
        nTasksMarkedDone: "{n} taken als voltooid gemarkeerd",
        nTasksFlagged: "{n} taken gemarkeerd",
        showOtherTasks: "Toon {n} andere taken in deze audit",
        hideOtherTasks: "Verberg {n} andere taken in deze audit",
        myTasksN: "Mijn taken ({n})",
        allCaughtUp: "Geen open taken — alles is ingehaald!",
        notes: "Noten",
        attachments: "Bijlagen",
        categoryBreakdown: "Categorie-indeling",
        noGroupAssigned: "Geen groep toegewezen",
        noIndividualAssignee: "Geen individuele toegewezen",
        group: "Groep",
        person: "Persoon",
        searchPeopleGroups: "Zoek mensen of groepen...",
        auditFinding: "Auditbevinding",
        description: "Beschrijving",
        noDescription: "Geen beschrijving",
        comments: "Reacties",
        addComment: "Voeg een opmerking toe...",
        attachFile: "Bestand bijvoegen",
        noTaskSpaces: "Geen taakruimtes gevonden",
        noTaskSpacesHint: "Zorg dat er ten minste één Taken-installatie bestaat.",
        failedToLoad: "Taken zijn niet kunnen laden",
        noTasksFound: "Geen taken gevonden",
        allCaughtUpPersonal: "Geen open taken — je bent helemaal bij!",
        noCompletedTasks: "Nog geen voltooide taken",
        auditEmptyHint: "Dien een audit in via de Audit-widget om hier de resultaten te zien.",
        noMatches: "Geen wedstrijden",
        createFailedPrefix: "Taak niet aanmaken:",
        newTaskHeading: "Nieuwe taak",
        title: "Titel",
        titlePlaceholder: "Wat moet er gedaan worden?",
        descriptionPlaceholder: "Details toevoegen (optioneel)",
        list: "Lijst",
        type: "Type",
        newTypePlaceholder: "Nieuwe typenaam",
        noType: "— Geen type —",
        createNewType: "+ Maak een nieuw type...",
        dueDate: "Uitgerekende datum",
        dueLabel: "Te betalen",
        overdueLabel: "Achterstallig",
        priority: "Prioriteit",
        normal: "Normaal",
        medium: "Medium",
        high: "Hoog",
        critical: "Kritisch",
        recurring: "Terugkerend",
        cancel: "Annuleren",
        createTask: "Maak taak aan",
        creating: "Creëren...",
        debug: "Debug",
        copy: "Begrepen",
        clear: "Vrij",
        hide: "Verstop",
        copied: "Gekopieerd!",
        copyFailed: "Kopie mislukt",
        hideCompleted: "Verbergen voltooid",
        showCompletedN: "Show voltooid ({n})",
        markAsOpen: "Markeer als open",
        markAsDone: "Markeer als gedaan",
        passing: "Overlijden",
        failing: "Falen",
        notScored: "Niet gescoord",
    },
    zh_CN: {
        myTasks: "我的任务",
        auditResults: "审计结果",
        newTask: "新任务",
        refresh: "刷新",
        translateBtn: "翻译",
        showOriginal: "节目原版",
        translating: "翻译......",
        auditHistory: "审计历史",
        scrollLeft: "向左滚动",
        scrollRight: "向右滚动",
        allTypes: "所有类型",
        nTypes: "{n}类型",
        noTypeLabel: "无类型",
        open: "开门",
        done: "完成",
        both: "两者兼具",
        close: "结束",
        noPreview: "没有预览——请下载",
        groups: "团体",
        people: "人物",
        loading: "加载中......",
        unassign: "未分配",
        reassign: "重新分配",
        assign: "分配",
        add: "添加",
        send: "发送",
        noCommentsYet: "还没有评论。成为第一个评论的人。",
        noAttachments: "无附件",
        remove: "删除",
        noAuditsFound: "未发现审计",
        selectAudit: "请选择上方的审计。",
        noFailureTasks: "本次审计没有失败任务。",
        noTasksAssigned: "本次审计未分配任何任务。",
        allTasksComplete: "本次审计的所有任务都已完成！",
        nTasksMarkedDone: "{n}任务标记为完成",
        nTasksFlagged: "{n}任务标记",
        showOtherTasks: "本次审计中展示{n}其他任务",
        hideOtherTasks: "在本次审计中隐藏{n}其他任务",
        myTasksN: "我的任务（{n}）",
        allCaughtUp: "没有未完成任务——一切都赶上了！",
        notes: "注释",
        attachments: "附属品",
        categoryBreakdown: "类别分类",
        noGroupAssigned: "没有分配组别",
        noIndividualAssignee: "无个人受派人员",
        group: "集团",
        person: "人物",
        searchPeopleGroups: "搜索人员或群体......",
        auditFinding: "审计发现",
        description: "描述",
        noDescription: "无描述",
        comments: "评论",
        addComment: "添加一条评论......",
        attachFile: "附件文件",
        noTaskSpaces: "未找到任务空间",
        noTaskSpacesHint: "确保至少有一个任务安装。",
        failedToLoad: "任务加载失败",
        noTasksFound: "找不到任务",
        allCaughtUpPersonal: "没有未完成任务——你已经全部赶上了！",
        noCompletedTasks: "还没有完成任务",
        auditEmptyHint: "请使用审计小工具提交审计，查看结果。",
        noMatches: "没有匹配",
        createFailedPrefix: "无法创建任务：",
        newTaskHeading: "新任务",
        title: "标题",
        titlePlaceholder: "需要做什么？",
        descriptionPlaceholder: "添加细节（可选）",
        list: "列表",
        type: "类型",
        newTypePlaceholder: "新型号名称",
        noType: "—— 没有类型 ——",
        createNewType: "+ 创建新类型......",
        dueDate: "预产期",
        dueLabel: "该",
        overdueLabel: "逾期",
        priority: "优先级",
        normal: "普通",
        medium: "媒介",
        high: "高",
        critical: "批判",
        recurring: "常驻角色",
        cancel: "取消",
        createTask: "创建任务",
        creating: "创造......",
        debug: "调试",
        copy: "收到",
        clear: "清场",
        hide: "藏起来",
        copied: "复制了！",
        copyFailed: "复制失败",
        hideCompleted: "藏匿完成",
        showCompletedN: "节目已完结（{n}年）",
        markAsOpen: "标记为开",
        markAsDone: "标记为完成",
        passing: "通过",
        failing: "失败",
        notScored: "未得分",
    },
    ja_JP: {
        myTasks: "私の任務",
        auditResults: "監査結果",
        newTask: "新たな任務",
        refresh: "リフレッシュ",
        translateBtn: "翻訳",
        showOriginal: "番組オリジナル",
        translating: "翻訳中...",
        auditHistory: "監査履歴",
        scrollLeft: "左にスクロール",
        scrollRight: "右にスクロールしてください",
        allTypes: "すべてのタイプ",
        nTypes: "{n}の種類",
        noTypeLabel: "タイプなし",
        open: "開けて",
        done: "終わった",
        both: "両方とも",
        close: "閉じる",
        noPreview: "プレビューは利用できません — ダウンロードをご利用ください",
        groups: "グループ",
        people: "人々",
        loading: "読み込み中...",
        unassign: "割り当て解除",
        reassign: "再配属",
        assign: "割り当て",
        add: "追加",
        send: "送信",
        noCommentsYet: "まだコメントはありません。最初にコメントしてください。",
        noAttachments: "アタッチメントは一切ありません",
        remove: "削除",
        noAuditsFound: "監査は見つかりませんでした",
        selectAudit: "上記で監査を選択してください。",
        noFailureTasks: "この監査では失敗作業は一切ありません。",
        noTasksAssigned: "この監査で割り当てられたタスクはありません。",
        allTasksComplete: "この監査のためにすべての作業を完了させました!",
        nTasksMarkedDone: "{n}タスクは完了済みと表示されています",
        nTasksFlagged: "{n}タスクがフラグされています",
        showOtherTasks: "この監査で{n}他のタスクを表示してください",
        hideOtherTasks: "この監査で他のタスク{n}隠す",
        myTasksN: "私のタスク({n})",
        allCaughtUp: "未解決のタスクはなし — すべて追いついた!",
        notes: "注記",
        attachments: "付属施設",
        categoryBreakdown: "カテゴリー内訳",
        noGroupAssigned: "グループは割り当てられていません",
        noIndividualAssignee: "個人の譲受者はいない",
        group: "グループ",
        person: "人物",
        searchPeopleGroups: "人やグループを検索する...",
        auditFinding: "監査の判断",
        description: "概要",
        noDescription: "特徴なし",
        comments: "コメント",
        addComment: "コメントを追加してください...",
        attachFile: "ファイルを添付してください",
        noTaskSpaces: "タスクスペースは見つかりませんでした",
        noTaskSpacesHint: "少なくとも1つのタスクインストールが存在することを確認してください。",
        failedToLoad: "タスクの読み込み失敗",
        noTasksFound: "タスクは見つかりませんでした",
        allCaughtUpPersonal: "未解決のタスクはなく、すべて追いついた状態です!",
        noCompletedTasks: "まだ完成したタスクはありません",
        auditEmptyHint: "監査ウィジェットを使って監査を提出すると、こちらから結果をご覧ください。",
        noMatches: "一致なし",
        createFailedPrefix: "タスクを作成できなかった:",
        newTaskHeading: "新たな任務",
        title: "タイトル",
        titlePlaceholder: "何をすべきでしょうか?",
        descriptionPlaceholder: "詳細の追加(任意)",
        list: "一覧",
        type: "種類",
        newTypePlaceholder: "新しいタイプ名",
        noType: "— タイプなし —",
        createNewType: "+ 新しいタイプを作成...",
        dueDate: "出産予定日",
        dueLabel: "期限",
        overdueLabel: "遅れてる",
        priority: "優先順位",
        normal: "ノーマル",
        medium: "メディア",
        high: "ハイ",
        critical: "重要な点",
        recurring: "レギュラー出演者",
        cancel: "キャンセル",
        createTask: "タスク作成",
        creating: "創造...",
        debug: "デバッグ",
        copy: "了解",
        clear: "クリア",
        hide: "隠れて",
        copied: "コピーしました!",
        copyFailed: "コピー失敗",
        hideCompleted: "隠れ膑完了",
        showCompletedN: "番組完了({n}年)",
        markAsOpen: "マークを開いたと示す",
        markAsDone: "完了したとマークする",
        passing: "パス",
        failing: "失敗",
        notScored: "スコアは取れていません",
    },
    th_TH: {
        myTasks: "งานของฉัน",
        auditResults: "ผลการตรวจสอบ",
        newTask: "งานใหม่",
        refresh: "รีเฟรช",
        translateBtn: "แปล",
        showOriginal: "แสดงต้นฉบับ",
        translating: "แปล...",
        auditHistory: "ประวัติการตรวจสอบ",
        scrollLeft: "เลื่อนไปทางซ้าย",
        scrollRight: "เลื่อนไปทางขวา",
        allTypes: "ทุกประเภท",
        nTypes: "ประเภท{n}",
        noTypeLabel: "ไม่มีประเภท",
        open: "เปิด",
        done: "เสร็จสิ้น",
        both: "ทั้งสองอย่าง",
        close: "ปิด",
        noPreview: "ไม่มีการแสดงตัวอย่าง — ใช้ดาวน์โหลด",
        groups: "กลุ่ม",
        people: "บุคลากร",
        loading: "กําลังโหลด...",
        unassign: "ยกเลิกการมอบหมาย",
        reassign: "มอบหมายใหม่",
        assign: "มอบหมาย",
        add: "เพิ่ม",
        send: "ส่ง",
        noCommentsYet: "ยังไม่มีความคิดเห็น มาเป็นคนแรกที่แสดงความคิดเห็น",
        noAttachments: "ไม่มีไฟล์แนบ",
        remove: "ลบ",
        noAuditsFound: "ไม่พบการตรวจสอบ",
        selectAudit: "เลือกการตรวจสอบด้านบน",
        noFailureTasks: "ไม่มีงานที่ล้มเหลวในการตรวจสอบนี้",
        noTasksAssigned: "ไม่มีงานที่มอบหมายให้คุณในการตรวจสอบนี้",
        allTasksComplete: "งานทั้งหมดเสร็จสมบูรณ์สําหรับการตรวจสอบนี้!",
        nTasksMarkedDone: "{n}งานที่ทําเครื่องหมายว่าเสร็จสิ้น",
        nTasksFlagged: "{n}งานที่ถูกตั้งค่าสถานะ",
        showOtherTasks: "แสดง{n}งานอื่นๆ ในการตรวจสอบนี้",
        hideOtherTasks: "ซ่อนงาน{n}อื่นๆ ในการตรวจสอบนี้",
        myTasksN: "งานของฉัน ({n})",
        allCaughtUp: "ไม่มีงานที่เปิดอยู่ — ทั้งหมดตามทัน!",
        notes: "หมายเหตุ",
        attachments: "เอกสารแนบ",
        categoryBreakdown: "รายละเอียดหมวดหมู่",
        noGroupAssigned: "ไม่มีการกําหนดกลุ่ม",
        noIndividualAssignee: "ไม่มีผู้รับมอบหมายเป็นรายบุคคล",
        group: "กลุ่มเพื่อน",
        person: "คน",
        searchPeopleGroups: "ค้นหาผู้คนหรือกลุ่ม...",
        auditFinding: "ผลการตรวจสอบ",
        description: "คําอธิบาย",
        noDescription: "ไม่มีคําอธิบาย",
        comments: "ความคิดเห็น",
        addComment: "เพิ่มความคิดเห็น...",
        attachFile: "แนบไฟล์",
        noTaskSpaces: "ไม่พบพื้นที่งาน",
        noTaskSpacesHint: "ตรวจสอบให้แน่ใจว่ามีการติดตั้งงานอย่างน้อยหนึ่งรายการ",
        failedToLoad: "โหลดงานไม่สําเร็จ",
        noTasksFound: "ไม่พบงาน",
        allCaughtUpPersonal: "ไม่มีงานที่เปิดอยู่ — คุณตามทันแล้ว!",
        noCompletedTasks: "ยังไม่มีงานที่เสร็จสมบูรณ์",
        auditEmptyHint: "ส่งการตรวจสอบโดยใช้วิดเจ็ตการตรวจสอบเพื่อดูผลลัพธ์ที่นี่",
        noMatches: "ไม่มีการแข่งขัน",
        createFailedPrefix: "สร้างงานไม่ได้:",
        newTaskHeading: "ภารกิจใหม่",
        title: "ชื่อเรื่อง",
        titlePlaceholder: "ต้องทําอะไรบ้าง?",
        descriptionPlaceholder: "เพิ่มรายละเอียด (ไม่บังคับ)",
        list: "รายการ",
        type: "ชนิดภาพเขียน",
        newTypePlaceholder: "ชื่อประเภทใหม่",
        noType: "— ไม่มีประเภท —",
        createNewType: "+ สร้างประเภทใหม่...",
        dueDate: "วันครบกําหนด",
        dueLabel: "ครบกําหนด",
        overdueLabel: "ค้างชําระ",
        priority: "ลําดับความสําคัญ",
        normal: "ปกติ",
        medium: "ปานกลาง",
        high: "จุดสูง",
        critical: "วิกฤต",
        recurring: "เกิดซ้ํา",
        cancel: "ยกเลิก",
        createTask: "สร้างงาน",
        creating: "กําลังสร้าง...",
        debug: "แก้ไขข้อบกพร่อง",
        copy: "สําเนา",
        clear: "ล้างค่าการค้นหา",
        hide: "ปิด",
        copied: "คัดลอกแล้ว!",
        copyFailed: "คัดลอกล้มเหลว",
        hideCompleted: "ซ่อนเสร็จสมบูรณ์",
        showCompletedN: "แสดงเสร็จสมบูรณ์ ({n})",
        markAsOpen: "ทําเครื่องหมายว่าเปิด",
        markAsDone: "ทําเครื่องหมายว่าเสร็จสิ้น",
        passing: "ผ่าน",
        failing: "ล้มเหลว",
        notScored: "ไม่ได้คะแนน",
    },
    es_MX: {
        myTasks: "Mis tareas",
        auditResults: "Resultados de la auditoría",
        newTask: "Nueva tarea",
        refresh: "Actualizar",
        translateBtn: "Traducir",
        showOriginal: "Original del programa",
        translating: "Traduciendo...",
        auditHistory: "Historial de auditorías",
        scrollLeft: "Desplego a la izquierda",
        scrollRight: "Desplázate a la derecha",
        allTypes: "Todo Tipo",
        nTypes: "{n} tipos",
        noTypeLabel: "Sin tipo",
        open: "Abierto",
        done: "Hecho",
        both: "Ambos",
        close: "Cierre",
        noPreview: "No hay vista previa disponible — usar Descargar",
        groups: "Grupos",
        people: "Personas",
        loading: "Cargando...",
        unassign: "Desasignación",
        reassign: "Reasignación",
        assign: "Asignar",
        add: "Añadir",
        send: "Envía",
        noCommentsYet: "Aún no hay comentarios. Sé el primero en comentar.",
        noAttachments: "Sin accesorios",
        remove: "Eliminar",
        noAuditsFound: "No se han encontrado auditorías",
        selectAudit: "Selecciona una auditoría arriba.",
        noFailureTasks: "No hay tareas fallidas en esta auditoría.",
        noTasksAssigned: "No se te asignan tareas en esta auditoría.",
        allTasksComplete: "¡Todas las tareas completadas para esta auditoría!",
        nTasksMarkedDone: "{n} tareas marcadas como realizadas",
        nTasksFlagged: "{n} tareas marcadas",
        showOtherTasks: "Mostrar {n} otras tareas en esta auditoría",
        hideOtherTasks: "Ocultar {n} otras tareas en esta auditoría",
        myTasksN: "Mis tareas ({n})",
        allCaughtUp: "¡No hay tareas pendientes — todo puesto al día!",
        notes: "Notas",
        attachments: "Accesorios",
        categoryBreakdown: "Desglose por categorías",
        noGroupAssigned: "No hay grupo asignado",
        noIndividualAssignee: "No hay asignado individual",
        group: "Grupo",
        person: "Persona",
        searchPeopleGroups: "Busca personas o grupos...",
        auditFinding: "Hallazgo de auditoría",
        description: "Descripción",
        noDescription: "Sin descripción",
        comments: "Comentarios",
        addComment: "Añadir un comentario...",
        attachFile: "Adjuntar archivo",
        noTaskSpaces: "No se han encontrado espacios de tareas",
        noTaskSpacesHint: "Asegúrate de que exista al menos una instalación de Tasks.",
        failedToLoad: "No se han cargado tareas",
        noTasksFound: "No se han encontrado tareas",
        allCaughtUpPersonal: "¡No hay tareas pendientes — ya estáis al día!",
        noCompletedTasks: "Aún no he completado ninguna tarea",
        auditEmptyHint: "Envía una auditoría usando el Widget de Auditoría para ver los resultados aquí.",
        noMatches: "Sin partidos",
        createFailedPrefix: "No se pudo crear la tarea:",
        newTaskHeading: "Nueva tarea",
        title: "Título",
        titlePlaceholder: "¿Qué hay que hacer?",
        descriptionPlaceholder: "Añadir detalles (opcional)",
        list: "Lista",
        type: "Tipo",
        newTypePlaceholder: "Nuevo nombre tipo",
        noType: "— No hay tipo —",
        createNewType: "+ Crear un nuevo tipo...",
        dueDate: "Fecha prevista de parto",
        dueLabel: "Debido",
        overdueLabel: "Tarde",
        priority: "Prioridad",
        normal: "Normal",
        medium: "Medio",
        high: "Alto",
        critical: "Crítica",
        recurring: "Recurrentes",
        cancel: "Cancelar",
        createTask: "Crear tarea",
        creating: "Crear...",
        debug: "Depuración",
        copy: "Copiado",
        clear: "¡Libre",
        hide: "Escóndete",
        copied: "¡Copiado!",
        copyFailed: "Copia fallida",
        hideCompleted: "Escondite completado",
        showCompletedN: "Espectáculo finalizado ({n})",
        markAsOpen: "Marca como abierto",
        markAsDone: "Marca como hecho",
        passing: "Fallecimiento",
        failing: "Fracaso",
        notScored: "No puntuado",
    },
    vi_VN: {
        myTasks: "Nhiệm vụ của tôi",
        auditResults: "Kết quả kiểm toán",
        newTask: "Nhiệm vụ mới",
        refresh: "Làm mới",
        translateBtn: "Dịch",
        showOriginal: "Xem bản gốc",
        translating: "Đang dịch...",
        auditHistory: "Lịch sử kiểm toán",
        scrollLeft: "Cuộn sang trái",
        scrollRight: "Cuộn sang phải",
        allTypes: "Tất cả các loại",
        nTypes: "Các loại {n}",
        noTypeLabel: "Không có loại",
        open: "Mở",
        done: "Xong",
        both: "Cả hai",
        close: "Đóng",
        noPreview: "Không có bản xem trước - sử dụng Tải xuống",
        groups: "Nhóm",
        people: "Con người",
        loading: "Đang tải...",
        unassign: "Hủy chỉ định",
        reassign: "Chỉ định lại",
        assign: "Chỉ định",
        add: "Thêm",
        send: "Gửi",
        noCommentsYet: "Chưa có bình luận nào. Hãy là người đầu tiên bình luận.",
        noAttachments: "Không có tệp đính kèm",
        remove: "Loại bỏ",
        noAuditsFound: "Không tìm thấy kiểm toán",
        selectAudit: "Chọn một cuộc kiểm tra ở trên.",
        noFailureTasks: "Không có nhiệm vụ thất bại trong cuộc kiểm toán này.",
        noTasksAssigned: "Không có nhiệm vụ nào được giao cho bạn trong cuộc kiểm tra này.",
        allTasksComplete: "Tất cả các nhiệm vụ đã hoàn thành cho cuộc kiểm toán này!",
        nTasksMarkedDone: "{n} nhiệm vụ được đánh dấu là đã hoàn thành",
        nTasksFlagged: "{n} nhiệm vụ được gắn cờ",
        showOtherTasks: "Hiển thị {n} nhiệm vụ khác trong cuộc kiểm tra này",
        hideOtherTasks: "Ẩn {n} nhiệm vụ khác trong kiểm tra này",
        myTasksN: "Nhiệm vụ của tôi ({n})",
        allCaughtUp: "Không có nhiệm vụ mở - tất cả đều bắt kịp!",
        notes: "Ghi chú",
        attachments: "Tệp đính kèm",
        categoryBreakdown: "Phân tích danh mục",
        noGroupAssigned: "Không có nhóm nào được chỉ định",
        noIndividualAssignee: "Không có người được chuyển nhượng cá nhân",
        group: "Nhóm",
        person: "Người",
        searchPeopleGroups: "Tìm kiếm mọi người hoặc nhóm...",
        auditFinding: "Kết quả kiểm toán",
        description: "Sự miêu tả",
        noDescription: "Không có mô tả",
        comments: "Bình luận",
        addComment: "Thêm bình luận...",
        attachFile: "Đính kèm tệp",
        noTaskSpaces: "Không tìm thấy không gian nhiệm vụ",
        noTaskSpacesHint: "Đảm bảo có ít nhất một cài đặt Tác vụ.",
        failedToLoad: "Không tải được tác vụ",
        noTasksFound: "Không tìm thấy nhiệm vụ nào",
        allCaughtUpPersonal: "Không có nhiệm vụ mở - tất cả các bạn đều bị bắt kịp!",
        noCompletedTasks: "Chưa có nhiệm vụ nào đã hoàn thành",
        auditEmptyHint: "Gửi đánh giá bằng Tiện ích kiểm tra để xem kết quả tại đây.",
        noMatches: "Không trùng khớp",
        createFailedPrefix: "Không thể tạo tác vụ:",
        newTaskHeading: "Nhiệm vụ mới",
        title: "Tiêu đề",
        titlePlaceholder: "Cần phải làm gì?",
        descriptionPlaceholder: "Thêm chi tiết (tùy chọn)",
        list: "Danh sách",
        type: "Kiểu",
        newTypePlaceholder: "Tên kiểu mới",
        noType: "- Không có loại -",
        createNewType: "+ Tạo kiểu mới...",
        dueDate: "Ngày đến hạn",
        dueLabel: "Đến hạn",
        overdueLabel: "Quá hạn",
        priority: "Ưu tiên",
        normal: "Bình thường",
        medium: "Trung bình",
        high: "Cao",
        critical: "Quan trọng",
        recurring: "Định kỳ",
        cancel: "Hủy bỏ",
        createTask: "Tạo nhiệm vụ",
        creating: "Đang tạo...",
        debug: "Gỡ lỗi",
        copy: "Sao chép",
        clear: "Xóa",
        hide: "Ẩn giấu",
        copied: "Đã sao chép!",
        copyFailed: "Sao chép không thành công",
        hideCompleted: "Ẩn đã hoàn thành",
        showCompletedN: "Hiển thị đã hoàn thành ({n})",
        markAsOpen: "Đánh dấu là mở",
        markAsDone: "Đánh dấu là xong",
        passing: "Vượt qua",
        failing: "Không thành công",
        notScored: "Không được ghi bàn",
    },
    ko_KR: {
        myTasks: "나의 임무",
        auditResults: "감사 결과",
        newTask: "새로운 임무",
        refresh: "새로고침",
        translateBtn: "번역해",
        showOriginal: "쇼 오리지널",
        translating: "번역 중...",
        auditHistory: "감사 이력",
        scrollLeft: "왼쪽으로 스크롤",
        scrollRight: "오른쪽으로 스크롤하세요",
        allTypes: "모든 유형",
        nTypes: "{n} 종류",
        noTypeLabel: "타입 없음",
        open: "오픈",
        done: "끝났어",
        both: "둘 다",
        close: "닫습니다",
        noPreview: "미리보기는 제공되지 않습니다 — 다운로드 사용",
        groups: "그룹",
        people: "인물",
        loading: "로딩 중...",
        unassign: "언배정",
        reassign: "재배치",
        assign: "할당",
        add: "추가",
        send: "보내세요",
        noCommentsYet: "아직 댓글은 없습니다. 가장 먼저 댓글을 달아보세요.",
        noAttachments: "부착물 없어",
        remove: "제거",
        noAuditsFound: "감사 기록은 발견되지 않았습니다",
        selectAudit: "위에서 감사를 선택하세요.",
        noFailureTasks: "이번 감사에는 실패 과제가 없습니다.",
        noTasksAssigned: "이번 감사에서는 당신에게 할당된 업무가 없습니다.",
        allTasksComplete: "이번 감사를 위한 모든 업무가 완료되었습니다!",
        nTasksMarkedDone: "{n} 완료 표시 작업",
        nTasksFlagged: "{n} 작업 플래그됨",
        showOtherTasks: "이 감사에서 {n} 다른 업무를 보여줘",
        hideOtherTasks: "이 감사에서 다른 {n} 작업을 숨기세요",
        myTasksN: "나의 과제 ({n})",
        allCaughtUp: "미해결 과제는 없고 — 모두 완료했습니다!",
        notes: "주석",
        attachments: "부속 자료",
        categoryBreakdown: "카테고리 분류",
        noGroupAssigned: "그룹 배정 없음",
        noIndividualAssignee: "개별 파견자는 없습니다",
        group: "그룹",
        person: "인물",
        searchPeopleGroups: "사람이나 집단을 검색해보세요...",
        auditFinding: "감사 조사 결과",
        description: "설명",
        noDescription: "묘사는 없어",
        comments: "댓글",
        addComment: "댓글을 추가하세요...",
        attachFile: "파일 첨부",
        noTaskSpaces: "작업 공간이 없음",
        noTaskSpacesHint: "최소한 하나의 Tasks 설치가 존재하는지 확인하세요.",
        failedToLoad: "작업 불러오지 않음",
        noTasksFound: "과제가 없음",
        allCaughtUpPersonal: "미해결 과제는 없어요 — 모두 끝났으니까요!",
        noCompletedTasks: "아직 완료된 작업은 없습니다",
        auditEmptyHint: "감사 위젯을 통해 감사를 제출하여 결과를 확인할 수 있습니다.",
        noMatches: "일치하는 사람이 없어",
        createFailedPrefix: "작업을 만들 수 없었다:",
        newTaskHeading: "새로운 임무",
        title: "제목",
        titlePlaceholder: "무엇을 해야 할까요?",
        descriptionPlaceholder: "세부 정보 추가(선택 사항)",
        list: "목록",
        type: "유형",
        newTypePlaceholder: "새로운 유형명입니다",
        noType: "— 종류 없음 —",
        createNewType: "+ 새로운 타입 생성...",
        dueDate: "출산 예정일",
        dueLabel: "기분",
        overdueLabel: "기한이 지났어",
        priority: "우선순위",
        normal: "정상",
        medium: "매체",
        high: "높게",
        critical: "비평",
        recurring: "반복 출연",
        cancel: "취소",
        createTask: "작업 만들기",
        creating: "창조...",
        debug: "디버그",
        copy: "알겠습니다",
        clear: "비켜",
        hide: "숨어",
        copied: "복사했어요!",
        copyFailed: "복사 실패",
        hideCompleted: "숨기기 완료",
        showCompletedN: "쇼 완결 ({n})",
        markAsOpen: "표시 열려 있음",
        markAsDone: "완료된 것으로 표시하세요",
        passing: "통과",
        failing: "실패",
        notScored: "점수 부여되지 않았습니다",
    },
    tl_PH: {
        myTasks: "Ang Aking Mga Gawain",
        auditResults: "Mga Resulta ng Pag-audit",
        newTask: "Bagong gawain",
        refresh: "I-refresh",
        translateBtn: "Magsalin",
        showOriginal: "Ipakita ang orihinal",
        translating: "Pagsasalin ...",
        auditHistory: "Kasaysayan ng Audit",
        scrollLeft: "Mag-scroll pakaliwa",
        scrollRight: "Mag-scroll pakanan",
        allTypes: "Lahat ng Uri",
        nTypes: "{n} uri",
        noTypeLabel: "Walang Uri",
        open: "Buksan",
        done: "Tapos na",
        both: "Parehong",
        close: "Isara",
        noPreview: "Walang preview na magagamit — gamitin ang I-download",
        groups: "Mga Grupo",
        people: "Mga Tao",
        loading: "Naglo-load...",
        unassign: "I-unassign",
        reassign: "Muling Pagtatalaga",
        assign: "Email Address *",
        add: "Magdagdag",
        send: "Email Address *",
        noCommentsYet: "Walang mga komento pa. Maging ang unang magkomento.",
        noAttachments: "Walang mga attachment",
        remove: "Alisin",
        noAuditsFound: "Walang natagpuang mga audit",
        selectAudit: "Pumili ng isang audit sa itaas.",
        noFailureTasks: "Walang mga gawain sa pagkabigo sa audit na ito.",
        noTasksAssigned: "Walang mga gawain na itinalaga sa iyo sa pag-audit na ito.",
        allTasksComplete: "Lahat ng gawain ay nakumpleto para sa audit na ito!",
        nTasksMarkedDone: "{n} mga gawain na minarkahan na tapos na",
        nTasksFlagged: "{n} mga gawain na na-flag",
        showOtherTasks: "Ipakita {n} iba pang mga gawain sa audit na ito",
        hideOtherTasks: "Itago {n} iba pang mga gawain sa audit na ito",
        myTasksN: "Ang Aking Mga Gawain ({n})",
        allCaughtUp: "Walang bukas na gawain - lahat ay naabutan!",
        notes: "Mga Tala",
        attachments: "Mga Attachment",
        categoryBreakdown: "Pagkasira ng kategorya",
        noGroupAssigned: "Walang pangkat na itinalaga",
        noIndividualAssignee: "Walang indibidwal na tagapag-atas",
        group: "Pangkat",
        person: "Tao",
        searchPeopleGroups: "Hanapin ang mga tao o pangkat ...",
        auditFinding: "Paghahanap ng Audit",
        description: "Paglalarawan",
        noDescription: "Walang paglalarawan",
        comments: "Mga Komento",
        addComment: "Magdagdag ng komento ...",
        attachFile: "Email Address *",
        noTaskSpaces: "Walang natagpuan na mga puwang ng gawain",
        noTaskSpacesHint: "Tiyaking umiiral ang hindi bababa sa isang pag-install ng Mga Gawain.",
        failedToLoad: "Nabigong mag-load ng mga gawain",
        noTasksFound: "Walang natagpuang mga gawain",
        allCaughtUpPersonal: "Walang bukas na gawain - lahat kayo ay nahuli!",
        noCompletedTasks: "Wala pang nakumpletong gawain",
        auditEmptyHint: "Magsumite ng audit gamit ang Audit Widget para makita ang mga resulta dito.",
        noMatches: "Walang mga tugma",
        createFailedPrefix: "Hindi ko magawa ang gawain:",
        newTaskHeading: "Bagong Gawain",
        title: "Pamagat",
        titlePlaceholder: "Ano ang kailangang gawin?",
        descriptionPlaceholder: "Magdagdag ng mga detalye (opsyonal)",
        list: "Listahan",
        type: "Uri",
        newTypePlaceholder: "Bagong uri ng pangalan",
        noType: "— Walang uri —",
        createNewType: "+ Lumikha ng bagong uri ...",
        dueDate: "Takdang petsa",
        dueLabel: "Dahil",
        overdueLabel: "Huli na",
        priority: "Prayoridad",
        normal: "Normal",
        medium: "Katamtaman",
        high: "Mataas",
        critical: "Kritikal",
        recurring: "Paulit-ulit",
        cancel: "Kanselahin",
        createTask: "Lumikha ng Gawain",
        creating: "Paglikha ...",
        debug: "I-debug",
        copy: "Kopyahin",
        clear: "I-clear",
        hide: "Itago",
        copied: "Kinopya!",
        copyFailed: "Nabigo ang kopya",
        hideCompleted: "Kumpleto na ang Itago",
        showCompletedN: "Kumpleto ang Ipakita ({n})",
        markAsOpen: "Markahan bilang bukas",
        markAsDone: "Markahan bilang tapos na",
        passing: "Pagpasa",
        failing: "Pagkabigo",
        notScored: "Hindi nakapuntos",
    },
    pt_BR: {
        myTasks: "Minhas Tarefas",
        auditResults: "Resultados da Auditoria",
        newTask: "Nova tarefa",
        refresh: "Atualizar",
        translateBtn: "Traduzir",
        showOriginal: "Original do programa",
        translating: "Traduzindo...",
        auditHistory: "Histórico de Auditoria",
        scrollLeft: "Rola à esquerda",
        scrollRight: "Rola para a direita",
        allTypes: "Todos os Tipos",
        nTypes: "{n} Tipos",
        noTypeLabel: "Sem Tipo",
        open: "Aberto",
        done: "Feito",
        both: "Ambos",
        close: "Fechar",
        noPreview: "Sem prévia disponível — use Download",
        groups: "Grupos",
        people: "Pessoas",
        loading: "Carregando...",
        unassign: "Desatribuição",
        reassign: "Reatribuição",
        assign: "Atribuir",
        add: "Adicionar",
        send: "Enviar",
        noCommentsYet: "Ainda sem comentários. Seja o primeiro a comentar.",
        noAttachments: "Sem anexos",
        remove: "Remover",
        noAuditsFound: "Nenhuma auditoria foi encontrada",
        selectAudit: "Selecione uma auditoria acima.",
        noFailureTasks: "Nenhuma falha nessa auditoria.",
        noTasksAssigned: "Nenhuma tarefa atribuída a você nesta auditoria.",
        allTasksComplete: "Todas as tarefas concluídas para esta auditoria!",
        nTasksMarkedDone: "{n} tarefas marcadas como concluídas",
        nTasksFlagged: "{n} tarefas sinalizadas",
        showOtherTasks: "Mostre {n} outras tarefas nesta auditoria",
        hideOtherTasks: "Esconda {n} outras tarefas nesta auditoria",
        myTasksN: "Minhas tarefas ({n})",
        allCaughtUp: "Nenhuma tarefa em aberto — tudo estava em dia!",
        notes: "Notas",
        attachments: "Anexos",
        categoryBreakdown: "Divisão por categorias",
        noGroupAssigned: "Nenhum grupo designado",
        noIndividualAssignee: "Sem um cedente individual",
        group: "Grupo",
        person: "Pessoa",
        searchPeopleGroups: "Procurem pessoas ou grupos...",
        auditFinding: "Constatação da Auditoria",
        description: "Descrição",
        noDescription: "Sem descrição",
        comments: "Comentários",
        addComment: "Adicione um comentário...",
        attachFile: "Anexar arquivo",
        noTaskSpaces: "Nenhum espaço de tarefas encontrado",
        noTaskSpacesHint: "Certifique-se de que existe pelo menos uma instalação de Tarefas.",
        failedToLoad: "Falharam ao carregar tarefas",
        noTasksFound: "Nenhuma tarefa encontrada",
        allCaughtUpPersonal: "Sem tarefas em aberto — você está em dia!",
        noCompletedTasks: "Ainda nenhuma tarefa concluída",
        auditEmptyHint: "Submeta uma auditoria usando o Widget de Auditoria para ver os resultados aqui.",
        noMatches: "Sem matches",
        createFailedPrefix: "Não consegui criar tarefa:",
        newTaskHeading: "Nova Tarefa",
        title: "Título",
        titlePlaceholder: "O que precisa ser feito?",
        descriptionPlaceholder: "Adicionar detalhes (opcional)",
        list: "Lista",
        type: "Tipo",
        newTypePlaceholder: "Novo nome de tipo",
        noType: "— Sem tipo —",
        createNewType: "+ Criar novo tipo...",
        dueDate: "Data prevista para o parto",
        dueLabel: "Devido",
        overdueLabel: "Atrasado",
        priority: "Prioridade",
        normal: "Normal",
        medium: "Médio",
        high: "Alto",
        critical: "Crítica",
        recurring: "Recorrentes",
        cancel: "Cancelar",
        createTask: "Criar Tarefa",
        creating: "Criando...",
        debug: "Depuração",
        copy: "Cópia",
        clear: "Limpo",
        hide: "Esconder",
        copied: "Copiado!",
        copyFailed: "Cópia falhou",
        hideCompleted: "Esconderijo concluído",
        showCompletedN: "Exposição concluída ({n})",
        markAsOpen: "Marque como aberto",
        markAsDone: "Marque como feito",
        passing: "Passagem",
        failing: "Fracasso",
        notScored: "Não pontuado",
    },
    ht_HT: {
        myTasks: "Travay mwen yo",
        auditResults: "Rezilta Kontwòl Odit",
        newTask: "Nouvo travay",
        refresh: "Rafrechi",
        translateBtn: "Tradwi",
        showOriginal: "Montre orijinal la",
        translating: "Tradui...",
        auditHistory: "Istwa odit",
        scrollLeft: "Scroll bò gòch",
        scrollRight: "Scroll dwat",
        allTypes: "Tout kalite",
        nTypes: "{n} kalite",
        noTypeLabel: "Pa gen kalite",
        open: "ouvè",
        done: "Fè",
        both: "Tou de",
        close: "Fèmen",
        noPreview: "Pa gen preview disponib — itilize Download",
        groups: "Gwoup yo",
        people: "Moun",
        loading: "Chaje ...",
        unassign: "Unattribut",
        reassign: "Reasiyen",
        assign: "Asiyen",
        add: "Ajoute",
        send: "Voye",
        noCommentsYet: "Pa gen kòmantè ankò. Fè premye moun ki fè kòmantè.",
        noAttachments: "Pa gen atachman",
        remove: "Retire",
        noAuditsFound: "Pa jwenn odit",
        selectAudit: "Chwazi yon odit pi wo a.",
        noFailureTasks: "Pa gen okenn travay echèk nan odit sa a.",
        noTasksAssigned: "Pa gen travay ki asiyen ou nan odit sa a.",
        allTasksComplete: "Tout travay ki te fini pou odit sa a!",
        nTasksMarkedDone: "{n} travay make fè",
        nTasksFlagged: "{n} travay ki make",
        showOtherTasks: "Montre {n} lòt travay nan odit sa a",
        hideOtherTasks: "Kache {n} lòt travay nan odit sa a",
        myTasksN: "Travay mwen ({n})",
        allCaughtUp: "Pa gen travay ouvè - tout kenbe moute!",
        notes: "Nòt yo",
        attachments: "Atachman",
        categoryBreakdown: "Kategori pann",
        noGroupAssigned: "Pa gen gwoup asiyen",
        noIndividualAssignee: "Pa gen moun asiyen endividyèl",
        group: "Gwoup",
        person: "Moun",
        searchPeopleGroups: "Rechèch moun oswa gwoup...",
        auditFinding: "Odit Jwenn",
        description: "Deskripsyon",
        noDescription: "Pa gen deskripsyon",
        comments: "Kòmantè",
        addComment: "Ajoute yon kòmantè...",
        attachFile: "Tache dosye",
        noTaskSpaces: "Pa gen espas travay yo te jwenn",
        noTaskSpacesHint: "Asire w ke omwen yon enstalasyon Travay egziste.",
        failedToLoad: "Echwe pou pou chaje travay yo",
        noTasksFound: "Pa gen travay yo te jwenn",
        allCaughtUpPersonal: "Pa gen travay ouvè - ou tout kenbe moute!",
        noCompletedTasks: "Pa gen travay fini ankò",
        auditEmptyHint: "Soumèt yon odit lè l sèvi avèk Widget Odit la pou wè rezilta isit la.",
        noMatches: "Pa gen alimèt",
        createFailedPrefix: "Pa t &#39;kapab kreye travay:",
        newTaskHeading: "Nouvo Travay",
        title: "",
        titlePlaceholder: "Kisa ki dwe fè?",
        descriptionPlaceholder: "Ajoute detay (si ou vle)",
        list: "Lis",
        type: "Kalite",
        newTypePlaceholder: "Nouvo non kalite",
        noType: "— Pa gen kalite —",
        createNewType: "+ Kreye nouvo kalite...",
        dueDate: "Dat limit yo",
        dueLabel: "Akòz",
        overdueLabel: "Anreta",
        priority: "Priyorite",
        normal: "Nòmal",
        medium: "Mwayen",
        high: "Segondè",
        critical: "Kritik",
        recurring: "Renouvlab",
        cancel: "Anile",
        createTask: "Kreye Travay",
        creating: "Kreye...",
        debug: "Debogaj",
        copy: "Kopi",
        clear: "Klè",
        hide: "Kache",
        copied: "Kopye!",
        copyFailed: "Kopi echwe",
        hideCompleted: "Kache ranpli",
        showCompletedN: "Montre fini ({n})",
        markAsOpen: "Make kòm louvri",
        markAsDone: "Make kòm fè",
        passing: "Pase",
        failing: "Echwe",
        notScored: "Pa bay nòt",
    },
};

;// ./my-tasks-widget.ts
var my_tasks_widget_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};



// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_API_TOKEN = "";
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#da2e32";
const DEFAULT_ACCENT_COLOR = "#da2e32";
// ── Config schema ─────────────────────────────────────────────────────────────
const configurationSchema = {
    properties: {
        apitoken: { type: "string", title: "API Token", default: DEFAULT_API_TOKEN },
        baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
        usethemecolors: { type: "boolean", title: "Use Theme Colors", default: false },
        backgroundcolor: { type: "string", title: "Background Color", default: "" },
        storelabelsingular: { type: "string", title: "Store Label (singular)", default: "Store" },
        storelabelplural: { type: "string", title: "Store Label (plural)", default: "Stores" },
        typecolors: { type: "string", title: "Type Colors (comma-separated hex)", default: "#DA2E32,#0369A1,#2E7D4A,#D97706,#7C3AED,#4A90A4,#8B4513,#0EA5E9" },
        showalltasks: { type: "boolean", title: "Show All Tasks (not just mine)", default: false },
        showdonetasks: { type: "boolean", title: "Include Completed Tasks", default: true },
        auditmode: { type: "boolean", title: "Audit Mode", default: false },
        enablecomments: { type: "boolean", title: "Enable Comments (experimental)", default: false },
        allowtaskcreation: { type: "boolean", title: "Allow Task Creation", default: false },
        allowtaskassignment: { type: "boolean", title: "Allow Task Assignment (audit mode)", default: false },
        notifyonassign: { type: "boolean", title: "Notify on Assignment", default: true },
        detailedlogging: { type: "boolean", title: "Detailed Activity Logging", default: false },
        debugmode: { type: "boolean", title: "Debug Mode (on-screen logs)", default: false },
        limitheight: { type: "boolean", title: "Limit Height", default: false },
    },
    // When "Use Theme Colors" is off, expose the manual Primary/Accent pickers.
    // When on, they're hidden (colors are pulled from the branding theme instead).
    dependencies: {
        usethemecolors: {
            oneOf: [
                {
                    properties: {
                        usethemecolors: { const: false },
                        primarycolor: { type: "string", title: "Primary Color", default: DEFAULT_PRIMARY_COLOR },
                        accentcolor: { type: "string", title: "Accent Color", default: DEFAULT_ACCENT_COLOR },
                    },
                },
                {
                    properties: {
                        usethemecolors: { const: true },
                    },
                },
            ],
        },
        // When "Limit Height" is on, reveal the Max Height field.
        limitheight: {
            oneOf: [
                { properties: { limitheight: { const: false } } },
                { properties: { limitheight: { const: true }, maxheight: { type: "string", title: "Max Height (px)", default: "600" } } },
            ],
        },
    },
};
const uiSchema = {
    apitoken: { "ui:widget": "password", "ui:help": "Staffbase Basic auth token" },
    baseurl: { "ui:help": "Staffbase API base URL" },
    usethemecolors: { "ui:help": "Pull Primary & Accent from the app's branding theme (uses the API Token). Hides the color pickers below." },
    primarycolor: { "ui:widget": "color", "ui:help": "Primary brand color" },
    accentcolor: { "ui:widget": "color", "ui:help": "Accent / secondary color" },
    backgroundcolor: { "ui:widget": "color", "ui:help": "Widget background color — leave blank for transparent" },
    storelabelsingular: { "ui:help": "e.g. Store, Location, Branch" },
    storelabelplural: { "ui:help": "e.g. Stores, Locations, Branches" },
    typecolors: { "ui:help": "Type-badge palette. Colors are assigned to each type in order; all are used before any repeat." },
    showalltasks: { "ui:help": "When enabled, tasks from all users are shown — not just yours" },
    showdonetasks: { "ui:help": "When enabled, completed tasks are included in the view" },
    auditmode: { "ui:help": "When enabled, shows audit results and history instead of regular tasks" },
    enablecomments: { "ui:help": "Experimental: show a comments section in the task detail panel (uses the logged-in user's session)" },
    allowtaskcreation: { "ui:help": "Show a “New Task” button so users can create tasks from this widget" },
    allowtaskassignment: { "ui:help": "In audit mode, allow reassigning a task (to a group or person) from its detail panel" },
    notifyonassign: { "ui:help": "Send a Staffbase notification (“You were assigned a new task”) to people newly assigned a task via this widget" },
    detailedlogging: { "ui:help": "Record reassignments and completions as hidden activity entries the Manager Tasks widget surfaces in its activity feed. Off by default." },
    debugmode: { "ui:help": "Show an on-screen log panel with a copy button — useful for debugging inside the mobile app" },
    limitheight: { "ui:help": "Cap the widget's height — anything taller scrolls inside a styled scrollbar" },
    maxheight: { "ui:help": "Maximum height in pixels (e.g. 600). You can also include a CSS unit like 600px or 70vh." },
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
    // Lean toward white text: only genuinely light backgrounds get dark text, so
    // mid-tone/saturated colors (e.g. #4A90A4) read as white, not harsh black.
    return L > 0.45 ? "#1a1a1a" : "#ffffff";
}
// ── Task type parsing ─────────────────────────────────────────────────────────
const TYPE_REGEX = /\[type:\s*([^\]]+)\]/i;
function parseTaskType(text) {
    const m = TYPE_REGEX.exec(text);
    return m ? m[1].trim().toLowerCase() : null;
}
// Recurrence markers written by the recurring-tasks-widget / scheduler:
//   [rrule: ...]  — schedule definition on a hidden template task
//   [recur: id@YYYY-MM-DD] — dedup stamp on a generated recurring task
const RRULE_REGEX = /\[rrule:\s*[^\]]+\]/i;
const RECUR_REGEX = /\[recur:\s*[^\]]+\]/i;
// Priority level stamp on generated recurring tasks (Critical & High both map to
// Priority_1, so this distinguishes them). e.g. [lvl: critical]
const LVL_REGEX = /\[lvl:\s*([^\]]+)\]/i;
function stripTypeTag(text) {
    return text
        .replace(TYPE_REGEX, "")
        .replace(RRULE_REGEX, "")
        .replace(RECUR_REGEX, "")
        .replace(LVL_REGEX, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}
// ── Color palette for type badges ─────────────────────────────────────────────
// Colors come from the configurable `typecolors` palette, assigned round-robin to
// the distinct types (sorted, so a type keeps its color) — every color is used
// before any repeats. TYPE_PALETTE/TYPE_ORDER are set per-instance in renderBlock.
let TYPE_PALETTE = []; // set per-instance from the `typecolors` config
let TYPE_ORDER = [];
// Original system — used when no palette is configured (field blank / all cleared).
const TYPE_COLORS = {
    storetask: "#da2e32", compliance: "#8B4513", maintenance: "#2E7D4A",
    training: "#4A90A4", audit: "#7C3AED", safety: "#D97706", inventory: "#0369A1",
};
function typeColorOriginal(key) {
    if (TYPE_COLORS[key])
        return TYPE_COLORS[key];
    let h = 0;
    for (let i = 0; i < key.length; i++)
        h = (h * 31 + key.charCodeAt(i)) & 0xffffff;
    return `hsl(${((h >> 16) & 0xff) % 360},55%,40%)`;
}
function typeColor(type) {
    const key = type.toLowerCase();
    if (!TYPE_PALETTE.length)
        return typeColorOriginal(key); // no palette → fall back to original system
    let i = TYPE_ORDER.indexOf(key);
    if (i < 0) { // not registered yet — deterministic fallback so it's still stable
        let h = 0;
        for (let c = 0; c < key.length; c++)
            h = (h * 31 + key.charCodeAt(c)) & 0xffffff;
        i = h;
    }
    return TYPE_PALETTE[i % TYPE_PALETTE.length];
}
function priorityLabel(p) {
    if (p === "Priority_1")
        return "High";
    if (p === "Priority_2")
        return "Med";
    return "Low";
}
function priorityColor(p) {
    if (p === "Priority_1")
        return "#C41E3A";
    if (p === "Priority_2")
        return "#D97706";
    return "#6b7280";
}
// ── Widget factory ────────────────────────────────────────────────────────────
const factory = (BaseBlockClass, widgetApi) => {
    return class MyTasksWidget extends BaseBlockClass {
        constructor() { super(); }
        renderBlock(container) {
            return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                const apiToken = this.getAttribute("apitoken") || DEFAULT_API_TOKEN;
                const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/$/, "");
                let primaryColor = this.getAttribute("primarycolor") || DEFAULT_PRIMARY_COLOR;
                let accentColor = this.getAttribute("accentcolor") || DEFAULT_ACCENT_COLOR;
                const bgColor = this.getAttribute("backgroundcolor") || "";
                // When "Use Theme Colors" is on, pull Primary/Accent from the branding theme
                // (token-auth GET). Failures fall back silently to the values above.
                if (this.getAttribute("usethemecolors") === "true") {
                    const themed = yield fetchThemeColors(baseUrl, apiToken);
                    if (themed.primary)
                        primaryColor = themed.primary;
                    if (themed.accent)
                        accentColor = themed.accent;
                }
                // Valid hex colors only; if blank/all-cleared, TYPE_PALETTE stays empty → original color system.
                TYPE_PALETTE = (this.getAttribute("typecolors") || "").split(",").map(s => s.trim()).filter(c => /^#?[0-9a-fA-F]{3,8}$/.test(c)).map(c => c[0] === "#" ? c : `#${c}`);
                const showAll = this.getAttribute("showalltasks") === "true";
                const showDone = this.getAttribute("showdonetasks") !== "false";
                const auditMode = this.getAttribute("auditmode") === "true";
                const enableComments = this.getAttribute("enablecomments") === "true";
                const allowCreate = this.getAttribute("allowtaskcreation") === "true";
                const allowAssign = this.getAttribute("allowtaskassignment") === "true";
                const notifyOnAssign = this.getAttribute("notifyonassign") !== "false";
                const detailedLogging = this.getAttribute("detailedlogging") === "true";
                const storeSingular = this.getAttribute("storelabelsingular") || "Store";
                const debugMode = this.getAttribute("debugmode") === "true";
                const primaryRgb = hexToRgb(primaryColor);
                const accentRgb = hexToRgb(accentColor);
                const primaryText = contrastColor(primaryColor);
                const p = "mtw";
                // ── Limit height / scroll ───────────────────────────────────────────
                // When on, the root becomes a fixed-max-height scroll container with a
                // subtly themed scrollbar. Body-appended panels (detail/create) are
                // position:fixed outside the root, so they're never clipped by this.
                const limitHeight = this.getAttribute("limitheight") === "true";
                let maxHeight = (this.getAttribute("maxheight") || "").trim();
                if (!maxHeight)
                    maxHeight = "600px";
                else if (/^\d+(\.\d+)?$/.test(maxHeight))
                    maxHeight += "px";
                const limitCss = limitHeight ? `
          .${p}.${p}-limited{max-height:${maxHeight};overflow-y:auto;box-sizing:border-box;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(${primaryRgb},.45) transparent}
          .${p}.${p}-limited::-webkit-scrollbar{width:10px;height:10px}
          .${p}.${p}-limited::-webkit-scrollbar-track{background:transparent;margin:6px 0}
          .${p}.${p}-limited::-webkit-scrollbar-thumb{background:rgba(${primaryRgb},.32);border-radius:8px;border:3px solid transparent;background-clip:padding-box}
          .${p}.${p}-limited::-webkit-scrollbar-thumb:hover{background:rgba(${primaryRgb},.55);background-clip:padding-box}` : "";
                let allTasks = [];
                let activeTypeFilters = new Set();
                let activeStatusFilter = "open";
                let activeInstallFilter = "all";
                let activeAuditListId = "";
                let auditLists = [];
                let showCompletedAudit = false;
                let showOtherAuditTasks = false;
                let introUsed = false; // staggered entrance only on first list render
                let currentUserId = "";
                // ── Locale / i18n ──────────────────────────────────────────────────
                // Resolved once on load from the user's Staffbase locale (see load()).
                // Until then we render in the default locale, so first paint is identical
                // to the pre-i18n behavior for en_US users.
                let locale = DEFAULT_LOCALE;
                // `tr` (not `t`) — the codebase uses `t` as the task loop variable in many
                // .map/.filter callbacks, which would shadow a translator named `t`.
                let tr = makeT(STRINGS, locale);
                // ── On-demand content translation (free-text task data) ────────────
                // Ephemeral: nothing is persisted. `ct(text)` returns the cached
                // translation when translate-mode is on, else the original.
                let contentTranslated = false;
                let translateBusy = false;
                const ctCache = {};
                const ct = (s) => { if (!contentTranslated || !s)
                    return s; return ctCache[s.trim()] || s; };
                // Comments translate independently (their own toggle in the comment list).
                let cmtTranslated = false;
                let cmtTrBusy = false;
                const cmtCache = {};
                let lastCmt = null;
                let allInstalls = []; // for task creation
                const listsByInst = new Map();
                let usersList = null; // lazy, for reassign picker
                let userGroupIds = [];
                const groupMap = new Map(); // groupId → name
                const EDIT_MARK = "[tasks:edit]"; // hidden audit-comment marker (shared w/ manager widget)
                const isEditCommentText = (txt) => txt.trim().indexOf(EDIT_MARK) === 0;
                // ── Render skeleton ────────────────────────────────────────────────
                container.innerHTML = `
        <style>
          .${p}{--primary:${primaryColor};--primary-rgb:${primaryRgb};--accent-rgb:${accentRgb};--primary-text:${primaryText};--accent:${accentColor};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;--shadow-sm:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04);--shadow-md:0 4px 16px rgba(0,0,0,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);background:${bgColor || "transparent"};padding:20px}
          .${p} *,.${p} *::before,.${p} *::after{box-sizing:border-box;margin:0;padding:0}
          /* Neutralize Staffbase's global button rule (margin:auto/width:90%) inside the
             body-appended panels, which sit outside the .${p} reset above. */
          .${p}-detail button,.${p}-create button{margin:0!important;box-sizing:border-box}
          .${p}-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
          .${p}-title{font-size:18px;font-weight:800;color:var(--dark);display:flex;align-items:center;gap:10px}
          .${p}-title-dot{width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));flex-shrink:0}
          .${p}-badge-count{background:var(--primary);color:var(--primary-text);padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700}
          .${p} .${p}-refresh-btn{width:34px;height:34px;border:1.5px solid var(--border)!important;border-radius:var(--r-md)!important;background:#fff!important;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--gray)!important;transition:background .15s,color .15s,border-color .15s}
          .${p} .${p}-refresh-btn:hover,.${p} .${p}-refresh-btn:focus,.${p} .${p}-refresh-btn:focus-visible,.${p} .${p}-refresh-btn:active{background:#fff!important;color:var(--primary)!important;border-color:var(--primary)!important;box-shadow:none!important;outline:none!important}
          .${p} .${p}-refresh-btn svg{stroke:currentColor!important;fill:none!important}
          .${p} .${p}-refresh-btn span{color:currentColor!important}
          .${p}-refresh-btn:hover{border-color:var(--primary);color:var(--primary);background:rgba(var(--primary-rgb),.05)}
          .${p}-refresh-btn:disabled{opacity:.4;cursor:not-allowed}
          .${p}-header-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
          .${p}-new-btn{display:inline-flex!important;width:auto!important;align-items:center;gap:6px;height:34px;padding:0 14px!important;border:none!important;border-radius:var(--r-md);background:var(--primary)!important;color:var(--primary-text,#fff)!important;font-family:inherit;font-size:13px;font-weight:700;line-height:normal!important;cursor:pointer;white-space:nowrap;box-shadow:0 3px 10px rgba(var(--primary-rgb),.3);transition:all .15s}
          .${p}-new-btn:hover{filter:brightness(.9);transform:translateY(-1px)}
          /* ── Create task sheet ── */
          .${p}-create{--primary:${primaryColor};--primary-rgb:${primaryRgb};--primary-text:${primaryText};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--error:#C41E3A;--r-sm:6px;--r-md:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;position:fixed;left:0;right:0;bottom:0;z-index:100001;background:#fff;border-radius:20px 20px 0 0;max-height:90vh;display:flex;flex-direction:column;transform:translateY(102%);transition:transform .32s cubic-bezier(.32,.72,0,1);overflow:hidden;box-shadow:0 -8px 40px rgba(0,0,0,.18)}
          .${p}-create.open{transform:translateY(0)}
          .${p}-create.side{left:auto;top:0;right:0;bottom:0;width:min(460px,94vw);max-height:none;border-radius:20px 0 0 20px;transform:translateX(102%)}
          .${p}-create.side.open{transform:translateX(0)}
          .${p}-create-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid var(--border)}
          .${p}-create-head h3{margin:0;font-size:16px;font-weight:800;color:var(--dark)}
          .${p}-create-close{width:30px;height:30px;border:none;background:#f3f4f6;border-radius:50%;cursor:pointer;color:var(--gray);display:flex;align-items:center;justify-content:center}
          .${p}-create-body{padding:16px 18px;overflow-y:auto}
          .${p}-fld{margin-bottom:14px}
          .${p}-fld label{display:block;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--gray-lt);margin-bottom:6px}
          .${p}-in,.${p}-sel{width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fafafa;color:var(--dark);font-family:inherit;font-size:14px;line-height:1.4}
          .${p}-in:focus,.${p}-sel:focus{outline:none;border-color:var(--primary);background:#fff;box-shadow:0 0 0 3px rgba(var(--primary-rgb),.12)}
          textarea.${p}-in{resize:vertical;min-height:64px}
          .${p}-fld-row{display:flex;gap:10px}
          .${p}-fld-row .${p}-fld{flex:1;min-width:0}
          .${p}-create-foot{display:flex;gap:10px;padding:14px 18px;border-top:1px solid var(--border)}
          .${p}-create-foot button{flex:1;padding:12px!important;border-radius:var(--r-md)!important;font-family:inherit;font-size:14px;font-weight:700;line-height:normal!important;cursor:pointer;width:auto!important}
          .${p}-btn-cancel{background:#f3f4f6!important;border:none!important;color:var(--gray)}
          .${p}-btn-save{background:var(--primary)!important;border:none!important;color:var(--primary-text,#fff)!important;box-shadow:0 3px 10px rgba(var(--primary-rgb),.3)}
          .${p}-btn-save:disabled{opacity:.5;cursor:default}
          .${p}-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(var(--primary-rgb),.22);border-top-color:var(--accent);animation:${p}-spin .7s linear infinite;flex-shrink:0;display:inline-block}
          @keyframes ${p}-spin{to{transform:rotate(360deg)}}
          /* ── Detail panel ── */
          .${p}-overlay{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .25s ease}
          .${p}-overlay.open{opacity:1;pointer-events:auto}
          .${p}-detail{--primary:${primaryColor};--primary-rgb:${primaryRgb};--primary-text:${primaryText};--accent:${accentColor};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#fff;border-radius:20px 20px 0 0;max-height:88vh;display:flex;flex-direction:column;transform:translateY(102%);transition:transform .32s cubic-bezier(.32,.72,0,1);overflow:hidden}
          .${p}-detail.open{transform:translateY(0)}
          .${p}-detail.side{left:auto;top:0;right:0;bottom:0;width:min(420px,92vw);max-height:none;border-radius:20px 0 0 20px;transform:translateX(102%)}
          .${p}-detail.side.open{transform:translateX(0)}
          .${p}-detail-handle{width:40px;height:5px;border-radius:3px;background:var(--border);margin:9px auto 2px;flex-shrink:0;cursor:grab;touch-action:none}
          .${p}-detail-head{touch-action:none}
          .${p}-detail.side .${p}-detail-handle{display:none}
          .${p}-detail-head{display:flex;align-items:center;gap:10px;padding:16px 20px 12px;flex-shrink:0;border-bottom:1px solid var(--border)}
          .${p}-detail-head-badges{display:flex;gap:6px;flex-wrap:wrap;flex:1;align-items:center}
          .${p}-detail-close{width:28px;height:28px;border-radius:50%;border:none;background:#f3f4f6;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--gray);flex-shrink:0;transition:background .15s,color .15s;font-family:inherit}
          .${p}-detail-close:hover{background:var(--border);color:var(--dark)}
          .${p}-detail-body{flex:1;overflow-y:auto;padding:20px;min-height:0}
          .${p}-detail-title{font-size:18px;font-weight:800;color:var(--dark);line-height:1.3;margin-bottom:14px;word-break:break-word}
          .${p}-detail-title.done{text-decoration:line-through;color:var(--gray)}
          .${p}-detail-meta{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
          .${p}-detail-meta-row{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--gray)}
          .${p}-detail-meta-row svg{flex-shrink:0;color:var(--gray-lt)}
          .${p}-detail-meta-row.overdue{color:var(--error);font-weight:600}
          .${p}-detail-desc-label{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-lt);margin-bottom:6px}
          .${p}-detail-desc{font-size:13px;color:var(--gray);line-height:1.65;white-space:pre-wrap;word-break:break-word}
          .${p}-detail-desc.empty{font-style:italic;color:var(--gray-lt)}
          /* Audit finding (parsed, audit mode only) */
          .${p}-af{margin-top:2px}
          .${p}-af-code{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.5px;color:var(--primary);background:rgba(var(--primary-rgb),.1);border-radius:6px;padding:3px 9px;margin-bottom:9px}
          .${p}-af-finding{font-size:13px;font-weight:400;line-height:1.5;color:var(--gray);margin-bottom:11px}
          .${p}-af-pills{display:flex;flex-wrap:wrap;gap:6px}
          .${p}-af-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--gray);background:#f3f4f6;border:1px solid var(--border);border-radius:20px;padding:5px 11px}
          .${p}-af-pill svg{width:12px;height:12px;opacity:.7;flex-shrink:0}
          .${p}-detail-foot{padding:14px 20px;border-top:1px solid var(--border);flex-shrink:0}
          .${p}-detail-toggle-btn{width:100%;padding:11px;border-radius:var(--r-md);border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:8px}
          .${p}-detail-toggle-btn.done-btn{background:rgba(var(--primary-rgb),.08);border:1.5px solid rgba(var(--primary-rgb),.2);color:var(--primary)}
          .${p}-detail-toggle-btn.done-btn:hover{background:var(--primary);color:var(--primary-text)}
          .${p}-detail-toggle-btn.open-btn{background:#f3f4f6;border:1.5px solid var(--border);color:var(--gray)}
          .${p}-detail-toggle-btn.open-btn:hover{background:var(--border);color:var(--dark)}
          /* ── Attachments ── */
          .${p}-att{margin-top:16px}
          .${p}-att-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
          .${p}-att-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--gray-lt)}
          .${p}-att-add{display:inline-flex!important;width:auto!important;margin:0!important;align-items:center;gap:5px;font-size:12px;font-weight:600;line-height:normal!important;color:var(--gray);background:none!important;border:none!important;cursor:pointer;font-family:inherit;padding:3px 6px!important;border-radius:var(--r-sm);transition:color .15s,background .15s}
          .${p}-att-add:hover{color:var(--primary);background:rgba(var(--primary-rgb),.06)}
          .${p}-att-add:disabled{opacity:.5;cursor:default}
          .${p}-att-grid{display:flex;flex-wrap:wrap;gap:8px}
          .${p}-att-tile{display:flex;align-items:center;gap:8px;padding:6px 9px;border:1px solid var(--border);border-radius:var(--r-md);background:#fafafa;font-size:12px;color:var(--dark);transition:border-color .15s,background .15s}
          .${p}-att-tile:hover{border-color:var(--primary);background:#fff}
          .${p}-att-link{display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none;min-width:0}
          .${p}-att-thumb{width:34px;height:34px;border-radius:var(--r-sm);object-fit:cover;flex-shrink:0;background:#f3f4f6}
          .${p}-att-ico{width:34px;height:34px;border-radius:var(--r-sm);background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:var(--gray-lt);flex-shrink:0}
          .${p}-att-meta{min-width:0;display:flex;flex-direction:column;gap:1px}
          .${p}-att-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px;font-weight:500}
          .${p}-att-size{color:var(--gray-lt);font-size:11px}
          /* Attachment preview modal */
          .${p}-amodal{position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.75);display:none;align-items:center;justify-content:center;padding:16px}
          .${p}-amodal.open{display:flex}
          .${p}-amodal-card{background:#fff;border-radius:var(--r-lg);width:100%;max-width:min(900px,96vw);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.4)}
          .${p}-amodal-head{display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid var(--border);flex-shrink:0}
          .${p}-amodal-name{flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .${p}-amodal-dl{display:inline-flex!important;align-items:center;gap:6px;width:auto!important;margin:0!important;font-family:inherit;font-size:13px;font-weight:700;line-height:normal!important;border:none!important;border-radius:var(--r-md)!important;background:var(--primary)!important;color:var(--primary-text,#fff)!important;cursor:pointer;padding:8px 14px!important;flex-shrink:0}
          .${p}-amodal-x{width:32px;height:32px;flex-shrink:0;border:none!important;border-radius:50%;background:#f3f4f6!important;color:var(--gray)!important;cursor:pointer;display:flex!important;align-items:center;justify-content:center;padding:0!important;margin:0!important}
          .${p}-amodal-body{flex:1;min-height:0;overflow:auto;background:#f1f3f5;display:flex;align-items:center;justify-content:center}
          .${p}-amodal-body img{max-width:100%;max-height:88vh;object-fit:contain;display:block}
          .${p}-amodal-body iframe,.${p}-amodal-body object,.${p}-amodal-pdf{width:100%;height:84vh;border:none;background:#fff}
          .${p}-amodal-none{display:flex;flex-direction:column;align-items:center;gap:12px;padding:48px 24px;color:var(--gray-lt);font-size:13px}
          .${p}-att-x{width:auto!important;margin:0 0 0 2px!important;border:none!important;background:none!important;color:var(--gray-lt);cursor:pointer;padding:3px!important;display:flex!important;border-radius:50%;flex-shrink:0;transition:color .15s,background .15s}
          .${p}-att-x:hover{color:var(--error);background:rgba(196,30,58,.08)}
          .${p}-att-empty{font-size:12px;color:var(--gray-lt)}
          /* ── Comments ── */
          .${p}-cmt{margin-top:18px;border-top:1px solid var(--border);padding-top:14px}
          .${p}-cmt-list{display:flex;flex-direction:column;gap:14px;margin-bottom:14px}
          .${p}-cmt-item{display:flex;gap:10px;align-items:flex-start;position:relative}
          .${p}-cmt-tr{position:absolute;top:-2px;inset-inline-end:0;display:none;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--primary)!important;background:#fff!important;border:1px solid var(--border)!important;border-radius:12px;padding:2px 8px;cursor:pointer;font-family:inherit;z-index:3;line-height:1.4}
          .${p}-cmt-tr svg{stroke:currentColor!important}
          .${p}-cmt-item:hover .${p}-cmt-tr,.${p}-cmt-item.show-tr .${p}-cmt-tr{display:inline-flex}
          .${p}-cmt-av{width:32px;height:32px;border-radius:50%;flex-shrink:0;object-fit:cover;background:#e5e7eb}
          .${p}-cmt-av-fb{display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;background:var(--primary);text-transform:uppercase}
          .${p}-cmt-main{flex:1;min-width:0;background:#f6f7f9;border-radius:0 var(--r-md) var(--r-md) var(--r-md);padding:8px 12px}
          .${p}-cmt-head{display:flex;align-items:baseline;gap:8px;margin-bottom:2px}
          .${p}-cmt-author{font-size:13px;font-weight:700;color:var(--dark)}
          .${p}-cmt-time{font-size:11px;color:var(--gray-lt);flex-shrink:0}
          .${p}-cmt-body{font-size:13px;line-height:1.5;color:var(--dark);word-break:break-word}
          .${p}-cmt-body p{margin:0 0 4px}
          .${p}-cmt-body p:last-child{margin-bottom:0}
          .${p}-cmt-empty{font-size:12px;color:var(--gray-lt);padding:4px 0}
          .${p}-cmt-compose{display:flex;align-items:flex-start;gap:10px}
          .${p}-cmt-av-slot{flex-shrink:0}
          .${p}-cmt-field{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fafafa;padding:10px 13px;transition:border-color .15s,box-shadow .15s}
          .${p}-cmt-field:focus-within{border-color:var(--primary);background:#fff;box-shadow:0 0 0 3px rgba(var(--primary-rgb),.12)}
          .${p}-cmt-input{width:100%;resize:none;max-height:140px;min-height:38px;font-family:inherit;font-size:14px;line-height:1.5;border:none;background:none;color:var(--dark)}
          .${p}-cmt-input:focus{outline:none}
          .${p}-cmt-bar{display:none;align-items:center;gap:6px;margin-top:8px}
          .${p}-cmt-bar.show{display:flex}
          .${p}-cmt-attach{display:inline-flex!important;width:38px!important;height:38px;margin:0!important;align-items:center;justify-content:center;border:none!important;background:none!important;color:var(--gray);cursor:pointer;padding:0!important;border-radius:50%;line-height:normal!important;font-family:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
          .${p}-cmt-attach:hover,.${p}-cmt-attach:active{color:var(--primary);background:rgba(var(--primary-rgb),.1)}
          .${p}-cmt-attach svg{width:18px;height:18px}
          .${p}-cmt-file{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0 0 0 0);pointer-events:none}
          .${p}-cmt-send{display:none!important;width:auto!important;margin:0!important;align-items:center!important;gap:7px!important;font-family:inherit!important;font-size:13px!important;font-weight:700!important;line-height:normal!important;white-space:nowrap!important;border:none!important;border-radius:var(--r-md)!important;background:var(--primary)!important;color:var(--primary-text,#fff)!important;cursor:pointer!important;padding:9px 16px!important;box-shadow:0 3px 10px rgba(var(--primary-rgb),.3)!important;transition:all .15s!important}
          .${p}-cmt-send.show{display:inline-flex!important}
          .${p}-cmt-send svg{width:14px;height:14px}
          .${p}-cmt-send:hover{filter:brightness(.9)!important;transform:translateY(-1px)!important}
          .${p}-cmt-send:active{transform:translateY(0)!important}
          .${p}-cmt-chips{display:flex;flex-wrap:nowrap;gap:5px;flex:1;min-width:0;overflow-x:auto;margin:0;scrollbar-width:none}
          .${p}-cmt-chips::-webkit-scrollbar{display:none}
          .${p}-cmt-chip{display:inline-flex;align-items:center;gap:5px;max-width:130px;flex-shrink:0;font-size:11px;font-weight:600;background:rgba(var(--primary-rgb),.08);color:var(--primary);border-radius:12px;padding:3px 4px 3px 9px}
          .${p}-cmt-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .${p}-cmt-chip button{width:auto!important;margin:0!important;border:none!important;background:none!important;cursor:pointer;color:inherit;padding:1px!important;display:flex!important;opacity:.7}
          .${p}-cmt-chip button:hover{opacity:1}
          .${p}-cmt-att{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--primary)!important;text-decoration:none;background:rgba(var(--primary-rgb),.08);border-radius:6px;padding:3px 9px;margin:3px 4px 3px 0}
          .${p}-cmt-att svg{width:12px;height:12px;flex-shrink:0}
          .${p}-cmt-att-img{max-width:180px;max-height:140px;border-radius:8px;display:block;margin:5px 0;border:1px solid var(--border)}
          /* ── Debug panel ── */
          .${p}-dbg{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#0d1117;color:#e6edf3;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;border-top:2px solid var(--primary);box-shadow:0 -4px 16px rgba(0,0,0,.3);max-height:45vh;display:flex;flex-direction:column}
          .${p}-dbg.collapsed .${p}-dbg-body{display:none}
          .${p}-dbg-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#161b22;flex-shrink:0}
          .${p}-dbg-title{font-size:12px;font-weight:700;letter-spacing:.5px}
          .${p}-dbg-actions{display:flex;gap:6px}
          .${p}-dbg-btn{font-family:inherit;font-size:12px;font-weight:600;color:#e6edf3;background:#21262d;border:1px solid #30363d;border-radius:6px;padding:5px 12px;cursor:pointer;-webkit-tap-highlight-color:transparent}
          .${p}-dbg-btn:active{background:var(--primary);border-color:var(--primary)}
          .${p}-dbg-body{margin:0;padding:8px 10px;overflow:auto;font-size:11px;line-height:1.45;white-space:pre-wrap;word-break:break-word;-webkit-overflow-scrolling:touch}
          /* ── Audit tabs ── */
          .${p}-audit-tab-wrap{margin-bottom:12px}
          .${p}-audit-tab-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray-lt);margin-bottom:6px}
          .${p}-audit-scroll{display:flex;align-items:stretch;border-bottom:2px solid var(--border)}
          .${p}-audit-tabs{display:flex;overflow-x:auto;scrollbar-width:none;flex:1;scroll-behavior:smooth}
          .${p}-audit-tabs::-webkit-scrollbar{display:none}
          .${p}-audit-arrow{flex-shrink:0;width:30px;margin:0!important;padding:0!important;border:none!important;background:linear-gradient(90deg,#fff,#fff);color:var(--gray);cursor:pointer;display:none;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
          .${p}-audit-arrow.show{display:flex}
          .${p}-audit-arrow:active{color:var(--primary)}
          .${p}-audit-tab{flex-shrink:0;padding:8px 14px;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer;border-bottom:2.5px solid transparent;margin-bottom:-2px;white-space:nowrap;background:none;border:none;font-family:inherit;transition:color .15s,border-color .15s;display:flex;align-items:center;gap:6px;user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none}
          .${p}-audit-tab:hover{color:var(--dark);background:rgba(var(--primary-rgb),.04)}
          .${p}-audit-tab.active{color:var(--primary);border-bottom-color:var(--primary)}
          .${p}-audit-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
          /* ── Store tabs ── */
          .${p}-store-tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px}
          .${p}-store-tab{display:inline-flex;align-items:center;width:auto;padding:5px 12px;border-radius:20px;border:1.5px solid var(--border);background:#fff;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;flex-shrink:0;user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none}
          .${p}-store-tab:hover{border-color:var(--accent);color:var(--accent);background:rgba(var(--accent-rgb),.06)}
          .${p}-store-tab.active{background:var(--primary);border-color:var(--primary);color:var(--primary-text)}
          /* ── Filter bar ── */
          .${p}-filters{display:flex;gap:8px;margin-bottom:16px;align-items:center}
          .${p}-type-wrap{position:relative;flex:1;min-width:0}
          .${p}-type-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:7px 11px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fff;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer;font-family:inherit;transition:all .15s;text-align:start}
          .${p}-type-btn:hover,.${p}-type-btn.open{border-color:var(--accent);color:var(--accent)}
          .${p}-type-btn svg{flex-shrink:0;transition:transform .15s}
          .${p}-type-btn.open svg{transform:rotate(180deg)}
          .${p}-type-menu{display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1.5px solid var(--border);border-radius:var(--r-md);box-shadow:var(--shadow-md);z-index:100;overflow:hidden}
          .${p}-type-menu.open{display:block}
          .${p}-type-opt{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:none;background:none;font-size:12px;font-weight:500;color:var(--gray);cursor:pointer;font-family:inherit;text-align:start;transition:background .1s}
          .${p}-type-opt:hover{background:rgba(0,0,0,.04);color:var(--dark)}
          .${p}-type-opt.active{font-weight:700;color:var(--dark);background:rgba(var(--primary-rgb),.06)}
          .${p}-type-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
          .${p}-status-toggle{display:flex;border:1.5px solid var(--border);border-radius:var(--r-md);overflow:hidden;background:#fff;flex-shrink:0}
          .${p}-status-opt{padding:7px 13px;font-size:12px;font-weight:600;cursor:pointer;color:var(--gray);font-family:inherit;border:none;background:none;transition:all .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none;user-select:none}
          .${p}-status-opt.active{background:var(--primary);color:var(--primary-text)}
          /* ── Task cards ── */
          .${p}-list{display:flex;flex-direction:column;gap:8px}
          .${p}-card{background:#fff;border-radius:var(--r-lg);box-shadow:var(--shadow-sm);border:1px solid var(--border);border-inline-start:3px solid var(--primary);overflow:hidden;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-left-color .35s ease,opacity .35s ease}
          .${p}-card:hover:not(.done){transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.09);border-inline-start-color:var(--accent)}
          .${p}-card:active:not(.done){transform:translateY(0);box-shadow:var(--shadow-sm)}
          .${p}-card.done{border-inline-start-color:var(--border);opacity:.72}
          .${p}-card.done:hover{opacity:.88}
          .${p}-card-inner{display:flex;align-items:flex-start;gap:12px;padding:13px 16px}
          .${p}-check-wrap{flex-shrink:0;padding-top:2px;position:relative}
          .${p}-check{width:18px;height:18px;border-radius:50%;border:2px solid #d1d5db;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
          .${p}-check:hover{border-color:var(--primary);background:rgba(var(--primary-rgb),.05)}
          .${p}-check.checked{background:var(--success);border-color:var(--success)}
          .${p}-check-icon{display:none}
          .${p}-check.checked .${p}-check-icon{display:block}
          .${p}-card-body{flex:1;min-width:0}
          .${p}-card-top{display:flex;align-items:center;gap:7px;margin-bottom:4px;flex-wrap:wrap}
          .${p}-type-badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;line-height:1.4;letter-spacing:.5px;text-transform:uppercase;color:#fff;flex-shrink:0}
          .${p}-prio-badge{display:inline-flex;align-items:center;padding:1.5px 7px;border-radius:4px;font-size:10px;font-weight:700;line-height:1.4;letter-spacing:.3px;flex-shrink:0;border:1.5px solid currentColor}
          .${p}-recur-badge{display:inline-flex;align-items:center;gap:3px;padding:3px 7px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.3px;flex-shrink:0;text-transform:uppercase;background:rgba(var(--primary-rgb),.1);color:var(--primary)}
          .${p}-recur-badge svg{width:9px;height:9px}
          .${p}-card-title{font-size:14px;font-weight:700;color:var(--dark);line-height:1.3;word-break:break-word;transition:color .3s ease}
          .${p}-card.done .${p}-card-title{color:var(--gray)}
          .${p}-card-title>span{position:relative;display:inline}
          .${p}-card-title>span::after{content:"";position:absolute;left:0;top:50%;height:1.5px;background:var(--gray);width:0;transform:translateY(-50%);transition:width .35s ease;display:block}
          .${p}-card.done .${p}-card-title>span::after{width:100%}
          .${p}-card-desc{font-size:12px;color:var(--gray);margin-top:3px;line-height:1.45;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
          .${p}-card-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:7px;align-items:center}
          .${p}-meta-item{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--gray-lt)}
          .${p}-meta-item svg{flex-shrink:0}
          .${p}-meta-item.overdue{color:var(--error);font-weight:600}
          @keyframes ${p}-check-pop{0%{transform:scale(1)}35%{transform:scale(1.35);box-shadow:0 0 0 6px rgba(var(--primary-rgb),.12)}65%{transform:scale(.88)}100%{transform:scale(1);box-shadow:none}}
          @keyframes ${p}-uncheck-pop{0%{transform:scale(1)}40%{transform:scale(1.2)}100%{transform:scale(1)}}
          .${p}-check.pop-done{animation:${p}-check-pop .38s cubic-bezier(.34,1.56,.64,1) forwards}
          .${p}-check.pop-undone{animation:${p}-uncheck-pop .28s cubic-bezier(.34,1.56,.64,1) forwards}
          @keyframes ${p}-spark{0%{transform:scale(0) translate(0,0);opacity:1}100%{transform:scale(1) translate(var(--tx),var(--ty));opacity:0}}
          .${p}-spark{position:absolute;width:5px;height:5px;border-radius:50%;pointer-events:none;animation:${p}-spark .5s ease-out forwards}
          /* Staggered list entrance (first render only) */
          @keyframes ${p}-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
          .${p}-list.intro>*{animation:${p}-rise .42s cubic-bezier(.22,1,.36,1) both}
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `.${p}-list.intro>*:nth-child(${n}){animation-delay:${(n - 1) * 0.05}s}`).join("")}
          .${p}-list.intro>*:nth-child(n+11){animation-delay:.5s}
          /* Comment entrance */
          @keyframes ${p}-cmt-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
          .${p}-cmt-item{animation:${p}-cmt-in .32s ease both}
          ${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `.${p}-cmt-list .${p}-cmt-item:nth-child(${n}){animation-delay:${(n - 1) * 0.04}s}`).join("")}
          @media (prefers-reduced-motion:reduce){.${p}-list.intro>*,.${p}-cmt-item{animation:none!important}}
          /* ── Audit result card ── */
          .${p}-audit-card{border-radius:var(--r-lg);padding:16px;margin-bottom:12px;border:1px solid}
          .${p}-audit-card.pass{background:rgba(46,125,74,.05);border-color:rgba(46,125,74,.25)}
          .${p}-audit-card.fail{background:rgba(196,30,58,.05);border-color:rgba(196,30,58,.25)}
          .${p}-audit-card-score{font-size:36px;font-weight:800;line-height:1}
          .${p}-audit-card-meta{font-size:12px;color:var(--gray);display:flex;flex-direction:column;gap:4px;margin-top:10px}
          .${p}-audit-card-meta span{display:flex;align-items:center;gap:5px}
          .${p}-audit-card{cursor:pointer;transition:transform .12s,box-shadow .15s;-webkit-tap-highlight-color:transparent}
          .${p}-audit-card:hover{box-shadow:var(--shadow-md)}
          .${p}-audit-card:active{transform:scale(.99)}
          .${p}-audit-card-cta{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:13px;padding-top:11px;border-top:1px solid rgba(0,0,0,.07);font-size:12px;font-weight:700;color:var(--gray)}
          .${p}-reassign{margin-top:8px;position:relative}
          .${p}-reassign-btn{display:inline-flex!important;width:auto!important;margin:0!important;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--primary);background:rgba(var(--primary-rgb),.07)!important;border:none!important;border-radius:var(--r-sm);cursor:pointer;font-family:inherit;padding:6px 11px!important;line-height:normal!important}
          .${p}-reassign-btn:hover{background:rgba(var(--primary-rgb),.13)!important}
          .${p}-reassign-pop{margin-top:8px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fff;box-shadow:var(--shadow-md);overflow:hidden}
          .${p}-reassign-search{width:100%;border:none;border-bottom:1px solid var(--border);padding:10px 12px;font-family:inherit;font-size:13px;color:var(--dark);background:#fafafa}
          .${p}-reassign-search:focus{outline:none;background:#fff}
          .${p}-reassign-results{max-height:240px;overflow-y:auto}
          .${p}-reassign-h{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray-lt);padding:8px 12px 4px}
          .${p}-reassign-opt{display:flex;align-items:center;gap:8px;padding:9px 12px;font-size:13px;color:var(--dark);cursor:pointer}
          .${p}-reassign-opt:hover{background:rgba(var(--primary-rgb),.06)}
          .${p}-reassign-opt span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .${p}-reassign-opt.unassign{color:var(--error);border-top:1px solid var(--border);font-weight:600}
          .${p}-reassign-opt .${p}-ck{margin-inline-start:auto;color:var(--success);display:none;flex-shrink:0}
          .${p}-reassign-opt.sel{background:rgba(var(--primary-rgb),.06)}
          .${p}-reassign-opt.sel .${p}-ck{display:flex}
          .${p}-reassign-opt.sel span:first-of-type{font-weight:600}
          .${p}-reassign-empty{padding:9px 12px;font-size:12px;color:var(--gray-lt)}
          .${p}-reassign-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-top:1px solid var(--border);background:#fafafa}
          .${p}-reassign-sel{font-size:11px;color:var(--gray);font-weight:600}
          .${p}-reassign-save,.${p}-reassign-clear{width:auto!important;margin:0!important;font-family:inherit;font-size:12px;font-weight:700;border-radius:var(--r-sm);cursor:pointer;padding:6px 12px!important;border:none!important;line-height:normal!important}
          .${p}-reassign-save{background:var(--primary)!important;color:var(--primary-text)!important}
          .${p}-reassign-save:disabled{opacity:.5;cursor:default}
          .${p}-reassign-clear{background:transparent!important;color:var(--gray)!important}
          .${p}-reassign-clear:hover{color:var(--error)!important}
          .${p}-audit-detail-score{font-size:52px;font-weight:800;line-height:1;letter-spacing:-1px}
          .${p}-audit-detail-sub{font-size:14px;font-weight:700;margin:4px 0 16px}
          .${p}-detail.audit-view .${p}-detail-foot{display:none}
          .${p}-detail.audit-view .${p}-detail-body{padding-bottom:44px}
          .${p}-cat-chart{display:flex;flex-direction:column;gap:10px;margin-top:13px}
          .${p}-cat-top{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;margin-bottom:4px}
          .${p}-cat-name{color:var(--dark);font-weight:400}
          .${p}-cat-pct{color:var(--gray);font-weight:700;flex-shrink:0;margin-inline-start:8px}
          .${p}-cat-bar{height:7px;background:rgba(0,0,0,.08);border-radius:4px;overflow:hidden}
          .${p}-cat-fill{display:block;height:100%;border-radius:4px;transition:width .45s ease}
          .${p}-cat-fill.hi{background:var(--success)}
          .${p}-cat-fill.mid{background:#d97706}
          .${p}-cat-fill.lo{background:var(--error)}
          /* ── Assignee tab toggle in detail ── */
          .${p}-assign-tabs{display:flex;gap:4px;margin:8px 0}
          .${p}-assign-tab{flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:12px;font-weight:600;background:#f9fafb;color:var(--gray);cursor:pointer;text-align:center;transition:all .15s;font-family:inherit}
          .${p}-assign-tab.active{background:var(--primary);color:var(--primary-text);border-color:var(--primary)}
          /* Neutralize Staffbase's global blue/red button hover/focus/active background
             on our chrome buttons (their rules aren't !important, so this wins). */
          .${p}-assign-tab,.${p}-assign-tab:hover,.${p}-assign-tab:focus{background:#f9fafb!important;color:var(--gray)!important}
          .${p}-assign-tab.active,.${p}-assign-tab.active:hover,.${p}-assign-tab.active:focus{background:var(--primary)!important;color:var(--primary-text)!important}
          .${p}-refresh-btn,.${p}-refresh-btn:focus{background:#fff!important}
          .${p}-refresh-btn:hover{background:rgba(var(--primary-rgb),.05)!important}
          .${p}-detail-close,.${p}-detail-close:hover,.${p}-detail-close:focus,.${p}-create-close,.${p}-create-close:hover,.${p}-create-close:focus{background:#f3f4f6!important;color:var(--gray)!important}
          .${p}-other-toggle,.${p}-other-toggle:hover,.${p}-other-toggle:focus{background:none!important}
          .${p}-reassign-btn,.${p}-reassign-btn:focus{background:rgba(var(--primary-rgb),.07)!important}
          .${p}-reassign-btn:hover{background:rgba(var(--primary-rgb),.13)!important}
          .${p}-status-opt,.${p}-status-opt:hover,.${p}-status-opt:focus{background:none!important}
          .${p}-status-opt.active,.${p}-status-opt.active:hover,.${p}-status-opt.active:focus{background:var(--primary)!important;color:var(--primary-text)!important}
          .${p}-type-btn,.${p}-type-btn:hover,.${p}-type-btn:focus,.${p}-type-btn.open{background:#fff!important}
          .${p}-type-opt,.${p}-type-opt:focus{background:none!important}
          .${p}-type-opt:hover{background:rgba(0,0,0,.04)!important}
          .${p}-type-opt.active,.${p}-type-opt.active:hover,.${p}-type-opt.active:focus{background:rgba(var(--primary-rgb),.06)!important}
          .${p}-detail-toggle-btn.done-btn,.${p}-detail-toggle-btn.done-btn:focus{background:rgba(var(--primary-rgb),.08)!important}
          .${p}-detail-toggle-btn.done-btn:hover{background:var(--primary)!important;color:var(--primary-text)!important}
          /* Faded-accent click feedback on the primary CTAs (replaces host blue :active) */
          .${p}-new-btn:active,.${p}-btn-save:active,.${p}-cmt-send:active{background:rgba(var(--accent-rgb),.85)!important;color:#fff!important;filter:none!important}
          /* Pin text/icon color so the host button color:#fff rules can't whiten light buttons */
          .${p}-status-opt:not(.active),.${p}-status-opt:not(.active):hover,.${p}-status-opt:not(.active):focus,.${p}-status-opt:not(.active):active,
          .${p}-type-opt:not(.active),.${p}-type-opt:not(.active):focus,.${p}-type-opt:not(.active):active,
          .${p}-audit-arrow,.${p}-audit-arrow:hover,.${p}-audit-arrow:focus,.${p}-audit-arrow:active,
          .${p}-amodal-x,.${p}-amodal-x:hover,.${p}-amodal-x:focus,.${p}-amodal-x:active{color:var(--gray)!important}
          .${p}-type-btn,.${p}-type-btn:focus,.${p}-type-btn:active{color:var(--gray)!important}
          .${p}-type-btn:hover,.${p}-type-btn.open{color:var(--accent)!important}
          .${p}-type-opt:hover,.${p}-type-opt.active{color:var(--dark)!important}
          .${p}-other-toggle,.${p}-other-toggle:hover,.${p}-other-toggle:focus,.${p}-other-toggle:active{color:var(--gray-lt)!important}
          .${p}-reassign-btn,.${p}-reassign-btn:hover,.${p}-reassign-btn:focus,.${p}-reassign-btn:active{color:var(--primary)!important}
          .${p}-detail-toggle-btn.open-btn,.${p}-detail-toggle-btn.open-btn:focus{background:#f3f4f6!important}
          .${p}-detail-toggle-btn.open-btn:hover{background:var(--border)!important;color:var(--dark)!important}
          .${p}-reassign-opt,.${p}-reassign-opt:focus{background:none!important}
          .${p}-reassign-opt:hover{background:rgba(var(--primary-rgb),.06)!important}
          .${p}-dbg-btn,.${p}-dbg-btn:hover,.${p}-dbg-btn:focus{background:#21262d!important}
          .${p}-dbg-btn:active{background:var(--primary)!important}
          /* ── States ── */
          .${p}-state{padding:40px 20px;text-align:center;color:var(--gray-lt);font-size:13px;line-height:1.6}
          .${p}-state-icon{font-size:32px;margin-bottom:8px;display:block}
          .${p}-state strong{color:var(--gray);display:block;font-size:14px;margin-bottom:4px}
          .${p}-banner{display:none;padding:10px 14px;border-radius:var(--r-md);margin-bottom:12px;font-size:13px;line-height:1.5}
          .${p}-banner.error{background:rgba(196,30,58,.08);border:1px solid rgba(196,30,58,.25);color:var(--error)}
          .${p}-banner.info{background:rgba(var(--primary-rgb),.06);border:1px solid rgba(var(--primary-rgb),.2);color:var(--primary)}
          .${p}-section-label{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-lt);padding:4px 0 8px;margin-top:4px}
          /* ── Ghost cards (other audit tasks) ── */
          .${p}-card.ghost{opacity:.55;border-inline-start-color:var(--border)}
          .${p}-card.ghost:hover{opacity:.8}
          .${p}-other-toggle{width:100%;padding:9px 14px;background:none;border:1.5px dashed var(--border);border-radius:var(--r-md);font-size:12px;font-weight:600;color:var(--gray-lt);cursor:pointer;text-align:center;font-family:inherit;transition:all .15s;touch-action:manipulation;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:6px}
          .${p}-other-toggle:hover{border-color:var(--gray);color:var(--gray)}
        
          /* RTL: flip horizontal directional arrows */
          [dir="rtl"] .mtw-audit-arrow svg{transform:scaleX(-1)}
          ${limitCss}
        </style>

        <div class="${p}${limitHeight ? ` ${p}-limited` : ""}">
          <div class="${p}-header">
            <div class="${p}-title">
              <span class="${p}-title-dot"></span>
              <span id="${p}-title-text">${auditMode ? tr("auditResults") : tr("myTasks")}</span>
              <span class="${p}-badge-count" id="${p}-count">0</span>
            </div>
            <div class="${p}-header-actions">
              ${allowCreate && !auditMode ? `<button type="button" class="${p}-new-btn" id="${p}-new" title="${tr("newTask")}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span id="${p}-new-label">${tr("newTask")}</span></button>` : ""}
              <button type="button" class="${p}-refresh-btn" id="${p}-translate" title="${tr("translateBtn")}" style="display:none;width:auto;padding:0 10px;gap:5px">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/></svg>
                <span id="${p}-translate-lbl"></span>
              </button>
              <button type="button" class="${p}-refresh-btn" id="${p}-refresh" title="${tr("refresh")}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            </div>
          </div>

          ${auditMode ? `<div class="${p}-audit-tab-wrap" id="${p}-audit-tab-wrap" style="display:none">
            <div class="${p}-audit-tab-label" id="${p}-audit-tab-label">${tr("auditHistory")}</div>
            <div class="${p}-audit-scroll">
              <button type="button" class="${p}-audit-arrow" id="${p}-audit-prev" aria-label="${tr("scrollLeft")}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
              <div class="${p}-audit-tabs" id="${p}-audit-tabs"></div>
              <button type="button" class="${p}-audit-arrow" id="${p}-audit-next" aria-label="${tr("scrollRight")}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
            </div>
          </div>` : ""}

          <div class="${p}-store-tabs" id="${p}-store-tabs" style="display:none"></div>
          <div class="${p}-banner" id="${p}-banner"></div>

          ${!auditMode ? `
          <div class="${p}-filters">
            <div class="${p}-type-wrap" id="${p}-type-wrap">
              <button type="button" class="${p}-type-btn" id="${p}-type-btn">
                <span id="${p}-type-label">${tr("allTypes")}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="${p}-type-menu" id="${p}-type-menu"></div>
            </div>
            <div class="${p}-status-toggle">
              <button type="button" class="${p}-status-opt active" data-status="open">${tr("open")}</button>
              <button type="button" class="${p}-status-opt" data-status="done">${tr("done")}</button>
              ${showDone ? `<button type="button" class="${p}-status-opt" data-status="all">${tr("both")}</button>` : ""}
            </div>
          </div>` : ""}

          <div id="${p}-list-wrap">
            <div class="${p}-state">
              <span class="${p}-spin" style="width:24px;height:24px;border-width:3px;margin:0 auto 12px;display:block"></span>
              Loading…
            </div>
          </div>
        </div>
      `;
                // ── DOM refs ──────────────────────────────────────────────────────
                const countEl = container.querySelector(`#${p}-count`);
                const bannerEl = container.querySelector(`#${p}-banner`);
                const storeTabs = container.querySelector(`#${p}-store-tabs`);
                const listWrap = container.querySelector(`#${p}-list-wrap`);
                const refreshBtn = container.querySelector(`#${p}-refresh`);
                const typeBtn = !auditMode ? container.querySelector(`#${p}-type-btn`) : null;
                const typeLabelEl = !auditMode ? container.querySelector(`#${p}-type-label`) : null;
                const typeMenu = !auditMode ? container.querySelector(`#${p}-type-menu`) : null;
                const auditTabWrap = auditMode ? container.querySelector(`#${p}-audit-tab-wrap`) : null;
                const auditTabsEl = auditMode ? container.querySelector(`#${p}-audit-tabs`) : null;
                const auditPrev = auditMode ? container.querySelector(`#${p}-audit-prev`) : null;
                const auditNext = auditMode ? container.querySelector(`#${p}-audit-next`) : null;
                function updateAuditArrows() {
                    if (!auditTabsEl || !auditPrev || !auditNext)
                        return;
                    const max = auditTabsEl.scrollWidth - auditTabsEl.clientWidth;
                    const overflow = max > 4;
                    auditPrev.classList.toggle("show", overflow && auditTabsEl.scrollLeft > 2);
                    auditNext.classList.toggle("show", overflow && auditTabsEl.scrollLeft < max - 2);
                }
                if (auditTabsEl && auditPrev && auditNext) {
                    const step = () => Math.max(160, auditTabsEl.clientWidth * 0.7);
                    auditPrev.addEventListener("click", () => auditTabsEl.scrollBy({ left: -step(), behavior: "smooth" }));
                    auditNext.addEventListener("click", () => auditTabsEl.scrollBy({ left: step(), behavior: "smooth" }));
                    auditTabsEl.addEventListener("scroll", updateAuditArrows, { passive: true });
                    window.addEventListener("resize", updateAuditArrows);
                }
                // Detail panel — appended to body so position:fixed works in Staffbase.
                // Body-appended elements + document listeners don't get cleaned up on
                // SPA navigation when the host element is removed, so we manage their
                // lifecycle explicitly via refs stashed on `this`.
                const self = this;
                // Tear down artifacts from a previous render of this same host (re-renders)
                if (self._mtwOverlay) {
                    self._mtwOverlay.remove();
                    self._mtwOverlay = undefined;
                }
                if (self._mtwDetail) {
                    self._mtwDetail.remove();
                    self._mtwDetail = undefined;
                }
                if (self._mtwAModal) {
                    self._mtwAModal.remove();
                    self._mtwAModal = undefined;
                }
                if (self._mtwCreate) {
                    self._mtwCreate.remove();
                    self._mtwCreate = undefined;
                }
                if (self._mtwDocClick) {
                    document.removeEventListener("click", self._mtwDocClick);
                    self._mtwDocClick = undefined;
                }
                if (self._mtwDocKey) {
                    document.removeEventListener("keydown", self._mtwDocKey);
                    self._mtwDocKey = undefined;
                }
                const instId = Math.random().toString(36).slice(2);
                container.dataset.mtwInst = instId;
                container.dataset.sbPortalHost = instId;
                // Defensive sweep: remove any body-appended portal node — from this or any
                // sibling task widget — whose owning host is no longer in the DOM.
                // disconnectedCallback is unreliable across Staffbase SPA navigation, so a
                // widget that *is* on the page clears stale portals left by pages that aren't.
                document.querySelectorAll("[data-sb-portal]").forEach(node => {
                    const owner = node.getAttribute("data-sb-portal");
                    if (!owner || !document.querySelector(`[data-sb-portal-host="${owner}"]`))
                        node.remove();
                });
                const overlayEl = document.createElement("div");
                overlayEl.className = `${p}-overlay`;
                overlayEl.dataset.mtwInst = instId;
                overlayEl.dataset.sbPortal = instId;
                document.body.appendChild(overlayEl);
                self._mtwOverlay = overlayEl;
                const detailEl = document.createElement("div");
                detailEl.className = `${p}-detail`;
                detailEl.dataset.mtwInst = instId;
                detailEl.dataset.sbPortal = instId;
                detailEl.innerHTML = `
        <div class="${p}-detail-handle"></div>
        <div class="${p}-detail-head">
          <div class="${p}-detail-head-badges" id="${p}-detail-badges-${instId}"></div>
          <button type="button" class="${p}-detail-close" id="${p}-detail-close-${instId}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="${p}-detail-body" id="${p}-detail-body-${instId}"></div>
        <div class="${p}-detail-foot">
          <button type="button" class="${p}-detail-toggle-btn" id="${p}-detail-toggle-${instId}"></button>
        </div>
      `;
                document.body.appendChild(detailEl);
                self._mtwDetail = detailEl;
                const detailBadges = detailEl.querySelector(`#${p}-detail-badges-${instId}`);
                const detailBody = detailEl.querySelector(`#${p}-detail-body-${instId}`);
                const detailToggle = detailEl.querySelector(`#${p}-detail-toggle-${instId}`);
                const detailClose = detailEl.querySelector(`#${p}-detail-close-${instId}`);
                // ── Attachment preview modal (images + PDFs) ───────────────────────
                const attModal = document.createElement("div");
                attModal.className = `${p}-amodal`;
                attModal.innerHTML = `
        <div class="${p}-amodal-card">
          <div class="${p}-amodal-head">
            <span class="${p}-amodal-name" id="${p}-amodal-name-${instId}"></span>
            <button type="button" class="${p}-amodal-dl" id="${p}-amodal-dl-${instId}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>
            <button type="button" class="${p}-amodal-x" id="${p}-amodal-x-${instId}" aria-label="Close"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="${p}-amodal-body" id="${p}-amodal-body-${instId}"></div>
        </div>`;
                attModal.dataset.sbPortal = instId;
                document.body.appendChild(attModal);
                self._mtwAModal = attModal;
                const aName = attModal.querySelector(`#${p}-amodal-name-${instId}`);
                const aBody = attModal.querySelector(`#${p}-amodal-body-${instId}`);
                const aDl = attModal.querySelector(`#${p}-amodal-dl-${instId}`);
                const aX = attModal.querySelector(`#${p}-amodal-x-${instId}`);
                let dlUrl = "", dlName = "";
                // previewUrl = the reliable thumbnail (full image for pics, page-1 image for PDFs);
                // downloadUrl = best-effort original. kind: img | pdf | other.
                function openAttModal(previewUrl, downloadUrl, name, kind) {
                    dlUrl = downloadUrl || previewUrl;
                    dlName = name || "file";
                    aName.textContent = dlName;
                    const none = `<div class="${p}-amodal-none"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${tr("noPreview")}</span></div>`;
                    if (kind === "pdf" && downloadUrl) {
                        // Native PDF viewer via <object> on the derived .pdf (same URL the app uses); iframe fallback.
                        aBody.innerHTML = `<object class="${p}-amodal-pdf" data="${esc(downloadUrl)}" type="application/pdf"><iframe src="${esc(downloadUrl)}" title="${esc(dlName)}"></iframe></object>`;
                    }
                    else if (kind === "img") {
                        aBody.innerHTML = `<img alt="${esc(dlName)}">`;
                        const img = aBody.querySelector("img");
                        img.src = downloadUrl || previewUrl;
                        // Fall back to the thumbnail if the full-res derived URL fails to load.
                        img.onerror = () => { if (previewUrl && img.getAttribute("src") !== previewUrl) {
                            img.src = previewUrl;
                        } };
                    }
                    else {
                        aBody.innerHTML = none;
                    }
                    attModal.classList.add("open");
                }
                function closeAttModal() { attModal.classList.remove("open"); aBody.innerHTML = ""; }
                aX.addEventListener("click", closeAttModal);
                attModal.addEventListener("click", e => { if (e.target === attModal)
                    closeAttModal(); });
                aDl.addEventListener("click", () => my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                    if (!dlUrl)
                        return;
                    const name = dlName;
                    try {
                        const res = yield fetch(dlUrl);
                        const blob = yield res.blob();
                        const navAny = navigator;
                        const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
                        // On mobile, the native share sheet offers "Save Image" / "Save to Files".
                        if (navAny.canShare && navAny.canShare({ files: [file] })) {
                            yield navAny.share({ files: [file], title: name });
                            return;
                        }
                        const obj = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = obj;
                        a.download = name;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        setTimeout(() => URL.revokeObjectURL(obj), 5000);
                    }
                    catch (_) {
                        window.open(dlUrl, "_blank");
                    }
                }));
                // Delegated: clicking any attachment in the detail body opens the preview modal.
                detailBody.addEventListener("click", e => {
                    const a = e.target.closest("[data-att-url]");
                    if (!a)
                        return;
                    e.preventDefault();
                    openAttModal(a.dataset.attPreview || a.dataset.attUrl || "", a.dataset.attUrl || "", a.dataset.attName || "file", a.dataset.attKind || "other");
                });
                // ── Drag-to-dismiss the bottom sheet (mobile) ──────────────────────
                (function setupSheetDrag() {
                    let startY = 0, dy = 0, dragging = false;
                    const begin = (y) => { if (detailEl.classList.contains("side"))
                        return; dragging = true; startY = y; dy = 0; detailEl.style.transition = "none"; };
                    const move = (y) => { if (!dragging)
                        return; dy = Math.max(0, y - startY); detailEl.style.transform = `translateY(${dy}px)`; overlayEl.style.opacity = String(Math.max(0, 1 - dy / 420)); };
                    const end = () => { if (!dragging)
                        return; dragging = false; detailEl.style.transition = ""; detailEl.style.transform = ""; overlayEl.style.opacity = ""; if (dy > 110)
                        closeDetail(); };
                    [`.${p}-detail-handle`, `.${p}-detail-head`].forEach(sel => {
                        const el = detailEl.querySelector(sel);
                        if (!el)
                            return;
                        el.addEventListener("touchstart", (e) => begin(e.touches[0].clientY), { passive: true });
                        el.addEventListener("touchmove", (e) => { move(e.touches[0].clientY); if (dragging && dy > 0)
                            e.preventDefault(); }, { passive: false });
                        el.addEventListener("touchend", end);
                        el.addEventListener("touchcancel", end);
                    });
                })();
                // ── Helpers ───────────────────────────────────────────────────────
                const apiOpts = (extra) => (Object.assign(Object.assign({}, extra), { credentials: "omit", headers: { Authorization: `Basic ${apiToken}`, "Content-Type": "application/json" } }));
                function esc(s) { return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
                function showBanner(type, msg) { bannerEl.className = `${p}-banner ${type}`; bannerEl.style.display = "block"; bannerEl.textContent = msg; }
                function hideBanner() { bannerEl.style.display = "none"; }
                // ── On-screen debug log (for mobile webview where console is hidden) ──
                const debugLog = [];
                let debugBodyEl = null;
                function dlog(...args) {
                    const ts = new Date().toISOString().slice(11, 23);
                    const line = ts + " " + args.map(a => {
                        if (typeof a === "string")
                            return a;
                        try {
                            return JSON.stringify(a);
                        }
                        catch (_) {
                            return String(a);
                        }
                    }).join(" ");
                    debugLog.push(line);
                    if (debugLog.length > 500)
                        debugLog.shift();
                    try {
                        console.log("[mtw]", ...args);
                    }
                    catch (_) { }
                    if (debugBodyEl) {
                        debugBodyEl.textContent = debugLog.join("\n");
                        debugBodyEl.scrollTop = debugBodyEl.scrollHeight;
                    }
                }
                function buildDebugPanel() {
                    if (!debugMode)
                        return;
                    const panel = document.createElement("div");
                    panel.className = `${p}-dbg`;
                    panel.innerHTML = `
          <div class="${p}-dbg-bar">
            <span class="${p}-dbg-title">${tr("debug")}</span>
            <div class="${p}-dbg-actions">
              <button type="button" class="${p}-dbg-btn" data-act="copy">${tr("copy")}</button>
              <button type="button" class="${p}-dbg-btn" data-act="clear">${tr("clear")}</button>
              <button type="button" class="${p}-dbg-btn" data-act="toggle">${tr("hide")}</button>
            </div>
          </div>
          <pre class="${p}-dbg-body"></pre>`;
                    document.body.appendChild(panel);
                    debugBodyEl = panel.querySelector(`.${p}-dbg-body`);
                    const body = debugBodyEl;
                    const copyBtn = panel.querySelector(`[data-act="copy"]`);
                    panel.querySelector(`[data-act="clear"]`).addEventListener("click", () => { debugLog.length = 0; if (body)
                        body.textContent = ""; });
                    panel.querySelector(`[data-act="toggle"]`).addEventListener("click", (e) => {
                        const collapsed = panel.classList.toggle("collapsed");
                        e.target.textContent = collapsed ? "Show" : "Hide";
                    });
                    copyBtn.addEventListener("click", () => my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        const text = debugLog.join("\n");
                        let ok = false;
                        try {
                            yield navigator.clipboard.writeText(text);
                            ok = true;
                        }
                        catch (_) {
                            // Fallback for webviews without async clipboard.
                            try {
                                const ta = document.createElement("textarea");
                                ta.value = text;
                                ta.style.position = "fixed";
                                ta.style.opacity = "0";
                                document.body.appendChild(ta);
                                ta.focus();
                                ta.select();
                                ok = document.execCommand("copy");
                                document.body.removeChild(ta);
                            }
                            catch (_) {
                                ok = false;
                            }
                        }
                        copyBtn.textContent = ok ? tr("copied") : tr("copyFailed");
                        setTimeout(() => { copyBtn.textContent = tr("copy"); }, 1500);
                    }));
                    dlog("debug panel ready · origin", location.origin, "· comments", enableComments);
                }
                buildDebugPanel();
                function formatDate(iso) {
                    if (!iso)
                        return { text: "", overdue: false };
                    const datePart = iso.split("T")[0];
                    if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart))
                        return { text: "", overdue: false };
                    const [year, month, day] = datePart.split("-").map(Number);
                    const d = new Date(year, month - 1, day);
                    if (isNaN(d.getTime()))
                        return { text: "", overdue: false };
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    const overdue = d < now;
                    let text;
                    try {
                        text = d.toLocaleDateString(locale.replace("_", "-"), { month: "short", day: "numeric", year: "numeric" });
                    }
                    catch (_) {
                        text = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    }
                    return { text, overdue };
                }
                function groupName(id) { return groupMap.get(id) || id; }
                // ── Attachments (Staffbase media TUS upload) ──────────────────────
                const MEDIA_MAX = 25 * 1024 * 1024; // 25 MB
                function humanSize(b) {
                    if (b < 1024)
                        return `${b} B`;
                    if (b < 1048576)
                        return `${(b / 1024).toFixed(0)} KB`;
                    return `${(b / 1048576).toFixed(1)} MB`;
                }
                function b64utf8(s) {
                    let out = "";
                    const bytes = new TextEncoder().encode(s);
                    for (const byte of bytes)
                        out += String.fromCharCode(byte);
                    return btoa(out);
                }
                // Upload a File to Staffbase media via the resumable TUS protocol.
                function uploadMedia(file) {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        var _a, _b, _c, _d;
                        const create = yield fetch(`${baseUrl}/media/tus`, {
                            method: "POST", credentials: "omit",
                            headers: {
                                Authorization: `Basic ${apiToken}`,
                                "Tus-Resumable": "1.0.0",
                                "Upload-Length": String(file.size),
                                "Upload-Metadata": `filename ${b64utf8(file.name)},filetype ${b64utf8(file.type || "application/octet-stream")}`,
                            },
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
                            const res = yield fetch(loc, {
                                method: "PATCH", credentials: "omit",
                                headers: {
                                    Authorization: `Basic ${apiToken}`,
                                    "Tus-Resumable": "1.0.0",
                                    "Upload-Offset": String(offset),
                                    "Content-Type": "application/offset+octet-stream",
                                },
                                body: buf.slice(offset, end),
                            });
                            if (!res.ok)
                                throw new Error(`upload failed (${res.status})`);
                            offset = end;
                            try {
                                media = yield res.clone().json();
                            }
                            catch (_) { }
                        }
                        if (!(media === null || media === void 0 ? void 0 : media.id))
                            throw new Error("no media id returned");
                        const url = ((_a = media.resourceInfo) === null || _a === void 0 ? void 0 : _a.url) || ((_d = (_c = (_b = media.transformations) === null || _b === void 0 ? void 0 : _b.t_preview) === null || _c === void 0 ? void 0 : _c.resourceInfo) === null || _d === void 0 ? void 0 : _d.url) || "";
                        return { id: media.id, url };
                    });
                }
                function mediaMeta(id) {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        try {
                            const r = yield fetch(`${baseUrl}/media/medium/${id}/metadata`, apiOpts());
                            return r.ok ? yield r.json() : null;
                        }
                        catch (_) {
                            return null;
                        }
                    });
                }
                // Best-effort original-file URL: metadata only exposes a `thumbnail` (t_preview), so we
                // derive the original by dropping the transform segment and restoring the file extension.
                function originalUrl(m) {
                    var _a;
                    const t = ((_a = m === null || m === void 0 ? void 0 : m.thumbnail) === null || _a === void 0 ? void 0 : _a.url) || "";
                    if (!t)
                        return "";
                    const ext = ((String((m === null || m === void 0 ? void 0 : m.fileName) || "").match(/\.[a-z0-9]+$/i)) || [])[0] || ((m === null || m === void 0 ? void 0 : m.type) === "pdf" ? ".pdf" : "");
                    let u = t.replace(/\/upload\/[^/]+\//, "/upload/"); // ".../upload/t_preview/<hash>.png" → ".../upload/<hash>.png"
                    if (ext)
                        u = u.replace(/\.[a-z0-9]+($|\?)/i, ext + "$1");
                    return u;
                }
                function attKind(m) {
                    const fn = String((m === null || m === void 0 ? void 0 : m.fileName) || "");
                    const mime = String((m === null || m === void 0 ? void 0 : m.mimeType) || (m === null || m === void 0 ? void 0 : m.contentType) || "").toLowerCase();
                    if (/^image\//.test(mime) || /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(fn))
                        return "img";
                    if (mime.indexOf("pdf") >= 0 || (m === null || m === void 0 ? void 0 : m.type) === "pdf" || /\.pdf$/i.test(fn))
                        return "pdf";
                    return "other";
                }
                const iClip = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
                const iFileGeneric = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
                const iXsmall = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
                const iSend = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
                // ── Comments (user-session auth; NOT the Basic token) ──────────────
                // Comments must be attributed to a person, so the POST uses the logged-in
                // user's session (cookie + CSRF) — see comments.md. We target the real
                // API host (baseUrl), NOT location.origin: on mobile the app runs under a
                // capacitor:// origin, where location.origin/api hits the local app shell
                // and returns index.html instead of reaching Staffbase.
                function readCsrf() {
                    var _a, _b;
                    // Confirmed source (web + mobile widget context): window.we.authMgr.csrfToken.
                    const w = window;
                    try {
                        const t = (_b = (_a = w.we) === null || _a === void 0 ? void 0 : _a.authMgr) === null || _b === void 0 ? void 0 : _b.csrfToken;
                        if (t)
                            return String(t);
                    }
                    catch (_) { }
                    if (w.csrfToken)
                        return String(w.csrfToken);
                    const m = document.cookie.match(/(?:^|;\s*)(?:csrf|XSRF-TOKEN|csrftoken)=([^;]+)/i);
                    if (m)
                        return decodeURIComponent(m[1]);
                    const meta = document.querySelector('meta[name="csrf-token"]');
                    return (meta === null || meta === void 0 ? void 0 : meta.content) || "";
                }
                function sessionOpts(extra) {
                    const csrf = readCsrf();
                    return Object.assign(Object.assign({}, extra), { credentials: "include", headers: Object.assign(Object.assign({}, (csrf ? { "x-csrf-token": csrf } : {})), ((extra === null || extra === void 0 ? void 0 : extra.headers) || {})) });
                }
                const CMT_CREATE_CT = "application/vnd.staffbase.tasks.comment-create.v1+json";
                const CMT_HTML_ACCEPT = "application/vnd.staffbase.tasks.comment.html-content.v1+json";
                // Build the Designer content document the create endpoint expects.
                function commentDoc(text) {
                    const html = `<p>${esc(text)}</p>`;
                    // `config` carries the visible text. Exact key is still being
                    // confirmed in-app (see comments.md); send the likely variants.
                    return { blocks: { b1: { type: "text", children: [], config: { html, text } } }, content: ["b1"] };
                }
                // Reading comments works with the Basic token (confirmed). Only the
                // POST needs the user session, so the read uses the token path here.
                function loadComments(task) {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        const url = `${baseUrl}/tasks/${task.installationId}/task/${task.id}/comments${currentUserId ? `?viewedBy=${currentUserId}` : ""}`;
                        dlog("GET comments", url);
                        const r = yield fetch(url, apiOpts({ headers: { Accept: CMT_HTML_ACCEPT } }));
                        const raw = yield r.text();
                        dlog("GET comments ←", r.status, raw.slice(0, 400));
                        if (!r.ok)
                            throw new Error(`HTTP ${r.status}`);
                        let d;
                        try {
                            d = JSON.parse(raw);
                        }
                        catch (_) {
                            d = [];
                        }
                        const arr = Array.isArray(d) ? d : (d.data || []);
                        // Hide the widget's own hidden [tasks:edit] audit comments (they only feed
                        // the Manager Tasks activity feed).
                        return arr.filter(c => !isEditCommentText(commentText(c).replace(/<[^>]+>/g, " ")));
                    });
                }
                // User lookup (for avatars + names on comments), cached.
                const userCache = new Map();
                function fetchUser(id) {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        var _a, _b, _c, _d, _e, _f;
                        if (!id)
                            return { name: "User", avatar: "" };
                        const hit = userCache.get(id);
                        if (hit)
                            return hit;
                        let info = { name: "User", avatar: "" };
                        try {
                            const r = yield fetch(`${baseUrl}/users/${id}`, apiOpts());
                            if (r.ok) {
                                const u = yield r.json();
                                const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.userName || "User";
                                const avatar = ((_b = (_a = u.avatar) === null || _a === void 0 ? void 0 : _a.icon) === null || _b === void 0 ? void 0 : _b.url) || ((_d = (_c = u.avatar) === null || _c === void 0 ? void 0 : _c.thumb) === null || _d === void 0 ? void 0 : _d.url) || ((_f = (_e = u.avatar) === null || _e === void 0 ? void 0 : _e.original) === null || _f === void 0 ? void 0 : _f.url) || "";
                                info = { name, avatar };
                            }
                        }
                        catch (_) { }
                        userCache.set(id, info);
                        return info;
                    });
                }
                function fetchUsers() {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        if (usersList)
                            return usersList;
                        try {
                            const r = yield fetch(`${baseUrl}/users?limit=200`, apiOpts());
                            if (r.ok) {
                                const d = yield r.json();
                                usersList = (d.data || d || []).map((u) => ({ id: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.userName || u.id }));
                            }
                            else
                                usersList = [];
                        }
                        catch (_) {
                            usersList = [];
                        }
                        return usersList;
                    });
                }
                // Reassign picker (audit mode). Searchable groups + people; PATCHes the task.
                function wireReassign(task) {
                    const root = detailBody.querySelector(`#${p}-reassign-${instId}`);
                    if (!root)
                        return;
                    const btn = root.querySelector(`.${p}-reassign-btn`);
                    const pop = root.querySelector(`.${p}-reassign-pop`);
                    const search = root.querySelector(`.${p}-reassign-search`);
                    const results = root.querySelector(`.${p}-reassign-results`);
                    const selLbl = root.querySelector(`.${p}-reassign-sel`);
                    const saveBtn = root.querySelector(`.${p}-reassign-save`);
                    const clearBtn = root.querySelector(`.${p}-reassign-clear`);
                    const gIco = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
                    const uIco = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                    const ckIco = `<svg class="${p}-ck" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                    // Multi-select: seed from the task's current assignment, toggle on click,
                    // PATCH both arrays together on Save (the API accepts multiples).
                    const selUsers = new Set(task.assigneeIds);
                    const selGroups = new Set(task.groupIds);
                    const groupsArr = () => { const o = []; groupMap.forEach((name, id) => o.push({ id, name })); return o.sort((a, b) => a.name.localeCompare(b.name)); };
                    const updateFoot = () => { const n = selUsers.size + selGroups.size; selLbl.textContent = n ? tr("nSelected").replace("{n}", String(n)) : tr("noneSelected"); };
                    const renderResults = (q) => {
                        const ql = q.trim().toLowerCase();
                        const groups = groupsArr().filter(g => !ql || g.name.toLowerCase().includes(ql)).slice(0, 30);
                        const users = (usersList || []).filter(u => !ql || u.name.toLowerCase().includes(ql)).slice(0, 30);
                        let html = "";
                        if (groups.length) {
                            html += `<div class="${p}-reassign-h">${tr("groups")}</div>` + groups.map(g => `<div class="${p}-reassign-opt${selGroups.has(g.id) ? " sel" : ""}" data-type="group" data-id="${esc(g.id)}">${gIco}<span>${esc(g.name)}</span>${ckIco}</div>`).join("");
                        }
                        html += `<div class="${p}-reassign-h">${tr("people")}</div>` + (users.length ? users.map(u => `<div class="${p}-reassign-opt${selUsers.has(u.id) ? " sel" : ""}" data-type="user" data-id="${esc(u.id)}">${uIco}<span>${esc(u.name)}</span>${ckIco}</div>`).join("") : `<div class="${p}-reassign-empty">${usersList ? tr("noMatches") : tr("loading")}</div>`);
                        results.innerHTML = html;
                        results.querySelectorAll(`.${p}-reassign-opt`).forEach(o => o.addEventListener("click", () => {
                            const el = o;
                            const type = el.dataset.type;
                            const id = el.dataset.id;
                            const set = type === "group" ? selGroups : selUsers;
                            if (set.has(id))
                                set.delete(id);
                            else
                                set.add(id);
                            el.classList.toggle("sel");
                            updateFoot();
                        }));
                    };
                    const apply = () => my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        const prevUsers = new Set(task.assigneeIds), prevGroups = new Set(task.groupIds);
                        const body = { assigneeIds: [...selUsers], groupIds: [...selGroups] };
                        saveBtn.disabled = true;
                        try {
                            const r = yield fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify(body) }));
                            if (!r.ok)
                                throw new Error(`HTTP ${r.status}`);
                            task.groupIds = body.groupIds;
                            task.assigneeIds = body.assigneeIds;
                            // Hidden audit comment (→ Manager activity feed) + notify the newly assigned.
                            const nm = (id) => { var _a; return ((_a = (usersList || []).find(u => u.id === id)) === null || _a === void 0 ? void 0 : _a.name) || groupMap.get(id) || id; };
                            const allNames = [...body.assigneeIds, ...body.groupIds].map(nm);
                            if (detailedLogging)
                                postEditComment(task, `reassigned “${task.title}” to ${allNames.length ? allNames.join(", ") : "no one"}`);
                            const newUsers = body.assigneeIds.filter(id => !prevUsers.has(id));
                            const newGroups = body.groupIds.filter(id => !prevGroups.has(id)).map(id => ({ id, name: groupMap.get(id) || id }));
                            notifyAssigned(newUsers, newGroups, task.title);
                            pop.style.display = "none";
                            hideBanner();
                            renderDetailContent(task);
                            load();
                        }
                        catch (e) {
                            showBanner("error", `Couldn't reassign: ${e.message}`);
                            saveBtn.disabled = false;
                        }
                    });
                    btn.addEventListener("click", () => my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        if (pop.style.display !== "none") {
                            pop.style.display = "none";
                            return;
                        }
                        pop.style.display = "block";
                        renderResults("");
                        search.value = "";
                        updateFoot();
                        search.focus();
                        if (!usersList) {
                            yield fetchUsers();
                            if (detailTask === task)
                                renderResults(search.value);
                        }
                    }));
                    search.addEventListener("input", () => renderResults(search.value));
                    saveBtn.addEventListener("click", apply);
                    clearBtn.addEventListener("click", () => { selUsers.clear(); selGroups.clear(); renderResults(search.value); updateFoot(); });
                }
                function initials(name) {
                    var _a, _b;
                    const parts = name.trim().split(/\s+/);
                    return ((((_a = parts[0]) === null || _a === void 0 ? void 0 : _a[0]) || "") + (((_b = parts[1]) === null || _b === void 0 ? void 0 : _b[0]) || "")).toUpperCase() || "?";
                }
                function avatarHtml(info) {
                    if (info.avatar)
                        return `<img class="${p}-cmt-av" src="${esc(info.avatar)}" alt="${esc(info.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="${p}-cmt-av ${p}-cmt-av-fb" style="display:none">${esc(initials(info.name))}</span>`;
                    return `<span class="${p}-cmt-av ${p}-cmt-av-fb">${esc(initials(info.name))}</span>`;
                }
                function postComment(task, text) {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        const url = `${baseUrl}/tasks/${task.installationId}/task/${task.id}/comments`;
                        const body = JSON.stringify({ content: commentDoc(text) });
                        dlog("POST comment", url, "csrf?", readCsrf() ? "yes" : "no", "body", body);
                        const r = yield fetch(url, sessionOpts({
                            method: "POST",
                            headers: { "Content-Type": CMT_CREATE_CT, Accept: CMT_HTML_ACCEPT },
                            body,
                        }));
                        const raw = yield r.text();
                        // Capture the real shape of the first successful create for tuning.
                        dlog("POST comment ←", r.status, raw.slice(0, 600));
                        if (!r.ok)
                            throw new Error(`HTTP ${r.status}`);
                        try {
                            return JSON.parse(raw);
                        }
                        catch (_) {
                            return null;
                        }
                    });
                }
                // "Chriscelle" / "Chriscelle and Andrea" / "Chriscelle and Andrea, +1 more"
                function ownerLabel(task) {
                    const names = task.assigneeIds.map(id => { var _a; return ((_a = (usersList || []).find(u => u.id === id)) === null || _a === void 0 ? void 0 : _a.name) || id; }).filter(Boolean);
                    if (names.length === 0)
                        return "";
                    if (names.length === 1)
                        return names[0];
                    if (names.length === 2)
                        return `${names[0]} and ${names[1]}`;
                    return `${names[0]} and ${names[1]}, +${names.length - 2} more`;
                }
                // Status-change action text → activity feed. Credits the actor with completing
                // someone else's task when they aren't an assignee, e.g. "completed Chriscelle's task".
                function statusAction(task, newStatus) {
                    const verb = newStatus === "CLOSED" ? "completed" : "reopened";
                    const mine = !!currentUserId && task.assigneeIds.indexOf(currentUserId) !== -1;
                    const owner = ownerLabel(task);
                    return (!mine && owner) ? `${verb} ${owner}'s task “${task.title}”` : `${verb} “${task.title}”`;
                }
                // Hidden audit comment → feeds the Manager Tasks activity feed; suppressed
                // from the visible comment list here. Best-effort (needs the user session).
                function postEditComment(task, action) {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        try {
                            yield postComment(task, `${EDIT_MARK} ${action}`);
                        }
                        catch (_) { }
                    });
                }
                // Notifications to newly-assigned people/groups (Basic token). Users get
                // "You were assigned…"; each group gets a named "Your group X was assigned…".
                function notifyAssigned(userIds, groups, title) {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        if (!notifyOnAssign)
                            return;
                        const send = (ids, text) => my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                            if (!ids.length)
                                return;
                            const content = { en_US: { text } };
                            if (locale && locale !== "en_US")
                                content[locale] = { text };
                            try {
                                yield fetch(`${baseUrl}/branch/notifications`, apiOpts({
                                    method: "POST",
                                    body: JSON.stringify({ accessorIds: ids, channels: ["notificationCenter", "push"], content, icon: { en_US: { type: "font", char: "n" } } }),
                                }));
                            }
                            catch (_) { }
                        });
                        if (userIds.length)
                            yield send(userIds, tr("notifyAssignedText").replace("{title}", title));
                        for (const g of groups)
                            yield send([g.id], tr("notifyGroupAssignedText").replace("{group}", g.name).replace("{title}", title));
                    });
                }
                function commentText(c) {
                    const ct = c.content;
                    if (typeof ct === "string")
                        return ct; // rendered HTML
                    if (ct === null || ct === void 0 ? void 0 : ct.html)
                        return ct.html;
                    // Structured Designer document: pull html/text from its blocks in order.
                    if (ct === null || ct === void 0 ? void 0 : ct.blocks) {
                        const order = Array.isArray(ct.content) ? ct.content : Object.keys(ct.blocks);
                        const parts = order.map((id) => {
                            const b = ct.blocks[id];
                            const cfg = b && b.config || {};
                            return cfg.html || (cfg.text ? `<p>${esc(cfg.text)}</p>` : "");
                        }).filter(Boolean);
                        if (parts.length)
                            return parts.join("");
                    }
                    if (c.text)
                        return c.text;
                    return "";
                }
                function commentTime(iso) {
                    const t = Date.parse(iso);
                    if (isNaN(t))
                        return "";
                    const s = Math.floor((Date.now() - t) / 1000);
                    if (s < 60)
                        return "just now";
                    if (s < 3600)
                        return `${Math.floor(s / 60)}m ago`;
                    if (s < 86400)
                        return `${Math.floor(s / 3600)}h ago`;
                    if (s < 604800)
                        return `${Math.floor(s / 86400)}d ago`;
                    return new Date(t).toLocaleDateString();
                }
                function commentAuthorId(c) {
                    var _a;
                    return c.authorId || c.authorID || ((_a = c.author) === null || _a === void 0 ? void 0 : _a.id) || "";
                }
                // Inline comment attachments: comment text carries [attachment:<id>] tokens.
                const mediaCache = new Map();
                function metaCached(id) {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () { if (mediaCache.has(id))
                        return mediaCache.get(id); const m = yield mediaMeta(id); mediaCache.set(id, m); return m; });
                }
                const ATT_TOKEN = /\[attachment:([A-Za-z0-9]+)\]/g;
                function resolveAttachments(html) {
                    return html.replace(ATT_TOKEN, (_m, id) => {
                        var _a;
                        const meta = mediaCache.get(id);
                        const name = esc((meta === null || meta === void 0 ? void 0 : meta.fileName) || "attachment");
                        const fn = (meta === null || meta === void 0 ? void 0 : meta.fileName) || "attachment";
                        const turl = ((_a = meta === null || meta === void 0 ? void 0 : meta.thumbnail) === null || _a === void 0 ? void 0 : _a.url) || "";
                        const full = originalUrl(meta) || turl;
                        const kind = attKind(meta);
                        const data = `data-att-url="${esc(full)}" data-att-preview="${esc(turl)}" data-att-name="${esc(fn)}" data-att-kind="${kind}"`;
                        if (kind === "img" && turl) {
                            return `<a href="${esc(full)}" target="_blank" rel="noopener" ${data}><img class="${p}-cmt-att-img" src="${esc(turl)}" alt="${name}"></a>`;
                        }
                        return `<a class="${p}-cmt-att" href="${esc(full) || "#"}" target="_blank" rel="noopener" ${data}>${iClip}<span>${name}</span></a>`;
                    });
                }
                // Render the comments list inside the open detail panel.
                function renderComments(task) {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        const list = detailBody.querySelector(`#${p}-cmt-list-${instId}`);
                        if (!list)
                            return;
                        list.innerHTML = `<div class="${p}-cmt-empty">${tr("loading")}</div>`;
                        let comments = [];
                        try {
                            comments = yield loadComments(task);
                        }
                        catch (e) {
                            if (detailTask !== task)
                                return;
                            list.innerHTML = `<div class="${p}-cmt-empty">Couldn't load comments (${esc(e.message)}).</div>`;
                            return;
                        }
                        if (detailTask !== task)
                            return; // panel changed while loading
                        if (!comments.length) {
                            list.innerHTML = `<div class="${p}-cmt-empty">${tr("noCommentsYet")}</div>`;
                            return;
                        }
                        // Resolve author profiles (avatars + names) in parallel.
                        const authors = yield Promise.all(comments.map(c => fetchUser(commentAuthorId(c))));
                        // Prefetch metadata for any inline [attachment:id] tokens.
                        const bodies = comments.map(c => commentText(c));
                        const attIds = new Set();
                        bodies.forEach(b => { let m; ATT_TOKEN.lastIndex = 0; while ((m = ATT_TOKEN.exec(b)))
                            attIds.add(m[1]); });
                        if (attIds.size)
                            yield Promise.all([...attIds].map(metaCached));
                        if (detailTask !== task)
                            return;
                        // Fresh load → reset translate state, cache data, paint.
                        cmtTranslated = false;
                        cmtTrBusy = false;
                        lastCmt = { comments, authors, bodies, task };
                        paintComments();
                    });
                }
                // Translate icon (shared by header button + per-comment button).
                const iGlobe = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/></svg>`;
                // Paint the cached comments (no re-fetch). Used on first render and on
                // translate toggle. Each comment carries a translate affordance: hover
                // (desktop) or tap (mobile) reveals it; clicking translates all comments.
                function paintComments() {
                    if (!lastCmt)
                        return;
                    const list = detailBody.querySelector(`#${p}-cmt-list-${instId}`);
                    if (!list || detailTask !== lastCmt.task)
                        return;
                    const { comments, authors, bodies } = lastCmt;
                    const showBtn = locale !== DEFAULT_LOCALE;
                    const btnLbl = cmtTrBusy ? tr("translating") : cmtTranslated ? tr("showOriginal") : tr("translateBtn");
                    list.innerHTML = comments.map((c, i) => {
                        const a = authors[i];
                        const body = cmtTranslated ? (cmtCache[bodies[i].trim()] || bodies[i]) : bodies[i];
                        return `
          <div class="${p}-cmt-item">
            ${showBtn ? `<button type="button" class="${p}-cmt-tr" title="${btnLbl}">${iGlobe}<span>${btnLbl}</span></button>` : ""}
            ${avatarHtml(a)}
            <div class="${p}-cmt-main">
              <div class="${p}-cmt-head"><span class="${p}-cmt-author">${esc(a.name)}</span><span class="${p}-cmt-time">${esc(commentTime(c.createdAt || c.created || ""))}</span></div>
              <div class="${p}-cmt-body" dir="auto">${resolveAttachments(body) || "<em>(empty)</em>"}</div>
            </div>
          </div>`;
                    }).join("");
                    // Tap a comment (mobile) → reveal its button; hover handles desktop via CSS.
                    list.querySelectorAll(`.${p}-cmt-item`).forEach(it => it.addEventListener("click", () => it.classList.toggle("show-tr")));
                    list.querySelectorAll(`.${p}-cmt-tr`).forEach(b => b.addEventListener("click", e => { e.stopPropagation(); toggleComments(); }));
                }
                function toggleComments() {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        if (cmtTrBusy || !lastCmt)
                            return;
                        if (!cmtTranslated) {
                            cmtTrBusy = true;
                            paintComments();
                            const map = yield translateMap(lastCmt.bodies, translateSend);
                            Object.assign(cmtCache, map);
                            cmtTrBusy = false;
                            cmtTranslated = true;
                        }
                        else {
                            cmtTranslated = false;
                        }
                        paintComments();
                    });
                }
                // Render the attachment tiles inside the open detail panel for a task.
                function renderAttachments(task) {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        const grid = detailBody.querySelector(`#${p}-att-grid-${instId}`);
                        if (!grid)
                            return;
                        const ids = task.attachmentIds || [];
                        if (!ids.length) {
                            grid.innerHTML = `<span class="${p}-att-empty">${tr("noAttachments")}</span>`;
                            return;
                        }
                        grid.innerHTML = `<span class="${p}-att-empty">${tr("loading")}</span>`;
                        const metas = yield Promise.all(ids.map(mediaMeta));
                        if (detailTask !== task)
                            return; // panel changed while loading
                        grid.innerHTML = ids.map((id, i) => {
                            var _a, _b;
                            const m = metas[i];
                            const name = esc((m === null || m === void 0 ? void 0 : m.fileName) || "file");
                            const size = (m === null || m === void 0 ? void 0 : m.size) ? `<span class="${p}-att-size">${humanSize(m.size)}</span>` : "";
                            const thumb = ((_a = m === null || m === void 0 ? void 0 : m.thumbnail) === null || _a === void 0 ? void 0 : _a.url)
                                ? `<img class="${p}-att-thumb" src="${esc(m.thumbnail.url)}" alt="">`
                                : `<span class="${p}-att-ico">${iFileGeneric}</span>`;
                            const fn = (m === null || m === void 0 ? void 0 : m.fileName) || "file";
                            const turl = ((_b = m === null || m === void 0 ? void 0 : m.thumbnail) === null || _b === void 0 ? void 0 : _b.url) || "";
                            const full = originalUrl(m) || turl;
                            const kind = attKind(m);
                            return `<div class="${p}-att-tile">
            <a class="${p}-att-link" href="${esc(full)}" target="_blank" rel="noopener" data-att-url="${esc(full)}" data-att-preview="${esc(turl)}" data-att-name="${esc(fn)}" data-att-kind="${kind}">
              ${thumb}<span class="${p}-att-meta"><span class="${p}-att-name">${name}</span>${size}</span>
            </a>
            <button type="button" class="${p}-att-x" data-id="${esc(id)}" title="Remove">${iXsmall}</button>
          </div>`;
                        }).join("");
                        grid.querySelectorAll(`.${p}-att-x`).forEach(btn => {
                            btn.addEventListener("click", () => my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                                const rid = btn.dataset.id || "";
                                const next = (task.attachmentIds || []).filter(x => x !== rid);
                                btn.disabled = true;
                                try {
                                    const res = yield fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ attachmentIds: next }) }));
                                    if (!res.ok)
                                        throw new Error(`HTTP ${res.status}`);
                                    task.attachmentIds = next;
                                    renderAttachments(task);
                                }
                                catch (e) {
                                    showBanner("error", `Could not remove: ${e.message}`);
                                    btn.disabled = false;
                                }
                            }));
                        });
                    });
                }
                // ── Distinct types for visible install ────────────────────────────
                function getTypes() {
                    const types = new Set();
                    let hasUntyped = false;
                    for (const t of allTasks) {
                        if (t.taskType === "audit-result")
                            continue;
                        if (activeInstallFilter !== "all" && t.installationId !== activeInstallFilter)
                            continue;
                        if (t.taskType)
                            types.add(t.taskType);
                        else
                            hasUntyped = true;
                    }
                    const sorted = [...types].sort().map(k => ({ key: k, label: k }));
                    if (hasUntyped)
                        sorted.push({ key: "__none__", label: tr("noTypeLabel") });
                    return sorted;
                }
                // ── Filtered tasks (normal mode) ──────────────────────────────────
                function filteredTasks() {
                    return allTasks.filter(t => {
                        if (t.taskType === "audit-result")
                            return false; // always hide system tasks
                        if (activeInstallFilter !== "all" && t.installationId !== activeInstallFilter)
                            return false;
                        if (activeTypeFilters.size > 0) {
                            const key = t.taskType || "__none__";
                            if (!activeTypeFilters.has(key))
                                return false;
                        }
                        const isDone = t.status === "DONE" || t.status === "done" || t.status === "CLOSED";
                        if (activeStatusFilter === "open" && isDone)
                            return false;
                        if (activeStatusFilter === "done" && !isDone)
                            return false;
                        return true;
                    });
                }
                // ── Store tabs ────────────────────────────────────────────────────
                function renderStoreTabs() {
                    if (auditMode) {
                        // In audit mode: pills built from auditLists unique installs
                        const instMap = new Map();
                        for (const al of auditLists) {
                            if (!instMap.has(al.installId))
                                instMap.set(al.installId, { title: al.instTitle || al.installId, count: 0 });
                            instMap.get(al.installId).count++;
                        }
                        if (instMap.size <= 1) {
                            storeTabs.style.display = "none";
                            return;
                        }
                        storeTabs.style.display = "flex";
                        storeTabs.innerHTML = `
            <div role="button" tabindex="0" class="${p}-store-tab ${activeInstallFilter === "all" ? "active" : ""}" data-inst="all">
              All <span style="opacity:.6;font-weight:400">(${auditLists.length})</span>
            </div>
            ${[...instMap.entries()].map(([id, info]) => `
              <div role="button" tabindex="0" class="${p}-store-tab ${activeInstallFilter === id ? "active" : ""}" data-inst="${esc(id)}">
                ${esc(info.title || id)} <span style="opacity:.6;font-weight:400">(${info.count})</span>
              </div>`).join("")}`;
                        storeTabs.querySelectorAll(`.${p}-store-tab`).forEach(btn => {
                            btn.addEventListener("click", () => {
                                var _a;
                                activeInstallFilter = btn.dataset.inst || "all";
                                // If current audit belongs to a different store, reset to first match
                                const filtered = activeInstallFilter === "all" ? auditLists : auditLists.filter(al => al.installId === activeInstallFilter);
                                if (!filtered.find(al => al.listId === activeAuditListId))
                                    activeAuditListId = ((_a = filtered[0]) === null || _a === void 0 ? void 0 : _a.listId) || "";
                                renderStoreTabs();
                                renderAuditTabs();
                                renderList();
                            });
                        });
                        return;
                    }
                    // Normal mode
                    const instMap = new Map();
                    for (const t of allTasks) {
                        if (t.taskType === "audit-result")
                            continue;
                        if (!instMap.has(t.installationId))
                            instMap.set(t.installationId, { title: t.installationTitle, count: 0 });
                        instMap.get(t.installationId).count++;
                    }
                    if (instMap.size <= 1) {
                        storeTabs.style.display = "none";
                        return;
                    }
                    storeTabs.style.display = "flex";
                    const total = allTasks.filter(t => t.taskType !== "audit-result").length;
                    storeTabs.innerHTML = `
          <div role="button" tabindex="0" class="${p}-store-tab ${activeInstallFilter === "all" ? "active" : ""}" data-inst="all">
            All <span style="opacity:.6;font-weight:400">(${total})</span>
          </div>
          ${[...instMap.entries()].map(([id, info]) => `
            <div role="button" tabindex="0" class="${p}-store-tab ${activeInstallFilter === id ? "active" : ""}" data-inst="${esc(id)}">
              ${esc(info.title || id)} <span style="opacity:.6;font-weight:400">(${info.count})</span>
            </div>`).join("")}`;
                    storeTabs.querySelectorAll(`.${p}-store-tab`).forEach(btn => {
                        btn.addEventListener("click", () => {
                            activeInstallFilter = btn.dataset.inst || "all";
                            activeTypeFilters.clear();
                            dropdownOpen = false;
                            renderStoreTabs();
                            renderTypeFilters();
                            renderList();
                        });
                    });
                }
                // ── Audit tabs ────────────────────────────────────────────────────
                function renderAuditTabs() {
                    if (!auditMode || !auditTabWrap || !auditTabsEl)
                        return;
                    if (auditLists.length === 0) {
                        auditTabWrap.style.display = "none";
                        return;
                    }
                    // Filter by active store pill
                    const visible = activeInstallFilter === "all" ? auditLists : auditLists.filter(al => al.installId === activeInstallFilter);
                    if (visible.length === 0) {
                        auditTabWrap.style.display = "none";
                        return;
                    }
                    auditTabWrap.style.display = "";
                    auditTabsEl.innerHTML = visible.map(al => {
                        var _a;
                        const pa = al.parsedAudit;
                        const passing = (_a = pa === null || pa === void 0 ? void 0 : pa.passing) !== null && _a !== void 0 ? _a : null;
                        const pct = (pa === null || pa === void 0 ? void 0 : pa.score) != null ? pa.score + "%" : "—";
                        const dotColor = passing === true ? "var(--success)" : passing === false ? "var(--error)" : "var(--gray-lt)";
                        const label = al.listName.replace(/^Audit\s*—\s*/i, "").trim() || al.listName;
                        return `<div role="button" tabindex="0" class="${p}-audit-tab${al.listId === activeAuditListId ? " active" : ""}" data-list-id="${esc(al.listId)}" data-inst-id="${esc(al.installId)}">
            <span class="${p}-audit-dot" style="background:${dotColor}"></span>
            ${esc(label)} <span style="opacity:.55;font-size:10px">${pct}</span>
          </div>`;
                    }).join("");
                    auditTabsEl.querySelectorAll(`.${p}-audit-tab`).forEach(btn => {
                        btn.addEventListener("click", () => {
                            activeAuditListId = btn.dataset.listId || "";
                            showOtherAuditTasks = false;
                            renderAuditTabs();
                            renderList();
                        });
                    });
                    // Keep the active tab in view + refresh scroll arrows.
                    const active = auditTabsEl.querySelector(`.${p}-audit-tab.active`);
                    if (active)
                        active.scrollIntoView({ inline: "center", block: "nearest" });
                    requestAnimationFrame(updateAuditArrows);
                }
                // ── Type dropdown ─────────────────────────────────────────────────
                let dropdownOpen = false;
                function typeDropdownLabel() {
                    if (activeTypeFilters.size === 0)
                        return tr("allTypes");
                    const types = getTypes();
                    const sel = types.filter(t => activeTypeFilters.has(t.key));
                    if (sel.length === 1)
                        return ct(sel[0].label);
                    return tr("nTypes").replace("{n}", String(sel.length));
                }
                function renderTypeFilters() {
                    if (!typeBtn || !typeLabelEl || !typeMenu)
                        return;
                    const types = getTypes();
                    typeLabelEl.textContent = typeDropdownLabel();
                    typeBtn.classList.toggle("open", dropdownOpen);
                    typeMenu.classList.toggle("open", dropdownOpen);
                    const iconCheck = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                    const allActive = activeTypeFilters.size === 0;
                    typeMenu.innerHTML = `
          <button type="button" class="${p}-type-opt ${allActive ? "active" : ""}" data-key="__all__">
            <span style="width:12px;display:flex;align-items:center;justify-content:center">${allActive ? iconCheck : ""}</span>${tr("allTypes")}
          </button>
          <div style="height:1px;background:var(--border);margin:2px 0"></div>
          ${types.map(({ key, label }) => {
                        const checked = activeTypeFilters.has(key);
                        const dot = key !== "__none__"
                            ? `<span class="${p}-type-dot" style="background:${typeColor(key)}"></span>`
                            : `<span class="${p}-type-dot" style="background:var(--border)"></span>`;
                        return `<button type="button" class="${p}-type-opt ${checked ? "active" : ""}" data-key="${esc(key)}">
              <span style="width:12px;display:flex;align-items:center;justify-content:center">${checked ? iconCheck : ""}</span>
              ${dot}${esc(ct(label))}</button>`;
                    }).join("")}`;
                    typeMenu.querySelectorAll(`.${p}-type-opt`).forEach(btn => {
                        btn.addEventListener("click", e => {
                            e.stopPropagation();
                            const key = btn.dataset.key;
                            if (key === "__all__")
                                activeTypeFilters.clear();
                            else if (activeTypeFilters.has(key))
                                activeTypeFilters.delete(key);
                            else
                                activeTypeFilters.add(key);
                            renderTypeFilters();
                            renderList();
                        });
                    });
                }
                if (typeBtn)
                    typeBtn.addEventListener("click", e => { e.stopPropagation(); dropdownOpen = !dropdownOpen; renderTypeFilters(); });
                const onDocClick = () => { if (dropdownOpen) {
                    dropdownOpen = false;
                    renderTypeFilters();
                } };
                document.addEventListener("click", onDocClick);
                self._mtwDocClick = onDocClick;
                // ── Render task list ──────────────────────────────────────────────
                function renderList() {
                    if (auditMode) {
                        renderAuditContent();
                        return;
                    }
                    const tasks = filteredTasks();
                    countEl.textContent = String(tasks.length);
                    if (!tasks.length) {
                        const emptyMsg = allTasks.filter(t => t.taskType !== "audit-result").length === 0
                            ? tr("noTasksFound")
                            : activeStatusFilter === "open" ? tr("allCaughtUpPersonal") : tr("noCompletedTasks");
                        listWrap.innerHTML = `<div class="${p}-state">
            <span class="${p}-state-icon">${activeStatusFilter === "open" && allTasks.length > 0 ? "✓" : "📋"}</span>
            <strong>${emptyMsg}</strong>
          </div>`;
                        return;
                    }
                    const grouped = new Map();
                    for (const t of tasks) {
                        const key = t.taskType || "__none__";
                        if (!grouped.has(key))
                            grouped.set(key, []);
                        grouped.get(key).push(t);
                    }
                    const orderedKeys = [...grouped.keys()].sort((a, b) => { if (a === "__none__")
                        return 1; if (b === "__none__")
                        return -1; return a.localeCompare(b); });
                    let html = `<div class="${p}-list${introUsed ? "" : " intro"}">`;
                    introUsed = true;
                    for (const key of orderedKeys) {
                        const group = grouped.get(key);
                        const label = key === "__none__" ? tr("noTypeLabel") : ct(key);
                        html += `<div class="${p}-section-label">${esc(label)} <span style="font-weight:400">(${group.length})</span></div>`;
                        for (const task of group)
                            html += renderTaskCard(task);
                    }
                    html += `</div>`;
                    listWrap.innerHTML = html;
                    bindListEvents();
                }
                // ── Audit mode content ────────────────────────────────────────────
                function renderAuditContent() {
                    var _a, _b;
                    if (auditLists.length === 0) {
                        countEl.textContent = "0";
                        listWrap.innerHTML = `<div class="${p}-state"><strong>${tr("noAuditsFound")}</strong>${tr("auditEmptyHint")}</div>`;
                        return;
                    }
                    const al = auditLists.find(a => a.listId === activeAuditListId) || auditLists[0];
                    if (!al) {
                        listWrap.innerHTML = `<div class="${p}-state">${tr("selectAudit")}</div>`;
                        return;
                    }
                    // Ensure active is set
                    if (!activeAuditListId)
                        activeAuditListId = al.listId;
                    const pa = al.parsedAudit;
                    const passing = (_a = pa === null || pa === void 0 ? void 0 : pa.passing) !== null && _a !== void 0 ? _a : null;
                    const pct = (_b = pa === null || pa === void 0 ? void 0 : pa.score) !== null && _b !== void 0 ? _b : null;
                    const passClass = passing === true ? "pass" : passing === false ? "fail" : "";
                    // Audit summary card
                    const iconStore_ = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
                    const iconUser_ = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                    const iconCal_ = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
                    const iconNote_ = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
                    const scoreColor = passing === true ? "var(--success)" : passing === false ? "var(--error)" : "var(--gray)";
                    const summaryHtml = pa ? `
          <div class="${p}-audit-card ${passClass}" id="${p}-audit-card" role="button" tabindex="0">
            <div style="display:flex;align-items:flex-start;justify-content:space-between">
              <div>
                <div class="${p}-audit-card-score" style="color:${scoreColor}">${pct != null ? pct + "%" : "—"}</div>
                <div style="font-size:13px;font-weight:700;color:${scoreColor};margin-top:3px">${passing === true ? tr("passing") : passing === false ? tr("failing") : "—"}</div>
              </div>
              <div style="font-size:11px;color:var(--gray-lt);text-align:end;line-height:1.6">
                ${pa.taskCount != null ? `<div style="font-weight:600;color:${scoreColor}">${tr("nTasksFlagged").replace("{n}", String(pa.taskCount))}</div>` : ""}
              </div>
            </div>
            <div class="${p}-audit-card-meta">
              ${pa.store ? `<span>${iconStore_} ${esc(pa.store)}</span>` : ""}
              ${pa.auditor ? `<span>${iconUser_} ${esc(pa.auditor)}</span>` : ""}
              ${pa.date ? `<span>${iconCal_} ${esc(pa.date)}</span>` : ""}
              ${pa.notes ? `<span style="align-items:flex-start">${iconNote_} <span style="line-height:1.5;font-style:italic">${esc(pa.notes)}</span></span>` : ""}
            </div>
          </div>` : "";
                    // All failure tasks in this audit (excluding system task)
                    const allAuditTasks = allTasks.filter(t => t.listId === al.listId && t.installationId === al.installId && t.taskType !== "audit-result");
                    const isDoneTask = (t) => t.status === "DONE" || t.status === "done" || t.status === "CLOSED";
                    // Split into "mine" vs "other" — uses widget-level currentUserId + userGroupIds
                    const isMyTask = (t) => {
                        if (!currentUserId)
                            return true; // if we have no user info, treat everything as mine
                        const direct = t.assigneeIds.indexOf(currentUserId) !== -1;
                        const grp = t.groupIds.some(gid => userGroupIds.indexOf(gid) !== -1);
                        return direct || grp;
                    };
                    const myTasks = allAuditTasks.filter(t => isMyTask(t));
                    // Other people's tasks are only available when "Show All Tasks" is on.
                    const otherTasks = showAll ? allAuditTasks.filter(t => !isMyTask(t)) : [];
                    const doneMine = myTasks.filter(isDoneTask);
                    const visibleMine = showCompletedAudit ? myTasks : myTasks.filter(t => !isDoneTask(t));
                    const allMyDone = myTasks.length > 0 && doneMine.length === myTasks.length;
                    countEl.textContent = String(visibleMine.length);
                    // "Show completed" toggle header
                    const completedToggleHtml = doneMine.length > 0 ? `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--gray-lt)">
              ${tr("myTasksN").replace("{n}", String(myTasks.length))}
            </span>
            <button id="${p}-audit-toggle" type="button" style="font-size:11px;font-weight:600;color:var(--primary);background:none;border:none;cursor:pointer;padding:3px 7px;border-radius:4px;font-family:inherit;touch-action:manipulation">
              ${showCompletedAudit ? tr("hideCompleted") : tr("showCompletedN").replace("{n}", String(doneMine.length))}
            </button>
          </div>` :
                        myTasks.length > 0 ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--gray-lt);margin-bottom:10px">${tr("myTasksN").replace("{n}", String(myTasks.length))}</div>` : "";
                    // Main task list HTML
                    let taskHtml;
                    if (allAuditTasks.length === 0) {
                        taskHtml = `<div style="text-align:center;padding:20px;color:var(--gray-lt);font-size:13px">${tr("noFailureTasks")}</div>`;
                    }
                    else if (myTasks.length === 0) {
                        taskHtml = `<div style="text-align:center;padding:20px;color:var(--gray-lt);font-size:13px">${tr("noTasksAssigned")}</div>`;
                    }
                    else if (allMyDone && !showCompletedAudit) {
                        taskHtml = `<div style="text-align:center;padding:20px 16px;background:rgba(46,125,74,.06);border:1px solid rgba(46,125,74,.2);border-radius:10px">
            <div style="font-size:22px;margin-bottom:6px">✓</div>
            <div style="font-size:14px;font-weight:700;color:var(--success)">${tr("allTasksComplete")}</div>
            <div style="font-size:12px;color:var(--gray-lt);margin-top:4px">${tr("nTasksMarkedDone").replace("{n}", String(doneMine.length))}</div>
          </div>`;
                    }
                    else if (visibleMine.length === 0) {
                        taskHtml = `<div style="text-align:center;padding:20px;color:var(--gray-lt);font-size:13px">${tr("allCaughtUp")}</div>`;
                    }
                    else {
                        taskHtml = `<div class="${p}-list${introUsed ? "" : " intro"}">${visibleMine.map(t => renderTaskCard(t)).join("")}</div>`;
                        introUsed = true;
                    }
                    // "Other tasks" section (greyed but clickable) — only when Show All is on
                    let otherHtml = "";
                    if (showAll && otherTasks.length > 0) {
                        const iChev = showOtherAuditTasks
                            ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`
                            : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
                        const ghostCards = otherTasks.map(t => {
                            const card = renderTaskCard(t);
                            // inject ghost class and remove checkbox
                            return card.replace(`class="${p}-card `, `class="${p}-card ghost `).replace(`class="${p}-card"`, `class="${p}-card ghost"`);
                        }).join("");
                        otherHtml = `
            <button id="${p}-other-toggle" type="button" class="${p}-other-toggle">
              ${iChev} ${(showOtherAuditTasks ? tr("hideOtherTasks") : tr("showOtherTasks")).replace("{n}", String(otherTasks.length))}
            </button>
            ${showOtherAuditTasks ? `<div class="${p}-list" style="margin-top:8px">${ghostCards}</div>` : ""}`;
                    }
                    listWrap.innerHTML = summaryHtml + completedToggleHtml + taskHtml + otherHtml;
                    // Wire "show completed" toggle
                    const toggleBtn = listWrap.querySelector(`#${p}-audit-toggle`);
                    if (toggleBtn)
                        toggleBtn.addEventListener("click", () => { showCompletedAudit = !showCompletedAudit; renderAuditContent(); });
                    // Wire "other tasks" toggle
                    const otherBtn = listWrap.querySelector(`#${p}-other-toggle`);
                    if (otherBtn)
                        otherBtn.addEventListener("click", () => { showOtherAuditTasks = !showOtherAuditTasks; renderAuditContent(); });
                    // Click the audit summary card → open it in the sidebar with the chart
                    const auditCard = listWrap.querySelector(`#${p}-audit-card`);
                    if (auditCard && pa)
                        auditCard.addEventListener("click", () => openAuditSummary(pa, al.listName || "Audit", al.systemTask));
                    bindListEvents();
                }
                function bindListEvents() {
                    listWrap.querySelectorAll(`.${p}-check`).forEach((btn) => {
                        btn.addEventListener("click", () => toggleTask(btn));
                    });
                    listWrap.querySelectorAll(`.${p}-card`).forEach((card) => {
                        card.addEventListener("click", (e) => {
                            if (e.target.closest(`.${p}-check-wrap`))
                                return;
                            const taskId = card.dataset.taskId;
                            const task = allTasks.find(t => t.id === taskId);
                            if (task)
                                openDetail(task);
                        });
                    });
                }
                // ── Task card ─────────────────────────────────────────────────────
                function renderTaskCard(task) {
                    const isDone = task.status === "DONE" || task.status === "done" || task.status === "CLOSED";
                    const dueInfo = formatDate(task.dueDate);
                    const desc = task.description ? esc(ct(stripTypeTag(task.description).trim())) : "";
                    const typeCol = task.taskType ? typeColor(task.taskType) : "";
                    const typeText = task.taskType ? contrastColor(typeCol) : "";
                    const isCrit = (task.auditSeverity || "").toLowerCase() === "critical";
                    const prioCol = isCrit ? "#9B1C2E" : priorityColor(task.priority);
                    const prioLbl = isCrit ? tr("critical") : task.priority === "Priority_1" ? tr("high") : task.priority === "Priority_2" ? tr("medium") : tr("normal");
                    const typeBadge = task.taskType ? `<span class="${p}-type-badge" style="background:${typeCol};color:${typeText}" dir="auto">${esc(ct(task.taskType))}</span>` : "";
                    const prioBadge = (isCrit || (task.priority && task.priority !== "Priority_3")) ? `<span class="${p}-prio-badge${isCrit ? " crit" : ""}" style="color:${prioCol};border-color:${prioCol}">${prioLbl}</span>` : "";
                    const iconRecur = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
                    const recurBadge = task.isRecurring ? `<span class="${p}-recur-badge">${iconRecur}${tr("recurring")}</span>` : "";
                    const iconCal = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
                    const iconStore = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
                    const iconList = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
                    const iconGroup = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
                    const iconCheck = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                    // Group names
                    const groupNames = task.groupIds.map(gid => groupName(gid)).filter(Boolean);
                    return `
          <div class="${p}-card ${isDone ? "done" : ""}" data-task-id="${esc(task.id)}" data-install-id="${esc(task.installationId)}">
            <div class="${p}-card-inner">
              <div class="${p}-check-wrap">
                <div class="${p}-check ${isDone ? "checked" : ""}"
                     data-task-id="${esc(task.id)}" data-install-id="${esc(task.installationId)}" data-status="${esc(task.status)}"
                     title="${isDone ? tr("markAsOpen") : tr("markAsDone")}">
                  <span class="${p}-check-icon">${iconCheck}</span>
                </div>
              </div>
              <div class="${p}-card-body">
                <div class="${p}-card-top">${typeBadge}${recurBadge}${prioBadge}</div>
                <div class="${p}-card-title"><span dir="auto">${esc(ct(task.title))}</span></div>
                ${desc ? `<div class="${p}-card-desc" dir="auto">${desc}</div>` : ""}
                <div class="${p}-card-meta">
                  ${dueInfo.text ? `<span class="${p}-meta-item ${dueInfo.overdue && !isDone ? "overdue" : ""}">${iconCal} ${dueInfo.overdue && !isDone ? tr("overdueLabel") + ": " : ""}<span dir="auto">${dueInfo.text}</span></span>` : ""}
                  ${task.installationTitle ? `<span class="${p}-meta-item">${iconStore} ${esc(task.installationTitle)}</span>` : ""}
                  ${task.listName ? `<span class="${p}-meta-item">${iconList} ${esc(task.listName)}</span>` : ""}
                  ${groupNames.map(gn => `<span class="${p}-meta-item">${iconGroup} ${esc(gn)}</span>`).join("")}
                </div>
              </div>
            </div>
          </div>`;
                }
                // ── Detail panel ──────────────────────────────────────────────────
                let detailTask = null;
                let detailAudit = null; // when the panel shows an audit summary instead of a task
                let detailAssignTab = "group";
                function openDetail(task) {
                    detailTask = task;
                    detailAudit = null;
                    detailAssignTab = "group";
                    const isWide = window.innerWidth >= 720; // side panel on desktop, bottom sheet on mobile (viewport-based, not column width)
                    detailEl.classList.toggle("side", isWide);
                    detailEl.classList.remove("audit-view");
                    renderDetailContent(task);
                    overlayEl.classList.add("open");
                    requestAnimationFrame(() => detailEl.classList.add("open"));
                }
                // Open the audit summary in the same sidebar/sheet, with an animated
                // category breakdown chart.
                function openAuditSummary(pa, label, sysTask) {
                    detailAudit = pa;
                    detailTask = null;
                    const isWide = window.innerWidth >= 720; // side panel on desktop, bottom sheet on mobile (viewport-based, not column width)
                    detailEl.classList.toggle("side", isWide);
                    detailEl.classList.add("audit-view"); // hides the task footer
                    renderAuditSummaryDetail(pa, label, sysTask);
                    overlayEl.classList.add("open");
                    requestAnimationFrame(() => detailEl.classList.add("open"));
                }
                function renderAuditSummaryDetail(pa, label, sysTask) {
                    var _a, _b;
                    const passing = (_a = pa === null || pa === void 0 ? void 0 : pa.passing) !== null && _a !== void 0 ? _a : null;
                    const pct = (_b = pa === null || pa === void 0 ? void 0 : pa.score) !== null && _b !== void 0 ? _b : null;
                    const scoreColor = passing === true ? "var(--success)" : passing === false ? "var(--error)" : "var(--gray)";
                    detailBadges.innerHTML = `<span class="${p}-prio-badge" style="color:${scoreColor};border-color:${scoreColor}">${passing === true ? tr("passing") : passing === false ? tr("failing") : "—"}</span>`;
                    const cats = (pa === null || pa === void 0 ? void 0 : pa.categories) && typeof pa.categories === "object" ? Object.keys(pa.categories) : [];
                    const iCal2 = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
                    const iStore2 = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
                    const iUser2 = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                    const bars = cats.map((name, i) => {
                        const c = pa.categories[name];
                        const v = Math.max(0, Math.min(100, (c === null || c === void 0 ? void 0 : c.pct) != null ? c.pct : ((c === null || c === void 0 ? void 0 : c.total) ? Math.round((c.earned / c.total) * 100) : 0)));
                        const tier = v >= 80 ? "hi" : v >= 50 ? "mid" : "lo";
                        const detail = c && c.total != null ? `${c.earned}/${c.total}` : "";
                        return `<div class="${p}-cat-row">
            <div class="${p}-cat-top"><span class="${p}-cat-name">${esc(name)}</span><span class="${p}-cat-pct">${detail ? `<span style="color:var(--gray-lt);font-weight:500;margin-inline-end:6px">${detail}</span>` : ""}${v}%</span></div>
            <div class="${p}-cat-bar"><span class="${p}-cat-fill ${tier}" data-pct="${v}" style="width:0;transition-delay:${i * 60}ms"></span></div>
          </div>`;
                    }).join("");
                    detailBody.innerHTML = `
          <div class="${p}-detail-title">${esc(label.replace(/^Audit\s*[—–-]\s*/i, "").trim() || label)}</div>
          <div class="${p}-audit-detail-score" style="color:${scoreColor}">${pct != null ? pct + "%" : "—"}</div>
          <div class="${p}-audit-detail-sub" style="color:${scoreColor}">${passing === true ? tr("passing") : passing === false ? tr("failing") : tr("notScored")}</div>
          <div class="${p}-detail-meta" style="margin-bottom:18px">
            ${(pa === null || pa === void 0 ? void 0 : pa.store) ? `<div class="${p}-detail-meta-row">${iStore2} ${esc(pa.store)}</div>` : ""}
            ${(pa === null || pa === void 0 ? void 0 : pa.auditor) ? `<div class="${p}-detail-meta-row">${iUser2} ${esc(pa.auditor)}</div>` : ""}
            ${(pa === null || pa === void 0 ? void 0 : pa.date) ? `<div class="${p}-detail-meta-row">${iCal2} ${esc(pa.date)}</div>` : ""}
            ${(pa === null || pa === void 0 ? void 0 : pa.taskCount) != null ? `<div class="${p}-detail-meta-row">${iClip} ${tr("nTasksFlagged").replace("{n}", String(pa.taskCount))}</div>` : ""}
          </div>
          ${(pa === null || pa === void 0 ? void 0 : pa.notes) ? `<div class="${p}-detail-desc-label">${tr("notes")}</div><div class="${p}-detail-desc" style="margin-bottom:18px" dir="auto">${esc(ct(pa.notes))}</div>` : ""}
          ${(sysTask && sysTask.attachmentIds && sysTask.attachmentIds.length) ? `<div class="${p}-detail-desc-label">${tr("attachments")}</div><div class="${p}-att-grid" id="${p}-audit-att-${instId}" style="margin-bottom:18px"><span class="${p}-att-empty">${tr("loading")}</span></div>` : ""}
          ${cats.length ? `<div class="${p}-detail-desc-label">${tr("categoryBreakdown")}</div><div class="${p}-cat-chart">${bars}</div>` : ""}
        `;
                    // Render the summary task's attachments (above the bars).
                    if (sysTask && sysTask.attachmentIds && sysTask.attachmentIds.length) {
                        const grid = detailBody.querySelector(`#${p}-audit-att-${instId}`);
                        const ids = sysTask.attachmentIds;
                        Promise.all(ids.map(mediaMeta)).then(metas => {
                            if (detailAudit !== pa || !grid)
                                return;
                            grid.innerHTML = ids.map((_id, i) => {
                                var _a, _b;
                                const m = metas[i];
                                const name = esc((m === null || m === void 0 ? void 0 : m.fileName) || "file");
                                const thumb = ((_a = m === null || m === void 0 ? void 0 : m.thumbnail) === null || _a === void 0 ? void 0 : _a.url) ? `<img class="${p}-att-thumb" src="${esc(m.thumbnail.url)}" alt="">` : `<span class="${p}-att-ico">${iFileGeneric}</span>`;
                                const size = (m === null || m === void 0 ? void 0 : m.size) ? `<span class="${p}-att-size">${humanSize(m.size)}</span>` : "";
                                const fn = (m === null || m === void 0 ? void 0 : m.fileName) || "file";
                                const turl = ((_b = m === null || m === void 0 ? void 0 : m.thumbnail) === null || _b === void 0 ? void 0 : _b.url) || "";
                                const full = originalUrl(m) || turl;
                                const kind = attKind(m);
                                return `<div class="${p}-att-tile"><a class="${p}-att-link" href="${esc(full || "#")}" target="_blank" rel="noopener" data-att-url="${esc(full)}" data-att-preview="${esc(turl)}" data-att-name="${esc(fn)}" data-att-kind="${kind}">${thumb}<span class="${p}-att-meta"><span class="${p}-att-name">${name}</span>${size}</span></a></div>`;
                            }).join("");
                        });
                    }
                    const reduceMotion = (() => { try {
                        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                    }
                    catch (_) {
                        return false;
                    } })();
                    // Animate the bars from 0 → their value once laid out.
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        detailBody.querySelectorAll(`.${p}-cat-fill`).forEach(el => {
                            el.style.width = (el.dataset.pct || "0") + "%";
                        });
                    }));
                    // Count the score up from 0 → pct.
                    const scoreEl = detailBody.querySelector(`.${p}-audit-detail-score`);
                    if (scoreEl && pct != null && !reduceMotion) {
                        const target = pct, dur = 750, t0 = performance.now();
                        scoreEl.textContent = "0%";
                        const tick = (now) => {
                            if (detailAudit !== pa)
                                return; // panel changed
                            const k = Math.min(1, (now - t0) / dur);
                            const eased = 1 - Math.pow(1 - k, 3);
                            scoreEl.textContent = Math.round(eased * target) + "%";
                            if (k < 1)
                                requestAnimationFrame(tick);
                        };
                        requestAnimationFrame(tick);
                    }
                }
                function closeDetail() {
                    overlayEl.classList.remove("open");
                    detailEl.classList.remove("open");
                    detailEl.style.bottom = "";
                    detailTask = null;
                    detailAudit = null;
                }
                detailEl.addEventListener("click", e => e.stopPropagation());
                // Lift the bottom-sheet above the on-screen keyboard (mobile). Pinning to
                // bottom:0 puts the composer behind the keyboard and it can't scroll past
                // its own end, so we raise the whole sheet by the keyboard height instead.
                const vv = window.visualViewport;
                const onViewport = () => {
                    if ((!detailTask && !detailAudit) || detailEl.classList.contains("side")) {
                        detailEl.style.bottom = "";
                        return;
                    }
                    if (!vv)
                        return;
                    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
                    detailEl.style.bottom = kb > 80 ? kb + "px" : "";
                };
                if (vv) {
                    vv.addEventListener("resize", onViewport);
                    vv.addEventListener("scroll", onViewport);
                    self._mtwVV = onViewport;
                }
                // Parse an audit-generated description into structured fields.
                // Matches the format produced by the audit widget:
                //   Audit finding: EXT-007 — Building exterior walls are clean
                //   Audit: Audit — May 28, 2026 9:12 AM
                //   Auditor: Nicole Adams
                function parseAuditFinding(desc) {
                    const lines = desc.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                    let code = "", finding = "", audit = "", auditor = "";
                    for (const ln of lines) {
                        let m;
                        if ((m = ln.match(/^Audit finding:\s*(.+)$/i))) {
                            const rest = m[1].trim();
                            const d = rest.match(/^([A-Za-z0-9][\w.-]*)\s*[—–-]\s*(.+)$/);
                            if (d) {
                                code = d[1];
                                finding = d[2].trim();
                            }
                            else {
                                finding = rest;
                            }
                        }
                        else if ((m = ln.match(/^Audit:\s*(.+)$/i))) {
                            audit = m[1].trim();
                        }
                        else if ((m = ln.match(/^Auditor:\s*(.+)$/i))) {
                            auditor = m[1].trim();
                        }
                    }
                    if (!finding && !audit && !auditor)
                        return null;
                    return { code, finding, audit, auditor };
                }
                function renderDetailContent(task) {
                    const isDone = task.status === "DONE" || task.status === "done" || task.status === "CLOSED";
                    const dueInfo = formatDate(task.dueDate);
                    const typeCol = task.taskType ? typeColor(task.taskType) : "";
                    const typeText = task.taskType ? contrastColor(typeCol) : "";
                    const isCrit = (task.auditSeverity || "").toLowerCase() === "critical";
                    const prioCol = isCrit ? "#9B1C2E" : priorityColor(task.priority);
                    const prioLbl = isCrit ? tr("critical") : task.priority === "Priority_1" ? tr("high") : task.priority === "Priority_2" ? tr("medium") : tr("normal");
                    const cleanDesc = task.description ? stripTypeTag(task.description).trim() : "";
                    const iconRecurD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
                    detailBadges.innerHTML = `
          ${task.taskType ? `<span class="${p}-type-badge" style="background:${typeCol};color:${typeText}" dir="auto">${esc(ct(task.taskType))}</span>` : ""}
          ${task.isRecurring ? `<span class="${p}-recur-badge">${iconRecurD}Recurring</span>` : ""}
          ${(isCrit || (task.priority && task.priority !== "Priority_3")) ? `<span class="${p}-prio-badge${isCrit ? " crit" : ""}" style="color:${prioCol};border-color:${prioCol}">${prioLbl}</span>` : ""}`;
                    const iCal = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
                    const iStore = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
                    const iList = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
                    const iGroup = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
                    const iUser = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                    // Assignee section: group vs person tabs (only shown when there are groups or assignees)
                    const hasGroup = task.groupIds.length > 0;
                    const hasAssignee = task.assigneeIds.length > 0;
                    const showAssignTabs = (hasGroup || hasAssignee) && auditMode;
                    let assigneeHtml = "";
                    if (hasGroup || hasAssignee) {
                        if (showAssignTabs) {
                            const groupNames = task.groupIds.map(gid => groupName(gid)).filter(Boolean);
                            const groupHtml = groupNames.map(gn => `<div class="${p}-detail-meta-row">${iGroup} ${esc(gn)}</div>`).join("") || `<div style='font-size:12px;color:var(--gray-lt)'>${tr("noGroupAssigned")}</div>`;
                            const personHtml = task.assigneeIds.length > 0 ? task.assigneeIds.map(aid => `<div class="${p}-detail-meta-row" data-uid="${esc(aid)}">${iUser} <span>${esc(aid)}</span></div>`).join("") : `<div style='font-size:12px;color:var(--gray-lt)'>${tr("noIndividualAssignee")}</div>`;
                            assigneeHtml = `
              <div class="${p}-assign-tabs" id="${p}-assign-tabs-${instId}">
                <button type="button" class="${p}-assign-tab${detailAssignTab === "group" ? " active" : ""}" data-tab="group">${tr("group")}</button>
                <button type="button" class="${p}-assign-tab${detailAssignTab === "person" ? " active" : ""}" data-tab="person">${tr("person")}</button>
              </div>
              <div id="${p}-assign-content-${instId}">
                ${detailAssignTab === "group" ? groupHtml : personHtml}
              </div>`;
                        }
                        else {
                            const groupNames = task.groupIds.map(gid => groupName(gid)).filter(Boolean);
                            assigneeHtml = groupNames.map(gn => `<div class="${p}-detail-meta-row">${iGroup} ${esc(gn)}</div>`).join("");
                        }
                    }
                    detailBody.innerHTML = `
          <div class="${p}-detail-title ${isDone ? "done" : ""}" dir="auto">${esc(ct(task.title))}</div>
          <div class="${p}-detail-meta">
            ${dueInfo.text ? `<div class="${p}-detail-meta-row ${dueInfo.overdue && !isDone ? "overdue" : ""}">${iCal}${dueInfo.overdue && !isDone ? tr("overdueLabel") + " · " : tr("dueLabel") + " "}<span dir="auto">${dueInfo.text}</span></div>` : ""}
            ${task.installationTitle ? `<div class="${p}-detail-meta-row">${iStore} ${esc(task.installationTitle)}</div>` : ""}
            ${task.listName ? `<div class="${p}-detail-meta-row">${iList} ${esc(task.listName)}</div>` : ""}
            ${assigneeHtml}
            ${auditMode && allowAssign ? `<div class="${p}-reassign" id="${p}-reassign-${instId}">
              <button type="button" class="${p}-reassign-btn" data-act="open"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> ${(task.groupIds.length || task.assigneeIds.length) ? tr("reassign") : tr("assign")}</button>
              <div class="${p}-reassign-pop" style="display:none">
                <input type="text" class="${p}-reassign-search" placeholder="${tr("searchPeopleGroups")}">
                <div class="${p}-reassign-results"></div>
                <div class="${p}-reassign-foot">
                  <span class="${p}-reassign-sel"></span>
                  <span style="display:flex;gap:6px">
                    <button type="button" class="${p}-reassign-clear">${tr("clearAll")}</button>
                    <button type="button" class="${p}-reassign-save">${tr("save")}</button>
                  </span>
                </div>
              </div>
            </div>` : ""}
          </div>
          ${(() => {
                        const af = auditMode && cleanDesc ? parseAuditFinding(cleanDesc) : null;
                        if (af) {
                            return `<div class="${p}-detail-desc-label">${tr("auditFinding")}</div>
                <div class="${p}-af">
                  ${af.code ? `<span class="${p}-af-code">${esc(af.code)}</span>` : ""}
                  ${af.finding ? `<div class="${p}-af-finding" dir="auto">${esc(ct(af.finding))}</div>` : ""}
                  <div class="${p}-af-pills">
                    ${af.audit ? `<span class="${p}-af-pill">${iCal}<span>${esc(af.audit)}</span></span>` : ""}
                    ${af.auditor ? `<span class="${p}-af-pill">${iUser}<span>${esc(af.auditor)}</span></span>` : ""}
                  </div>
                </div>`;
                        }
                        return cleanDesc
                            ? `<div class="${p}-detail-desc-label">${tr("description")}</div><div class="${p}-detail-desc" dir="auto">${esc(ct(cleanDesc))}</div>`
                            : `<div class="${p}-detail-desc empty">${tr("noDescription")}</div>`;
                    })()}
          <div class="${p}-att">
            <div class="${p}-att-head">
              <span class="${p}-att-label">${tr("attachments")}</span>
              <label class="${p}-att-add" id="${p}-att-add-${instId}" for="${p}-att-input-${instId}">${iClip} ${tr("add")}</label>
            </div>
            <div class="${p}-att-grid" id="${p}-att-grid-${instId}"></div>
            <input type="file" multiple class="${p}-cmt-file" id="${p}-att-input-${instId}">
          </div>
          ${enableComments ? `
          <div class="${p}-cmt">
            <div class="${p}-att-head"><span class="${p}-att-label">${tr("comments")}</span></div>
            <div class="${p}-cmt-list" id="${p}-cmt-list-${instId}"></div>
            <div class="${p}-cmt-compose">
              <span class="${p}-cmt-av-slot" id="${p}-cmt-me-${instId}"><span class="${p}-cmt-av ${p}-cmt-av-fb">·</span></span>
              <div class="${p}-cmt-field">
                <textarea class="${p}-cmt-input" id="${p}-cmt-input-${instId}" rows="2" placeholder="${tr("addComment")}"></textarea>
                <div class="${p}-cmt-bar" id="${p}-cmt-bar-${instId}">
                  <div class="${p}-cmt-chips" id="${p}-cmt-chips-${instId}"></div>
                  <label class="${p}-cmt-attach" id="${p}-cmt-attach-${instId}" for="${p}-cmt-file-${instId}" title="${tr("attachFile")}">${iClip}</label>
                  <button type="button" class="${p}-cmt-send" id="${p}-cmt-send-${instId}">${iSend} ${tr("send")}</button>
                </div>
                <input type="file" multiple class="${p}-cmt-file" id="${p}-cmt-file-${instId}">
              </div>
            </div>
          </div>` : ""}
        `;
                    renderAttachments(task);
                    // Resolve assignee IDs → names (shown in the Person tab).
                    detailBody.querySelectorAll(`.${p}-detail-meta-row[data-uid]`).forEach(row => {
                        const uid = row.dataset.uid || "";
                        fetchUser(uid).then(u => { const s = row.querySelector("span"); if (s && u.name)
                            s.textContent = u.name; });
                    });
                    // Reassign control (audit mode + allowtaskassignment)
                    if (auditMode && allowAssign)
                        wireReassign(task);
                    if (enableComments) {
                        renderComments(task);
                        // Current user's avatar next to the composer.
                        if (currentUserId)
                            fetchUser(currentUserId).then(me => {
                                if (detailTask !== task)
                                    return;
                                const slot = detailBody.querySelector(`#${p}-cmt-me-${instId}`);
                                if (slot)
                                    slot.innerHTML = avatarHtml(me);
                            });
                        const cInput = detailBody.querySelector(`#${p}-cmt-input-${instId}`);
                        const cSend = detailBody.querySelector(`#${p}-cmt-send-${instId}`);
                        const cBar = detailBody.querySelector(`#${p}-cmt-bar-${instId}`);
                        const cAttach = detailBody.querySelector(`#${p}-cmt-attach-${instId}`);
                        const cFile = detailBody.querySelector(`#${p}-cmt-file-${instId}`);
                        const cChips = detailBody.querySelector(`#${p}-cmt-chips-${instId}`);
                        // Files attached to the comment-in-progress (also become task attachments).
                        const pending = [];
                        const hasContent = () => !!((cInput === null || cInput === void 0 ? void 0 : cInput.value.trim()) || pending.length);
                        // Bar (attach + send) shows on focus or when there's content; Send shows only with content.
                        const updateSendVisibility = () => {
                            if (cBar)
                                cBar.classList.toggle("show", document.activeElement === cInput || hasContent());
                            if (cSend)
                                cSend.classList.toggle("show", hasContent());
                        };
                        // Only do the keyboard avoidance on touch devices — on desktop there's
                        // no on-screen keyboard, so the extra padding/scroll is unwanted.
                        const isTouch = (() => { try {
                            return window.matchMedia("(pointer:coarse)").matches;
                        }
                        catch (_) {
                            return "ontouchstart" in window;
                        } })();
                        cInput === null || cInput === void 0 ? void 0 : cInput.addEventListener("focus", () => {
                            cBar === null || cBar === void 0 ? void 0 : cBar.classList.add("show");
                            if (!isTouch)
                                return;
                            // The composer is the last element, so there's nothing below it to
                            // scroll into — add temporary room so it can clear the keyboard, then
                            // scroll it into the visible (keyboard-reduced) viewport.
                            detailBody.style.paddingBottom = "55vh";
                            setTimeout(() => cInput.scrollIntoView({ block: "center", behavior: "smooth" }), 350);
                        });
                        cInput === null || cInput === void 0 ? void 0 : cInput.addEventListener("blur", () => { setTimeout(() => { if (isTouch)
                            detailBody.style.paddingBottom = ""; if (!hasContent())
                            cBar === null || cBar === void 0 ? void 0 : cBar.classList.remove("show"); }, 200); });
                        // Send keeps textarea focus until its click fires; attach is a <label for>
                        // that opens the picker natively (reliable on mobile, no input.click()).
                        cSend === null || cSend === void 0 ? void 0 : cSend.addEventListener("mousedown", e => e.preventDefault());
                        const renderChips = () => {
                            if (!cChips)
                                return;
                            cChips.innerHTML = pending.map((f, i) => `<span class="${p}-cmt-chip"><span>${esc(f.name)}</span><button type="button" data-idx="${i}">${iXsmall}</button></span>`).join("");
                            cChips.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
                                const idx = parseInt(b.dataset.idx || "-1", 10);
                                if (idx >= 0) {
                                    pending.splice(idx, 1);
                                    renderChips();
                                    updateSendVisibility();
                                }
                            }));
                        };
                        // Auto-grow textarea + reveal Send when there's text or attachments.
                        cInput === null || cInput === void 0 ? void 0 : cInput.addEventListener("input", () => {
                            cInput.style.height = "auto";
                            cInput.style.height = Math.min(cInput.scrollHeight, 140) + "px";
                            updateSendVisibility();
                        });
                        cFile === null || cFile === void 0 ? void 0 : cFile.addEventListener("change", () => my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                            const files = Array.from(cFile.files || []);
                            cFile.value = "";
                            if (!files.length)
                                return;
                            const tooBig = files.find(f => f.size > MEDIA_MAX);
                            if (tooBig) {
                                showBanner("error", `"${tooBig.name}" exceeds ${humanSize(MEDIA_MAX)}.`);
                                return;
                            }
                            if (cAttach)
                                cAttach.disabled = true;
                            try {
                                for (const f of files) {
                                    const m = yield uploadMedia(f);
                                    pending.push({ id: m.id, url: m.url, name: f.name });
                                }
                                hideBanner();
                            }
                            catch (e) {
                                showBanner("error", `Upload failed: ${e.message}`);
                            }
                            if (cAttach)
                                cAttach.disabled = false;
                            renderChips();
                            updateSendVisibility();
                        }));
                        const submit = () => my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                            const text = ((cInput === null || cInput === void 0 ? void 0 : cInput.value) || "").trim();
                            if ((!text && !pending.length) || !cSend || !cInput)
                                return;
                            cSend.disabled = true;
                            cInput.disabled = true;
                            let ok = false;
                            try {
                                const tokens = pending.map(f => `[attachment:${f.id}]`).join(" ");
                                const full = [text, tokens].filter(Boolean).join(text && tokens ? "\n" : "");
                                yield postComment(task, full);
                                // Also attach the files to the task itself (so they appear in Attachments).
                                if (pending.length) {
                                    const next = [...(task.attachmentIds || []), ...pending.map(f => f.id)];
                                    try {
                                        yield fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ attachmentIds: next }) }));
                                        task.attachmentIds = next;
                                        renderAttachments(task);
                                    }
                                    catch (_) { }
                                }
                                cInput.value = "";
                                cInput.style.height = "auto";
                                pending.length = 0;
                                renderChips();
                                cSend === null || cSend === void 0 ? void 0 : cSend.classList.remove("show");
                                cBar === null || cBar === void 0 ? void 0 : cBar.classList.remove("show");
                                hideBanner();
                                yield renderComments(task);
                                ok = true;
                            }
                            catch (e) {
                                showBanner("error", `Couldn't post comment: ${e.message}`);
                            }
                            cSend.disabled = false;
                            cInput.disabled = false;
                            // On success, blur so the mobile keyboard dismisses; on failure keep
                            // focus so they can retry without re-tapping the field.
                            if (ok)
                                cInput.blur();
                            else
                                cInput.focus();
                        });
                        cSend === null || cSend === void 0 ? void 0 : cSend.addEventListener("click", submit);
                        cInput === null || cInput === void 0 ? void 0 : cInput.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                            submit(); });
                    }
                    // ── Attachment add / upload ────────────────────────────────────
                    const attAdd = detailBody.querySelector(`#${p}-att-add-${instId}`);
                    const attInput = detailBody.querySelector(`#${p}-att-input-${instId}`);
                    if (attAdd && attInput) {
                        // attAdd is a <label for> → opens the picker natively (mobile-reliable).
                        attInput.addEventListener("change", () => my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                            const files = Array.from(attInput.files || []);
                            attInput.value = "";
                            if (!files.length)
                                return;
                            const oversize = files.find(f => f.size > MEDIA_MAX);
                            if (oversize) {
                                showBanner("error", `"${oversize.name}" exceeds ${humanSize(MEDIA_MAX)}.`);
                                return;
                            }
                            attAdd.disabled = true;
                            attAdd.innerHTML = `<span class="${p}-spin" style="width:12px;height:12px;border-width:2px"></span> Uploading…`;
                            try {
                                const ids = [];
                                for (const f of files) {
                                    const m = yield uploadMedia(f);
                                    ids.push(m.id);
                                }
                                const next = [...(task.attachmentIds || []), ...ids];
                                const res = yield fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ attachmentIds: next }) }));
                                if (!res.ok)
                                    throw new Error(`HTTP ${res.status}`);
                                task.attachmentIds = next;
                                hideBanner();
                            }
                            catch (e) {
                                showBanner("error", `Upload failed: ${e.message}`);
                            }
                            attAdd.disabled = false;
                            attAdd.innerHTML = `${iClip} Add`;
                            renderAttachments(task);
                        }));
                    }
                    // Wire assignee tab switch
                    detailBody.querySelectorAll(`.${p}-assign-tab`).forEach(btn => {
                        btn.addEventListener("click", () => {
                            detailAssignTab = btn.dataset.tab;
                            if (detailTask)
                                renderDetailContent(detailTask);
                        });
                    });
                    const iconCheck = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                    const iconUndo = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`;
                    if (isDone) {
                        detailToggle.className = `${p}-detail-toggle-btn open-btn`;
                        detailToggle.innerHTML = `${iconUndo} Reopen task`;
                    }
                    else {
                        detailToggle.className = `${p}-detail-toggle-btn done-btn`;
                        detailToggle.innerHTML = `${iconCheck} Mark as done`;
                    }
                }
                overlayEl.addEventListener("click", closeDetail);
                detailClose.addEventListener("click", e => { e.stopPropagation(); closeDetail(); });
                const onDocKey = (e) => { if (e.key === "Escape" && (detailTask || detailAudit))
                    closeDetail(); };
                document.addEventListener("keydown", onDocKey);
                self._mtwDocKey = onDocKey;
                detailToggle.addEventListener("click", () => my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                    if (!detailTask)
                        return;
                    const task = detailTask;
                    const isDone = task.status === "DONE" || task.status === "done" || task.status === "CLOSED";
                    const newStatus = isDone ? "OPEN" : "CLOSED";
                    detailToggle.disabled = true;
                    try {
                        const res = yield fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ status: newStatus }) }));
                        if (!res.ok)
                            throw new Error(`HTTP ${res.status}`);
                        task.status = newStatus;
                        if (detailedLogging) {
                            yield fetchUsers();
                            postEditComment(task, statusAction(task, newStatus));
                        }
                        renderDetailContent(task);
                        const cardEl = listWrap.querySelector(`[data-task-id="${task.id}"]`);
                        if (cardEl) {
                            if (!isDone)
                                cardEl.classList.add("done");
                            else
                                cardEl.classList.remove("done");
                        }
                        setTimeout(() => { if (!auditMode) {
                            renderTypeFilters();
                            renderList();
                        }
                        else
                            renderList(); }, 380);
                    }
                    catch (e) {
                        showBanner("error", `Could not update: ${e.message}`);
                    }
                    detailToggle.disabled = false;
                }));
                // ── Sparkle burst ─────────────────────────────────────────────────
                function spawnSparks(wrap, color) {
                    [0, 45, 90, 135, 180, 225, 270, 315].forEach(deg => {
                        const spark = document.createElement("div");
                        spark.className = `${p}-spark`;
                        const rad = (deg * Math.PI) / 180;
                        const dist = 14 + Math.random() * 8;
                        spark.style.cssText = `background:${color};left:50%;top:50%;margin:-2.5px;--tx:${Math.cos(rad) * dist}px;--ty:${Math.sin(rad) * dist}px;`;
                        wrap.appendChild(spark);
                        spark.addEventListener("animationend", () => spark.remove());
                    });
                }
                // ── Toggle task status ────────────────────────────────────────────
                function toggleTask(checkEl) {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        const taskId = checkEl.dataset.taskId;
                        const installId = checkEl.dataset.installId;
                        const currentStatus = checkEl.dataset.status;
                        const isDone = currentStatus === "DONE" || currentStatus === "done" || currentStatus === "CLOSED";
                        const newStatus = isDone ? "OPEN" : "CLOSED";
                        const cardEl = checkEl.closest(`.${p}-card`);
                        const wrap = checkEl.closest(`.${p}-check-wrap`);
                        checkEl.style.pointerEvents = "none";
                        checkEl.classList.remove("pop-done", "pop-undone");
                        void checkEl.offsetWidth;
                        checkEl.classList.add(isDone ? "pop-undone" : "pop-done");
                        if (!isDone) {
                            checkEl.classList.add("checked");
                            if (cardEl)
                                cardEl.classList.add("done");
                            if (wrap)
                                spawnSparks(wrap, primaryColor);
                        }
                        else {
                            checkEl.classList.remove("checked");
                            if (cardEl)
                                cardEl.classList.remove("done");
                        }
                        try {
                            const res = yield fetch(`${baseUrl}/tasks/${installId}/task/${taskId}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ status: newStatus }) }));
                            if (!res.ok)
                                throw new Error(`HTTP ${res.status}`);
                            const task = allTasks.find(t => t.id === taskId);
                            if (task) {
                                task.status = newStatus;
                                if (detailedLogging) {
                                    yield fetchUsers();
                                    postEditComment(task, statusAction(task, newStatus));
                                }
                            }
                            setTimeout(() => { if (!auditMode) {
                                renderTypeFilters();
                                renderList();
                            }
                            else
                                renderList(); }, 420);
                        }
                        catch (e) {
                            if (!isDone) {
                                checkEl.classList.remove("checked");
                                if (cardEl)
                                    cardEl.classList.remove("done");
                            }
                            else {
                                checkEl.classList.add("checked");
                                if (cardEl)
                                    cardEl.classList.add("done");
                            }
                            showBanner("error", `Could not update task: ${e.message}`);
                            checkEl.style.pointerEvents = "";
                        }
                    });
                }
                // ── Status filter ─────────────────────────────────────────────────
                if (!auditMode) {
                    container.querySelectorAll(`.${p}-status-opt`).forEach((btn) => {
                        btn.addEventListener("click", () => {
                            container.querySelectorAll(`.${p}-status-opt`).forEach((b) => b.classList.remove("active"));
                            btn.classList.add("active");
                            activeStatusFilter = btn.dataset.status || "open";
                            renderList();
                        });
                    });
                }
                // ── Locale resolution ─────────────────────────────────────────────
                // Resolve the viewer's locale (once), rebind `t`, set text direction,
                // and refresh the static header/filter labels that were painted in the
                // default locale. List/detail/create content re-reads `t` at render
                // time, so it picks up the new locale automatically.
                let localeApplied = false;
                function applyLocale() {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        var _a;
                        if (localeApplied)
                            return;
                        localeApplied = true;
                        const available = Object.keys(STRINGS);
                        let configLocale = "";
                        try {
                            if (currentUserId) {
                                const r = yield fetch(`${baseUrl}/users/${currentUserId}`, apiOpts());
                                if (r.ok) {
                                    const u = yield r.json();
                                    configLocale = ((_a = u === null || u === void 0 ? void 0 : u.config) === null || _a === void 0 ? void 0 : _a.locale) || "";
                                }
                            }
                        }
                        catch (e) {
                            dlog("locale fetch failed", (e === null || e === void 0 ? void 0 : e.message) || String(e));
                        }
                        locale = detectLocale({ configLocale, available });
                        tr = makeT(STRINGS, locale);
                        const rtl = isRtl(locale);
                        dlog("locale", locale, "configLocale", configLocale || "(none)", "rtl", rtl);
                        // Text direction on the widget root and on the body-attached panels
                        // (overlay/detail/attachment modal live outside `container`, so they
                        // don't inherit its dir).
                        const dir = rtl ? "rtl" : "ltr";
                        try {
                            container.setAttribute("dir", dir);
                        }
                        catch (_) { }
                        try {
                            overlayEl === null || overlayEl === void 0 ? void 0 : overlayEl.setAttribute("dir", dir);
                        }
                        catch (_) { }
                        try {
                            detailEl === null || detailEl === void 0 ? void 0 : detailEl.setAttribute("dir", dir);
                        }
                        catch (_) { }
                        try {
                            attModal === null || attModal === void 0 ? void 0 : attModal.setAttribute("dir", dir);
                        }
                        catch (_) { }
                        // Refresh static labels painted before the locale was known.
                        const setText = (id, val) => { const el = container.querySelector(`#${id}`); if (el)
                            el.textContent = val; };
                        const setAttr = (id, attr, val) => { const el = container.querySelector(`#${id}`); if (el)
                            el.setAttribute(attr, val); };
                        setText(`${p}-title-text`, auditMode ? tr("auditResults") : tr("myTasks"));
                        setText(`${p}-new-label`, tr("newTask"));
                        setAttr(`${p}-new`, "title", tr("newTask"));
                        setAttr(`${p}-refresh`, "title", tr("refresh"));
                        setText(`${p}-audit-tab-label`, tr("auditHistory"));
                        setAttr(`${p}-audit-prev`, "aria-label", tr("scrollLeft"));
                        setAttr(`${p}-audit-next`, "aria-label", tr("scrollRight"));
                        setText(`${p}-type-label`, tr("allTypes"));
                        const st = (s, v) => { const el = container.querySelector(`.${p}-status-opt[data-status="${s}"]`); if (el)
                            el.textContent = v; };
                        st("open", tr("open"));
                        st("done", tr("done"));
                        st("all", tr("both"));
                        // Translate button: only meaningful when the viewer isn't on en_US.
                        const trBtn = container.querySelector(`#${p}-translate`);
                        if (trBtn) {
                            if (locale !== DEFAULT_LOCALE) {
                                trBtn.style.display = "";
                                updateTranslateBtn();
                                trBtn.addEventListener("click", toggleTranslate);
                            }
                            else
                                trBtn.style.display = "none";
                        }
                    });
                }
                // ── On-demand content translation ─────────────────────────────────
                // One batched POST to /api/translations via the logged-in user's session
                // (same auth path as comments). Source = branch default (en_US).
                function translateSend(payload) {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        var _a;
                        const r = yield fetch(`${baseUrl}/translations`, sessionOpts({
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ sourceLanguage: DEFAULT_LOCALE, targetLanguage: locale, contents: { value: payload } }),
                        }));
                        if (!r.ok)
                            throw new Error("translate " + r.status);
                        const d = yield r.json();
                        return ((_a = d === null || d === void 0 ? void 0 : d.contents) === null || _a === void 0 ? void 0 : _a.value) || "";
                    });
                }
                function updateTranslateBtn() {
                    const lbl = container.querySelector(`#${p}-translate-lbl`);
                    if (lbl)
                        lbl.textContent = translateBusy ? tr("translating") : contentTranslated ? tr("showOriginal") : tr("translateBtn");
                }
                function toggleTranslate() {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        if (translateBusy)
                            return;
                        if (!contentTranslated) {
                            const texts = [];
                            for (const t of allTasks) {
                                if (t.title)
                                    texts.push(t.title);
                                if (t.taskType)
                                    texts.push(t.taskType);
                                const cd = t.description ? stripTypeTag(t.description).trim() : "";
                                if (cd) {
                                    texts.push(cd);
                                    // Audit findings render a parsed subset (af.finding) rather than the
                                    // raw cleaned description, so collect that string too.
                                    try {
                                        const af = parseAuditFinding(cd);
                                        if (af && af.finding)
                                            texts.push(af.finding);
                                    }
                                    catch (_) { }
                                }
                            }
                            if (texts.length) {
                                translateBusy = true;
                                updateTranslateBtn();
                                const map = yield translateMap(texts, translateSend);
                                Object.assign(ctCache, map);
                                translateBusy = false;
                            }
                            contentTranslated = true;
                        }
                        else {
                            contentTranslated = false;
                        }
                        updateTranslateBtn();
                        renderList();
                        if (detailTask)
                            renderDetailContent(detailTask);
                    });
                }
                // Load the tasks-plugin installations ("stores") this viewer may see.
                // Two sources, merged + deduped: the classic /installations list (which
                // Panda relies on) plus the tasks-plugin search — the only place that
                // surfaces access-restricted stores — then filtered to the viewer's own
                // access. NOTE: this access check is client-side only; see HANDOVER.md.
                function fetchTaskStores() {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        var _a, _b;
                        let viewerId = "";
                        let viewerGroups = [];
                        try {
                            const prof = yield widgetApi.getUserInformation();
                            viewerId = prof.id || "";
                            viewerGroups = prof.groupIDs || [];
                        }
                        catch (_) { }
                        const titleOf = (i) => { var _a, _b, _c; return ((_c = (_b = (_a = i.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) || i.title || i.name || i.id; };
                        const byId = new Map();
                        // ① /installations — unchanged source; keeps existing behaviour intact.
                        try {
                            const res = yield fetch(`${baseUrl}/installations?limit=200`, apiOpts());
                            if (res.ok) {
                                const d = yield res.json();
                                for (const i of (d.data || d))
                                    if (i.pluginID === "tasks" || i.pluginId === "tasks")
                                        byId.set(i.id, { id: i.id, title: titleOf(i), accessors: (_a = i.accessors) !== null && _a !== void 0 ? _a : null });
                            }
                        }
                        catch (_) { }
                        // ② tasks-plugin search — surfaces access-restricted stores that never
                        // appear in ①. Best-effort: on failure we keep ① (no regression).
                        try {
                            const res = yield fetch(`${baseUrl}/plugins/tasks/installations/search?permission=manage&limit=200&sort=updated_DESC`, apiOpts());
                            if (res.ok) {
                                const d = yield res.json();
                                for (const e of (d.entries || [])) {
                                    const i = e.data || e;
                                    if (!byId.has(i.id))
                                        byId.set(i.id, { id: i.id, title: titleOf(i), accessors: (_b = i.accessors) !== null && _b !== void 0 ? _b : null });
                                }
                            }
                        }
                        catch (_) { }
                        // Access filter: show a store only if it's branch-open, unrestricted,
                        // or names this viewer's id / one of their groups.
                        const canSee = (a) => {
                            if (!a)
                                return true;
                            if (a.branchAccess === true)
                                return true;
                            const hasU = Array.isArray(a.userIds) && a.userIds.length;
                            const hasG = Array.isArray(a.groupIds) && a.groupIds.length;
                            if (!hasU && !hasG)
                                return true;
                            return (hasU && !!viewerId && a.userIds.includes(viewerId)) ||
                                (hasG && a.groupIds.some((g) => viewerGroups.includes(g)));
                        };
                        return [...byId.values()].filter(s => canSee(s.accessors))
                            .map(s => ({ id: s.id, title: s.title }))
                            .sort((a, b) => a.title.localeCompare(b.title));
                    });
                }
                // ── Load data ─────────────────────────────────────────────────────
                function load() {
                    return my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                        var _a, _b, _c, _d, _e, _f;
                        refreshBtn.disabled = true;
                        refreshBtn.innerHTML = `<span class="${p}-spin" style="width:14px;height:14px;border-width:2px"></span>`;
                        hideBanner();
                        allTasks = [];
                        auditLists = [];
                        activeAuditListId = "";
                        activeInstallFilter = "all";
                        activeTypeFilters.clear();
                        dropdownOpen = false;
                        listWrap.innerHTML = `<div class="${p}-state"><span class="${p}-spin" style="width:24px;height:24px;border-width:3px;margin:0 auto 12px;display:block"></span>${tr("loading")}</div>`;
                        try {
                            // Fetch installations ("stores") — merged + access-filtered (see fetchTaskStores)
                            const installations = yield fetchTaskStores();
                            allInstalls = installations; // expose for task creation
                            if (!installations.length) {
                                listWrap.innerHTML = `<div class="${p}-state"><strong>${tr("noTaskSpaces")}</strong>${tr("noTaskSpacesHint")}</div>`;
                                return;
                            }
                            // Fetch current user (always — needed for "other tasks" split in audit mode)
                            try {
                                const profile = yield widgetApi.getUserInformation();
                                currentUserId = profile.id || "";
                                userGroupIds = profile.groupIDs || [];
                                dlog("user", currentUserId, "groups", userGroupIds.length);
                            }
                            catch (e) {
                                dlog("getUserInformation failed", (e === null || e === void 0 ? void 0 : e.message) || String(e));
                            }
                            // Detect the viewer's locale and bind the translation fn.
                            // getUserInformation() does NOT carry locale (verified), so we read
                            // config.locale from GET /api/users/{id} — the only field that
                            // reflects the user's Staffbase language. navigator.language is the
                            // fallback. Available locales come from the branch.
                            yield applyLocale();
                            // Fetch groups → build groupMap (search endpoint + /groups supplement)
                            try {
                                const [searchRes, legacyRes] = yield Promise.all([
                                    fetch(`${baseUrl}/groups/search?limit=100&sort=name_ASC`, apiOpts()),
                                    fetch(`${baseUrl}/groups?limit=200`, apiOpts()),
                                ]);
                                const seen = new Set();
                                if (searchRes.ok) {
                                    const d = yield searchRes.json();
                                    const parseEntry = (e) => { var _a, _b, _c, _d, _e, _f; const inner = e.data || e; return { id: inner.id, name: ((_c = (_b = (_a = inner.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.name) || ((_f = (_e = (_d = inner.config) === null || _d === void 0 ? void 0 : _d.localization) === null || _e === void 0 ? void 0 : _e.en_US) === null || _f === void 0 ? void 0 : _f.title) || inner.name || inner.id }; };
                                    for (const e of (d.entries || d.data || d.results || d.items || (Array.isArray(d) ? d : []))) {
                                        const { id, name } = parseEntry(e);
                                        if (id && name && !seen.has(id)) {
                                            groupMap.set(id, name);
                                            seen.add(id);
                                        }
                                    }
                                }
                                if (legacyRes.ok) {
                                    const gd = yield legacyRes.json();
                                    for (const g of (gd.data || [])) {
                                        const name = ((_c = (_b = (_a = g.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) || ((_f = (_e = (_d = g.config) === null || _d === void 0 ? void 0 : _d.localization) === null || _e === void 0 ? void 0 : _e.en_US) === null || _f === void 0 ? void 0 : _f.name) || g.name || g.id;
                                        if (g.id && name && !seen.has(g.id)) {
                                            groupMap.set(g.id, name);
                                            seen.add(g.id);
                                        }
                                    }
                                }
                            }
                            catch (_) { }
                            // Fetch tasks per installation
                            for (const inst of installations) {
                                try {
                                    const listRes = yield fetch(`${baseUrl}/tasks/${inst.id}/lists`, apiOpts());
                                    const listMap = new Map();
                                    const listIds = [];
                                    if (listRes.ok) {
                                        const listsRaw = yield listRes.json();
                                        const lists = Array.isArray(listsRaw) ? listsRaw : (listsRaw.data || []);
                                        for (const l of lists) {
                                            listMap.set(l.id, l.name || "");
                                            if (l.id)
                                                listIds.push(l.id);
                                        }
                                        listsByInst.set(inst.id, lists.map((l) => ({ id: l.id, name: l.name || l.id })));
                                    }
                                    const perList = yield Promise.all(listIds.map(lid => fetch(`${baseUrl}/tasks/${inst.id}/task?listId=${lid}`, apiOpts())
                                        .then(r => r.ok ? r.json() : null).catch(() => null)));
                                    const seen = new Set();
                                    for (const result of perList) {
                                        if (!result)
                                            continue;
                                        const arr = Array.isArray(result) ? result : (result.data || []);
                                        for (const t of arr) {
                                            if (!t.id || seen.has(t.id))
                                                continue;
                                            if (!showAll && currentUserId && !auditMode) {
                                                // In normal mode: only include tasks assigned to current user/groups
                                                const assigneeIds = t.assigneeIds || [];
                                                const taskGroupIds = t.groupIds || [];
                                                const taskType_ = parseTaskType(t.title || "") || parseTaskType(t.description || "");
                                                if (taskType_ !== "audit-result") {
                                                    const directMatch = assigneeIds.indexOf(currentUserId) !== -1;
                                                    const groupMatch = taskGroupIds.some((gid) => userGroupIds.indexOf(gid) !== -1);
                                                    if (!directMatch && !groupMatch)
                                                        continue;
                                                }
                                            }
                                            // In auditMode: always load all tasks — "mine" vs "other" split happens at render time
                                            seen.add(t.id);
                                            const desc = t.description || "";
                                            const lname = t.taskListId ? (listMap.get(t.taskListId) || "") : "";
                                            let taskType = parseTaskType(t.title || "") || parseTaskType(desc);
                                            // Recurring-task templates are hidden system tasks — never show them.
                                            if (taskType === "recur-template") {
                                                seen.delete(t.id);
                                                continue;
                                            }
                                            // Audit-generated tasks have no [type] tag — surface them as an
                                            // "Audit" type so they're filterable in the normal (non-audit) view.
                                            if (!taskType && (/^\s*Audit finding:/i.test(desc) || /^\s*Audit\s*[—–-]/i.test(lname)))
                                                taskType = "Audit";
                                            const sevM = desc.match(/(?:^|\n)\s*Severity:\s*([A-Za-z]+)/i);
                                            // Recurring tasks stamped [lvl: critical] surface as Critical (same badge as audit criticals).
                                            const lvlM = desc.match(LVL_REGEX);
                                            const lvlCritical = !!lvlM && lvlM[1].trim().toLowerCase() === "critical";
                                            allTasks.push({
                                                id: t.id, title: t.title || "(no title)", description: desc,
                                                status: t.status || "OPEN", priority: t.priority || "Priority_3",
                                                dueDate: t.dueDate || null, taskType,
                                                installationId: inst.id, installationTitle: inst.title,
                                                listId: t.taskListId || "",
                                                listName: lname,
                                                groupIds: t.groupIds || [], assigneeIds: t.assigneeIds || [],
                                                attachmentIds: t.attachmentIds || [],
                                                auditSeverity: lvlCritical ? "Critical" : (sevM ? sevM[1] : undefined),
                                                isRecurring: RECUR_REGEX.test(desc),
                                            });
                                        }
                                    }
                                }
                                catch (_) { }
                            }
                            // Sort: open first, then by due date
                            allTasks.sort((a, b) => {
                                const aDone = a.status === "DONE" || a.status === "done" || a.status === "CLOSED";
                                const bDone = b.status === "DONE" || b.status === "done" || b.status === "CLOSED";
                                if (aDone !== bDone)
                                    return aDone ? 1 : -1;
                                if (a.dueDate && b.dueDate)
                                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                                if (a.dueDate)
                                    return -1;
                                if (b.dueDate)
                                    return 1;
                                return 0;
                            });
                            // Register distinct types (sorted) so each gets a stable palette color, no repeats until exhausted.
                            TYPE_ORDER = Array.from(new Set(allTasks.map(t => t.taskType).filter((x) => !!x))).sort();
                            // Identify audit lists (lists containing an audit-result system task)
                            const auditListIds = new Map(); // listId → system task
                            for (const t of allTasks) {
                                if (t.taskType === "audit-result" && t.listId && !auditListIds.has(t.listId)) {
                                    auditListIds.set(t.listId, t);
                                }
                            }
                            // Build AuditList entries
                            for (const [listId, sysTask] of auditListIds) {
                                let parsedAudit = null;
                                try {
                                    const desc = sysTask.description || "";
                                    const jsonStart = desc.indexOf("{");
                                    if (jsonStart >= 0)
                                        parsedAudit = JSON.parse(desc.slice(jsonStart));
                                }
                                catch (_) { }
                                auditLists.push({
                                    listId, listName: sysTask.listName,
                                    installId: sysTask.installationId, instTitle: sysTask.installationTitle,
                                    systemTask: sysTask, parsedAudit,
                                });
                            }
                            // Sort audits newest first — parse the datetime out of the list name
                            // ("Audit — May 8, 2026 3:19 PM"); the name carries the time, so it
                            // disambiguates same-day audits that parsedAudit.date (day-only) cannot.
                            const auditTime = (al) => {
                                var _a;
                                const fromName = Date.parse(al.listName.replace(/^Audit\s*—\s*/i, "").trim());
                                if (!isNaN(fromName))
                                    return fromName;
                                const fromJson = ((_a = al.parsedAudit) === null || _a === void 0 ? void 0 : _a.date) ? Date.parse(al.parsedAudit.date) : NaN;
                                return isNaN(fromJson) ? 0 : fromJson;
                            };
                            auditLists.sort((a, b) => auditTime(b) - auditTime(a));
                            if (auditLists.length > 0)
                                activeAuditListId = auditLists[0].listId;
                            if (auditMode) {
                                renderStoreTabs(); // store pills based on audit installs
                                renderAuditTabs();
                                renderList();
                            }
                            else {
                                renderStoreTabs();
                                renderTypeFilters();
                                renderList();
                                if (allTasks.filter(t => t.taskType !== "audit-result").length === 0) {
                                    showBanner("info", "No tasks found. Your manager can enable \"Show All Tasks\" to see all store tasks.");
                                }
                            }
                        }
                        catch (e) {
                            listWrap.innerHTML = `<div class="${p}-state"><strong>${tr("failedToLoad")}</strong>${esc(e.message)}</div>`;
                        }
                        refreshBtn.disabled = false;
                        refreshBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
                    });
                }
                refreshBtn.addEventListener("click", load);
                // ── Create task sheet ─────────────────────────────────────────────────
                if (allowCreate && !auditMode) {
                    const newBtn = container.querySelector(`#${p}-new`);
                    let createEl = null;
                    const closeCreate = () => { if (!createEl)
                        return; createEl.classList.remove("open"); overlayEl.classList.remove("open"); };
                    const openCreate = () => {
                        var _a;
                        if (!allInstalls.length) {
                            showBanner("error", "No task spaces available yet — try Refresh.");
                            return;
                        }
                        if (!createEl) {
                            createEl = document.createElement("div");
                            createEl.className = `${p}-create`;
                            createEl.dataset.sbPortal = instId;
                            document.body.appendChild(createEl);
                            self._mtwCreate = createEl;
                        }
                        const instOpts = allInstalls.map(i => `<option value="${esc(i.id)}">${esc(i.title)}</option>`).join("");
                        const firstInst = allInstalls[0].id;
                        const listOpts = (id) => (listsByInst.get(id) || []).map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join("");
                        const existingTypes = [...new Set(allTasks.filter(t => t.taskType && t.taskType !== "audit-result").map(t => t.taskType))].sort();
                        const typeOpts = existingTypes.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
                        createEl.innerHTML = `
            <div class="${p}-create-head"><h3>${tr("newTaskHeading")}</h3>
              <button type="button" class="${p}-create-close" id="${p}-c-x"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div class="${p}-create-body">
              <div class="${p}-fld"><label>${tr("title")}</label><input class="${p}-in" id="${p}-c-title" placeholder="${tr("titlePlaceholder")}"></div>
              <div class="${p}-fld"><label>${tr("description")}</label><textarea class="${p}-in" id="${p}-c-desc" placeholder="${tr("descriptionPlaceholder")}"></textarea></div>
              ${allInstalls.length > 1 ? `<div class="${p}-fld"><label>${esc(storeSingular)}</label><select class="${p}-sel" id="${p}-c-inst">${instOpts}</select></div>` : `<input type="hidden" id="${p}-c-inst" value="${esc(firstInst)}">`}
              <div class="${p}-fld"><label>${tr("list")}</label><select class="${p}-sel" id="${p}-c-list">${listOpts(firstInst)}</select></div>
              <div class="${p}-fld"><label>${tr("type")}</label>
                <select class="${p}-sel" id="${p}-c-type">
                  <option value="">${tr("noType")}</option>
                  ${typeOpts}
                  <option value="__new__">${tr("createNewType")}</option>
                </select>
                <input class="${p}-in" id="${p}-c-type-new" placeholder="${tr("newTypePlaceholder")}" style="display:none;margin-top:8px">
              </div>
              <div class="${p}-fld-row">
                <div class="${p}-fld"><label>${tr("dueDate")}</label><input type="date" class="${p}-in" id="${p}-c-due"></div>
                <div class="${p}-fld"><label>${tr("priority")}</label><select class="${p}-sel" id="${p}-c-prio"><option value="Priority_3">${tr("normal")}</option><option value="Priority_2">${tr("medium")}</option><option value="Priority_1">${tr("high")}</option><option value="critical">${tr("critical")}</option></select></div>
              </div>
            </div>
            <div class="${p}-create-foot">
              <button type="button" class="${p}-btn-cancel" id="${p}-c-cancel">${tr("cancel")}</button>
              <button type="button" class="${p}-btn-save" id="${p}-c-save">${tr("createTask")}</button>
            </div>`;
                        const $ = (id) => createEl.querySelector(`#${p}-${id}`);
                        const instSel = $("c-inst");
                        const listSel = $("c-list");
                        if (instSel && instSel.tagName === "SELECT") {
                            instSel.addEventListener("change", () => { listSel.innerHTML = listOpts(instSel.value); });
                        }
                        const typeSel = $("c-type");
                        const typeNew = $("c-type-new");
                        typeSel.addEventListener("change", () => {
                            const isNew = typeSel.value === "__new__";
                            typeNew.style.display = isNew ? "block" : "none";
                            if (isNew)
                                typeNew.focus();
                        });
                        $("c-x").addEventListener("click", closeCreate);
                        $("c-cancel").addEventListener("click", closeCreate);
                        $("c-save").addEventListener("click", () => my_tasks_widget_awaiter(this, void 0, void 0, function* () {
                            const title = ($("c-title").value || "").trim();
                            if (!title) {
                                $("c-title").focus();
                                return;
                            }
                            const instId2 = $("c-inst").value;
                            const listId = listSel.value;
                            if (!listId) {
                                showBanner("error", "That space has no list to add the task to.");
                                return;
                            }
                            const desc = ($("c-desc").value || "").trim();
                            const taskType = (typeSel.value === "__new__" ? (typeNew.value || "") : typeSel.value).trim();
                            // Embed the type as a [type: X] tag in the description — same convention
                            // the tasks-integration-widget uses and parseTaskType() reads on load.
                            let finalDesc = desc;
                            if (taskType)
                                finalDesc = finalDesc ? `${finalDesc} [type: ${taskType}]` : `[type: ${taskType}]`;
                            const due = $("c-due").value; // yyyy-mm-dd
                            // "Critical" isn't a Staffbase priority — map it to Priority_1 and stamp [lvl: critical]
                            // (same convention the recurring runner uses) so it round-trips as Critical, not High.
                            const prioVal = $("c-prio").value || "Priority_3";
                            const isCritical = prioVal === "critical";
                            const prio = isCritical ? "Priority_1" : prioVal;
                            if (isCritical)
                                finalDesc = finalDesc ? `${finalDesc} [lvl: critical]` : `[lvl: critical]`;
                            const saveBtn = $("c-save");
                            saveBtn.disabled = true;
                            saveBtn.textContent = tr("creating");
                            try {
                                const body = { title, status: "OPEN", priority: prio, taskListId: listId };
                                if (finalDesc)
                                    body.description = finalDesc;
                                if (due)
                                    body.dueDate = `${due}T00:00:00.000Z`;
                                const r = yield fetch(`${baseUrl}/tasks/${instId2}/task`, Object.assign(Object.assign({ method: "POST" }, apiOpts()), { body: JSON.stringify(body) }));
                                if (!r.ok)
                                    throw new Error(`HTTP ${r.status}`);
                                closeCreate();
                                hideBanner();
                                yield load();
                            }
                            catch (e) {
                                showBanner("error", `${tr("createFailedPrefix")} ${e.message}`);
                                saveBtn.disabled = false;
                                saveBtn.textContent = tr("createTask");
                            }
                        }));
                        // Side panel on desktop, bottom sheet on mobile (matches detail panel).
                        createEl.classList.toggle("side", window.innerWidth >= 720);
                        overlayEl.classList.add("open");
                        requestAnimationFrame(() => createEl.classList.add("open"));
                        (_a = $("c-title")) === null || _a === void 0 ? void 0 : _a.focus();
                    };
                    newBtn === null || newBtn === void 0 ? void 0 : newBtn.addEventListener("click", openCreate);
                    overlayEl.addEventListener("click", closeCreate);
                }
                load();
            });
        }
        disconnectedCallback() {
            const self = this;
            if (self._mtwOverlay) {
                self._mtwOverlay.remove();
                self._mtwOverlay = undefined;
            }
            if (self._mtwDetail) {
                self._mtwDetail.remove();
                self._mtwDetail = undefined;
            }
            if (self._mtwAModal) {
                self._mtwAModal.remove();
                self._mtwAModal = undefined;
            }
            if (self._mtwCreate) {
                self._mtwCreate.remove();
                self._mtwCreate = undefined;
            }
            if (self._mtwDocClick) {
                document.removeEventListener("click", self._mtwDocClick);
                self._mtwDocClick = undefined;
            }
            if (self._mtwDocKey) {
                document.removeEventListener("keydown", self._mtwDocKey);
                self._mtwDocKey = undefined;
            }
            if (self._mtwVV && window.visualViewport) {
                window.visualViewport.removeEventListener("resize", self._mtwVV);
                window.visualViewport.removeEventListener("scroll", self._mtwVV);
                self._mtwVV = undefined;
            }
        }
        static get observedAttributes() {
            return ["apitoken", "baseurl", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor", "storelabelsingular", "storelabelplural", "typecolors", "showalltasks", "showdonetasks", "auditmode", "enablecomments", "allowtaskcreation", "allowtaskassignment", "notifyonassign", "detailedlogging", "debugmode"];
        }
    };
};
// ── Block registration ────────────────────────────────────────────────────────
const blockDefinition = {
    name: "my-tasks-widget", label: "My Tasks Widget",
    attributes: ["apitoken", "baseurl", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor", "storelabelsingular", "storelabelplural", "typecolors", "showalltasks", "showdonetasks", "auditmode", "enablecomments", "allowtaskcreation", "allowtaskassignment", "notifyonassign", "detailedlogging", "debugmode", "limitheight", "maxheight"],
    factory, configurationSchema, uiSchema, blockLevel: "block", iconUrl: "",
};
window.defineBlock({ blockDefinition, author: "Staffbase", version: "1.0.0" });

/******/ })()
;