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
        recurringTasks: "Recurring Tasks",
        list: "List",
        calendar: "Calendar",
        newBtn: "New",
        taskDetails: "Task Details",
        title: "Title",
        titlePlaceholder: "What needs to be done?",
        description: "Description",
        descriptionPlaceholder: "Add details (optional)",
        type: "Type",
        noType: "— No type —",
        createNewType: "+ Create new type…",
        newTypePlaceholder: "New type name",
        priority: "Priority",
        normal: "Normal",
        medium: "Medium",
        high: "High",
        critical: "Critical",
        recurrence: "Recurrence",
        repeats: "Repeats",
        every: "Every",
        days: "day(s)",
        weeks: "week(s)",
        months: "month(s)",
        onDay: "On day",
        onThe: "On the",
        last: "last",
        timeOfDay: "Time of day",
        dueDaysAfter: "Due (days after)",
        startDate: "Start date",
        endDate: "End date",
        optional: "(optional)",
        recurrenceHelp: "Created at the chosen time (within ~15 min). Starts today by default.",
        targetStores: "Target {stores}",
        findStores: "Find {stores}",
        loadingStores: "Loading {stores}…",
        searchStores: "Search {stores}…",
        loading: "Loading…",
        listHelp: 'Tasks land in a "Recurring Tasks" list in each {store}.',
        assignTo: "Assign To",
        searchUsersGroups: "Search users and groups…",
        users: "Users",
        groups: "Groups",
        cancel: "Cancel",
        createSchedule: "Create Schedule",
        saveChanges: "Save Changes",
        errorLoading: "Error loading",
        failedToLoad: "Failed to load",
        selectStore: "Select a {store}…",
        noStoresFound: "No {stores} found",
        failedLoadStores: "Failed to load {stores}",
        noSchedulesYet: "No recurring schedules yet.",
        clickNewToCreate: "Click <b>New</b> to create one.",
        month: "Month",
        today: "Today",
        pickWeekday: "Pick at least one weekday.",
        startNotPast: "Start date can't be in the past.",
        endAfterStart: "End date must be on or after the start date.",
        close: "Close",
        delete: "Delete",
        edit: "Edit",
        nextRun: "Next run",
        activeRange: "Active range",
        due: "Due",
        assignedTo: "Assigned to",
        anyoneWithAccess: "Anyone with access to the list",
        threeDay: "3 Day",
        daysAfterCreation: "{n} days after creation",
        tomorrow: "Tomorrow",
        nextPrefix: "Next:",
        rangeStarts: "Starts {date} · no end date",
        tasksWillBeCreated: "Tasks will be created — {summary}",
        scheduleSavedMsg: "Schedule saved to {n} {store}. Tasks will be created automatically — {summary}.",
        everyDay: "Every day",
        everyNDays: "Every {n} days",
        weekly: "Weekly",
        everyNWeeks: "Every {n} weeks",
        everyWeekday: "Every weekday",
        monthly: "Monthly",
        everyNMonths: "Every {n} months",
        ruleOnDays: "{every} on {days}",
        ruleOnDom: "{every} on day {dom}",
        ruleOnNth: "{every} on the {ord} {day}",
        ruleAtTime: "{base} at {time} {tz}",
        ord1: "1st", ord2: "2nd", ord3: "3rd", ord4: "4th", ordLast: "last",
        sfEveryDay: "every day",
        sfEveryNDays: "every {n} days",
        sfEveryWeekday: "every weekday",
        sfEveryWeekend: "every weekend",
        sfDaysWeekly: "{days} every week",
        sfDaysEveryNWeek: "{days} every {ord} week",
        sfEveryDom: "every {ord}",
        sfEveryNDom: "every {int} {ord}",
        sfEveryNth: "every {nth} {day}",
        sfEveryNMoNth: "every {int} mo · {nth} {day}",
    },
    de_DE: {
        recurringTasks: "Wiederkehrende Aufgaben",
        list: "Liste",
        calendar: "Kalender",
        newBtn: "Neu",
        taskDetails: "Aufgabendetails",
        title: "Titel",
        titlePlaceholder: "Was ist zu tun?",
        description: "Beschreibung",
        descriptionPlaceholder: "Details hinzufügen (optional)",
        type: "Typ",
        noType: "— Kein Typ —",
        createNewType: "+ Neuen Typ erstellen…",
        newTypePlaceholder: "Name des neuen Typs",
        priority: "Priorität",
        normal: "Normal",
        medium: "Mittel",
        high: "Hoch",
        critical: "Kritisch",
        recurrence: "Wiederholung",
        repeats: "Wiederholt sich",
        every: "Alle",
        days: "Tag(e)",
        weeks: "Woche(n)",
        months: "Monat(e)",
        onDay: "Am Tag",
        onThe: "Am",
        last: "letzten",
        timeOfDay: "Uhrzeit",
        dueDaysAfter: "Fällig (Tage danach)",
        startDate: "Startdatum",
        endDate: "Enddatum",
        optional: "(optional)",
        recurrenceHelp: "Wird zur gewählten Zeit erstellt (innerhalb von ~15 Min.). Beginnt standardmäßig heute.",
        targetStores: "Ziel-{stores}",
        findStores: "{stores} finden",
        loadingStores: "{stores} werden geladen…",
        searchStores: "{stores} suchen…",
        loading: "Wird geladen…",
        listHelp: 'Aufgaben landen in einer Liste „Wiederkehrende Aufgaben" in jeder {store}.',
        assignTo: "Zuweisen an",
        searchUsersGroups: "Benutzer und Gruppen suchen…",
        users: "Benutzer",
        groups: "Gruppen",
        cancel: "Abbrechen",
        createSchedule: "Zeitplan erstellen",
        saveChanges: "Änderungen speichern",
        errorLoading: "Fehler beim Laden",
        failedToLoad: "Laden fehlgeschlagen",
        selectStore: "{store} auswählen…",
        noStoresFound: "Keine {stores} gefunden",
        failedLoadStores: "{stores} konnten nicht geladen werden",
        noSchedulesYet: "Noch keine wiederkehrenden Zeitpläne.",
        clickNewToCreate: "Klicken Sie auf <b>Neu</b>, um einen zu erstellen.",
        month: "Monat",
        today: "Heute",
        pickWeekday: "Wählen Sie mindestens einen Wochentag.",
        startNotPast: "Das Startdatum darf nicht in der Vergangenheit liegen.",
        endAfterStart: "Das Enddatum muss am oder nach dem Startdatum liegen.",
        close: "Schließen",
        delete: "Löschen",
        edit: "Bearbeiten",
        nextRun: "Nächste Ausführung",
        activeRange: "Aktiver Zeitraum",
        due: "Fällig",
        assignedTo: "Zugewiesen an",
        anyoneWithAccess: "Jeder mit Zugriff auf die Liste",
        threeDay: "3 Tage",
        daysAfterCreation: "{n} Tage nach Erstellung",
        tomorrow: "Morgen",
        nextPrefix: "Nächste:",
        rangeStarts: "Beginnt am {date} · kein Enddatum",
        tasksWillBeCreated: "Aufgaben werden erstellt — {summary}",
        scheduleSavedMsg: "Zeitplan für {n} {store} gespeichert. Aufgaben werden automatisch erstellt — {summary}.",
        everyDay: "Jeden Tag",
        everyNDays: "Alle {n} Tage",
        weekly: "Wöchentlich",
        everyNWeeks: "Alle {n} Wochen",
        everyWeekday: "Jeden Wochentag",
        monthly: "Monatlich",
        everyNMonths: "Alle {n} Monate",
        ruleOnDays: "{every} am {days}",
        ruleOnDom: "{every} am {dom}. Tag",
        ruleOnNth: "{every} am {ord} {day}",
        ruleAtTime: "{base} um {time} {tz}",
        ord1: "1.", ord2: "2.", ord3: "3.", ord4: "4.", ordLast: "letzten",
        sfEveryDay: "jeden Tag",
        sfEveryNDays: "alle {n} Tage",
        sfEveryWeekday: "jeden Wochentag",
        sfEveryWeekend: "jedes Wochenende",
        sfDaysWeekly: "{days} jede Woche",
        sfDaysEveryNWeek: "{days} jede {ord} Woche",
        sfEveryDom: "jeden {ord}",
        sfEveryNDom: "alle {int} {ord}",
        sfEveryNth: "jeden {nth} {day}",
        sfEveryNMoNth: "alle {int} Mon · {nth} {day}",
    },
    ar_SA: {
        recurringTasks: "المهام المتكررة",
        list: "قائمة",
        calendar: "تقويم",
        newBtn: "جديد",
        taskDetails: "تفاصيل المهمة",
        title: "العنوان",
        titlePlaceholder: "ما الذي يجب إنجازه؟",
        description: "الوصف",
        descriptionPlaceholder: "أضف تفاصيل (اختياري)",
        type: "النوع",
        noType: "— بلا نوع —",
        createNewType: "+ إنشاء نوع جديد…",
        newTypePlaceholder: "اسم النوع الجديد",
        priority: "الأولوية",
        normal: "عادية",
        medium: "متوسطة",
        high: "عالية",
        critical: "حرجة",
        recurrence: "التكرار",
        repeats: "يتكرر",
        every: "كل",
        days: "يوم/أيام",
        weeks: "أسبوع/أسابيع",
        months: "شهر/أشهر",
        onDay: "في يوم",
        onThe: "في",
        last: "الأخير",
        timeOfDay: "وقت اليوم",
        dueDaysAfter: "الاستحقاق (بعد أيام)",
        startDate: "تاريخ البدء",
        endDate: "تاريخ الانتهاء",
        optional: "(اختياري)",
        recurrenceHelp: "تُنشأ في الوقت المحدد (خلال ~15 دقيقة). تبدأ اليوم افتراضيًا.",
        targetStores: "{stores} المستهدفة",
        findStores: "ابحث عن {stores}",
        loadingStores: "جارٍ تحميل {stores}…",
        searchStores: "ابحث في {stores}…",
        loading: "جارٍ التحميل…",
        listHelp: 'تظهر المهام في قائمة «المهام المتكررة» في كل {store}.',
        assignTo: "إسناد إلى",
        searchUsersGroups: "ابحث عن مستخدمين ومجموعات…",
        users: "المستخدمون",
        groups: "المجموعات",
        cancel: "إلغاء",
        createSchedule: "إنشاء جدول",
        saveChanges: "حفظ التغييرات",
        errorLoading: "خطأ في التحميل",
        failedToLoad: "فشل التحميل",
        selectStore: "اختر {store}…",
        noStoresFound: "لم يتم العثور على {stores}",
        failedLoadStores: "فشل تحميل {stores}",
        noSchedulesYet: "لا توجد جداول متكررة بعد.",
        clickNewToCreate: "انقر على <b>جديد</b> لإنشاء واحد.",
        month: "شهر",
        today: "اليوم",
        pickWeekday: "اختر يوم أسبوع واحدًا على الأقل.",
        startNotPast: "لا يمكن أن يكون تاريخ البدء في الماضي.",
        endAfterStart: "يجب أن يكون تاريخ الانتهاء في تاريخ البدء أو بعده.",
        close: "إغلاق",
        delete: "حذف",
        edit: "تعديل",
        nextRun: "التشغيل التالي",
        activeRange: "النطاق النشط",
        due: "الاستحقاق",
        assignedTo: "مُسنَدة إلى",
        anyoneWithAccess: "أي شخص لديه حق الوصول إلى القائمة",
        threeDay: "3 أيام",
        daysAfterCreation: "{n} يوم بعد الإنشاء",
        tomorrow: "غدًا",
        nextPrefix: "التالي:",
        rangeStarts: "يبدأ في {date} · بلا تاريخ انتهاء",
        tasksWillBeCreated: "ستُنشأ المهام — {summary}",
        scheduleSavedMsg: "تم حفظ الجدول لـ {n} {store}. ستُنشأ المهام تلقائيًا — {summary}.",
        everyDay: "كل يوم",
        everyNDays: "كل {n} أيام",
        weekly: "أسبوعيًا",
        everyNWeeks: "كل {n} أسابيع",
        everyWeekday: "كل يوم عمل",
        monthly: "شهريًا",
        everyNMonths: "كل {n} أشهر",
        ruleOnDays: "{every} يوم {days}",
        ruleOnDom: "{every} في اليوم {dom}",
        ruleOnNth: "{every} في {ord} {day}",
        ruleAtTime: "{base} الساعة {time} {tz}",
        ord1: "الأول", ord2: "الثاني", ord3: "الثالث", ord4: "الرابع", ordLast: "الأخير",
        sfEveryDay: "كل يوم",
        sfEveryNDays: "كل {n} أيام",
        sfEveryWeekday: "كل يوم عمل",
        sfEveryWeekend: "كل عطلة أسبوع",
        sfDaysWeekly: "{days} كل أسبوع",
        sfDaysEveryNWeek: "{days} كل {ord} أسبوع",
        sfEveryDom: "كل {ord}",
        sfEveryNDom: "كل {int} {ord}",
        sfEveryNth: "كل {nth} {day}",
        sfEveryNMoNth: "كل {int} شهر · {nth} {day}",
    },
};

;// ./recurring-tasks-widget.ts


// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_API_TOKEN = "NjljMjU3N2JjZmFjZWYxMzc4MzIzYTNkOkp6VEpkaGlfclRyRDk4bjlBZ2pIdXFkcmI3UjQhdl1LTm1RV1hwOHBIdUd+Unl3clk7MjYhSS1JdiprLGdOaVI=";
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#da2e32";
const DEFAULT_ACCENT_COLOR = "#da2e32";
// System task type that marks a template task. Hidden from normal task views
// (my-tasks-widget filters it the same way it filters "audit-result").
const TEMPLATE_TYPE = "recur-template";
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
    // Lean toward white text: only genuinely light backgrounds get dark text.
    return L > 0.45 ? "#1a1a1a" : "#ffffff";
}
// ── Recurrence model & encoding ─────────────────────────────────────────────────
//
// A "schedule" is authored here and stored as one hidden template task per target
// store. The schedule definition lives in the template's description as an [rrule:]
// tag, alongside a [type: recur-template] marker. Example:
//
//   Some description text [type: recur-template] [rrule: id=ab12;f=WEEKLY;i=1;d=MO,WE;time=09:00;tz=America/New_York;due=0;lvl=critical;t=safety;s=2026-05-29]
//
// The Apps Script / Azure runner reads these templates and, on each occurrence,
// creates a real task stamped with a [recur: <id>@<YYYY-MM-DD>] dedup marker.
const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const RRULE_REGEX = /\[rrule:\s*([^\]]+)\]/i;
const TYPE_REGEX = /\[type:\s*([^\]]+)\]/i;
const RECUR_REGEX = /\[recur:\s*([^\]]+)\]/i;
function defaultRule(tz) {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return {
        freq: "DAILY", interval: 1, byday: ["MO", "TU", "WE", "TH", "FR"],
        monthMode: "dom", dom: today.getDate(), nth: 1, nthWeekday: WEEKDAYS[today.getDay()],
        time: "09:00", tz, dueOffset: 0, level: "normal", taskType: "", start: iso, end: "",
    };
}
// Priority levels — "critical" is the custom level mirrored from the audit widget
// (above High, styled red). Staffbase only has 3 priorities, so critical & high
// both map to Priority_1; the distinct level is preserved in the rule for display.
const LEVELS = [
    { v: "normal", label: "Normal", pr: "Priority_3" },
    { v: "medium", label: "Medium", pr: "Priority_2" },
    { v: "high", label: "High", pr: "Priority_1" },
    { v: "critical", label: "Critical", pr: "Priority_1" },
];
function levelToPriority(level) { return (LEVELS.find(l => l.v === level) || LEVELS[0]).pr; }
function levelLabel(level) { return (LEVELS.find(l => l.v === level) || LEVELS[0]).label; }
function priorityToLevel(pr) { return pr === "Priority_1" ? "high" : pr === "Priority_2" ? "medium" : "normal"; }
function encodeRule(r) {
    const kv = [
        `f=${r.freq}`, `i=${r.interval}`, `time=${r.time}`, `tz=${r.tz}`,
        `due=${r.dueOffset}`, `lvl=${r.level}`, `s=${r.start}`,
    ];
    if (r.end)
        kv.push(`e=${r.end}`);
    if (r.freq === "WEEKLY")
        kv.push(`d=${r.byday.join(",")}`);
    if (r.freq === "MONTHLY") {
        kv.push(`mm=${r.monthMode}`);
        if (r.monthMode === "dom")
            kv.push(`dom=${r.dom}`);
        else
            kv.push(`nth=${r.nth}`, `nthd=${r.nthWeekday}`);
    }
    if (r.taskType)
        kv.push(`t=${encodeURIComponent(r.taskType)}`);
    return kv.join(";");
}
function parseRule(blob, fallbackTz) {
    const r = defaultRule(fallbackTz);
    for (const part of blob.split(";")) {
        const eq = part.indexOf("=");
        if (eq < 0)
            continue;
        const k = part.slice(0, eq).trim();
        const v = part.slice(eq + 1).trim();
        switch (k) {
            case "f":
                if (v === "DAILY" || v === "WEEKLY" || v === "MONTHLY")
                    r.freq = v;
                break;
            case "i":
                r.interval = Math.max(1, parseInt(v, 10) || 1);
                break;
            case "d":
                r.byday = v.split(",").map(s => s.trim().toUpperCase()).filter(x => WEEKDAYS.includes(x));
                break;
            case "mm":
                r.monthMode = v === "nth" ? "nth" : "dom";
                break;
            case "dom":
                r.dom = Math.min(31, Math.max(1, parseInt(v, 10) || 1));
                break;
            case "nth":
                r.nth = parseInt(v, 10) || 1;
                break;
            case "nthd":
                if (WEEKDAYS.includes(v.toUpperCase()))
                    r.nthWeekday = v.toUpperCase();
                break;
            case "time":
                if (/^\d{1,2}:\d{2}$/.test(v))
                    r.time = v;
                break;
            case "tz":
                if (v)
                    r.tz = v;
                break;
            case "due":
                r.dueOffset = parseInt(v, 10) || 0;
                break;
            case "lvl":
                if (LEVELS.some(l => l.v === v))
                    r.level = v;
                break;
            case "pr":
                if (/^Priority_[123]$/.test(v))
                    r.level = priorityToLevel(v);
                break; // back-compat
            case "t":
                r.taskType = decodeURIComponent(v);
                break;
            case "s":
                if (/^\d{4}-\d{2}-\d{2}$/.test(v))
                    r.start = v;
                break;
            case "e":
                if (/^\d{4}-\d{2}-\d{2}$/.test(v))
                    r.end = v;
                break;
        }
    }
    return r;
}
// Strip the schedule / system tags from a template description to recover the
// human-readable description.
function stripTags(text) {
    return text
        .replace(RRULE_REGEX, "")
        .replace(TYPE_REGEX, "")
        .replace(RECUR_REGEX, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}
// Does this rule fire on the given (local) calendar date? Time-of-day is not
// considered here — that's the runner's concern; this answers "which day".
function firesOn(r, date) {
    const start = new Date(`${r.start}T00:00:00`);
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (d < new Date(start.getFullYear(), start.getMonth(), start.getDate()))
        return false;
    if (r.end) {
        const [ey, em, ed] = r.end.split("-").map(Number);
        if (d > new Date(ey, em - 1, ed))
            return false;
    }
    if (r.freq === "DAILY") {
        const days = Math.round((d.getTime() - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) / 86400000);
        return days % r.interval === 0;
    }
    if (r.freq === "WEEKLY") {
        if (!r.byday.includes(WEEKDAYS[d.getDay()]))
            return false;
        // Whole weeks (Sunday-anchored) between the start's week and this week.
        const startWeek = new Date(start);
        startWeek.setDate(start.getDate() - start.getDay());
        const thisWeek = new Date(d);
        thisWeek.setDate(d.getDate() - d.getDay());
        const weeks = Math.round((thisWeek.getTime() - startWeek.getTime()) / (7 * 86400000));
        return weeks % r.interval === 0;
    }
    // MONTHLY
    const months = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
    if (months < 0 || months % r.interval !== 0)
        return false;
    if (r.monthMode === "dom") {
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        // Clamp to month length so "31" still fires on the last day of short months.
        return d.getDate() === Math.min(r.dom, lastDay);
    }
    // nth weekday of the month (nth = -1 means last)
    if (WEEKDAYS[d.getDay()] !== r.nthWeekday)
        return false;
    if (r.nth === -1) {
        const next = new Date(d);
        next.setDate(d.getDate() + 7);
        return next.getMonth() !== d.getMonth();
    }
    return Math.ceil(d.getDate() / 7) === r.nth;
}
// ── Widget factory ────────────────────────────────────────────────────────────
const factory = (BaseBlockClass, widgetApi) => {
    return class RecurringTasksWidget extends BaseBlockClass {
        constructor() { super(); }
        async renderBlock(container) {
            var _a;
            const apiToken = this.getAttribute("apitoken") || DEFAULT_API_TOKEN;
            const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/$/, "");
            const primaryColor = this.getAttribute("primarycolor") || DEFAULT_PRIMARY_COLOR;
            const accentColor = this.getAttribute("accentcolor") || DEFAULT_ACCENT_COLOR;
            const primaryRgb = hexToRgb(primaryColor);
            const primaryText = contrastColor(primaryColor);
            const bgColor = this.getAttribute("backgroundcolor") || "";
            const storeS = this.getAttribute("storelabelsingular") || "Store";
            const storeP = this.getAttribute("storelabelplural") || "Stores";
            const typeList = (this.getAttribute("tasktypes") || "Finance,Operations,Training,Compliance,Safety")
                .split(",").map(s => s.trim()).filter(Boolean);
            // Valid hex colors only; if blank/all-cleared, palette stays empty → original color system.
            TYPE_PALETTE = (this.getAttribute("typecolors") || "").split(",").map(s => s.trim()).filter(c => /^#?[0-9a-fA-F]{3,8}$/.test(c)).map(c => c[0] === "#" ? c : `#${c}`);
            // Register types up front (configured list + any seen on schedules) so colors are stable & repeat-free.
            TYPE_ORDER = Array.from(new Set(typeList.map(t => t.toLowerCase()))).sort();
            const p = "rtw";
            const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
            // ── Locale / i18n ──────────────────────────────────────────────────
            // `tr` (not `t`) to avoid clashing with loop vars named `t`. Resolved
            // before the skeleton is built (see below), so first paint is localized.
            let locale = DEFAULT_LOCALE;
            let tr = makeT(STRINGS, locale);
            // ── State ──────────────────────────────────────────────────────────
            let storeProjects = [];
            let selectedStores = [];
            let allUsers = [];
            let allGroups = [];
            let selectedAssignees = [];
            let schedules = [];
            let rule = defaultRule(localTz);
            let editingId = null;
            let view = "list";
            let calMode = "3day";
            let calCursor = new Date(); // 4day: first visible day · month: any day in the month
            // ── Helpers ────────────────────────────────────────────────────────
            const authHeaders = () => ({ Authorization: `Basic ${apiToken}`, "Content-Type": "application/json" });
            const apiOpts = (extra) => (Object.assign(Object.assign({}, extra), { credentials: "omit", headers: authHeaders() }));
            const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const genId = () => (crypto === null || crypto === void 0 ? void 0 : crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
            // "EST" / "PST" etc. for the chosen timezone
            function tzAbbrev(tz) {
                var _a;
                try {
                    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date());
                    return ((_a = parts.find(x => x.type === "timeZoneName")) === null || _a === void 0 ? void 0 : _a.value) || tz;
                }
                catch (_) {
                    return tz;
                }
            }
            // Locale tag for Intl (en_US → en-US). Read at call time so it reflects
            // the resolved viewer locale.
            const loc = () => locale.replace("_", "-");
            // Localized weekday name for a WEEKDAYS code (SU…SA). Jan 7 2024 = Sunday.
            const dayName = (code, style) => {
                const idx = WEEKDAYS.indexOf(code);
                if (idx < 0)
                    return code;
                try {
                    return new Date(2024, 0, 7 + idx).toLocaleDateString(loc(), { weekday: style });
                }
                catch (_) {
                    return code;
                }
            };
            const ord = (nth) => tr("ord" + (nth === "-1" ? "Last" : nth));
            function fmtTime12(t) {
                const [hStr, m] = t.split(":");
                try {
                    return new Date(2024, 0, 1, parseInt(hStr, 10), parseInt(m, 10)).toLocaleTimeString(loc(), { hour: "numeric", minute: "2-digit" });
                }
                catch (_) {
                    let h = parseInt(hStr, 10);
                    const ap = h >= 12 ? "PM" : "AM";
                    h = h % 12 || 12;
                    return `${h}:${m} ${ap}`;
                }
            }
            const ordinal = (n) => {
                const lang = locale.split("_")[0];
                if (lang === "de")
                    return n + ".";
                if (lang === "ar")
                    return String(n);
                const s = ["th", "st", "nd", "rd"], v = n % 100;
                return n + (s[(v - 20) % 10] || s[v] || s[0]);
            };
            // Compact frequency tag for calendar blocks, e.g. "Mon/Thu every week", "every 29th", "every 2nd 29th".
            function shortFreq(r) {
                if (r.freq === "DAILY")
                    return r.interval === 1 ? tr("sfEveryDay") : tr("sfEveryNDays").replace("{n}", String(r.interval));
                if (r.freq === "WEEKLY") {
                    const sel = WEEKDAYS.filter(d => r.byday.includes(d));
                    const isWeekdays = sel.length === 5 && !sel.includes("SA") && !sel.includes("SU");
                    const isWeekends = sel.length === 2 && sel.includes("SA") && sel.includes("SU");
                    if (r.interval === 1 && isWeekdays)
                        return tr("sfEveryWeekday");
                    if (r.interval === 1 && isWeekends)
                        return tr("sfEveryWeekend");
                    const days = sel.map(d => dayName(d, "short")).join("/") || "—";
                    return (r.interval === 1 ? tr("sfDaysWeekly") : tr("sfDaysEveryNWeek").replace("{ord}", ordinal(r.interval))).replace("{days}", days);
                }
                if (r.monthMode === "dom") {
                    return r.interval === 1 ? tr("sfEveryDom").replace("{ord}", ordinal(r.dom)) : tr("sfEveryNDom").replace("{int}", ordinal(r.interval)).replace("{ord}", ordinal(r.dom));
                }
                const nth = r.nth === -1 ? ord("-1") : ordinal(r.nth);
                return (r.interval === 1 ? tr("sfEveryNth") : tr("sfEveryNMoNth").replace("{int}", ordinal(r.interval))).replace("{nth}", nth).replace("{day}", dayName(r.nthWeekday, "short"));
            }
            function summarizeRule(r) {
                let base;
                if (r.freq === "DAILY") {
                    base = r.interval === 1 ? tr("everyDay") : tr("everyNDays").replace("{n}", String(r.interval));
                }
                else if (r.freq === "WEEKLY") {
                    const days = r.byday.length ? r.byday.map(d => dayName(d, "short")).join(", ") : "—";
                    const isWeekdays = r.byday.length === 5 && ["MO", "TU", "WE", "TH", "FR"].every(d => r.byday.includes(d));
                    const every = r.interval === 1 ? tr("weekly") : tr("everyNWeeks").replace("{n}", String(r.interval));
                    base = isWeekdays && r.interval === 1 ? tr("everyWeekday") : tr("ruleOnDays").replace("{every}", every).replace("{days}", days);
                }
                else {
                    const every = r.interval === 1 ? tr("monthly") : tr("everyNMonths").replace("{n}", String(r.interval));
                    base = r.monthMode === "dom"
                        ? tr("ruleOnDom").replace("{every}", every).replace("{dom}", String(r.dom))
                        : tr("ruleOnNth").replace("{every}", every).replace("{ord}", ord(String(r.nth))).replace("{day}", dayName(r.nthWeekday, "long"));
                }
                return tr("ruleAtTime").replace("{base}", base).replace("{time}", fmtTime12(r.time)).replace("{tz}", tzAbbrev(r.tz));
            }
            // Current wall-clock in a timezone, as date parts + minutes-since-midnight.
            function tzNowParts(tz) {
                try {
                    const parts = {};
                    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
                        .formatToParts(new Date()).forEach(x => { parts[x.type] = x.value; });
                    return { y: +parts.year, m: +parts.month, d: +parts.day, min: (+parts.hour % 24) * 60 + (+parts.minute) };
                }
                catch (_) {
                    const n = new Date();
                    return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate(), min: n.getHours() * 60 + n.getMinutes() };
                }
            }
            function nextRun(r) {
                const now = tzNowParts(r.tz);
                const schedMin = parseInt(r.time.split(":")[0], 10) * 60 + parseInt(r.time.split(":")[1], 10);
                for (let i = 0; i < 400; i++) {
                    const d = new Date(now.y, now.m - 1, now.d + i);
                    if (!firesOn(r, d))
                        continue;
                    if (i === 0 && now.min >= schedMin)
                        continue; // today's slot already passed
                    let label;
                    try {
                        label = i === 0 ? tr("today") : i === 1 ? tr("tomorrow") : d.toLocaleDateString(loc(), { weekday: "short", month: "short", day: "numeric" });
                    }
                    catch (_) {
                        label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    }
                    return `${label}, ${fmtTime12(r.time)}`;
                }
                return "—";
            }
            // ── Resolve locale before first paint ──────────────────────────────
            // No user is fetched elsewhere in this widget, so we read it here:
            // getUserInformation() → id → GET /users/{id} → config.locale. Done
            // before the skeleton so the whole form renders in the right language.
            try {
                const prof = await widgetApi.getUserInformation();
                let configLocale = "";
                const uid = (prof === null || prof === void 0 ? void 0 : prof.id) || "";
                if (uid) {
                    const r = await fetch(`${baseUrl}/users/${uid}`, apiOpts());
                    if (r.ok) {
                        const u = await r.json();
                        configLocale = ((_a = u === null || u === void 0 ? void 0 : u.config) === null || _a === void 0 ? void 0 : _a.locale) || "";
                    }
                }
                locale = detectLocale({ configLocale, available: Object.keys(STRINGS) });
                tr = makeT(STRINGS, locale);
            }
            catch (_) { /* keep default locale */ }
            const rtl = isRtl(locale);
            try {
                container.setAttribute("dir", rtl ? "rtl" : "ltr");
            }
            catch (_) { }
            // ── Render shell ────────────────────────────────────────────────────
            container.innerHTML = `
        <style>
          .${p} {
            --primary: ${primaryColor}; --primary-rgb: ${primaryRgb}; --primary-text: ${primaryText};
            --accent: ${accentColor};
            --dark:#1A1A1A; --gray:#6b7280; --gray-lt:#9ca3af; --border:#e5e7eb;
            --success:#2E7D4A; --error:#C41E3A;
            --r-sm:6px; --r-md:10px; --r-lg:14px;
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
            --shadow-md: 0 4px 16px rgba(0,0,0,0.08);
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            color:var(--dark); background:${bgColor || "transparent"}; padding:20px;
          }
          .${p} *, .${p} *::before, .${p} *::after { box-sizing:border-box; margin:0; padding:0; }

          /* Header + view toggle */
          .${p}-top { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
          .${p}-h1 { font-size:18px; font-weight:800; color:var(--dark); display:flex; align-items:center; gap:8px; }
          .${p}-h1 svg { color:var(--primary); }
          .${p}-top-actions { display:flex; align-items:center; gap:8px; }
          .${p}-seg { display:inline-flex; background:#f3f4f6; border-radius:var(--r-md); padding:3px; }
          .${p}-seg button {
            border:none; background:none; cursor:pointer; font-family:inherit;
            font-size:12px; font-weight:700; color:var(--gray); padding:6px 12px;
            border-radius:7px; display:inline-flex; align-items:center; gap:6px; transition:all .15s;
          }
          .${p}-seg button.active { background:#fff; color:var(--primary); box-shadow:var(--shadow-sm); }
          .${p}-seg svg { width:14px; height:14px; }

          /* Cards (matches tasks-integration-widget) */
          .${p}-card { background:#fff; border-radius:var(--r-lg); box-shadow:var(--shadow-sm);
            border:1px solid var(--border); border-inline-start:3px solid var(--primary); margin-bottom:12px; }
          .${p}-card-head { display:flex; align-items:center; gap:10px; padding:14px 18px 12px; border-bottom:1px solid var(--border); }
          .${p}-step { width:22px; height:22px; border-radius:50%; background:var(--primary); color:var(--primary-text);
            font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
          .${p}-card-title { font-size:12px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; color:var(--dark); }
          .${p}-card-body { padding:16px 18px; }

          .${p}-label { display:block; font-size:12px; font-weight:600; color:var(--gray);
            text-transform:uppercase; letter-spacing:.4px; margin-bottom:6px; }
          /* div (not <p>) + !important to dodge Staffbase's global rich-text "p" rule (16px/26px/24px margin). */
          .${p}-help { font-size:12px!important; line-height:1.45!important; font-weight:400!important; color:var(--gray-lt)!important; margin:5px 0 0!important; }
          .${p}-in, .${p}-select, textarea.${p}-in {
            width:100%; padding:10px 13px; border:1.5px solid var(--border); border-radius:var(--r-md);
            font-size:14px; font-family:inherit; color:var(--dark); background:#fafafa;
            transition:border-color .15s, box-shadow .15s;
          }
          textarea.${p}-in { resize:vertical; min-height:64px; line-height:1.4; }
          .${p}-in::placeholder { color:var(--gray-lt); }
          .${p}-in:focus, .${p}-select:focus { outline:none; border-color:var(--primary); background:#fff;
            box-shadow:0 0 0 3px rgba(var(--primary-rgb),.1); }
          .${p}-fld { margin-bottom:14px; }
          .${p}-fld:last-child { margin-bottom:0; }
          .${p}-row { display:flex; gap:10px; }
          .${p}-row .${p}-fld { flex:1; min-width:0; }

          /* Recurrence controls */
          .${p}-inline { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
          .${p}-num { width:64px; text-align:center; }
          .${p}-wd { display:flex; gap:6px; flex-wrap:wrap; margin-top:4px; }
          .${p}-wd button {
            width:38px; height:38px; border-radius:50%; border:1.5px solid var(--border);
            background:#fafafa; color:var(--gray); font-family:inherit; font-size:12px; font-weight:700;
            cursor:pointer; transition:all .15s;
          }
          .${p}-wd button.on { background:var(--primary); color:var(--primary-text); border-color:var(--primary); }
          .${p}-mode { display:flex; flex-direction:column; gap:10px; margin-top:6px; }
          .${p}-mode-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:14px; color:var(--dark); }
          .${p}-radio { width:16px; height:16px; accent-color:var(--primary); flex-shrink:0; }
          .${p}-time-note { margin-top:8px; font-size:13px; color:var(--primary); font-weight:600; display:flex; align-items:center; gap:6px; }
          .${p}-time-note svg { width:14px; height:14px; flex-shrink:0; }

          /* Multi-select (stores) — from tasks-integration-widget */
          .${p}-ms-wrap { position:relative; }
          .${p}-ms-trigger { width:100%; min-height:44px; padding:8px 36px 8px 11px; border:1.5px solid var(--border);
            border-radius:var(--r-md); background:#fafafa; cursor:pointer; display:flex; flex-wrap:wrap; gap:6px;
            align-items:center; position:relative; transition:border-color .15s; }
          .${p}-ms-trigger:hover, .${p}-ms-trigger.open { border-color:var(--primary); background:#fff; }
          .${p}-ms-trigger::after { content:'▾'; position:absolute; right:11px; top:50%; transform:translateY(-50%);
            color:var(--gray-lt); pointer-events:none; font-size:13px; }
          .${p}-ms-ph { color:var(--gray-lt); font-size:14px; }
          .${p}-tag { display:inline-flex; align-items:center; gap:4px; background:var(--primary); color:var(--primary-text);
            padding:3px 8px; border-radius:20px; font-size:12px; font-weight:600; }
          .${p}-tag-x { cursor:pointer; opacity:.75; line-height:1; }
          .${p}-tag-x:hover { opacity:1; }
          .${p}-dropdown { display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; background:#fff;
            border:1.5px solid var(--primary); border-radius:var(--r-md); box-shadow:var(--shadow-md); overflow:hidden; z-index:200; }
          .${p}-dropdown.show { display:block; }
          .${p}-dd-search { padding:9px 10px; border-bottom:1px solid var(--border); }
          .${p}-dd-search input { width:100%; padding:7px 10px; border:1.5px solid var(--border); border-radius:var(--r-sm);
            font-size:13px; background:#fafafa; font-family:inherit; }
          .${p}-dd-search input:focus { outline:none; border-color:var(--primary); background:#fff; }
          .${p}-dd-list { max-height:210px; overflow-y:auto; }
          .${p}-dd-opt { padding:10px 12px; cursor:pointer; display:flex; align-items:center; gap:9px; font-size:13px;
            border-bottom:1px solid #f3f4f6; transition:background .1s; }
          .${p}-dd-opt:last-child { border-bottom:none; }
          .${p}-dd-opt:hover { background:#fef2f2; }
          .${p}-dd-opt.sel { background:rgba(var(--primary-rgb),.06); }
          .${p}-check { width:16px; height:16px; border:1.5px solid #d1d5db; border-radius:3px; flex-shrink:0; font-size:10px;
            display:flex; align-items:center; justify-content:center; color:transparent; }
          .${p}-dd-opt.sel .${p}-check { background:var(--primary); border-color:var(--primary); color:#fff; }
          .${p}-dd-msg { padding:20px; text-align:center; color:var(--gray-lt); font-size:13px; }

          /* Assignee picker — from tasks-integration-widget */
          .${p}-assign-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
          .${p}-assign-chip { display:inline-flex; align-items:center; gap:5px; padding:3px 8px 3px 4px; border-radius:20px;
            background:rgba(var(--primary-rgb),.07); border:1px solid rgba(var(--primary-rgb),.2); font-size:12px; font-weight:500; color:var(--dark); }
          .${p}-assign-chip-av { width:20px; height:20px; border-radius:50%; overflow:hidden; background:var(--primary);
            color:var(--primary-text); display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; flex-shrink:0; }
          .${p}-assign-chip-av img { width:100%; height:100%; object-fit:cover; }
          .${p}-assign-chip-x { cursor:pointer; color:var(--gray); font-size:14px; line-height:1; margin-inline-start:2px; opacity:.6; }
          .${p}-assign-chip-x:hover { opacity:1; }
          .${p}-assign-search input { width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:var(--r-sm);
            font-size:13px; font-family:inherit; outline:none; background:#fafafa; }
          .${p}-assign-search input:focus { border-color:var(--primary); background:#fff; }
          .${p}-assign-tabs { display:flex; gap:4px; margin:8px 0; }
          .${p}-assign-tab { flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:var(--r-sm);
            font-size:12px; font-weight:600; background:#f9fafb; color:var(--gray); cursor:pointer; text-align:center;
            transition:all .15s; font-family:inherit; user-select:none; }
          .${p}-assign-tab.active { background:var(--primary); color:var(--primary-text); border-color:var(--primary); }
          .${p}-assign-list { max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--r-sm); background:#fff; }
          .${p}-assign-opt { display:flex; align-items:center; gap:10px; padding:8px 12px; cursor:pointer;
            transition:background .1s; border-bottom:1px solid #f3f4f6; }
          .${p}-assign-opt:last-child { border-bottom:none; }
          .${p}-assign-opt:hover { background:#f9fafb; }
          .${p}-assign-opt.sel { background:rgba(var(--primary-rgb),.04); }
          .${p}-assign-avatar { width:30px; height:30px; border-radius:50%; overflow:hidden; flex-shrink:0; background:var(--primary);
            color:var(--primary-text); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; }
          .${p}-assign-avatar img { width:100%; height:100%; object-fit:cover; }
          .${p}-assign-name { font-size:13px; color:var(--dark); flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
          .${p}-assign-chk { width:16px; height:16px; border-radius:4px; border:2px solid var(--border); background:#fff;
            display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:11px; color:transparent; }
          .${p}-assign-opt.sel .${p}-assign-chk { background:var(--primary); border-color:var(--primary); color:#fff; }
          .${p}-assign-empty { padding:20px; text-align:center; font-size:13px; color:var(--gray-lt); }

          /* Buttons */
          .${p}-btn { padding:9px 14px; border:none; border-radius:var(--r-md); font-size:13px; font-weight:600;
            font-family:inherit; cursor:pointer; display:inline-flex; align-items:center; gap:6px; white-space:nowrap; transition:all .2s; }
          .${p}-btn svg { width:16px; height:16px; }
          .${p}-btn:disabled { opacity:.4; cursor:not-allowed; box-shadow:none !important; transform:none !important; }
          .${p}-btn-primary { background:var(--primary); color:var(--primary-text); box-shadow:0 3px 10px rgba(var(--primary-rgb),.3); }
          .${p}-btn-primary:hover:not(:disabled) { filter:brightness(.88); transform:translateY(-1px); box-shadow:0 5px 16px rgba(var(--primary-rgb),.4); }
          .${p}-btn-ghost { background:#f3f4f6; color:var(--gray); }
          .${p}-btn-ghost:hover { background:var(--border); color:var(--dark); }
          .${p}-foot { display:flex; gap:10px; margin-top:4px; }
          .${p}-foot .${p}-btn { flex:1; justify-content:center; padding:12px; }
          .${p}-spin { width:14px; height:14px; border-radius:50%; border:2px solid rgba(255,255,255,.35); border-top-color:#fff;
            animation:${p}-spin .7s linear infinite; flex-shrink:0; }
          @keyframes ${p}-spin { to { transform:rotate(360deg); } }

          /* Pin our button backgrounds so Staffbase's global ".mouse button:hover{background-color:…}"
             (and .touch .button.active) can't recolor them on hover/active/focus. */
          .${p}-btn-primary, .${p}-btn-primary:hover, .${p}-btn-primary:focus,
          .${p}-detail-edit, .${p}-detail-edit:hover, .${p}-detail-edit:focus { background:var(--primary)!important; color:var(--primary-text)!important; }
          .${p}-btn-ghost, .${p}-btn-ghost:focus { background:#f3f4f6!important; }
          .${p}-btn-ghost:hover { background:var(--border)!important; }
          .${p}-detail-del, .${p}-detail-del:hover, .${p}-detail-del:focus { background:#fee2e2!important; color:var(--error)!important; }
          .${p}-seg button, .${p}-seg button:hover, .${p}-seg button:focus,
          .${p}-cal-modeseg button, .${p}-cal-modeseg button:hover, .${p}-cal-modeseg button:focus { background:none!important; }
          .${p}-seg button.active, .${p}-cal-modeseg button.active { background:#fff!important; }
          .${p}-ico-btn, .${p}-ico-btn:focus { background:none!important; }
          .${p}-ico-btn:hover { background:#f3f4f6!important; }
          .${p}-ico-btn.danger:hover { background:#fee2e2!important; }
          .${p}-wd button, .${p}-wd button:focus { background:#fafafa!important; }
          .${p}-wd button:hover { background:rgba(var(--primary-rgb),.07)!important; }
          .${p}-wd button.on, .${p}-wd button.on:hover, .${p}-wd button.on:focus { background:var(--primary)!important; color:var(--primary-text)!important; }
          .${p}-detail-close, .${p}-detail-close:focus { background:#f3f4f6!important; }
          .${p}-detail-close:hover { background:var(--border)!important; }

          /* Status banner */
          .${p}-status { display:none; padding:11px 15px; border-radius:var(--r-md); margin-top:12px; font-size:13px; line-height:1.5; }
          .${p}-status.success { background:rgba(46,125,74,.08); border:1px solid rgba(46,125,74,.25); color:var(--success); }
          .${p}-status.error   { background:rgba(196,30,58,.08); border:1px solid rgba(196,30,58,.25); color:var(--error); }
          .${p}-status.info    { background:rgba(var(--primary-rgb),.06); border:1px solid rgba(var(--primary-rgb),.2); color:var(--primary); }

          /* Schedule list */
          .${p}-sched { background:#fff; border:1px solid var(--border); border-inline-start:3px solid var(--primary);
            border-radius:var(--r-lg); box-shadow:var(--shadow-sm); padding:14px 16px; margin-bottom:10px; }
          .${p}-sched-top { display:flex; align-items:flex-start; gap:10px; }
          .${p}-sched-main { flex:1; min-width:0; }
          .${p}-sched-title { font-size:15px; font-weight:700; color:var(--dark); margin-bottom:3px; word-break:break-word; }
          .${p}-sched-sum { font-size:13px; color:var(--gray); display:flex; align-items:center; gap:6px; }
          .${p}-sched-sum svg { width:13px; height:13px; color:var(--gray-lt); flex-shrink:0; }
          .${p}-sched-meta { display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; }
          .${p}-pill { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:var(--gray);
            background:#f3f4f6; border:1px solid var(--border); border-radius:20px; padding:3px 9px; }
          .${p}-pill svg { width:11px; height:11px; opacity:.7; }
          .${p}-pill.next { background:rgba(var(--primary-rgb),.07); border-color:rgba(var(--primary-rgb),.2); color:var(--primary); }
          .${p}-pill.crit { background:rgba(196,30,58,.1); border-color:rgba(196,30,58,.28); color:var(--error); }
          .${p}-pill.high { background:rgba(217,119,6,.1); border-color:rgba(217,119,6,.28); color:#B45309; }
          .${p}-type-badge { display:inline-flex; align-items:center; font-size:11px; font-weight:700; line-height:1.4; border-radius:20px; padding:3px 9px; }
          .${p}-sched-acts { display:flex; gap:4px; flex-shrink:0; }
          .${p}-ico-btn { width:30px; height:30px; border:none; background:none; border-radius:var(--r-sm); cursor:pointer;
            color:var(--gray-lt); display:flex; align-items:center; justify-content:center; transition:all .15s; }
          .${p}-ico-btn:hover { background:#f3f4f6; color:var(--dark); }
          .${p}-ico-btn.danger:hover { background:#fee2e2; color:var(--error); }
          .${p}-empty { text-align:center; padding:40px 20px; color:var(--gray-lt); }
          .${p}-empty svg { width:42px; height:42px; opacity:.4; margin-bottom:12px; }
          .${p}-empty div { font-size:14px!important; line-height:1.5!important; margin:0!important; color:var(--gray-lt)!important; }

          /* Calendar shell */
          .${p}-cal { background:#fff; border:1px solid var(--border); border-radius:var(--r-lg); box-shadow:var(--shadow-sm); overflow:hidden; }
          .${p}-cal-head { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; border-bottom:1px solid var(--border); flex-wrap:wrap; }
          .${p}-cal-range { font-size:15px; font-weight:800; color:var(--dark); }
          .${p}-cal-ctrls { display:flex; align-items:center; gap:8px; }
          .${p}-cal-nav { display:flex; gap:2px; }
          .${p}-cal-modeseg { display:inline-flex; background:#f3f4f6; border-radius:var(--r-md); padding:3px; }
          .${p}-cal-modeseg button { border:none; background:none; cursor:pointer; font-family:inherit; font-size:11px; font-weight:700;
            color:var(--gray); padding:5px 14px; border-radius:7px; transition:all .15s; white-space:nowrap; min-width:64px; text-align:center; }
          .${p}-cal-modeseg button.active { background:#fff; color:var(--primary); box-shadow:var(--shadow-sm); }

          /* 4-day (agenda) view */
          .${p}-cal-cols { display:grid; grid-template-columns:repeat(3,1fr); }
          .${p}-cal-col { border-inline-end:1px solid #f3f4f6; min-height:280px; }
          .${p}-cal-col:last-child { border-inline-end:none; }
          .${p}-cal-colhead { text-align:center; padding:9px 4px 7px; border-bottom:1px solid var(--border); }
          .${p}-cal-dow2 { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--gray-lt); }
          .${p}-cal-dnum { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:50%;
            font-size:16px; font-weight:800; color:var(--dark); margin-top:3px; }
          .${p}-cal-colhead.today .${p}-cal-dnum { background:var(--primary); color:var(--primary-text); }
          .${p}-cal-evs { padding:6px; display:flex; flex-direction:column; gap:5px; }
          .${p}-ev { background:rgba(var(--primary-rgb),.10); border-inline-start:3px solid var(--primary); border-radius:6px;
            padding:5px 8px; cursor:pointer; transition:background .12s; }
          .${p}-ev:hover {
            background-color:rgba(var(--primary-rgb),.06);
            background-image:repeating-linear-gradient(45deg, rgba(var(--primary-rgb),.14) 0, rgba(var(--primary-rgb),.14) 5px, transparent 5px, transparent 10px);
          }
          .${p}-ev-time { font-size:10px; font-weight:700; color:var(--primary); }
          .${p}-ev-freq { display:inline-flex; align-items:center; margin-top:4px; padding:2px 8px; border-radius:20px;
            background:#fff; border:1px solid var(--primary); color:var(--primary); font-size:10px; font-weight:600; line-height:1.4; }
          .${p}-ev-title { font-size:12px; font-weight:600; color:var(--dark); margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
          .${p}-ev-desc { font-size:11px; font-weight:400; color:var(--gray); line-height:1.3; margin-top:2px;
            display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
          .${p}-col-empty { padding:14px 8px; text-align:center; color:#d1d5db; font-size:11px; }

          /* Month overview */
          .${p}-cal-dow { display:grid; grid-template-columns:repeat(7,1fr); background:#f9fafb; border-bottom:1px solid var(--border); }
          .${p}-cal-dow span { padding:7px 0; text-align:center; font-size:10px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; color:var(--gray-lt); }
          .${p}-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); }
          .${p}-cal-cell { min-height:78px; border-inline-end:1px solid #f3f4f6; border-bottom:1px solid #f3f4f6; padding:5px 6px; cursor:pointer; transition:background .12s; }
          .${p}-cal-cell:nth-child(7n) { border-inline-end:none; }
          .${p}-cal-cell.muted { background:#fafafa; }
          .${p}-cal-cell:hover { background:rgba(var(--primary-rgb),.05); }
          .${p}-cal-cell.today .${p}-cal-num { background:var(--primary); color:var(--primary-text); }
          .${p}-cal-num { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; font-size:12px; font-weight:600; color:var(--dark); }
          .${p}-cal-cell.muted .${p}-cal-num { color:var(--gray-lt); }
          .${p}-cal-chip { font-size:10px; font-weight:600; color:var(--primary); background:rgba(var(--primary-rgb),.12);
            border-radius:4px; padding:1px 5px; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
          .${p}-cal-more { font-size:10px; color:var(--gray-lt); margin-top:2px; font-weight:600; }

          .${p}-loading { text-align:center; padding:30px; color:var(--gray-lt); font-size:13px; }

          /* Detail panel — mobile bottom sheet / desktop side panel (body-appended) */
          .${p}-overlay { position:fixed; inset:0; z-index:99998; background:rgba(0,0,0,.45); opacity:0; pointer-events:none; transition:opacity .25s ease; }
          .${p}-overlay.open { opacity:1; pointer-events:auto; }
          .${p}-detail {
            --primary:${primaryColor}; --primary-rgb:${primaryRgb}; --primary-text:${primaryText};
            --dark:#1A1A1A; --gray:#6b7280; --gray-lt:#9ca3af; --border:#e5e7eb; --success:#2E7D4A; --error:#C41E3A;
            --r-sm:6px; --r-md:10px; --r-lg:14px;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            position:fixed; left:0; right:0; bottom:0; z-index:99999; background:#fff;
            border-radius:20px 20px 0 0; max-height:88vh; display:flex; flex-direction:column;
            transform:translateY(102%); transition:transform .32s cubic-bezier(.32,.72,0,1);
            overflow:hidden; box-shadow:0 -8px 40px rgba(0,0,0,.18);
          }
          .${p}-detail.open { transform:translateY(0); }
          .${p}-detail.side { left:auto; top:0; right:0; bottom:0; width:min(420px,92vw); max-height:none;
            border-radius:20px 0 0 20px; transform:translateX(102%); box-shadow:-8px 0 40px rgba(0,0,0,.18); }
          .${p}-detail.side.open { transform:translateX(0); }
          .${p}-detail-handle { width:40px; height:5px; border-radius:3px; background:var(--border); margin:9px auto 2px; flex-shrink:0; cursor:grab; touch-action:none; }
          .${p}-detail.side .${p}-detail-handle { display:none; }
          .${p}-detail-head { display:flex; align-items:flex-start; gap:10px; padding:14px 20px 12px; flex-shrink:0; border-bottom:1px solid var(--border); touch-action:none; }
          .${p}-detail-badges { display:flex; gap:6px; flex-wrap:wrap; flex:1; align-items:center; }
          .${p}-detail-close { width:28px; height:28px; border-radius:50%; border:none; background:#f3f4f6; cursor:pointer;
            display:flex; align-items:center; justify-content:center; color:var(--gray); flex-shrink:0; font-family:inherit; transition:background .15s,color .15s; }
          .${p}-detail-close:hover { background:var(--border); color:var(--dark); }
          .${p}-detail-body { flex:1; overflow-y:auto; padding:18px 20px; min-height:0; }
          .${p}-detail-title { font-size:18px; font-weight:800; color:var(--dark); line-height:1.3; margin-bottom:16px; word-break:break-word; }
          .${p}-detail-meta { display:flex; flex-direction:column; gap:13px; margin-bottom:16px; }
          .${p}-detail-row { display:flex; align-items:flex-start; gap:10px; font-size:13px; color:var(--dark); }
          .${p}-detail-row > svg { width:15px; height:15px; flex-shrink:0; color:var(--gray-lt); margin-top:2px; }
          .${p}-detail-row b { font-weight:700; color:var(--gray-lt); font-size:10px; text-transform:uppercase; letter-spacing:.5px; display:block; margin-bottom:3px; }
          .${p}-detail-row .v { color:var(--dark); line-height:1.4; }
          .${p}-detail-stores { display:flex; flex-direction:column; gap:3px; }
          .${p}-detail-desc-label { font-size:11px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; color:var(--gray-lt); margin-bottom:6px; }
          .${p}-detail-desc { font-size:13px; color:var(--gray); line-height:1.6; white-space:pre-wrap; word-break:break-word; }
          .${p}-detail-foot { display:flex; gap:10px; padding:14px 20px; border-top:1px solid var(--border); flex-shrink:0; }
          .${p}-detail-foot button { flex:1; padding:12px; border-radius:var(--r-md); border:none; font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px; }
          .${p}-detail-foot button svg { width:15px; height:15px; }
          .${p}-detail-edit { background:var(--primary); color:var(--primary-text); box-shadow:0 3px 10px rgba(var(--primary-rgb),.3); }
          .${p}-detail-del { background:#fee2e2; color:var(--error); }
          .${p}-sched { cursor:pointer; }
          .${p}-ev { }

          @media (max-width:600px) {
            .${p} { padding:14px; }
            .${p}-card-body { padding:14px; }
            .${p}-cal-cell { min-height:60px; }
            .${p}-row { flex-direction:column; gap:0; }
          }
        
          /* RTL: flip horizontal directional arrows */
          [dir="rtl"] .rtw-tabs-arrow{transform:scaleX(-1)} [dir="rtl"] .rtw-cal-nav .rtw-ico-btn svg{transform:scaleX(-1)}
        </style>

        <div class="${p}">
          <div class="${p}-top">
            <div class="${p}-h1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><polyline points="12 7 12 12 15 14"/></svg>
              ${tr("recurringTasks")}
            </div>
            <div class="${p}-top-actions">
              <div class="${p}-seg" id="${p}-seg">
                <button data-v="list" class="active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>${tr("list")}</button>
                <button data-v="calendar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${tr("calendar")}</button>
              </div>
              <button class="${p}-btn ${p}-btn-primary" id="${p}-new"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>${tr("newBtn")}</button>
            </div>
          </div>

          <div id="${p}-view-list"></div>
          <div id="${p}-view-cal" style="display:none"></div>

          <!-- Schedule form -->
          <div id="${p}-form" style="display:none">
            <div class="${p}-card">
              <div class="${p}-card-head"><span class="${p}-step">1</span><span class="${p}-card-title">${tr("taskDetails")}</span></div>
              <div class="${p}-card-body">
                <div class="${p}-fld"><label class="${p}-label">${tr("title")}</label><input class="${p}-in" id="${p}-f-title" placeholder="${tr("titlePlaceholder")}"></div>
                <div class="${p}-fld"><label class="${p}-label">${tr("description")}</label><textarea class="${p}-in" id="${p}-f-desc" placeholder="${tr("descriptionPlaceholder")}"></textarea></div>
                <div class="${p}-row">
                  <div class="${p}-fld"><label class="${p}-label">${tr("type")}</label>
                    <select class="${p}-select" id="${p}-f-type">
                      <option value="">${tr("noType")}</option>
                      ${typeList.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
                      <option value="__new__">${tr("createNewType")}</option>
                    </select>
                    <input class="${p}-in" id="${p}-f-type-new" placeholder="${tr("newTypePlaceholder")}" style="display:none;margin-top:8px">
                  </div>
                  <div class="${p}-fld"><label class="${p}-label">${tr("priority")}</label>
                    <select class="${p}-select" id="${p}-f-prio">
                      ${LEVELS.map(l => `<option value="${l.v}">${tr(l.v)}</option>`).join("")}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div class="${p}-card">
              <div class="${p}-card-head"><span class="${p}-step">2</span><span class="${p}-card-title">${tr("recurrence")}</span></div>
              <div class="${p}-card-body">
                <div class="${p}-fld">
                  <label class="${p}-label">${tr("repeats")}</label>
                  <div class="${p}-inline">
                    <span style="font-size:14px;color:var(--gray)">${tr("every")}</span>
                    <input type="number" min="1" class="${p}-in ${p}-num" id="${p}-f-interval" value="1">
                    <select class="${p}-select" id="${p}-f-freq" style="width:auto;flex:1">
                      <option value="DAILY">${tr("days")}</option><option value="WEEKLY">${tr("weeks")}</option><option value="MONTHLY">${tr("months")}</option>
                    </select>
                  </div>
                  <div id="${p}-f-weekly" style="display:none">
                    <div class="${p}-wd" id="${p}-f-wd"></div>
                  </div>
                  <div id="${p}-f-monthly" style="display:none">
                    <div class="${p}-mode">
                      <label class="${p}-mode-row"><input type="radio" name="${p}-mm" value="dom" class="${p}-radio" checked> ${tr("onDay")}
                        <input type="number" min="1" max="31" class="${p}-in ${p}-num" id="${p}-f-dom" value="1"></label>
                      <label class="${p}-mode-row"><input type="radio" name="${p}-mm" value="nth" class="${p}-radio"> ${tr("onThe")}
                        <select class="${p}-select" id="${p}-f-nth" style="width:auto"><option value="1">1st</option><option value="2">2nd</option><option value="3">3rd</option><option value="4">4th</option><option value="-1">${tr("last")}</option></select>
                        <select class="${p}-select" id="${p}-f-nthd" style="width:auto"></select></label>
                    </div>
                  </div>
                </div>
                <div class="${p}-row">
                  <div class="${p}-fld"><label class="${p}-label">${tr("timeOfDay")}</label><select class="${p}-select" id="${p}-f-time"></select></div>
                  <div class="${p}-fld"><label class="${p}-label">${tr("dueDaysAfter")}</label><input type="number" min="0" class="${p}-in" id="${p}-f-due" value="0"></div>
                </div>
                <div class="${p}-row">
                  <div class="${p}-fld"><label class="${p}-label">${tr("startDate")}</label><input type="date" class="${p}-in" id="${p}-f-start"></div>
                  <div class="${p}-fld"><label class="${p}-label">${tr("endDate")} <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px;color:var(--gray-lt)">${tr("optional")}</span></label><input type="date" class="${p}-in" id="${p}-f-end"></div>
                </div>
                <div class="${p}-help">${tr("recurrenceHelp")}</div>
                <div class="${p}-time-note" id="${p}-f-note"></div>
              </div>
            </div>

            <div class="${p}-card">
              <div class="${p}-card-head"><span class="${p}-step">3</span><span class="${p}-card-title">${tr("targetStores").replace("{stores}", esc(storeP))}</span></div>
              <div class="${p}-card-body">
                <div class="${p}-fld">
                  <label class="${p}-label">${tr("findStores").replace("{stores}", esc(storeP))}</label>
                  <div class="${p}-ms-wrap">
                    <div class="${p}-ms-trigger" id="${p}-trigger"><span class="${p}-ms-ph">${tr("loadingStores").replace("{stores}", esc(storeP.toLowerCase()))}</span></div>
                    <div class="${p}-dropdown" id="${p}-dropdown">
                      <div class="${p}-dd-search"><input type="text" id="${p}-search" placeholder="${tr("searchStores").replace("{stores}", esc(storeP.toLowerCase()))}"></div>
                      <div class="${p}-dd-list" id="${p}-opts"><div class="${p}-dd-msg">${tr("loading")}</div></div>
                    </div>
                  </div>
                  <div class="${p}-help">${tr("listHelp").replace("{store}", esc(storeS.toLowerCase()))}</div>
                </div>
              </div>
            </div>

            <div class="${p}-card">
              <div class="${p}-card-head"><span class="${p}-step">4</span><span class="${p}-card-title">${tr("assignTo")} <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px;color:var(--gray-lt)">${tr("optional")}</span></span></div>
              <div class="${p}-card-body">
                <div class="${p}-assign-chips" id="${p}-assign-chips"></div>
                <div class="${p}-assign-search"><input type="text" id="${p}-assign-search" placeholder="${tr("searchUsersGroups")}"></div>
                <div class="${p}-assign-tabs">
                  <div role="button" tabindex="0" class="${p}-assign-tab active" id="${p}-tab-users">${tr("users")}</div>
                  <div role="button" tabindex="0" class="${p}-assign-tab" id="${p}-tab-groups">${tr("groups")}</div>
                </div>
                <div class="${p}-assign-list" id="${p}-assign-list"><div class="${p}-assign-empty">${tr("loading")}</div></div>
              </div>
            </div>

            <div class="${p}-foot">
              <button class="${p}-btn ${p}-btn-ghost" id="${p}-cancel">${tr("cancel")}</button>
              <button class="${p}-btn ${p}-btn-primary" id="${p}-save" disabled>${tr("createSchedule")}</button>
            </div>
            <div class="${p}-status" id="${p}-status"></div>
          </div>
        </div>
      `;
            // ── DOM refs ────────────────────────────────────────────────────────
            const $ = (id) => container.querySelector(`#${p}-${id}`);
            const viewListEl = $("view-list"), viewCalEl = $("view-cal"), formEl = $("form");
            const segEl = $("seg"), newBtn = $("new"), cancelBtn = $("cancel"), saveBtn = $("save");
            const statusEl = $("status");
            const trigger = $("trigger"), dropdown = $("dropdown"), searchInp = $("search"), optsList = $("opts");
            const assignChipsEl = $("assign-chips"), assignListEl = $("assign-list"), assignSearchInp = $("assign-search");
            const tabUsersBtn = $("tab-users"), tabGroupsBtn = $("tab-groups");
            const freqSel = $("f-freq"), intervalInp = $("f-interval"), weeklyBox = $("f-weekly"), wdBox = $("f-wd");
            const monthlyBox = $("f-monthly"), domInp = $("f-dom"), nthSel = $("f-nth"), nthdSel = $("f-nthd");
            const timeInp = $("f-time"), dueInp = $("f-due"), noteEl = $("f-note");
            const startInp = $("f-start"), endInp = $("f-end");
            const titleInp = $("f-title"), descInp = $("f-desc"), typeSel = $("f-type"), typeNewInp = $("f-type-new"), prioSel = $("f-prio");
            const RECUR_LIST_NAME = "Recurring Tasks";
            const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
            const fmtDateLabel = (iso) => { if (!iso)
                return "—"; const [y, m, d] = iso.split("-").map(Number); try {
                return new Date(y, m - 1, d).toLocaleDateString(loc(), { month: "short", day: "numeric", year: "numeric" });
            }
            catch (_) {
                return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            } };
            // Populate nth-weekday select
            nthdSel.innerHTML = WEEKDAYS.map(d => `<option value="${d}">${dayName(d, "long")}</option>`).join("");
            // Populate time select in 15-minute steps (the runner checks every :00/:15/:30/:45).
            timeInp.innerHTML = Array.from({ length: 96 }, (_, i) => {
                const v = `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`;
                return `<option value="${v}">${fmtTime12(v)}</option>`;
            }).join("");
            timeInp.value = "09:00";
            const iconClock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
            const iconStore = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1-5h16l1 5"/><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/></svg>`;
            const iconFlag = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
            const iconCal = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
            const iconUser = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
            function showStatus(type, msg) {
                statusEl.className = `${p}-status ${type}`;
                statusEl.textContent = msg;
                statusEl.style.display = "block";
            }
            // ── View switching ──────────────────────────────────────────────────
            function setView(v) {
                view = v;
                formEl.style.display = "none";
                segEl.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.v === v));
                viewListEl.style.display = v === "list" ? "block" : "none";
                viewCalEl.style.display = v === "calendar" ? "block" : "none";
                if (v === "list")
                    renderScheduleList();
                else
                    renderCalendar();
            }
            segEl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.v)));
            // ── Recurrence form behavior ──────────────────────────────────────────
            function renderWeekdayBtns() {
                wdBox.innerHTML = WEEKDAYS.map(d => `<button type="button" data-d="${d}" class="${rule.byday.includes(d) ? "on" : ""}">${dayName(d, "short")[0]}</button>`).join("");
                wdBox.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
                    const d = b.dataset.d;
                    if (rule.byday.includes(d))
                        rule.byday = rule.byday.filter(x => x !== d);
                    else
                        rule.byday.push(d);
                    b.classList.toggle("on");
                    updateNote();
                    validateForm();
                }));
            }
            function syncFreqUI() {
                weeklyBox.style.display = freqSel.value === "WEEKLY" ? "block" : "none";
                monthlyBox.style.display = freqSel.value === "MONTHLY" ? "block" : "none";
            }
            function readRuleFromForm() {
                var _a;
                const mm = ((_a = container.querySelector(`input[name="${p}-mm"]:checked`)) === null || _a === void 0 ? void 0 : _a.value) === "nth" ? "nth" : "dom";
                return Object.assign(Object.assign({}, rule), { freq: freqSel.value, interval: Math.max(1, parseInt(intervalInp.value, 10) || 1), byday: rule.byday, monthMode: mm, dom: Math.min(31, Math.max(1, parseInt(domInp.value, 10) || 1)), nth: parseInt(nthSel.value, 10), nthWeekday: nthdSel.value, time: timeInp.value || "09:00", tz: localTz, dueOffset: Math.max(0, parseInt(dueInp.value, 10) || 0), level: prioSel.value, taskType: typeSel.value === "__new__" ? (typeNewInp.value || "").trim() : typeSel.value, start: startInp.value || todayISO(), end: endInp.value || "" });
            }
            function updateNote() {
                rule = readRuleFromForm();
                noteEl.innerHTML = `${iconClock}<span>${esc(tr("tasksWillBeCreated").replace("{summary}", summarizeRule(rule)))}</span>`;
            }
            [freqSel, intervalInp, domInp, nthSel, nthdSel, timeInp, dueInp, prioSel].forEach(el => el.addEventListener("input", () => { syncFreqUI(); updateNote(); validateForm(); }));
            startInp.addEventListener("input", () => { endInp.min = startInp.value || todayISO(); updateNote(); validateForm(); });
            endInp.addEventListener("input", () => { updateNote(); validateForm(); });
            container.querySelectorAll(`input[name="${p}-mm"]`).forEach((el) => el.addEventListener("change", () => { updateNote(); validateForm(); }));
            typeSel.addEventListener("change", () => {
                const isNew = typeSel.value === "__new__";
                typeNewInp.style.display = isNew ? "block" : "none";
                if (isNew)
                    typeNewInp.focus();
                updateNote();
            });
            typeNewInp.addEventListener("input", updateNote);
            titleInp.addEventListener("input", validateForm);
            function validateForm() {
                const r = readRuleFromForm();
                const weeklyOk = r.freq !== "WEEKLY" || r.byday.length > 0;
                // Start can't predate today (unless editing a schedule that already started earlier).
                const startOk = editingId !== null || r.start >= todayISO();
                const endOk = !r.end || r.end >= r.start;
                const ok = titleInp.value.trim().length > 0 && selectedStores.length > 0 && weeklyOk && startOk && endOk;
                saveBtn.disabled = !ok;
            }
            // ── Store multi-select ────────────────────────────────────────────────
            function renderOpts(filter = "") {
                const matches = storeProjects.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()));
                if (!matches.length) {
                    optsList.innerHTML = `<div class="${p}-dd-msg">${tr("noStoresFound").replace("{stores}", esc(storeP.toLowerCase()))}</div>`;
                    return;
                }
                optsList.innerHTML = matches.map(s => {
                    const sel = selectedStores.some(x => x.id === s.id);
                    return `<div class="${p}-dd-opt ${sel ? "sel" : ""}" data-id="${s.id}" data-title="${esc(s.title)}">
            <span class="${p}-check">${sel ? "&#10003;" : ""}</span><span>${esc(s.title)}</span></div>`;
                }).join("");
                optsList.querySelectorAll(`.${p}-dd-opt`).forEach((opt) => opt.addEventListener("click", () => toggleStore(opt)));
            }
            function toggleStore(opt) {
                const { id, title } = opt.dataset;
                const idx = selectedStores.findIndex(s => s.id === id);
                if (idx >= 0)
                    selectedStores.splice(idx, 1);
                else
                    selectedStores.push({ id, title });
                renderTrigger();
                renderOpts(searchInp.value);
                validateForm();
            }
            function renderTrigger() {
                if (!selectedStores.length) {
                    trigger.innerHTML = `<span class="${p}-ms-ph">${tr("selectStore").replace("{store}", esc(storeS))}</span>`;
                    return;
                }
                trigger.innerHTML = selectedStores.map(s => `<span class="${p}-tag">${esc(s.title)}<span class="${p}-tag-x" data-id="${s.id}">&times;</span></span>`).join("");
                trigger.querySelectorAll(`.${p}-tag-x`).forEach((btn) => btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    selectedStores = selectedStores.filter(s => s.id !== btn.dataset.id);
                    renderTrigger();
                    renderOpts(searchInp.value);
                    validateForm();
                }));
            }
            trigger.addEventListener("click", () => { dropdown.classList.toggle("show"); trigger.classList.toggle("open"); });
            document.addEventListener("click", (e) => {
                if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.remove("show");
                    trigger.classList.remove("open");
                }
            });
            searchInp.addEventListener("input", () => renderOpts(searchInp.value));
            async function fetchInstallations() {
                try {
                    const res = await fetch(`${baseUrl}/installations?limit=200`, apiOpts());
                    if (!res.ok)
                        throw new Error(`HTTP ${res.status}`);
                    const data = await res.json();
                    storeProjects = (data.data || data)
                        .filter((i) => i.pluginID === "tasks" || i.pluginId === "tasks")
                        .map((i) => { var _a, _b, _c; return ({ id: i.id, title: ((_c = (_b = (_a = i.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) || i.title || i.name || i.id }); })
                        .sort((a, b) => a.title.localeCompare(b.title));
                    if (!storeProjects.length) {
                        optsList.innerHTML = `<div class="${p}-dd-msg">${tr("noStoresFound").replace("{stores}", esc(storeP.toLowerCase()))}</div>`;
                        trigger.innerHTML = `<span class="${p}-ms-ph">${tr("noStoresFound").replace("{stores}", esc(storeP.toLowerCase()))}</span>`;
                    }
                    else {
                        trigger.innerHTML = `<span class="${p}-ms-ph">${tr("selectStore").replace("{store}", esc(storeS))}</span>`;
                        renderOpts();
                    }
                }
                catch (_) {
                    optsList.innerHTML = `<div class="${p}-dd-msg">${tr("failedLoadStores").replace("{stores}", esc(storeP.toLowerCase()))}</div>`;
                    trigger.innerHTML = `<span class="${p}-ms-ph">${tr("errorLoading")}</span>`;
                }
            }
            // ── Assignee picker ────────────────────────────────────────────────────
            let assignTab = "user";
            async function fetchUsersAndGroups() {
                try {
                    const [uRes, gRes] = await Promise.all([
                        fetch(`${baseUrl}/users?limit=200`, apiOpts()),
                        fetch(`${baseUrl}/groups?limit=200`, apiOpts()),
                    ]);
                    if (uRes.ok) {
                        const ud = await uRes.json();
                        allUsers = (ud.data || []).map((u) => {
                            var _a, _b;
                            return ({
                                id: u.id, name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.id, avatar: ((_b = (_a = u.avatar) === null || _a === void 0 ? void 0 : _a.icon) === null || _b === void 0 ? void 0 : _b.url) || "",
                            });
                        }).sort((a, b) => a.name.localeCompare(b.name));
                    }
                    if (gRes.ok) {
                        const gd = await gRes.json();
                        allGroups = (gd.data || []).map((g) => {
                            var _a, _b, _c;
                            return ({
                                id: g.id, name: ((_c = (_b = (_a = g.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) || g.name || g.id,
                            });
                        }).sort((a, b) => a.name.localeCompare(b.name));
                    }
                    renderAssignList();
                }
                catch (_) {
                    assignListEl.innerHTML = `<div class="${p}-assign-empty">${tr("failedToLoad")}</div>`;
                }
            }
            function initials(name) { return name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase(); }
            function renderAssignList(filter = "") {
                const fl = filter.toLowerCase();
                const items = assignTab === "user"
                    ? allUsers.filter(u => u.name.toLowerCase().includes(fl))
                    : allGroups.filter(g => g.name.toLowerCase().includes(fl));
                if (!items.length) {
                    assignListEl.innerHTML = `<div class="${p}-assign-empty">No ${assignTab === "user" ? "users" : "groups"} found</div>`;
                    return;
                }
                assignListEl.innerHTML = items.map((it) => {
                    const sel = selectedAssignees.some(a => a.id === it.id);
                    const av = assignTab === "user" && it.avatar
                        ? `<div class="${p}-assign-avatar"><img src="${esc(it.avatar)}" alt=""></div>`
                        : `<div class="${p}-assign-avatar" ${assignTab === "group" ? 'style="background:var(--gray)"' : ""}>${initials(it.name)}</div>`;
                    return `<div class="${p}-assign-opt ${sel ? "sel" : ""}" data-id="${it.id}" data-type="${assignTab}" data-name="${esc(it.name)}" data-avatar="${esc(it.avatar || "")}">
            ${av}<span class="${p}-assign-name">${esc(it.name)}</span><span class="${p}-assign-chk">${sel ? "&#10003;" : ""}</span></div>`;
                }).join("");
                assignListEl.querySelectorAll(`.${p}-assign-opt`).forEach((opt) => opt.addEventListener("click", () => toggleAssignee(opt)));
            }
            function toggleAssignee(opt) {
                const { id, type, name, avatar } = opt.dataset;
                const idx = selectedAssignees.findIndex(a => a.id === id);
                if (idx >= 0)
                    selectedAssignees.splice(idx, 1);
                else
                    selectedAssignees.push({ id, name, avatar: avatar || "", type });
                renderAssignChips();
                renderAssignList(assignSearchInp.value);
            }
            function renderAssignChips() {
                assignChipsEl.innerHTML = selectedAssignees.map(a => {
                    const bg = a.type === "group" ? 'style="background:var(--gray)"' : "";
                    const av = a.avatar ? `<div class="${p}-assign-chip-av"><img src="${esc(a.avatar)}" alt=""></div>`
                        : `<div class="${p}-assign-chip-av" ${bg}>${initials(a.name)}</div>`;
                    return `<span class="${p}-assign-chip">${av}${esc(a.name)}<span class="${p}-assign-chip-x" data-id="${a.id}">&times;</span></span>`;
                }).join("");
                assignChipsEl.querySelectorAll(`.${p}-assign-chip-x`).forEach((btn) => btn.addEventListener("click", () => {
                    selectedAssignees = selectedAssignees.filter(a => a.id !== btn.dataset.id);
                    renderAssignChips();
                    renderAssignList(assignSearchInp.value);
                }));
            }
            tabUsersBtn.addEventListener("click", () => { assignTab = "user"; tabUsersBtn.classList.add("active"); tabGroupsBtn.classList.remove("active"); renderAssignList(assignSearchInp.value); });
            tabGroupsBtn.addEventListener("click", () => { assignTab = "group"; tabGroupsBtn.classList.add("active"); tabUsersBtn.classList.remove("active"); renderAssignList(assignSearchInp.value); });
            assignSearchInp.addEventListener("input", () => renderAssignList(assignSearchInp.value));
            // ── Load existing schedules (scan task installations for templates) ─────
            async function loadSchedules() {
                viewListEl.innerHTML = `<div class="${p}-loading"><span class="${p}-spin" style="border-color:rgba(var(--primary-rgb),.25);border-top-color:var(--primary);display:inline-block;vertical-align:middle"></span> Loading schedules…</div>`;
                const byId = new Map();
                try {
                    const res = await fetch(`${baseUrl}/installations?limit=200`, apiOpts());
                    const data = res.ok ? await res.json() : { data: [] };
                    const installs = (data.data || data)
                        .filter((i) => i.pluginID === "tasks" || i.pluginId === "tasks")
                        .map((i) => { var _a, _b, _c; return ({ id: i.id, title: ((_c = (_b = (_a = i.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) || i.title || i.name || i.id }); });
                    for (const inst of installs) {
                        const listRes = await fetch(`${baseUrl}/tasks/${inst.id}/lists`, apiOpts());
                        if (!listRes.ok)
                            continue;
                        const listsRaw = await listRes.json();
                        const lists = Array.isArray(listsRaw) ? listsRaw : (listsRaw.data || []);
                        const perList = await Promise.all(lists.map(l => fetch(`${baseUrl}/tasks/${inst.id}/task?listId=${l.id}`, apiOpts())
                            .then(r => r.ok ? r.json() : null).catch(() => null)
                            .then(res2 => ({ listId: l.id, listName: l.name || l.id, tasks: res2 }))));
                        for (const { listId, listName, tasks } of perList) {
                            const arr = Array.isArray(tasks) ? tasks : ((tasks === null || tasks === void 0 ? void 0 : tasks.data) || []);
                            for (const t of arr) {
                                const desc = t.description || "";
                                const typeM = TYPE_REGEX.exec(t.title || "") || TYPE_REGEX.exec(desc);
                                if (!typeM || typeM[1].trim().toLowerCase() !== TEMPLATE_TYPE)
                                    continue;
                                const rrM = RRULE_REGEX.exec(desc);
                                if (!rrM)
                                    continue;
                                const r = parseRule(rrM[1], localTz);
                                const sid = (/(?:^|;)\s*id=([^;]+)/.exec(rrM[1]) || [])[1] || t.id;
                                const target = { storeId: inst.id, storeTitle: inst.title, listId, listName, templateTaskId: t.id };
                                const existing = byId.get(sid);
                                if (existing) {
                                    existing.targets.push(target);
                                }
                                else
                                    byId.set(sid, {
                                        id: sid, title: t.title || "(untitled)", description: stripTags(desc),
                                        rule: r, targets: [target],
                                        assigneeIds: t.assigneeIds || [], groupIds: t.groupIds || [],
                                    });
                            }
                        }
                    }
                }
                catch (_) { /* show whatever we got */ }
                schedules = [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));
                // Merge any schedule types into the stable, sorted type order for consistent colors.
                TYPE_ORDER = Array.from(new Set([...typeList.map(t => t.toLowerCase()), ...schedules.map(s => s.rule.taskType).filter(Boolean)])).sort();
                if (view === "list")
                    renderScheduleList();
                else
                    renderCalendar();
            }
            // ── Schedule list view ──────────────────────────────────────────────────
            function renderScheduleList() {
                if (!schedules.length) {
                    viewListEl.innerHTML = `<div class="${p}-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <div>${tr("noSchedulesYet")}<br>${tr("clickNewToCreate")}</div></div>`;
                    return;
                }
                viewListEl.innerHTML = schedules.map(s => {
                    const typeCol = s.rule.taskType ? typeColor(s.rule.taskType) : "";
                    const typeBadge = s.rule.taskType
                        ? `<span class="${p}-type-badge" style="background:${typeCol};color:${contrastColor(typeCol)}">${esc(s.rule.taskType)}</span>` : "";
                    const storeLabel = s.targets.length === 1 ? esc(s.targets[0].storeTitle) : `${s.targets.length} ${esc(storeP.toLowerCase())}`;
                    const prioPill = s.rule.level !== "normal"
                        ? `<span class="${p}-pill ${s.rule.level === "critical" ? "crit" : s.rule.level === "high" ? "high" : ""}">${iconFlag}${tr(s.rule.level)}</span>` : "";
                    const chevron = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-lt)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;align-self:center"><polyline points="9 18 15 12 9 6"/></svg>`;
                    return `<div class="${p}-sched" data-id="${esc(s.id)}">
            <div class="${p}-sched-top">
              <div class="${p}-sched-main">
                <div class="${p}-sched-title">${esc(s.title)}</div>
                <div class="${p}-sched-sum">${iconClock}${esc(summarizeRule(s.rule))}</div>
                <div class="${p}-sched-meta">
                  ${prioPill}
                  ${typeBadge}
                  <span class="${p}-pill">${iconStore}${storeLabel}</span>
                  <span class="${p}-pill next">${iconClock}${tr("nextPrefix")} ${esc(nextRun(s.rule))}</span>
                </div>
              </div>
              ${chevron}
            </div>
          </div>`;
                }).join("");
                viewListEl.querySelectorAll(`.${p}-sched`).forEach((el) => {
                    const id = el.dataset.id;
                    el.addEventListener("click", () => { const s = schedules.find(x => x.id === id); if (s)
                        openDetail(s); });
                });
            }
            // ── Calendar view (Google-cal style: 4-day default, expand to month) ──────
            const DOW_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
            const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const occOnDay = (d) => schedules.filter(s => firesOn(s.rule, d)).sort((a, b) => a.rule.time.localeCompare(b.rule.time));
            function fmtHour(t) { const h = parseInt(t.split(":")[0], 10); return `${h % 12 || 12}${h >= 12 ? "p" : "a"}`; }
            const chevL = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
            const chevR = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
            const dotToday = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="12" x2="12" y2="8"/></svg>`;
            function renderCalendar() {
                const todayK = dayKey(new Date());
                let rangeLabel = "", bodyHtml = "";
                if (calMode === "3day") {
                    const days = Array.from({ length: 3 }, (_, i) => new Date(calCursor.getFullYear(), calCursor.getMonth(), calCursor.getDate() + i));
                    const a = days[0], b = days[days.length - 1];
                    rangeLabel = a.getMonth() === b.getMonth()
                        ? `${a.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${b.getDate()}, ${b.getFullYear()}`
                        : `${a.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${b.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${b.getFullYear()}`;
                    bodyHtml = `<div class="${p}-cal-cols">` + days.map(d => {
                        const k = dayKey(d);
                        const occ = occOnDay(d);
                        const evs = occ.length ? occ.map(s => `<div class="${p}-ev" data-id="${esc(s.id)}">
                <div class="${p}-ev-time">${esc(fmtTime12(s.rule.time))}</div>
                <span class="${p}-ev-freq">${esc(shortFreq(s.rule))}</span>
                <div class="${p}-ev-title">${esc(s.title)}</div>
                ${s.description ? `<div class="${p}-ev-desc">${esc(s.description)}</div>` : ""}
              </div>`).join("") : `<div class="${p}-col-empty">—</div>`;
                        return `<div class="${p}-cal-col">
              <div class="${p}-cal-colhead ${k === todayK ? "today" : ""}">
                <div class="${p}-cal-dow2">${DOW_ABBR[d.getDay()]}</div>
                <div class="${p}-cal-dnum">${d.getDate()}</div>
              </div>
              <div class="${p}-cal-evs">${evs}</div>
            </div>`;
                    }).join("") + `</div>`;
                }
                else {
                    const y = calCursor.getFullYear(), m = calCursor.getMonth();
                    rangeLabel = calCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                    const startDow = new Date(y, m, 1).getDay();
                    const cells = [];
                    for (let i = 0; i < 42; i++) {
                        const d = new Date(y, m, 1 - startDow + i);
                        const muted = d.getMonth() !== m;
                        const occ = occOnDay(d);
                        const chips = occ.slice(0, 2).map(s => `<div class="${p}-cal-chip">${esc(fmtHour(s.rule.time))} ${esc(s.title)}</div>`).join("");
                        const more = occ.length > 2 ? `<div class="${p}-cal-more">+${occ.length - 2} more</div>` : "";
                        cells.push(`<div class="${p}-cal-cell ${muted ? "muted" : ""} ${dayKey(d) === todayK ? "today" : ""}" data-d="${dayKey(d)}">
              <span class="${p}-cal-num">${d.getDate()}</span>${chips}${more}</div>`);
                    }
                    bodyHtml = `<div class="${p}-cal-dow">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(x => `<span>${x}</span>`).join("")}</div>
            <div class="${p}-cal-grid">${cells.join("")}</div>`;
                }
                viewCalEl.innerHTML = `<div class="${p}-cal">
          <div class="${p}-cal-head">
            <span class="${p}-cal-range">${esc(rangeLabel)}</span>
            <div class="${p}-cal-ctrls">
              <div class="${p}-cal-modeseg" id="${p}-cal-mode">
                <button data-mode="3day" class="${calMode === "3day" ? "active" : ""}">${tr("threeDay")}</button>
                <button data-mode="month" class="${calMode === "month" ? "active" : ""}">${tr("month")}</button>
              </div>
              <div class="${p}-cal-nav">
                <button class="${p}-ico-btn" data-nav="-1">${chevL}</button>
                <button class="${p}-ico-btn" data-nav="0" title="${tr("today")}">${dotToday}</button>
                <button class="${p}-ico-btn" data-nav="1">${chevR}</button>
              </div>
            </div>
          </div>
          ${bodyHtml}
        </div>`;
                // Mode toggle
                viewCalEl.querySelectorAll(`#${p}-cal-mode button`).forEach((b) => b.addEventListener("click", () => { calMode = b.dataset.mode; renderCalendar(); }));
                // Prev / Today / Next
                viewCalEl.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => {
                    const nav = parseInt(b.dataset.nav, 10);
                    if (nav === 0)
                        calCursor = new Date();
                    else if (calMode === "3day")
                        calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth(), calCursor.getDate() + nav * 3);
                    else
                        calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + nav, 1);
                    renderCalendar();
                }));
                // 4-day: click an event block to open its detail panel
                viewCalEl.querySelectorAll(`.${p}-ev`).forEach((el) => el.addEventListener("click", () => { const s = schedules.find(x => x.id === el.dataset.id); if (s)
                    openDetail(s); }));
                // Month: click a day to jump into its 4-day view
                viewCalEl.querySelectorAll(`.${p}-cal-cell`).forEach((c) => c.addEventListener("click", () => {
                    const [yy, mm, dd] = c.dataset.d.split("-").map(Number);
                    calMode = "3day";
                    calCursor = new Date(yy, mm, dd);
                    renderCalendar();
                }));
            }
            // ── Open / reset the form ───────────────────────────────────────────────
            function resetForm() {
                editingId = null;
                rule = defaultRule(localTz);
                selectedStores = [];
                selectedAssignees = [];
                titleInp.value = "";
                descInp.value = "";
                typeSel.value = "";
                typeNewInp.value = "";
                typeNewInp.style.display = "none";
                prioSel.value = "normal";
                freqSel.value = "DAILY";
                intervalInp.value = "1";
                domInp.value = String(new Date().getDate());
                nthSel.value = "1";
                nthdSel.value = WEEKDAYS[new Date().getDay()];
                timeInp.value = "09:00";
                dueInp.value = "0";
                startInp.value = todayISO();
                startInp.min = todayISO();
                endInp.value = "";
                endInp.min = todayISO();
                container.querySelector(`input[name="${p}-mm"][value="dom"]`).checked = true;
                renderWeekdayBtns();
                renderTrigger();
                renderOpts();
                renderAssignChips();
                renderAssignList();
                syncFreqUI();
                updateNote();
                validateForm();
            }
            function openForm(id) {
                resetForm();
                saveBtn.textContent = id ? tr("saveChanges") : tr("createSchedule");
                if (id) {
                    const s = schedules.find(x => x.id === id);
                    if (s) {
                        editingId = id;
                        rule = Object.assign({}, s.rule);
                        titleInp.value = s.title;
                        descInp.value = s.description;
                        // type dropdown: select known, else add as "new"
                        if (s.rule.taskType) {
                            const opt = Array.from(typeSel.options).find((o) => o.value.toLowerCase() === s.rule.taskType.toLowerCase());
                            if (opt)
                                typeSel.value = opt.value;
                            else {
                                typeSel.value = "__new__";
                                typeNewInp.style.display = "block";
                                typeNewInp.value = s.rule.taskType;
                            }
                        }
                        prioSel.value = s.rule.level;
                        freqSel.value = s.rule.freq;
                        intervalInp.value = String(s.rule.interval);
                        domInp.value = String(s.rule.dom);
                        nthSel.value = String(s.rule.nth);
                        nthdSel.value = s.rule.nthWeekday;
                        timeInp.value = s.rule.time;
                        dueInp.value = String(s.rule.dueOffset);
                        // Editing: allow the existing (possibly past) start to stay; end can't precede start.
                        startInp.min = s.rule.start < todayISO() ? s.rule.start : todayISO();
                        startInp.value = s.rule.start;
                        endInp.min = s.rule.start;
                        endInp.value = s.rule.end || "";
                        container.querySelector(`input[name="${p}-mm"][value="${s.rule.monthMode}"]`).checked = true;
                        selectedStores = s.targets.map(t => ({ id: t.storeId, title: t.storeTitle }));
                        selectedAssignees = [
                            ...s.assigneeIds.map(uid => { const u = allUsers.find(x => x.id === uid); return { id: uid, name: (u === null || u === void 0 ? void 0 : u.name) || uid, avatar: (u === null || u === void 0 ? void 0 : u.avatar) || "", type: "user" }; }),
                            ...s.groupIds.map(gid => { const g = allGroups.find(x => x.id === gid); return { id: gid, name: (g === null || g === void 0 ? void 0 : g.name) || gid, avatar: "", type: "group" }; }),
                        ];
                        renderWeekdayBtns();
                        renderTrigger();
                        renderOpts();
                        renderAssignChips();
                        renderAssignList();
                        syncFreqUI();
                        updateNote();
                        validateForm();
                    }
                }
                statusEl.style.display = "none";
                viewListEl.style.display = "none";
                viewCalEl.style.display = "none";
                formEl.style.display = "block";
            }
            newBtn.addEventListener("click", () => openForm());
            cancelBtn.addEventListener("click", () => setView(view));
            // ── Find or create a list named `name` in a store ───────────────────────
            async function findOrCreateList(storeId, name) {
                var _a, _b;
                const palette = ["#D62300", "#FF6B00", "#2E7D4A", "#4A90A4", "#8B4513"];
                const listRes = await fetch(`${baseUrl}/tasks/${storeId}/lists`, apiOpts());
                if (listRes.ok) {
                    const raw = await listRes.json();
                    const lists = Array.isArray(raw) ? raw : (raw.data || []);
                    const match = lists.find(l => (l.name || "").trim().toLowerCase() === name.trim().toLowerCase());
                    if (match)
                        return match.id;
                }
                const r = await fetch(`${baseUrl}/tasks/${storeId}/lists`, Object.assign(Object.assign({ method: "POST" }, apiOpts()), { body: JSON.stringify({ name, color: palette[Math.floor(Math.random() * palette.length)] }) }));
                if (!r.ok)
                    throw new Error(`list create failed (${r.status})`);
                const d = await r.json();
                const id = (_a = d.id) !== null && _a !== void 0 ? _a : (_b = d.data) === null || _b === void 0 ? void 0 : _b.id;
                if (!id)
                    throw new Error("no list id");
                return id;
            }
            // ── Save schedule ─────────────────────────────────────────────────────────
            saveBtn.addEventListener("click", async () => {
                rule = readRuleFromForm();
                const title = titleInp.value.trim();
                const baseDesc = descInp.value.trim();
                if (!title || !selectedStores.length)
                    return;
                if (rule.freq === "WEEKLY" && !rule.byday.length) {
                    showStatus("error", tr("pickWeekday"));
                    return;
                }
                if (!editingId && rule.start < todayISO()) {
                    showStatus("error", tr("startNotPast"));
                    return;
                }
                if (rule.end && rule.end < rule.start) {
                    showStatus("error", tr("endAfterStart"));
                    return;
                }
                const sid = editingId || genId();
                const assigneeIds = selectedAssignees.filter(a => a.type === "user").map(a => a.id);
                const groupIds = selectedAssignees.filter(a => a.type === "group").map(a => a.id);
                const templateDesc = `${baseDesc ? baseDesc + " " : ""}[type: ${TEMPLATE_TYPE}] [rrule: id=${sid};${encodeRule(rule)}]`;
                saveBtn.disabled = true;
                saveBtn.innerHTML = `<span class="${p}-spin"></span> Saving…`;
                statusEl.style.display = "none";
                // If editing, remove the previous template tasks first (clean replace).
                if (editingId) {
                    const prev = schedules.find(s => s.id === editingId);
                    if (prev)
                        for (const t of prev.targets) {
                            await fetch(`${baseUrl}/tasks/${t.storeId}/task/${t.templateTaskId}`, apiOpts({ method: "DELETE" })).catch(() => { });
                        }
                }
                let ok = 0, fail = 0;
                for (const store of selectedStores) {
                    try {
                        const listId = await findOrCreateList(store.id, RECUR_LIST_NAME);
                        const body = {
                            title, description: templateDesc, status: "OPEN", priority: levelToPriority(rule.level),
                            taskListId: listId, assigneeIds, groupIds,
                        };
                        const r = await fetch(`${baseUrl}/tasks/${store.id}/task`, Object.assign(Object.assign({ method: "POST" }, apiOpts()), { body: JSON.stringify(body) }));
                        if (!r.ok)
                            throw new Error(`HTTP ${r.status}`);
                        ok++;
                    }
                    catch (_) {
                        fail++;
                    }
                }
                saveBtn.disabled = false;
                saveBtn.textContent = editingId ? tr("saveChanges") : tr("createSchedule");
                if (fail === 0) {
                    showStatus("success", tr("scheduleSavedMsg").replace("{n}", String(ok)).replace("{store}", ok === 1 ? storeS.toLowerCase() : storeP.toLowerCase()).replace("{summary}", summarizeRule(rule)));
                    await loadSchedules();
                    setTimeout(() => setView("list"), 900);
                }
                else if (ok > 0) {
                    showStatus("info", `Partial save: ${ok} succeeded, ${fail} failed.`);
                    await loadSchedules();
                }
                else {
                    showStatus("error", "Save failed. Check the API token and that the selected stores have a Tasks plugin.");
                }
            });
            async function deleteSchedule(id) {
                const s = schedules.find(x => x.id === id);
                if (!s)
                    return;
                if (!confirm(`Delete the recurring schedule "${s.title}"? Already-created tasks are kept; only the schedule stops.`))
                    return;
                for (const t of s.targets) {
                    await fetch(`${baseUrl}/tasks/${t.storeId}/task/${t.templateTaskId}`, apiOpts({ method: "DELETE" })).catch(() => { });
                }
                await loadSchedules();
            }
            // ── Detail panel (body-appended bottom sheet / side panel) ───────────────
            const self = this;
            const overlayEl = document.createElement("div");
            overlayEl.className = `${p}-overlay`;
            document.body.appendChild(overlayEl);
            self._rtwOverlay = overlayEl;
            const detailEl = document.createElement("div");
            detailEl.className = `${p}-detail`;
            detailEl.innerHTML = `
        <div class="${p}-detail-handle"></div>
        <div class="${p}-detail-head">
          <div class="${p}-detail-badges" id="${p}-detail-badges"></div>
          <button class="${p}-detail-close" id="${p}-detail-close" aria-label="${tr("close")}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="${p}-detail-body" id="${p}-detail-body"></div>
        <div class="${p}-detail-foot">
          <button class="${p}-detail-del" id="${p}-detail-del"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>${tr("delete")}</button>
          <button class="${p}-detail-edit" id="${p}-detail-edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>${tr("edit")}</button>
        </div>`;
            try {
                detailEl.setAttribute("dir", rtl ? "rtl" : "ltr");
            }
            catch (_) { }
            document.body.appendChild(detailEl);
            self._rtwDetail = detailEl;
            const detailBadges = detailEl.querySelector(`#${p}-detail-badges`);
            const detailBody = detailEl.querySelector(`#${p}-detail-body`);
            let detailSchedule = null;
            function openDetail(s) {
                detailSchedule = s;
                detailEl.classList.toggle("side", window.innerWidth >= 720);
                const typeCol = s.rule.taskType ? typeColor(s.rule.taskType) : "";
                detailBadges.innerHTML = [
                    s.rule.level !== "normal" ? `<span class="${p}-pill ${s.rule.level === "critical" ? "crit" : s.rule.level === "high" ? "high" : ""}">${iconFlag}${tr(s.rule.level)}</span>` : "",
                    s.rule.taskType ? `<span class="${p}-type-badge" style="background:${typeCol};color:${contrastColor(typeCol)}">${esc(s.rule.taskType)}</span>` : "",
                ].join("");
                const names = [
                    ...s.assigneeIds.map(id => (allUsers.find(u => u.id === id) || {}).name || id),
                    ...s.groupIds.map(id => (allGroups.find(g => g.id === id) || {}).name || id),
                ];
                const stores = s.targets.map(t => `<div>${esc(t.storeTitle)} <span style="color:var(--gray-lt)">— ${esc(t.listName)}</span></div>`).join("");
                const range = s.rule.end
                    ? `${fmtDateLabel(s.rule.start)} → ${fmtDateLabel(s.rule.end)}`
                    : tr("rangeStarts").replace("{date}", fmtDateLabel(s.rule.start));
                detailBody.innerHTML = `
          <div class="${p}-detail-title">${esc(s.title)}</div>
          <div class="${p}-detail-meta">
            <div class="${p}-detail-row">${iconClock}<div><b>${tr("repeats")}</b><span class="v">${esc(summarizeRule(s.rule))}</span></div></div>
            <div class="${p}-detail-row">${iconCal}<div><b>${tr("nextRun")}</b><span class="v">${esc(nextRun(s.rule))}</span></div></div>
            <div class="${p}-detail-row">${iconCal}<div><b>${tr("activeRange")}</b><span class="v">${esc(range)}</span></div></div>
            ${s.rule.dueOffset > 0 ? `<div class="${p}-detail-row">${iconClock}<div><b>${tr("due")}</b><span class="v">${tr("daysAfterCreation").replace("{n}", String(s.rule.dueOffset))}</span></div></div>` : ""}
            <div class="${p}-detail-row">${iconStore}<div><b>${esc(storeP)}</b><div class="${p}-detail-stores v">${stores}</div></div></div>
            <div class="${p}-detail-row">${iconUser}<div><b>${tr("assignedTo")}</b><span class="v">${names.length ? esc(names.join(", ")) : tr("anyoneWithAccess")}</span></div></div>
          </div>
          ${s.description ? `<div class="${p}-detail-desc-label">${tr("description")}</div><div class="${p}-detail-desc">${esc(s.description)}</div>` : ""}`;
                overlayEl.classList.add("open");
                requestAnimationFrame(() => detailEl.classList.add("open"));
            }
            function closeDetail() { detailEl.classList.remove("open"); overlayEl.classList.remove("open"); detailSchedule = null; }
            overlayEl.addEventListener("click", closeDetail);
            detailEl.querySelector(`#${p}-detail-close`).addEventListener("click", closeDetail);
            detailEl.querySelector(`#${p}-detail-edit`).addEventListener("click", () => { const s = detailSchedule; closeDetail(); if (s)
                openForm(s.id); });
            detailEl.querySelector(`#${p}-detail-del`).addEventListener("click", () => { const s = detailSchedule; closeDetail(); if (s)
                deleteSchedule(s.id); });
            const onDocKey = (e) => { if (e.key === "Escape" && detailSchedule)
                closeDetail(); };
            document.addEventListener("keydown", onDocKey);
            self._rtwDocKey = onDocKey;
            // Drag-to-dismiss (bottom-sheet mode only)
            let startY = 0, dy = 0, dragging = false;
            const dBegin = (y) => { if (detailEl.classList.contains("side"))
                return; dragging = true; startY = y; dy = 0; detailEl.style.transition = "none"; };
            const dMove = (y) => { if (!dragging)
                return; dy = Math.max(0, y - startY); detailEl.style.transform = `translateY(${dy}px)`; overlayEl.style.opacity = String(Math.max(0, 1 - dy / 420)); };
            const dEnd = () => { if (!dragging)
                return; dragging = false; detailEl.style.transition = ""; detailEl.style.transform = ""; overlayEl.style.opacity = ""; if (dy > 110)
                closeDetail(); };
            [`.${p}-detail-handle`, `.${p}-detail-head`].forEach(sel => {
                const el = detailEl.querySelector(sel);
                el.addEventListener("touchstart", (e) => dBegin(e.touches[0].clientY), { passive: true });
                el.addEventListener("touchmove", (e) => { dMove(e.touches[0].clientY); if (dragging && dy > 0)
                    e.preventDefault(); }, { passive: false });
                el.addEventListener("touchend", dEnd);
            });
            // ── Init ───────────────────────────────────────────────────────────────────
            renderWeekdayBtns();
            syncFreqUI();
            updateNote();
            fetchInstallations();
            fetchUsersAndGroups();
            loadSchedules();
        }
        disconnectedCallback() {
            const self = this;
            if (self._rtwOverlay) {
                self._rtwOverlay.remove();
                self._rtwOverlay = undefined;
            }
            if (self._rtwDetail) {
                self._rtwDetail.remove();
                self._rtwDetail = undefined;
            }
            if (self._rtwDocKey) {
                document.removeEventListener("keydown", self._rtwDocKey);
                self._rtwDocKey = undefined;
            }
        }
        static get observedAttributes() {
            return ["apitoken", "baseurl", "primarycolor", "accentcolor", "backgroundcolor", "storelabelsingular", "storelabelplural", "tasktypes", "typecolors"];
        }
    };
};
// ── Type badge color (shared convention with my-tasks-widget) ─────────────────────
// Colors come from the configurable `typecolors` palette, assigned round-robin to
// the distinct types (sorted) — every color is used before any repeats. If no
// palette is configured (field blank / all cleared), fall back to the original system.
let TYPE_PALETTE = [];
let TYPE_ORDER = [];
const TYPE_COLORS = {
    storetask: "#da2e32", compliance: "#8B4513", maintenance: "#2E7D4A",
    training: "#4A90A4", audit: "#7C3AED", safety: "#D97706", inventory: "#0369A1",
    finance: "#0369A1", operations: "#2E7D4A",
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
        return typeColorOriginal(key);
    let i = TYPE_ORDER.indexOf(key);
    if (i < 0) {
        let h = 0;
        for (let c = 0; c < key.length; c++)
            h = (h * 31 + key.charCodeAt(c)) & 0xffffff;
        i = h;
    }
    return TYPE_PALETTE[i % TYPE_PALETTE.length];
}
// ── Config schema ─────────────────────────────────────────────────────────────────
const configurationSchema = {
    properties: {
        apitoken: { type: "string", title: "API Token", default: DEFAULT_API_TOKEN },
        baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
        primarycolor: { type: "string", title: "Primary Color", default: DEFAULT_PRIMARY_COLOR },
        accentcolor: { type: "string", title: "Accent Color", default: DEFAULT_ACCENT_COLOR },
        backgroundcolor: { type: "string", title: "Background Color", default: "" },
        storelabelsingular: { type: "string", title: "Store Label (singular)", default: "Store" },
        storelabelplural: { type: "string", title: "Store Label (plural)", default: "Stores" },
        tasktypes: { type: "string", title: "Task Types (comma-separated)", default: "Finance,Operations,Training,Compliance,Safety" },
        typecolors: { type: "string", title: "Type Colors (comma-separated hex)", default: "#DA2E32,#0369A1,#2E7D4A,#D97706,#7C3AED,#4A90A4,#8B4513,#0EA5E9" },
    },
};
const uiSchema = {
    apitoken: { "ui:widget": "password", "ui:help": "Staffbase Basic auth token" },
    baseurl: { "ui:help": "Staffbase API base URL" },
    primarycolor: { "ui:widget": "color", "ui:help": "Primary brand color (default: Panda Express red)" },
    accentcolor: { "ui:widget": "color", "ui:help": "Accent / secondary color" },
    backgroundcolor: { "ui:widget": "color", "ui:help": "Widget background color — leave blank for transparent" },
    storelabelsingular: { "ui:help": "e.g. Store, Location, Branch" },
    storelabelplural: { "ui:help": "e.g. Stores, Locations, Branches" },
    tasktypes: { "ui:help": "Comma-separated list of task type options shown in the Type dropdown" },
    typecolors: { "ui:help": "Type-badge palette. Colors are assigned to each type in order; all are used before any repeat. Clear it to use the built-in colors." },
};
// ── Block registration ──────────────────────────────────────────────────────────────
const blockDefinition = {
    name: "recurring-tasks-widget",
    label: "Recurring Tasks Widget",
    attributes: ["apitoken", "baseurl", "primarycolor", "accentcolor", "backgroundcolor", "storelabelsingular", "storelabelplural", "tasktypes", "typecolors"],
    factory, configurationSchema, uiSchema, blockLevel: "block", iconUrl: "",
};
window.defineBlock({ blockDefinition, author: "Staffbase", version: "1.0.0" });

/******/ })()
;