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
        targetStores: "Target {stores}",
        findStores: "Find {stores}",
        loadingStores: "Loading {stores}…",
        searchStores: "Search {stores}…",
        selectStore: "Select a {store}…",
        noStoresFound: "No {stores} found",
        failedLoadStores: "Failed to load {stores}",
        errorLoading: "Error loading",
        loading: "Loading…",
        pullReviewTasks: "Pull & Review Tasks",
        taskListName: "Task List Name",
        taskListNamePlaceholder: "e.g., Q2 Store Checklist",
        pullFromExternal: "Pull from External Services",
        reviewEditTasks: "Review & Edit Tasks",
        nTasks: "{n} tasks",
        title: "Title",
        taskTitlePlaceholder: "Task title",
        description: "Description",
        type: "Type",
        noneOption: "— none —",
        dueDate: "Due Date",
        addTask: "Add task",
        attachFiles: "Attach files",
        remove: "Remove",
        attached: "attached:",
        assignTo: "Assign To",
        optional: "(optional)",
        searchUsersGroups: "Search users and groups…",
        users: "Users",
        groups: "Groups",
        noUsersFound: "No users found",
        noGroupsFound: "No groups found",
        failedToLoad: "Failed to load",
        updateExistingList: "Update Existing List",
        selectListToUpdate: "Select a list to update",
        createNewList: "— Create a new list —",
        replaceHint: "If selected, all tasks in that list are replaced. Leave blank to create a new list.",
        working: "Working…",
        updateYourTasks: "Update your Tasks",
        noTasksInSheet: "No tasks found in the sheet.",
        nTasksAdded: "{n} tasks added",
        done: "Done!",
    },
    de_DE: {
        targetStores: "Ziel-{stores}",
        findStores: "{stores} finden",
        loadingStores: "{stores} werden geladen…",
        searchStores: "{stores} suchen…",
        selectStore: "{store} auswählen…",
        noStoresFound: "Keine {stores} gefunden",
        failedLoadStores: "{stores} konnten nicht geladen werden",
        errorLoading: "Fehler beim Laden",
        loading: "Wird geladen…",
        pullReviewTasks: "Aufgaben abrufen & prüfen",
        taskListName: "Name der Aufgabenliste",
        taskListNamePlaceholder: "z. B. Q2 Filial-Checkliste",
        pullFromExternal: "Aus externen Diensten abrufen",
        reviewEditTasks: "Aufgaben prüfen & bearbeiten",
        nTasks: "{n} Aufgaben",
        title: "Titel",
        taskTitlePlaceholder: "Aufgabentitel",
        description: "Beschreibung",
        type: "Typ",
        noneOption: "— keine —",
        dueDate: "Fälligkeitsdatum",
        addTask: "Aufgabe hinzufügen",
        attachFiles: "Dateien anhängen",
        remove: "Entfernen",
        attached: "angehängt:",
        assignTo: "Zuweisen an",
        optional: "(optional)",
        searchUsersGroups: "Benutzer und Gruppen suchen…",
        users: "Benutzer",
        groups: "Gruppen",
        noUsersFound: "Keine Benutzer gefunden",
        noGroupsFound: "Keine Gruppen gefunden",
        failedToLoad: "Laden fehlgeschlagen",
        updateExistingList: "Bestehende Liste aktualisieren",
        selectListToUpdate: "Liste zum Aktualisieren auswählen",
        createNewList: "— Neue Liste erstellen —",
        replaceHint: "Wenn ausgewählt, werden alle Aufgaben in dieser Liste ersetzt. Leer lassen, um eine neue Liste zu erstellen.",
        working: "Wird bearbeitet…",
        updateYourTasks: "Aufgaben aktualisieren",
        noTasksInSheet: "Keine Aufgaben in der Tabelle gefunden.",
        nTasksAdded: "{n} Aufgaben hinzugefügt",
        done: "Fertig!",
    },
    ar_SA: {
        targetStores: "{stores} المستهدفة",
        findStores: "ابحث عن {stores}",
        loadingStores: "جارٍ تحميل {stores}…",
        searchStores: "ابحث في {stores}…",
        selectStore: "اختر {store}…",
        noStoresFound: "لم يتم العثور على {stores}",
        failedLoadStores: "فشل تحميل {stores}",
        errorLoading: "خطأ في التحميل",
        loading: "جارٍ التحميل…",
        pullReviewTasks: "سحب ومراجعة المهام",
        taskListName: "اسم قائمة المهام",
        taskListNamePlaceholder: "مثال: قائمة تدقيق الربع الثاني",
        pullFromExternal: "السحب من الخدمات الخارجية",
        reviewEditTasks: "مراجعة وتحرير المهام",
        nTasks: "{n} مهام",
        title: "العنوان",
        taskTitlePlaceholder: "عنوان المهمة",
        description: "الوصف",
        type: "النوع",
        noneOption: "— بلا —",
        dueDate: "تاريخ الاستحقاق",
        addTask: "إضافة مهمة",
        attachFiles: "إرفاق ملفات",
        remove: "إزالة",
        attached: "مرفق:",
        assignTo: "إسناد إلى",
        optional: "(اختياري)",
        searchUsersGroups: "ابحث عن مستخدمين ومجموعات…",
        users: "المستخدمون",
        groups: "المجموعات",
        noUsersFound: "لم يتم العثور على مستخدمين",
        noGroupsFound: "لم يتم العثور على مجموعات",
        failedToLoad: "فشل التحميل",
        updateExistingList: "تحديث قائمة موجودة",
        selectListToUpdate: "اختر قائمة لتحديثها",
        createNewList: "— إنشاء قائمة جديدة —",
        replaceHint: "في حال التحديد، سيتم استبدال جميع المهام في تلك القائمة. اتركه فارغًا لإنشاء قائمة جديدة.",
        working: "جارٍ العمل…",
        updateYourTasks: "تحديث مهامك",
        noTasksInSheet: "لم يتم العثور على مهام في الورقة.",
        nTasksAdded: "{n} مهام مُضافة",
        done: "تم!",
    },
    es_ES: {
        targetStores: "Objetivo {stores}",
        findStores: "Encuentra {stores}",
        loadingStores: "Cargando {stores}...",
        searchStores: "Registrar {stores}...",
        selectStore: "Elige un {store}...",
        noStoresFound: "No se encontró {stores}",
        failedLoadStores: "No se ha podido cargar {stores}",
        errorLoading: "Carga de errores",
        loading: "Cargando...",
        pullReviewTasks: "Tareas de Extracción y Revisión",
        taskListName: "Nombre de la lista de tareas",
        taskListNamePlaceholder: "por ejemplo, lista de verificación de tiendas Q2",
        pullFromExternal: "Retirada de Servicios Externos",
        reviewEditTasks: "Revisar y editar tareas",
        nTasks: "{n} tareas",
        title: "Título",
        taskTitlePlaceholder: "Título de la tarea",
        description: "Descripción",
        type: "Tipo",
        noneOption: "— ninguno —",
        dueDate: "Fecha de parto",
        addTask: "Añadir tarea",
        attachFiles: "Adjuntar archivos",
        remove: "Eliminar",
        attached: "Adjunto:",
        assignTo: "Asignar a",
        optional: "(opcional)",
        searchUsersGroups: "Buscar usuarios y grupos...",
        users: "Usuarios",
        groups: "Grupos",
        noUsersFound: "No se han encontrado usuarios",
        noGroupsFound: "No se han encontrado grupos",
        failedToLoad: "No se ha cargado",
        updateExistingList: "Actualizar lista existente",
        selectListToUpdate: "Seleccione una lista para actualizar",
        createNewList: "— Crear una nueva lista —",
        replaceHint: "Si se selecciona, todas las tareas de esa lista se reemplazan. Déjalo en blanco para crear una nueva lista.",
        working: "Trabajando...",
        updateYourTasks: "Actualiza tus tareas",
        noTasksInSheet: "No se encuentran tareas en la hoja.",
        nTasksAdded: "{n} tareas añadidas",
        done: "¡Hecho!",
    },
    fr_FR: {
        targetStores: "Cible {stores}",
        findStores: "Trouver {stores}",
        loadingStores: "Chargement {stores}...",
        searchStores: "Fouillez {stores}...",
        selectStore: "Sélectionnez un {store}...",
        noStoresFound: "Aucune {stores} trouvée",
        failedLoadStores: "Échec de charger {stores}",
        errorLoading: "Chargement d’erreur",
        loading: "Chargement...",
        pullReviewTasks: "Tâches de tirage et de révision",
        taskListName: "Nom de la liste des tâches",
        taskListNamePlaceholder: "par exemple, liste de contrôle des magasins Q2",
        pullFromExternal: "Appel auprès des services externes",
        reviewEditTasks: "Revoir et modifier les tâches",
        nTasks: "{n} Tâches",
        title: "Titre",
        taskTitlePlaceholder: "Titre de la tâche",
        description: "Description",
        type: "Type",
        noneOption: "— aucun —",
        dueDate: "Date d’accouchement",
        addTask: "Ajouter une tâche",
        attachFiles: "Joindre les fichiers",
        remove: "Retirer",
        attached: "Pièce jointe :",
        assignTo: "Assigner à",
        optional: "(optionnel)",
        searchUsersGroups: "Rechercher utilisateurs et groupes...",
        users: "Utilisateurs",
        groups: "Groupes",
        noUsersFound: "Aucun utilisateur trouvé",
        noGroupsFound: "Aucun groupe trouvé",
        failedToLoad: "Échec de chargement",
        updateExistingList: "Mettre à jour la liste existante",
        selectListToUpdate: "Sélectionnez une liste à mettre à jour",
        createNewList: "— Créer une nouvelle liste —",
        replaceHint: "Si sélectionnées, toutes les tâches de cette liste sont remplacées. Laissez vide pour créer une nouvelle liste.",
        working: "Travailler...",
        updateYourTasks: "Mettez à jour vos tâches",
        noTasksInSheet: "Aucune tâche trouvée dans la feuille.",
        nTasksAdded: "{n} tâches ajoutées",
        done: "C’est fait !",
    },
    nl_NL: {
        targetStores: "Doelwit {stores}",
        findStores: "Vind {stores}",
        loadingStores: "Laad {stores}...",
        searchStores: "Zoek {stores}...",
        selectStore: "Kies een {store}...",
        noStoresFound: "Geen {stores} gevonden",
        failedLoadStores: "Niet geladen {stores}",
        errorLoading: "Foutlading",
        loading: "Laden...",
        pullReviewTasks: "Taken ophalen en beoordelen",
        taskListName: "Naam van de Taaklijst",
        taskListNamePlaceholder: "bijvoorbeeld Q2 Store Checklist",
        pullFromExternal: "Put uit externe diensten",
        reviewEditTasks: "Taken beoordelen en bewerken",
        nTasks: "{n} taken",
        title: "Titel",
        taskTitlePlaceholder: "Taaktitel",
        description: "Beschrijving",
        type: "Type",
        noneOption: "— geen —",
        dueDate: "Uitgerekende datum",
        addTask: "Taak toevoegen",
        attachFiles: "Bestanden bijvoegen",
        remove: "Verwijder",
        attached: "Bijgevoegd:",
        assignTo: "Toewijzen aan",
        optional: "(optioneel)",
        searchUsersGroups: "Zoek gebruikers en groepen...",
        users: "Gebruikers",
        groups: "Groepen",
        noUsersFound: "Geen gebruikers gevonden",
        noGroupsFound: "Geen groepen gevonden",
        failedToLoad: "Niet geladen",
        updateExistingList: "Werk bestaande lijst bij",
        selectListToUpdate: "Selecteer een lijst om bij te werken",
        createNewList: "— Maak een nieuwe lijst aan —",
        replaceHint: "Als geselecteerd, worden alle taken in die lijst vervangen. Laat het leeg om een nieuwe lijst aan te maken.",
        working: "Aan het werk...",
        updateYourTasks: "Werk je taken bij",
        noTasksInSheet: "Geen taken in het blad gevonden.",
        nTasksAdded: "{n} taken toegevoegd",
        done: "Klaar!",
    },
    zh_CN: {
        targetStores: "目标{stores}",
        findStores: "找到{stores}",
        loadingStores: "正在加载{stores}......",
        searchStores: "搜查{stores}......",
        selectStore: "选择一个{store}......",
        noStoresFound: "未发现{stores}",
        failedLoadStores: "加载失败{stores}",
        errorLoading: "错误加载",
        loading: "加载中......",
        pullReviewTasks: "拉取与复核任务",
        taskListName: "任务列表名称",
        taskListNamePlaceholder: "例如，第二季度门店清单",
        pullFromExternal: "从外部服务中提取",
        reviewEditTasks: "审核与编辑任务",
        nTasks: "{n}任务",
        title: "标题",
        taskTitlePlaceholder: "任务名称",
        description: "描述",
        type: "类型",
        noneOption: "——没有——",
        dueDate: "预产期",
        addTask: "添加任务",
        attachFiles: "附件文件",
        remove: "删除",
        attached: "附录：",
        assignTo: "分配到",
        optional: "（可选）",
        searchUsersGroups: "搜索用户和组......",
        users: "用户",
        groups: "团体",
        noUsersFound: "未找到用户",
        noGroupsFound: "未找到组",
        failedToLoad: "加载失败",
        updateExistingList: "更新现有名单",
        selectListToUpdate: "选择列表进行更新",
        createNewList: "——创建新名单——",
        replaceHint: "如果被选中，列表中的所有任务都会被替换。留空以创建新列表。",
        working: "工作......",
        updateYourTasks: "更新你的任务",
        noTasksInSheet: "表格里没有找到任务。",
        nTasksAdded: "新增{n}任务",
        done: "完成！",
    },
    ja_JP: {
        targetStores: "ターゲット{stores}",
        findStores: "見つけ{stores}",
        loadingStores: "読み込み{stores}...",
        searchStores: "{stores}を捜索...",
        selectStore: "{store}を選んで...",
        noStoresFound: "{stores}は見つかりませんでした",
        failedLoadStores: "ロードに失敗{stores}",
        errorLoading: "エラーロード",
        loading: "読み込み中...",
        pullReviewTasks: "プル&レビュータスク",
        taskListName: "タスクリスト名",
        taskListNamePlaceholder: "例:第2四半期ストアチェックリスト",
        pullFromExternal: "外部サービスからの引用",
        reviewEditTasks: "レビュー&編集タスク",
        nTasks: "{n}任務",
        title: "タイトル",
        taskTitlePlaceholder: "課題タイトル",
        description: "概要",
        type: "種類",
        noneOption: "— なし —",
        dueDate: "予定日",
        addTask: "タスクを追加",
        attachFiles: "ファイルを添付する",
        remove: "削除",
        attached: "添付:",
        assignTo: "割り当て",
        optional: "(任意)",
        searchUsersGroups: "ユーザーやグループを検索...",
        users: "ユーザー",
        groups: "グループ",
        noUsersFound: "ユーザーは見つかりませんでした",
        noGroupsFound: "グループは見つかりませんでした",
        failedToLoad: "ロードに失敗しました",
        updateExistingList: "既存リストの更新",
        selectListToUpdate: "更新するリストを選択してください",
        createNewList: "— 新しいリストを作成 —",
        replaceHint: "選択されると、そのリスト内のすべてのタスクが置き換えられます。新しいリストを作成するには空欄のままにしてください。",
        working: "仕事中...",
        updateYourTasks: "タスクを更新する",
        noTasksInSheet: "シートにはタスクが見つからなかった。",
        nTasksAdded: "{n}タスクが追加されました",
        done: "完了!",
    },
    th_TH: {
        targetStores: "เป้าหมาย {stores}",
        findStores: "ค้นหา{stores}",
        loadingStores: "กําลังโหลด{stores}...",
        searchStores: "ค้นหา{stores}...",
        selectStore: "เลือก{store}...",
        noStoresFound: "ไม่พบ{stores}",
        failedLoadStores: "โหลด{stores}ไม่สําเร็จ",
        errorLoading: "โหลดผิดพลาด",
        loading: "กําลังโหลด...",
        pullReviewTasks: "งานดึงและทบทวน",
        taskListName: "ชื่อรายการงาน",
        taskListNamePlaceholder: "เช่น รายการตรวจสอบร้านค้า Q2",
        pullFromExternal: "ดึงจากบริการภายนอก",
        reviewEditTasks: "ตรวจสอบและแก้ไขงาน",
        nTasks: "งาน{n}",
        title: "ชื่อเรื่อง",
        taskTitlePlaceholder: "ชื่องาน",
        description: "คําอธิบาย",
        type: "ชนิดภาพเขียน",
        noneOption: "— ไม่มี —",
        dueDate: "วันครบกําหนด",
        addTask: "เพิ่มงาน",
        attachFiles: "แนบไฟล์",
        remove: "ลบ",
        attached: "แนบมา:",
        assignTo: "มอบหมายให้",
        optional: "(ไม่บังคับ)",
        searchUsersGroups: "ค้นหาผู้ใช้และกลุ่ม...",
        users: "ผู้ใช้",
        groups: "กลุ่ม",
        noUsersFound: "ไม่พบผู้ใช้",
        noGroupsFound: "ไม่พบกลุ่ม",
        failedToLoad: "โหลดไม่สําเร็จ",
        updateExistingList: "อัปเดตรายการที่มีอยู่",
        selectListToUpdate: "เลือกรายการที่จะอัปเดต",
        createNewList: "— สร้างรายการใหม่ —",
        replaceHint: "ถ้าเลือก งานทั้งหมดในรายการนั้นจะถูกแทนที่ เว้นว่างไว้เพื่อสร้างรายการใหม่",
        working: "ทํางาน...",
        updateYourTasks: "อัปเดตงานของคุณ",
        noTasksInSheet: "ไม่พบงานในชีต",
        nTasksAdded: "เพิ่มงาน{n}",
        done: "เสร็จแล้ว!",
    },
    es_MX: {
        targetStores: "Objetivo {stores}",
        findStores: "Encuentra {stores}",
        loadingStores: "Cargando {stores}...",
        searchStores: "Registrar {stores}...",
        selectStore: "Elige un {store}...",
        noStoresFound: "No se encontró {stores}",
        failedLoadStores: "No se ha podido cargar {stores}",
        errorLoading: "Carga de errores",
        loading: "Cargando...",
        pullReviewTasks: "Tareas de Extracción y Revisión",
        taskListName: "Nombre de la lista de tareas",
        taskListNamePlaceholder: "por ejemplo, lista de verificación de tiendas Q2",
        pullFromExternal: "Retirada de Servicios Externos",
        reviewEditTasks: "Revisar y editar tareas",
        nTasks: "{n} tareas",
        title: "Título",
        taskTitlePlaceholder: "Título de la tarea",
        description: "Descripción",
        type: "Tipo",
        noneOption: "— ninguno —",
        dueDate: "Fecha de parto",
        addTask: "Añadir tarea",
        attachFiles: "Adjuntar archivos",
        remove: "Eliminar",
        attached: "Adjunto:",
        assignTo: "Asignar a",
        optional: "(opcional)",
        searchUsersGroups: "Buscar usuarios y grupos...",
        users: "Usuarios",
        groups: "Grupos",
        noUsersFound: "No se han encontrado usuarios",
        noGroupsFound: "No se han encontrado grupos",
        failedToLoad: "No se ha cargado",
        updateExistingList: "Actualizar lista existente",
        selectListToUpdate: "Seleccione una lista para actualizar",
        createNewList: "— Crear una nueva lista —",
        replaceHint: "Si se selecciona, todas las tareas de esa lista se reemplazan. Déjalo en blanco para crear una nueva lista.",
        working: "Trabajando...",
        updateYourTasks: "Actualiza tus tareas",
        noTasksInSheet: "No se encuentran tareas en la hoja.",
        nTasksAdded: "{n} tareas añadidas",
        done: "¡Hecho!",
    },
    vi_VN: {
        targetStores: "Mục tiêu {stores}",
        findStores: "Tìm {stores}",
        loadingStores: "Đang tải {stores}...",
        searchStores: "Tìm kiếm {stores}...",
        selectStore: "Chọn một {store}...",
        noStoresFound: "Không tìm thấy {stores}",
        failedLoadStores: "Không tải được {stores}",
        errorLoading: "Lỗi tải",
        loading: "Đang tải...",
        pullReviewTasks: "Nhiệm vụ Pull & Review",
        taskListName: "Tên danh sách nhiệm vụ",
        taskListNamePlaceholder: "ví dụ: Danh sách kiểm tra cửa hàng Q2",
        pullFromExternal: "Lấy từ các dịch vụ bên ngoài",
        reviewEditTasks: "Xem lại và chỉnh sửa nhiệm vụ",
        nTasks: "{n} nhiệm vụ",
        title: "Tiêu đề",
        taskTitlePlaceholder: "Tiêu đề nhiệm vụ",
        description: "Sự miêu tả",
        type: "Kiểu",
        noneOption: "- không có -",
        dueDate: "Ngày đến hạn",
        addTask: "Thêm nhiệm vụ",
        attachFiles: "Đính kèm tệp",
        remove: "Loại bỏ",
        attached: "Đính kèm:",
        assignTo: "Gán cho",
        optional: "(tùy chọn)",
        searchUsersGroups: "Tìm kiếm người dùng và nhóm...",
        users: "Người dùng",
        groups: "Nhóm",
        noUsersFound: "Không tìm thấy người dùng",
        noGroupsFound: "Không tìm thấy nhóm nào",
        failedToLoad: "Không tải được",
        updateExistingList: "Cập nhật danh sách hiện có",
        selectListToUpdate: "Chọn một danh sách để cập nhật",
        createNewList: "— Tạo một danh sách mới —",
        replaceHint: "Nếu được chọn, tất cả các nhiệm vụ trong danh sách đó sẽ được thay thế. Để trống để tạo danh sách mới.",
        working: "Đang làm việc...",
        updateYourTasks: "Cập nhật nhiệm vụ của bạn",
        noTasksInSheet: "Không tìm thấy nhiệm vụ nào trong trang tính.",
        nTasksAdded: "{n} nhiệm vụ được thêm vào",
        done: "Xong!",
    },
    ko_KR: {
        targetStores: "타겟 {stores}",
        findStores: "찾아{stores}",
        loadingStores: "로딩 {stores}...",
        searchStores: "수색{stores}...",
        selectStore: "{store} 선택하세요...",
        noStoresFound: "{stores} 발견되지 않았습니다",
        failedLoadStores: "로드에 실패{stores}",
        errorLoading: "오류 로딩",
        loading: "로딩 중...",
        pullReviewTasks: "작업 추출 및 검토",
        taskListName: "작업 목록 이름",
        taskListNamePlaceholder: "예: Q2 매장 체크리스트",
        pullFromExternal: "외부 서비스에서 자료 추출",
        reviewEditTasks: "검토 및 편집 작업",
        nTasks: "{n} 임무",
        title: "제목",
        taskTitlePlaceholder: "과제 제목",
        description: "설명",
        type: "유형",
        noneOption: "— 없음 —",
        dueDate: "예정일",
        addTask: "작업 추가",
        attachFiles: "파일 첨부",
        remove: "제거",
        attached: "첨부:",
        assignTo: "할당",
        optional: "(선택 사항)",
        searchUsersGroups: "사용자 및 그룹을 검색하세요...",
        users: "사용자",
        groups: "그룹",
        noUsersFound: "사용자를 찾지 못했습니다",
        noGroupsFound: "그룹 찾기 어떠",
        failedToLoad: "로딩 실패",
        updateExistingList: "기존 목록 업데이트",
        selectListToUpdate: "업데이트할 목록을 선택하세요",
        createNewList: "— 새 목록을 만들기 —",
        replaceHint: "선택되면 해당 목록에 있는 모든 작업이 교체됩니다. 빈칸으로 남겨두면 새 목록을 만드세요.",
        working: "일하는 중...",
        updateYourTasks: "작업 업데이트",
        noTasksInSheet: "시트에는 어떤 작업도 없었습니다.",
        nTasksAdded: "{n} 과제 추가됨",
        done: "끝!",
    },
    tl_PH: {
        targetStores: "Target {stores}",
        findStores: "Hanapin {stores}",
        loadingStores: "Pag-load {stores} ...",
        searchStores: "Hanapin {stores} ...",
        selectStore: "Pumili ng isang {store} ...",
        noStoresFound: "Walang {stores} natagpuan",
        failedLoadStores: "Nabigo akong mag-load ng {stores}",
        errorLoading: "Error sa paglo-load",
        loading: "Naglo-load...",
        pullReviewTasks: "Mga Gawain sa Hilahin at Suruhin",
        taskListName: "Pangalan ng Listahan ng Gawain",
        taskListNamePlaceholder: "Halimbawa, Checklist ng Tindahan ng Q2",
        pullFromExternal: "Kumuha mula sa Mga Panlabas na Serbisyo",
        reviewEditTasks: "Suriin at I-edit ang Mga Gawain",
        nTasks: "{n} Mga Gawain",
        title: "Pamagat",
        taskTitlePlaceholder: "Pamagat ng gawain",
        description: "Paglalarawan",
        type: "Uri",
        noneOption: "— wala —",
        dueDate: "Takdang Petsa",
        addTask: "Email Address *",
        attachFiles: "Email Address *",
        remove: "Alisin",
        attached: "Nakakabit:",
        assignTo: "Magtalaga sa",
        optional: "(opsyonal)",
        searchUsersGroups: "Hanapin ang mga gumagamit at pangkat ...",
        users: "Mga Gumagamit",
        groups: "Mga Grupo",
        noUsersFound: "Walang natagpuang user",
        noGroupsFound: "Walang natagpuang grupo",
        failedToLoad: "Nabigong mag-load",
        updateExistingList: "I-update ang Umiiral na Listahan",
        selectListToUpdate: "Pumili ng listahan na i-update",
        createNewList: "— Lumikha ng bagong listahan —",
        replaceHint: "Kung napili, ang lahat ng mga gawain sa listahang iyon ay pinalitan. Mag-iwan ng blangko upang lumikha ng isang bagong listahan.",
        working: "Nagtatrabaho ...",
        updateYourTasks: "I-update ang iyong Mga Gawain",
        noTasksInSheet: "Walang mga gawain na natagpuan sa sheet.",
        nTasksAdded: "{n} mga gawain na idinagdag",
        done: "Tapos na!",
    },
    pt_BR: {
        targetStores: "Alvo {stores}",
        findStores: "Encontre {stores}",
        loadingStores: "Carregando {stores}...",
        searchStores: "Procurem {stores}...",
        selectStore: "Escolha um {store}...",
        noStoresFound: "Nenhuma {stores} encontrada",
        failedLoadStores: "Não carreguei {stores}",
        errorLoading: "Carregamento de erros",
        loading: "Carregando...",
        pullReviewTasks: "Puxar e revisar tarefas",
        taskListName: "Nome da Lista de Tarefas",
        taskListNamePlaceholder: "por exemplo, lista de verificação da loja do segundo trimestre",
        pullFromExternal: "Puxar de Serviços Externos",
        reviewEditTasks: "Revisar e editar tarefas",
        nTasks: "{n} Tarefas",
        title: "Título",
        taskTitlePlaceholder: "Título da tarefa",
        description: "Descrição",
        type: "Tipo",
        noneOption: "— nenhum —",
        dueDate: "Data de parto",
        addTask: "Adicionar tarefa",
        attachFiles: "Anexar arquivos",
        remove: "Remover",
        attached: "ANEXADO:",
        assignTo: "Atribuir a",
        optional: "(opcional)",
        searchUsersGroups: "Pesquise usuários e grupos...",
        users: "Usuários",
        groups: "Grupos",
        noUsersFound: "Nenhum usuário encontrado",
        noGroupsFound: "Nenhum grupo encontrado",
        failedToLoad: "Falharam ao carregar",
        updateExistingList: "Atualizar Lista Existente",
        selectListToUpdate: "Selecione uma lista para atualizar",
        createNewList: "— Criar uma nova lista —",
        replaceHint: "Se selecionadas, todas as tarefas dessa lista são substituídas. Deixe em branco para criar uma nova lista.",
        working: "Trabalhando...",
        updateYourTasks: "Atualize suas Tarefas",
        noTasksInSheet: "Nenhuma tarefa encontrada na ficha.",
        nTasksAdded: "{n} tarefas adicionadas",
        done: "Pronto!",
    },
    ht_HT: {
        targetStores: "Sib {stores}",
        findStores: "Jwenn {stores}",
        loadingStores: "Loading {stores}...",
        searchStores: "Rechèch {stores}...",
        selectStore: "Chwazi yon {store}...",
        noStoresFound: "Pa gen {stores} jwenn",
        failedLoadStores: "Echwe pou pou chaje {stores}",
        errorLoading: "Erè loading",
        loading: "Chaje ...",
        pullReviewTasks: "Rale & Revizyon Travay",
        taskListName: "Non Lis Travay la",
        taskListNamePlaceholder: "Egzanp, Q2 Store Lis verifikasyon",
        pullFromExternal: "Rale soti nan Sèvis Ekstèn",
        reviewEditTasks: "Revize & Edit Travay",
        nTasks: "{n} travay",
        title: "",
        taskTitlePlaceholder: "travay la",
        description: "Deskripsyon",
        type: "Kalite",
        noneOption: "— Pa gen yonn —",
        dueDate: "Dat limit",
        addTask: "Ajoute travay",
        attachFiles: "Tache dosye",
        remove: "Retire",
        attached: "Tache:",
        assignTo: "Asiyen a",
        optional: "(si ou vle)",
        searchUsersGroups: "Itilizatè rechèch ak gwoup ...",
        users: "Itilizatè yo",
        groups: "Gwoup yo",
        noUsersFound: "Pa gen itilizatè yo jwenn",
        noGroupsFound: "Pa gen gwoup yo te jwenn",
        failedToLoad: "Echwe pou pou chaje",
        updateExistingList: "Mizajou Lis ki deja egziste",
        selectListToUpdate: "Chwazi yon lis pou mete ajou",
        createNewList: "— Kreye yon nouvo lis —",
        replaceHint: "Si yo chwazi, tout travay nan lis sa a yo ranplase. Kite vid pou kreye yon nouvo lis.",
        working: "Travay ...",
        updateYourTasks: "Mete ajou Travay ou yo",
        noTasksInSheet: "Pa gen okenn travay yo te jwenn nan fèy la.",
        nTasksAdded: "{n} travay te ajoute",
        done: "Fè!",
    },
};

;// ./tasks-integration-widget.ts
var tasks_integration_widget_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};


// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwhJDxf4hgE_zIfZjvedGmqQnH8_nJ2UIEwMtcQ8Hbk2RBNXnslyqSV718k3k0RYXy1/exec";
const DEFAULT_API_TOKEN = "NjljMjU3N2JjZmFjZWYxMzc4MzIzYTNkOkp6VEpkaGlfclRyRDk4bjlBZ2pIdXFkcmI3UjQhdl1LTm1RV1hwOHBIdUd+Unl3clk7MjYhSS1JdiprLGdOaVI=";
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#da2e32";
const DEFAULT_ACCENT_COLOR = "#da2e32";
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
// ── Config schema ─────────────────────────────────────────────────────────────
const configurationSchema = {
    properties: {
        appsscripturl: {
            type: "string",
            title: "Apps Script URL",
            default: DEFAULT_APPS_SCRIPT_URL,
        },
        apitoken: {
            type: "string",
            title: "API Token",
            default: DEFAULT_API_TOKEN,
        },
        baseurl: {
            type: "string",
            title: "Base URL",
            default: DEFAULT_BASE_URL,
        },
        primarycolor: {
            type: "string",
            title: "Primary Color",
            default: DEFAULT_PRIMARY_COLOR,
        },
        accentcolor: {
            type: "string",
            title: "Accent Color",
            default: DEFAULT_ACCENT_COLOR,
        },
        backgroundcolor: {
            type: "string",
            title: "Background Color",
            default: "",
        },
        storelabelsingular: {
            type: "string",
            title: "Store Label (singular)",
            default: "Store",
        },
        storelabelplural: {
            type: "string",
            title: "Store Label (plural)",
            default: "Stores",
        },
        enabletasklistupdating: {
            type: "boolean",
            title: "Enable Task List Updating",
            default: false,
        },
        sheetname: {
            type: "string",
            title: "Sheet Name",
            default: "",
        },
        enabletasktypes: {
            type: "boolean",
            title: "Enable Task Types",
            default: false,
        },
        tasktypes: {
            type: "string",
            title: "Task Types (comma-separated)",
            default: "Finance,Operations,Training,Compliance,Safety",
        },
    },
};
const uiSchema = {
    apitoken: {
        "ui:widget": "password",
        "ui:help": "Staffbase Basic auth token",
    },
    appsscripturl: {
        "ui:help": "Deployed Google Apps Script web app URL (deploy as Anyone)",
    },
    baseurl: {
        "ui:help": "Staffbase API base URL",
    },
    primarycolor: {
        "ui:widget": "color",
        "ui:help": "Primary brand color (default: Panda Express red)",
    },
    accentcolor: {
        "ui:widget": "color",
        "ui:help": "Accent / secondary color (default: Panda Express orange)",
    },
    backgroundcolor: {
        "ui:widget": "color",
        "ui:help": "Widget background color — leave blank for transparent",
    },
    storelabelsingular: {
        "ui:help": "e.g. Store, Location, Branch",
    },
    storelabelplural: {
        "ui:help": "e.g. Stores, Locations, Branches",
    },
    enabletasklistupdating: {
        "ui:help": "When enabled, select an existing task list to update instead of always creating a new one",
    },
    sheetname: {
        "ui:help": "Override which Google Sheet tab to pull from (e.g. Panda). Leave blank to use the default tab in the Apps Script.",
    },
    enabletasktypes: {
        "ui:help": "When enabled, a Type column appears in the task table and the selected type is embedded in the task description",
    },
    tasktypes: {
        "ui:help": "Comma-separated list of task type options shown in the Type dropdown",
    },
};
// ── Widget factory ────────────────────────────────────────────────────────────
const factory = (BaseBlockClass, widgetApi) => {
    return class TasksIntegrationWidget extends BaseBlockClass {
        constructor() {
            super();
        }
        renderBlock(container) {
            return tasks_integration_widget_awaiter(this, void 0, void 0, function* () {
                var _a;
                const appsScriptUrl = this.getAttribute("appsscripturl") || DEFAULT_APPS_SCRIPT_URL;
                const apiToken = this.getAttribute("apitoken") || DEFAULT_API_TOKEN;
                const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/$/, "");
                const primaryColor = this.getAttribute("primarycolor") || DEFAULT_PRIMARY_COLOR;
                const accentColor = this.getAttribute("accentcolor") || DEFAULT_ACCENT_COLOR;
                const primaryRgb = hexToRgb(primaryColor);
                const primaryText = contrastColor(primaryColor);
                const bgColor = this.getAttribute("backgroundcolor") || "";
                const storeS = this.getAttribute("storelabelsingular") || "Store";
                const storeP = this.getAttribute("storelabelplural") || "Stores";
                const enableUpdating = this.getAttribute("enabletasklistupdating") === "true";
                const sheetName = this.getAttribute("sheetname") || "";
                const enableTypes = this.getAttribute("enabletasktypes") === "true";
                const typeList = (this.getAttribute("tasktypes") || "Finance,Operations,Training,Compliance,Safety")
                    .split(",")
                    .map(s => s.trim())
                    .filter(Boolean);
                let storeProjects = [];
                let selectedStores = [];
                let allUsers = [];
                let allGroups = [];
                let selectedAssignees = [];
                const p = "tiw";
                // ── Locale / i18n ──────────────────────────────────────────────────
                // Translator bound as `tx` (this widget uses `tr` as a table-row var).
                let locale = DEFAULT_LOCALE;
                let tx = makeT(STRINGS, locale);
                // Resolve before first paint: getUserInformation() → id → config.locale.
                // apiOpts is defined later, so we do a minimal inline fetch with the token.
                try {
                    const prof = yield widgetApi.getUserInformation();
                    let configLocale = "";
                    const uid = (prof === null || prof === void 0 ? void 0 : prof.id) || "";
                    if (uid) {
                        const r = yield fetch(`${baseUrl}/users/${uid}`, { credentials: "omit", headers: { Authorization: `Basic ${apiToken}` } });
                        if (r.ok) {
                            const u = yield r.json();
                            configLocale = ((_a = u === null || u === void 0 ? void 0 : u.config) === null || _a === void 0 ? void 0 : _a.locale) || "";
                        }
                    }
                    locale = detectLocale({ configLocale, available: Object.keys(STRINGS) });
                    tx = makeT(STRINGS, locale);
                }
                catch (_) { /* keep default */ }
                const rtl = isRtl(locale);
                try {
                    container.setAttribute("dir", rtl ? "rtl" : "ltr");
                }
                catch (_) { }
                // SVG icons (inlined so no external deps needed)
                const iconDownload = `<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M472.7 189.5c-15.76-10-36.21-16.79-58.59-19.54-6.65-39.1-24.22-72.52-51.27-97.26C334.15 46.45 296.21 32 256 32c-35.35 0-68 11.08-94.37 32a149.7 149.7 0 0 0-45.29 60.42c-30.67 4.32-57 14.61-76.71 30C13.7 174.83 0 203.56 0 237.6 0 305 55.92 352 136 352h104V208h32v144h124c72.64 0 116-34.24 116-91.6 0-30.05-13.59-54.57-39.3-70.9zM240 419.42 191.98 371l-22.61 23L256 480l86.63-86-22.61-23L272 419.42V352h-32v67.42z"/></svg>`;
                const iconUpload = `<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M504 256c0 136.967-111.033 248-248 248S8 392.967 8 256 119.033 8 256 8s248 111.033 248 248zM227.314 387.314l184-184c6.248-6.248 6.248-16.379 0-22.627l-22.627-22.627c-6.248-6.249-16.379-6.249-22.628 0L216 308.118l-70.059-70.059c-6.248-6.248-16.379-6.248-22.628 0l-22.627 22.627c-6.248 6.248-6.248 16.379 0 22.627l104 104c6.249 6.249 16.379 6.249 22.628.001z"/></svg>`;
                container.innerHTML = `
        <style>
          .${p} {
            --primary:      ${primaryColor};
            --primary-rgb:  ${primaryRgb};
            --primary-text: ${primaryText};
            --accent:       ${accentColor};
            --dark:    #1A1A1A;
            --gray:    #6b7280;
            --gray-lt: #9ca3af;
            --border:  #e5e7eb;
            --success: #2E7D4A;
            --error:   #C41E3A;
            --r-sm: 6px; --r-md: 10px; --r-lg: 14px;
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
            --shadow-md: 0 4px 16px rgba(0,0,0,0.08);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: var(--dark);
            background: ${bgColor || "transparent"};
            padding: 20px;
          }
          .${p} *, .${p} *::before, .${p} *::after {
            box-sizing: border-box; margin: 0; padding: 0;
          }

          /* ── Cards ─────────────────────────────────────────── */
          .${p}-card {
            background: #fff;
            border-radius: var(--r-lg);
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border);
            border-inline-start: 3px solid var(--primary);
            margin-bottom: 12px;
            overflow: visible;
            transition: background-color .18s ease, box-shadow .18s ease;
          }
          .${p}-card:hover,
          .${p}-card:focus-within {
            background: rgba(var(--primary-rgb),.015);
            box-shadow: 0 2px 8px rgba(0,0,0,.06);
          }
          .${p}-card-head {
            display: flex; align-items: center; gap: 10px;
            padding: 14px 18px 12px;
            border-bottom: 1px solid var(--border);
          }
          .${p}-step {
            width: 22px; height: 22px; border-radius: 50%;
            background: var(--primary); color: var(--primary-text);
            font-size: 11px; font-weight: 800;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          }
          .${p}-card-title {
            font-size: 12px; font-weight: 700; letter-spacing: .4px;
            text-transform: uppercase; color: var(--dark);
          }
          .${p}-card-body { padding: 16px 18px; }

          /* ── Labels / inputs ───────────────────────────────── */
          .${p}-label {
            display: block; font-size: 12px; font-weight: 600;
            color: var(--gray); text-transform: uppercase; letter-spacing: .4px;
            margin-bottom: 6px;
          }
          .${p}-help { font-size: 12px; color: var(--gray-lt); margin-top: 5px; }
          .${p}-input {
            width: 100%; padding: 10px 13px;
            border: 1.5px solid var(--border); border-radius: var(--r-md);
            font-size: 14px; font-family: inherit; color: var(--dark);
            transition: border-color .15s, box-shadow .15s;
            background: #fafafa;
          }
          .${p}-input::placeholder { color: var(--gray-lt); }
          .${p}-input:focus {
            outline: none; border-color: var(--primary); background: #fff;
            box-shadow: 0 0 0 3px rgba(var(--primary-rgb),.1);
          }

          /* ── Input + icon-button row ───────────────────────── */
          .${p}-input-group { display: flex; gap: 8px; align-items: stretch; }
          .${p}-input-group .${p}-input { flex: 1; }
          .${p}-icon-btn {
            width: 42px; border: none; border-radius: var(--r-md);
            background: var(--primary); color: var(--primary-text); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(var(--primary-rgb),.35);
            transition: filter .15s, transform .15s, box-shadow .15s;
          }
          .${p}-icon-btn:hover:not(:disabled) {
            filter: brightness(.88); transform: translateY(-1px);
            box-shadow: 0 4px 14px rgba(var(--primary-rgb),.4);
          }
          .${p}-icon-btn:active:not(:disabled) { transform: translateY(0); }
          .${p}-icon-btn:disabled { opacity: .4; cursor: not-allowed; }

          /* ── Multi-select ──────────────────────────────────── */
          .${p}-ms-wrap { position: relative; }
          .${p}-ms-trigger {
            width: 100%; min-height: 44px; padding: 8px 36px 8px 11px;
            border: 1.5px solid var(--border); border-radius: var(--r-md);
            background: #fafafa; cursor: pointer;
            display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
            position: relative; transition: border-color .15s;
          }
          .${p}-ms-trigger:hover, .${p}-ms-trigger.open {
            border-color: var(--primary); background: #fff;
          }
          .${p}-ms-trigger::after {
            content: '▾'; position: absolute; right: 11px; top: 50%;
            transform: translateY(-50%); color: var(--gray-lt); pointer-events: none;
            font-size: 13px;
          }
          .${p}-ms-ph { color: var(--gray-lt); font-size: 14px; }
          .${p}-tag {
            display: inline-flex; align-items: center; gap: 4px;
            background: var(--primary); color: var(--primary-text);
            padding: 3px 8px; border-radius: 20px;
            font-size: 12px; font-weight: 600;
          }
          .${p}-tag-x { cursor: pointer; opacity: .75; line-height: 1; }
          .${p}-tag-x:hover { opacity: 1; }
          .${p}-dropdown {
            display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0;
            background: #fff; border: 1.5px solid var(--primary);
            border-radius: var(--r-md); box-shadow: var(--shadow-md);
            overflow: hidden; z-index: 200;
          }
          .${p}-dropdown.show { display: block; animation: ${p}-fade .15s ease; }
          @keyframes ${p}-fade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
          .${p}-dd-search { padding: 9px 10px; border-bottom: 1px solid var(--border); }
          .${p}-dd-search input {
            width: 100%; padding: 7px 10px; border: 1.5px solid var(--border);
            border-radius: var(--r-sm); font-size: 13px; background: #fafafa;
          }
          .${p}-dd-search input:focus { outline: none; border-color: var(--primary); background: #fff; }
          .${p}-dd-list { max-height: 210px; overflow-y: auto; }
          .${p}-dd-opt {
            padding: 10px 12px; cursor: pointer;
            display: flex; align-items: center; gap: 9px;
            font-size: 13px; border-bottom: 1px solid #f3f4f6;
            transition: background .1s;
          }
          .${p}-dd-opt:last-child { border-bottom: none; }
          .${p}-dd-opt:hover { background: #fef2f2; }
          .${p}-dd-opt.sel { background: rgba(var(--primary-rgb),.06); }
          .${p}-check {
            width: 16px; height: 16px; border: 1.5px solid #d1d5db;
            border-radius: 3px; flex-shrink: 0; font-size: 10px;
            display: flex; align-items: center; justify-content: center; color: transparent;
            transition: all .1s;
          }
          .${p}-dd-opt.sel .${p}-check {
            background: var(--primary); border-color: var(--primary); color: #fff;
          }
          .${p}-dd-msg { padding: 20px; text-align: center; color: var(--gray-lt); font-size: 13px; }

          /* ── Task table ────────────────────────────────────── */
          .${p}-tbl-zone {
            margin-top: 16px;
            position: relative;
            padding-bottom: 10px;
          }
          .${p}-tbl-meta {
            display: flex; align-items: center;
            justify-content: space-between; margin-bottom: 8px;
          }
          .${p}-tbl-label {
            font-size: 12px; font-weight: 700; color: var(--gray);
            text-transform: uppercase; letter-spacing: .4px;
          }
          .${p}-badge-count {
            background: var(--primary); color: var(--primary-text);
            padding: 2px 9px; border-radius: 20px;
            font-size: 11px; font-weight: 700;
          }
          .${p}-tbl-wrap {
            border: 1.5px solid var(--border); border-radius: var(--r-md);
            overflow: hidden;
          }
          .${p}-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
          .${p}-tbl th {
            background: #f9fafb; color: var(--gray);
            padding: 9px 12px; text-align:start;
            font-size: 11px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase;
            border-bottom: 1.5px solid var(--border);
          }
          .${p}-tbl td { padding: 4px 6px; border-bottom: 1px solid #f3f4f6; }
          .${p}-tbl tr:last-child td { border-bottom: none; }
          .${p}-tbl tr:hover td { background: #fef2f2; }
          .${p}-cell {
            width: 100%; padding: 7px 9px;
            border: 1.5px solid transparent; border-radius: var(--r-sm);
            font-size: 13px; font-family: inherit; color: var(--dark);
            background: transparent; transition: border-color .15s, background .15s;
          }
          .${p}-cell-desc {
            min-height: 52px;
            line-height: 1.35;
            resize: none;
            overflow: hidden;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .${p}-cell::placeholder { color: #9ca3af; }
          .${p}-cell:hover { border-color: var(--border); background: #f9fafb; }
          .${p}-cell:focus { outline: none; border-color: var(--primary); background: #fff; }
          .${p}-del-row {
            width: 26px; height: 26px; border: none; background: none;
            cursor: pointer; border-radius: var(--r-sm);
            display: flex; align-items: center; justify-content: center;
            color: #d1d5db; transition: all .15s;
          }
          .${p}-del-row:hover { background: #fee2e2; color: var(--error); }
          .${p}-del-row svg { pointer-events: none; }

          /* Per-row attachment — subtle clip, revealed on row hover */
          .${p}-clip-row {
            width: 26px; height: 26px; border: none; background: none;
            cursor: pointer; border-radius: var(--r-sm);
            display: flex; align-items: center; justify-content: center;
            color: #d1d5db; transition: all .15s; opacity: 0;
          }
          .${p}-task-row:hover .${p}-clip-row,
          .${p}-clip-row.has-files { opacity: 1; }
          .${p}-clip-row.has-files { color: var(--primary); }
          .${p}-clip-row:hover { background: rgba(var(--primary-rgb), .08); color: var(--primary); }
          .${p}-clip-row svg { pointer-events: none; }
          .${p}-att-line {
            font-size: 11px; color: var(--gray); margin-top: 4px;
            display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
          }
          .${p}-att-line b { color: var(--gray-lt); font-weight: 600; }
          .${p}-att-chip {
            display: inline-flex; align-items: center; gap: 4px; max-width: 160px;
            background: rgba(var(--primary-rgb), .07); color: var(--primary);
            border-radius: 10px; padding: 1px 7px; font-weight: 600;
          }
          .${p}-att-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .${p}-att-chip button { border: none; background: none; cursor: pointer; color: inherit; padding: 0; display: flex; opacity: .7; }
          .${p}-att-chip button:hover { opacity: 1; }

          /* Add-row — subtle plus below table, visible on hover */
          .${p}-add-row {
            margin: 4px auto 0;
            width: 26px;
            height: 26px;
            border: 1.5px solid #d1d5db;
            border-radius: 999px;
            background: #fff;
            color: #9ca3af;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-family: inherit;
            font-size: 18px;
            font-weight: 400;
            line-height: 1;
            box-shadow: 0 1px 3px rgba(0,0,0,.05);
            opacity: 0; pointer-events: none;
            transition: opacity .16s, border-color .16s, color .16s, background .16s;
          }
          .${p}-tbl-zone:hover .${p}-add-row,
          .${p}-add-row:focus-visible {
            opacity: 1; pointer-events: auto;
          }
          .${p}-add-row:hover,
          .${p}-add-row:focus-visible {
            border-color: var(--primary);
            background: var(--primary);
            color: #fff;
            box-shadow: 0 2px 8px rgba(var(--primary-rgb),.22);
            outline: none;
          }

          /* ── Mobile: stack the task table into scrollable cards ── */
          @media (max-width: 600px) {
            .${p} { padding: 14px; }
            .${p}-card-body { padding: 14px; }

            /* Turn the editable table into a vertically scrollable list */
            .${p}-tbl-wrap {
              overflow-x: visible;
              overflow-y: auto;
              max-height: 60vh;
              -webkit-overflow-scrolling: touch;
            }
            .${p}-tbl, .${p}-tbl tbody, .${p}-tbl tr, .${p}-tbl td { display: block; width: 100%; }
            .${p}-tbl thead {
              position: absolute; width: 1px; height: 1px;
              overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
            }
            .${p}-task-row {
              padding: 12px 12px 14px;
              border-bottom: 1.5px solid var(--border);
            }
            .${p}-tbl tr:last-child { border-bottom: none; }
            .${p}-tbl td { padding: 6px 0; border-bottom: none; }
            .${p}-tbl tr:hover td { background: transparent; }
            .${p}-tbl td[data-label]::before {
              content: attr(data-label);
              display: block;
              font-size: 10px; font-weight: 700; letter-spacing: .5px;
              text-transform: uppercase; color: var(--gray-lt);
              margin-bottom: 4px;
            }
            /* Title spans full width and is always readable */
            .${p}-cell-title { font-weight: 600; }
            /* Action buttons: full-width row, always visible (no hover on touch) */
            .${p}-row-actions {
              display: flex; gap: 6px; justify-content: flex-end;
              white-space: normal !important; padding-top: 8px;
            }
            .${p}-clip-row { opacity: 1; }
            .${p}-del-row, .${p}-clip-row { width: 30px; height: 30px; }
            /* Add-row is always reachable on touch */
            .${p}-add-row { opacity: 1; pointer-events: auto; }
          }

          /* ── Select ────────────────────────────────────────── */
          .${p}-select {
            width: 100%; padding: 10px 13px;
            border: 1.5px solid var(--border); border-radius: var(--r-md);
            font-size: 14px; font-family: inherit; background: #fafafa; color: var(--dark);
          }
          .${p}-select:focus { outline: none; border-color: var(--primary); background: #fff; }

          /* ── Main buttons ──────────────────────────────────── */
          .${p}-btn {
            width: auto !important;
            padding: 9px 14px; border: none; border-radius: var(--r-md);
            font-size: 13px; font-weight: 600; font-family: inherit;
            cursor: pointer; display: inline-flex; align-items: center;
            gap: 6px; white-space: nowrap; flex: 0 0 auto; transition: all .2s;
          }
          .${p}-btn svg { width: 16px; height: 16px; }
          .${p}-btn:disabled { opacity: .4; cursor: not-allowed !important; transform: none !important; box-shadow: none !important; }
          .${p}-btn-primary {
            background: var(--primary); color: var(--primary-text);
            box-shadow: 0 3px 10px rgba(var(--primary-rgb),.3);
          }
          .${p}-btn-primary:hover:not(:disabled) { filter: brightness(.88); transform: translateY(-1px); box-shadow: 0 5px 16px rgba(var(--primary-rgb),.4); }
          .${p}-spin {
            width: 14px; height: 14px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
            animation: ${p}-spin .7s linear infinite; flex-shrink: 0;
          }
          @keyframes ${p}-spin { to { transform: rotate(360deg); } }

          /* ── Progress ──────────────────────────────────────── */
          .${p}-progress {
            display: none; background: #fff; border-radius: var(--r-md);
            padding: 14px 16px; border: 1px solid var(--border); margin-top: 12px;
          }
          .${p}-prog-meta {
            display: flex; justify-content: space-between;
            font-size: 12px; color: var(--gray); margin-bottom: 7px;
          }
          .${p}-prog-bar { height: 6px; background: #f3f4f6; border-radius: 3px; overflow: hidden; }
          .${p}-prog-fill {
            height: 100%; width: 0%;
            background: linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--primary) 60%, #ff6b00));
            border-radius: 3px; transition: width .3s ease;
          }
          .${p}-prog-log { margin-top: 10px; max-height: 90px; overflow-y: auto; font-size: 12px; }
          .${p}-log-item { padding: 3px 0; border-bottom: 1px solid #f3f4f6; color: var(--gray); }
          .${p}-log-item.ok  { color: var(--success); }
          .${p}-log-item.err { color: var(--error); }

          /* ── Status banner ─────────────────────────────────── */
          .${p}-status {
            display: none; padding: 11px 15px; border-radius: var(--r-md);
            margin-top: 12px; font-size: 13px; line-height: 1.5;
          }
          .${p}-status.success { background: rgba(46,125,74,.08); border: 1px solid rgba(46,125,74,.25); color: var(--success); }
          .${p}-status.error   { background: rgba(196,30,58,.08); border: 1px solid rgba(196,30,58,.25); color: var(--error); }
          .${p}-status.info    { background: rgba(var(--primary-rgb),.06); border: 1px solid rgba(var(--primary-rgb),.2); color: var(--primary); }

          /* ── Assignee picker ───────────────────────────────────── */
          .${p}-assign-chips { display: flex; flex-wrap: wrap; gap: 6px; min-height: 0; margin-bottom: 10px; }
          .${p}-assign-chip {
            display: inline-flex; align-items: center; gap: 5px;
            padding: 3px 8px 3px 4px; border-radius: 20px;
            background: rgba(var(--primary-rgb),.07); border: 1px solid rgba(var(--primary-rgb),.2);
            font-size: 12px; font-weight: 500; color: var(--dark);
          }
          .${p}-assign-chip-av {
            width: 20px; height: 20px; border-radius: 50%; overflow: hidden;
            background: var(--primary); color: var(--primary-text);
            display: flex; align-items: center; justify-content: center;
            font-size: 9px; font-weight: 700; flex-shrink: 0;
          }
          .${p}-assign-chip-av img { width: 100%; height: 100%; object-fit: cover; }
          .${p}-assign-chip-x { cursor: pointer; color: var(--gray); font-size: 14px; line-height: 1; margin-inline-start: 2px; opacity: .6; }
          .${p}-assign-chip-x:hover { opacity: 1; }
          .${p}-assign-search input {
            width: 100%; box-sizing: border-box; padding: 8px 10px;
            border: 1px solid var(--border); border-radius: var(--r-sm);
            font-size: 13px; font-family: inherit; outline: none; background: #fafafa;
          }
          .${p}-assign-search input:focus { border-color: var(--primary); background: #fff; }
          .${p}-assign-tabs { display: flex; gap: 4px; margin: 8px 0; }
          .${p}-assign-tab {
            flex: 1; padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--r-sm);
            font-size: 12px; font-weight: 600; background: #f9fafb; color: var(--gray);
            cursor: pointer; text-align: center; transition: all .15s; font-family: inherit;
            touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; outline: none;
          }
          .${p}-assign-tab.active { background: var(--primary); color: var(--primary-text); border-color: var(--primary); }
          .${p}-assign-list {
            max-height: 200px; overflow-y: auto;
            border: 1px solid var(--border); border-radius: var(--r-sm); background: #fff;
          }
          .${p}-assign-opt {
            display: flex; align-items: center; gap: 10px;
            padding: 8px 12px; cursor: pointer; transition: background .1s;
            border-bottom: 1px solid #f3f4f6;
          }
          .${p}-assign-opt:last-child { border-bottom: none; }
          .${p}-assign-opt:hover { background: #f9fafb; }
          .${p}-assign-opt.sel { background: rgba(var(--primary-rgb),.04); }
          .${p}-assign-avatar {
            width: 30px; height: 30px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
            background: var(--primary); color: var(--primary-text);
            display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 700;
          }
          .${p}-assign-avatar img { width: 100%; height: 100%; object-fit: cover; }
          .${p}-assign-name { font-size: 13px; color: var(--dark); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .${p}-assign-chk {
            width: 16px; height: 16px; border-radius: 4px; border: 2px solid var(--border);
            background: #fff; display: flex; align-items: center; justify-content: center;
            flex-shrink: 0; transition: all .15s; font-size: 11px; color: transparent;
          }
          .${p}-assign-opt.sel .${p}-assign-chk { background: var(--primary); border-color: var(--primary); color: #fff; }
          .${p}-assign-empty { padding: 20px; text-align: center; font-size: 13px; color: var(--gray-lt); }
        </style>

        <div class="${p}">

          <!-- 1. Target stores -->
          <div class="${p}-card">
            <div class="${p}-card-head">
              <span class="${p}-step">1</span>
              <span class="${p}-card-title">${tx("targetStores").replace("{stores}", storeP)}</span>
            </div>
            <div class="${p}-card-body">
              <label class="${p}-label">${tx("findStores").replace("{stores}", storeP)}</label>
              <div class="${p}-ms-wrap">
                <div class="${p}-ms-trigger" id="${p}-trigger">
                  <span class="${p}-ms-ph">${tx("loadingStores").replace("{stores}", storeP.toLowerCase())}</span>
                </div>
                <div class="${p}-dropdown" id="${p}-dropdown">
                  <div class="${p}-dd-search">
                    <input type="text" id="${p}-search" placeholder="${tx("searchStores").replace("{stores}", storeP.toLowerCase())}">
                  </div>
                  <div class="${p}-dd-list" id="${p}-opts">
                    <div class="${p}-dd-msg">${tx("loading")}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Pull & review -->
          <div class="${p}-card">
            <div class="${p}-card-head">
              <span class="${p}-step">2</span>
              <span class="${p}-card-title">${tx("pullReviewTasks")}</span>
            </div>
            <div class="${p}-card-body">
              <label class="${p}-label">${tx("taskListName")}</label>
              <div class="${p}-input-group">
                <input type="text" class="${p}-input" id="${p}-listname"
                       placeholder="${tx("taskListNamePlaceholder")}">
                <button type="button" class="${p}-icon-btn" id="${p}-pull-btn" title="${tx("pullFromExternal")}">
                  ${iconDownload}
                </button>
              </div>

              <!-- Editable task table -->
              <div class="${p}-tbl-zone" id="${p}-tbl-section" style="margin-top:16px">
                <div class="${p}-tbl-meta">
                  <span class="${p}-tbl-label">${tx("reviewEditTasks")}</span>
                  <span class="${p}-badge-count" id="${p}-task-count">${tx("nTasks").replace("{n}", "0")}</span>
                </div>
                <div class="${p}-tbl-wrap">
                  <table class="${p}-tbl">
                    <thead>
                      <tr>
                        <th style="width:30%">${tx("title")}</th>
                        <th>${tx("description")}</th>
                        ${enableTypes ? `<th style="width:130px">${tx("type")}</th>` : ""}
                        <th style="width:140px">${tx("dueDate")}</th>
                        <th style="width:36px"></th>
                      </tr>
                    </thead>
                    <tbody id="${p}-tbody"></tbody>
                  </table>
                </div>
                <button type="button" class="${p}-add-row" id="${p}-add-row" aria-label="${tx("addTask")}">+</button>
              </div>
            </div>
          </div>

          <!-- 3. Assign to users / groups -->
          <div class="${p}-card">
            <div class="${p}-card-head">
              <span class="${p}-step">3</span>
              <span class="${p}-card-title">${tx("assignTo")} <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px;color:#9ca3af">${tx("optional")}</span></span>
            </div>
            <div class="${p}-card-body">
              <div class="${p}-assign-chips" id="${p}-assign-chips"></div>
              <div class="${p}-assign-search">
                <input type="text" id="${p}-assign-search" placeholder="${tx("searchUsersGroups")}">
              </div>
              <div class="${p}-assign-tabs">
                <div role="button" tabindex="0" class="${p}-assign-tab active" id="${p}-tab-users">${tx("users")}</div>
                <div role="button" tabindex="0" class="${p}-assign-tab" id="${p}-tab-groups">${tx("groups")}</div>
              </div>
              <div class="${p}-assign-list" id="${p}-assign-list">
                <div class="${p}-assign-empty">${tx("loading")}</div>
              </div>
            </div>
          </div>

          <!-- 4. Optional: update existing list -->
          ${enableUpdating ? `
          <div class="${p}-card">
            <div class="${p}-card-head">
              <span class="${p}-step">4</span>
              <span class="${p}-card-title">${tx("updateExistingList")} <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px;color:#9ca3af">${tx("optional")}</span></span>
            </div>
            <div class="${p}-card-body">
              <label class="${p}-label">${tx("selectListToUpdate")}</label>
              <select class="${p}-select" id="${p}-existing">
                <option value="">${tx("createNewList")}</option>
              </select>
              <p class="${p}-help">${tx("replaceHint")}</p>
            </div>
          </div>
          ` : ""}

          <!-- Submit -->
          <div style="margin-top:4px">
            <button type="button" class="${p}-btn ${p}-btn-primary" id="${p}-submit" disabled>
              ${iconUpload} ${tx("updateYourTasks")}
            </button>
            <p id="${p}-hint" style="margin-top:8px;font-size:12px;color:var(--gray-lt);min-height:16px"></p>
          </div>

          <div class="${p}-progress" id="${p}-progress">
            <div class="${p}-prog-meta">
              <span id="${p}-prog-label">${tx("working")}</span>
              <span id="${p}-prog-pct">0%</span>
            </div>
            <div class="${p}-prog-bar">
              <div class="${p}-prog-fill" id="${p}-prog-fill"></div>
            </div>
            <div class="${p}-prog-log" id="${p}-prog-log"></div>
          </div>

          <div class="${p}-status" id="${p}-status"></div>

        </div>
      `;
                // ── DOM refs ──────────────────────────────────────────────────────
                const trigger = container.querySelector(`#${p}-trigger`);
                const dropdown = container.querySelector(`#${p}-dropdown`);
                const searchInp = container.querySelector(`#${p}-search`);
                const optsList = container.querySelector(`#${p}-opts`);
                const listName = container.querySelector(`#${p}-listname`);
                const pullBtn = container.querySelector(`#${p}-pull-btn`);
                const tbody = container.querySelector(`#${p}-tbody`);
                const taskCount = container.querySelector(`#${p}-task-count`);
                const addRowBtn = container.querySelector(`#${p}-add-row`);
                const submitBtn = container.querySelector(`#${p}-submit`);
                const progressEl = container.querySelector(`#${p}-progress`);
                const progLabel = container.querySelector(`#${p}-prog-label`);
                const progPct = container.querySelector(`#${p}-prog-pct`);
                const progFill = container.querySelector(`#${p}-prog-fill`);
                const progLog = container.querySelector(`#${p}-prog-log`);
                const statusEl = container.querySelector(`#${p}-status`);
                const existingSel = enableUpdating
                    ? container.querySelector(`#${p}-existing`)
                    : null;
                const assignChipsEl = container.querySelector(`#${p}-assign-chips`);
                const assignListEl = container.querySelector(`#${p}-assign-list`);
                const assignSearchInp = container.querySelector(`#${p}-assign-search`);
                const tabUsersBtn = container.querySelector(`#${p}-tab-users`);
                const tabGroupsBtn = container.querySelector(`#${p}-tab-groups`);
                // ── Helpers ───────────────────────────────────────────────────────
                const authHeaders = () => ({
                    Authorization: `Basic ${apiToken}`,
                    "Content-Type": "application/json",
                });
                // Widget runs on app.staffbase.com, so API calls are same-origin and
                // the browser auto-attaches the user's session cookie. That causes
                // Staffbase to auth via the session (which may lack write permissions)
                // instead of the API token. 'omit' forces token-only auth.
                const apiOpts = (extra) => (Object.assign(Object.assign({}, extra), { credentials: "omit", headers: authHeaders() }));
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
                function uploadMedia(file) {
                    return tasks_integration_widget_awaiter(this, void 0, void 0, function* () {
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
                        return media.id;
                    });
                }
                function esc(s) {
                    return s
                        .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
                        .replace(/</g, "&lt;").replace(/>/g, "&gt;");
                }
                function showStatus(type, msg) {
                    statusEl.className = `${p}-status ${type}`;
                    statusEl.style.display = "block";
                    statusEl.textContent = msg;
                }
                function setProgress(pct, label) {
                    progFill.style.width = `${pct}%`;
                    progPct.textContent = `${pct}%`;
                    progLabel.textContent = label;
                }
                function logLine(text, cls = "") {
                    const d = document.createElement("div");
                    d.className = `${p}-log-item ${cls}`;
                    d.textContent = text;
                    progLog.appendChild(d);
                    progLog.scrollTop = progLog.scrollHeight;
                }
                function refreshCount() {
                    const n = tbody.querySelectorAll("tr").length;
                    taskCount.textContent = tx("nTasks").replace("{n}", String(n));
                }
                function validate() {
                    const noStores = selectedStores.length === 0;
                    const noTasks = tbody.querySelectorAll("tr").length === 0;
                    const noName = listName.value.trim().length === 0;
                    submitBtn.disabled = noStores || noTasks || noName;
                    const hintEl = container.querySelector(`#${p}-hint`);
                    if (!hintEl)
                        return;
                    const missing = [];
                    if (noStores)
                        missing.push(`select a ${storeS.toLowerCase()}`);
                    if (noTasks)
                        missing.push("pull tasks");
                    if (noName)
                        missing.push("enter a list name");
                    hintEl.textContent = missing.length ? `Still needed: ${missing.join(", ")}` : "";
                }
                function fitDescCell(el) {
                    el.style.height = "0";
                    el.style.height = `${Math.max(52, el.scrollHeight)}px`;
                }
                // ── Editable rows ─────────────────────────────────────────────────
                function addRow(title = "", desc = "", dueDate = "", taskType = "") {
                    // Extract date part from ISO string directly to avoid timezone shift
                    const datePart = dueDate ? dueDate.split("T")[0] : "";
                    const typeOptions = enableTypes
                        ? `<td data-label="${tx("type")}"><select class="${p}-cell ${p}-cell-type" style="padding:7px 6px">
               <option value="">${tx("noneOption")}</option>
               ${typeList.map(t => `<option value="${esc(t)}"${t === taskType ? " selected" : ""}>${esc(t)}</option>`).join("")}
             </select></td>`
                        : "";
                    const tr = document.createElement("tr");
                    tr.className = `${p}-task-row`;
                    tr.innerHTML = `
          <td data-label="${tx("title")}"><input class="${p}-cell ${p}-cell-title" type="text" value="${esc(title)}" placeholder="${tx("taskTitlePlaceholder")}">
            <div class="${p}-att-line" style="display:none"></div></td>
          <td data-label="${tx("description")}"><textarea class="${p}-cell ${p}-cell-desc ${p}-cell-description" rows="1" placeholder="${tx("description")}">${esc(desc)}</textarea></td>
          ${typeOptions}
          <td data-label="${tx("dueDate")}"><input class="${p}-cell ${p}-cell-date" type="date" value="${datePart}"></td>
          <td class="${p}-row-actions" style="white-space:nowrap">
            <button class="${p}-clip-row" title="${tx("attachFiles")}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></button>
            <button class="${p}-del-row" title="${tx("remove")}"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
            <input type="file" multiple class="${p}-att-input" style="display:none">
          </td>
        `;
                    // Per-row attachment state — File objects held on the row element
                    const rowFiles = [];
                    tr._attFiles = rowFiles;
                    const clipBtn = tr.querySelector(`.${p}-clip-row`);
                    const attInput = tr.querySelector(`.${p}-att-input`);
                    const attLine = tr.querySelector(`.${p}-att-line`);
                    const iXmini = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
                    function renderAttLine() {
                        clipBtn.classList.toggle("has-files", rowFiles.length > 0);
                        if (!rowFiles.length) {
                            attLine.style.display = "none";
                            attLine.innerHTML = "";
                            return;
                        }
                        attLine.style.display = "flex";
                        attLine.innerHTML = `<b>${tx("attached")}</b>` + rowFiles.map((f, i) => `<span class="${p}-att-chip"><span>${esc(f.name)}</span><button type="button" data-i="${i}" title="${tx("remove")}">${iXmini}</button></span>`).join("");
                        attLine.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
                            rowFiles.splice(Number(b.dataset.i), 1);
                            renderAttLine();
                        }));
                    }
                    clipBtn.addEventListener("click", () => attInput.click());
                    attInput.addEventListener("change", () => {
                        for (const f of Array.from(attInput.files || [])) {
                            if (f.size > MEDIA_MAX) {
                                showStatus("error", `"${f.name}" exceeds ${humanSize(MEDIA_MAX)}.`);
                                continue;
                            }
                            rowFiles.push(f);
                        }
                        attInput.value = "";
                        renderAttLine();
                    });
                    tr.querySelector(`.${p}-del-row`).addEventListener("click", () => {
                        tr.remove();
                        refreshCount();
                        validate();
                    });
                    tr.querySelectorAll(`.${p}-cell`).forEach(i => i.addEventListener("input", validate));
                    tbody.appendChild(tr);
                    const descCell = tr.querySelector(`.${p}-cell-description`);
                    if (descCell) {
                        requestAnimationFrame(() => fitDescCell(descCell));
                        descCell.addEventListener("input", () => fitDescCell(descCell));
                    }
                    refreshCount();
                    validate();
                }
                function collectTasks() {
                    return Array.from(tbody.querySelectorAll("tr"))
                        .map(row => {
                        var _a, _b, _c;
                        const tr = row;
                        const titleInput = tr.querySelector(`.${p}-cell-title`);
                        const descInput = tr.querySelector(`.${p}-cell-description`);
                        const dueInput = tr.querySelector(`.${p}-cell-date`);
                        const typeSelect = enableTypes
                            ? tr.querySelector(`.${p}-cell-type`)
                            : null;
                        let description = (_a = descInput === null || descInput === void 0 ? void 0 : descInput.value.trim()) !== null && _a !== void 0 ? _a : "";
                        const taskType = (_b = typeSelect === null || typeSelect === void 0 ? void 0 : typeSelect.value) !== null && _b !== void 0 ? _b : "";
                        // Embed type tag at end of description so my-tasks-widget can parse it
                        if (taskType)
                            description = description ? `${description} [type: ${taskType}]` : `[type: ${taskType}]`;
                        return {
                            title: (_c = titleInput === null || titleInput === void 0 ? void 0 : titleInput.value.trim()) !== null && _c !== void 0 ? _c : "",
                            description,
                            // Append T00:00:00.000Z to date-only value — the API requires full ISO format
                            dueDate: (dueInput === null || dueInput === void 0 ? void 0 : dueInput.value) ? `${dueInput.value}T00:00:00.000Z` : null,
                            files: tr._attFiles || [],
                        };
                    })
                        .filter(t => t.title.length > 0);
                }
                // ── Multi-select ──────────────────────────────────────────────────
                function renderOpts(filter = "") {
                    const matches = storeProjects.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()));
                    if (!matches.length) {
                        optsList.innerHTML = `<div class="${p}-dd-msg">${tx("noStoresFound").replace("{stores}", storeP.toLowerCase())}</div>`;
                        return;
                    }
                    optsList.innerHTML = matches.map(s => {
                        const sel = selectedStores.some(x => x.id === s.id);
                        return `
            <div class="${p}-dd-opt ${sel ? "sel" : ""}"
                 data-id="${s.id}" data-title="${esc(s.title)}">
              <span class="${p}-check">${sel ? "&#10003;" : ""}</span>
              <span>${esc(s.title)}</span>
            </div>`;
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
                    if (enableUpdating)
                        loadExistingLists();
                    validate();
                }
                function renderTrigger() {
                    if (!selectedStores.length) {
                        trigger.innerHTML = `<span class="${p}-ms-ph">${tx("selectStore").replace("{store}", storeS)}</span>`;
                        return;
                    }
                    trigger.innerHTML = selectedStores.map(s => `<span class="${p}-tag">${esc(s.title)}
             <span class="${p}-tag-x" data-id="${s.id}">&times;</span>
           </span>`).join("");
                    trigger.querySelectorAll(`.${p}-tag-x`).forEach((btn) => btn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        selectedStores = selectedStores.filter(s => s.id !== btn.dataset.id);
                        renderTrigger();
                        renderOpts(searchInp.value);
                        if (enableUpdating)
                            loadExistingLists();
                        validate();
                    }));
                }
                trigger.addEventListener("click", () => {
                    dropdown.classList.toggle("show");
                    trigger.classList.toggle("open");
                });
                document.addEventListener("click", (e) => {
                    if (!trigger.contains(e.target) &&
                        !dropdown.contains(e.target)) {
                        dropdown.classList.remove("show");
                        trigger.classList.remove("open");
                    }
                });
                searchInp.addEventListener("input", () => renderOpts(searchInp.value));
                listName.addEventListener("input", validate);
                // ── Fetch installations ───────────────────────────────────────────
                function fetchInstallations() {
                    return tasks_integration_widget_awaiter(this, void 0, void 0, function* () {
                        try {
                            const res = yield fetch(`${baseUrl}/installations?limit=200`, Object.assign({}, apiOpts()));
                            if (!res.ok)
                                throw new Error(`HTTP ${res.status}`);
                            const data = yield res.json();
                            storeProjects = (data.data || data)
                                .filter((i) => i.pluginID === "tasks" || i.pluginId === "tasks")
                                .map((i) => {
                                var _a, _b, _c;
                                return ({
                                    id: i.id,
                                    title: ((_c = (_b = (_a = i.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) ||
                                        i.title || i.name || i.id,
                                });
                            })
                                .sort((a, b) => a.title.localeCompare(b.title));
                            if (!storeProjects.length) {
                                optsList.innerHTML = `<div class="${p}-dd-msg">${tx("noStoresFound").replace("{stores}", storeP.toLowerCase())}</div>`;
                                trigger.innerHTML = `<span class="${p}-ms-ph">${tx("noStoresFound").replace("{stores}", storeP.toLowerCase())}</span>`;
                            }
                            else {
                                trigger.innerHTML = `<span class="${p}-ms-ph">${tx("selectStore").replace("{store}", storeS)}</span>`;
                                renderOpts();
                            }
                        }
                        catch (_) {
                            optsList.innerHTML = `<div class="${p}-dd-msg">${tx("failedLoadStores").replace("{stores}", storeP.toLowerCase())}</div>`;
                            trigger.innerHTML = `<span class="${p}-ms-ph">${tx("errorLoading")}</span>`;
                        }
                    });
                }
                // ── Load existing task lists (update mode only) ───────────────────
                function loadExistingLists() {
                    return tasks_integration_widget_awaiter(this, void 0, void 0, function* () {
                        if (!existingSel)
                            return;
                        existingSel.innerHTML = `<option value="">${tx("createNewList")}</option>`;
                        for (const store of selectedStores) {
                            try {
                                const res = yield fetch(`${baseUrl}/tasks/${store.id}/lists`, Object.assign({}, apiOpts()));
                                if (!res.ok)
                                    continue;
                                const lists = yield res.json();
                                lists.forEach(l => {
                                    const opt = document.createElement("option");
                                    opt.value = `${store.id}::${l.id}`;
                                    opt.textContent = `${store.title} — ${l.name}`;
                                    existingSel.appendChild(opt);
                                });
                            }
                            catch (_) { /* skip */ }
                        }
                    });
                }
                // ── Fetch users & groups ──────────────────────────────────────────
                let assignTab = "user";
                function fetchUsersAndGroups() {
                    return tasks_integration_widget_awaiter(this, void 0, void 0, function* () {
                        try {
                            const [uRes, gRes] = yield Promise.all([
                                fetch(`${baseUrl}/users?limit=200`, apiOpts()),
                                fetch(`${baseUrl}/groups?limit=200`, apiOpts()),
                            ]);
                            if (uRes.ok) {
                                const ud = yield uRes.json();
                                allUsers = (ud.data || [])
                                    .map((u) => {
                                    var _a, _b;
                                    return ({
                                        id: u.id,
                                        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.id,
                                        avatar: ((_b = (_a = u.avatar) === null || _a === void 0 ? void 0 : _a.icon) === null || _b === void 0 ? void 0 : _b.url) || "",
                                    });
                                })
                                    .sort((a, b) => a.name.localeCompare(b.name));
                            }
                            if (gRes.ok) {
                                const gd = yield gRes.json();
                                allGroups = (gd.data || [])
                                    .map((g) => {
                                    var _a, _b, _c;
                                    return ({
                                        id: g.id,
                                        name: ((_c = (_b = (_a = g.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) || g.name || g.id,
                                    });
                                })
                                    .sort((a, b) => a.name.localeCompare(b.name));
                            }
                            renderAssignList();
                        }
                        catch (_) {
                            assignListEl.innerHTML = `<div class="${p}-assign-empty">${tx("failedToLoad")}</div>`;
                        }
                    });
                }
                function renderAssignList(filter = "") {
                    const fl = filter.toLowerCase();
                    if (assignTab === "user") {
                        const matches = allUsers.filter(u => u.name.toLowerCase().includes(fl));
                        if (!matches.length) {
                            assignListEl.innerHTML = `<div class="${p}-assign-empty">${tx("noUsersFound")}</div>`;
                            return;
                        }
                        assignListEl.innerHTML = matches.map(u => {
                            const sel = selectedAssignees.some(a => a.id === u.id);
                            const initials = u.name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
                            const avHtml = u.avatar
                                ? `<div class="${p}-assign-avatar"><img src="${esc(u.avatar)}" alt=""></div>`
                                : `<div class="${p}-assign-avatar">${initials}</div>`;
                            return `
              <div class="${p}-assign-opt ${sel ? "sel" : ""}" data-id="${u.id}" data-type="user" data-name="${esc(u.name)}" data-avatar="${esc(u.avatar)}">
                ${avHtml}
                <span class="${p}-assign-name">${esc(u.name)}</span>
                <span class="${p}-assign-chk">${sel ? "&#10003;" : ""}</span>
              </div>`;
                        }).join("");
                    }
                    else {
                        const matches = allGroups.filter(g => g.name.toLowerCase().includes(fl));
                        if (!matches.length) {
                            assignListEl.innerHTML = `<div class="${p}-assign-empty">${tx("noGroupsFound")}</div>`;
                            return;
                        }
                        assignListEl.innerHTML = matches.map(g => {
                            const sel = selectedAssignees.some(a => a.id === g.id);
                            const initials = g.name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
                            return `
              <div class="${p}-assign-opt ${sel ? "sel" : ""}" data-id="${g.id}" data-type="group" data-name="${esc(g.name)}" data-avatar="">
                <div class="${p}-assign-avatar" style="background:var(--gray)">${initials}</div>
                <span class="${p}-assign-name">${esc(g.name)}</span>
                <span class="${p}-assign-chk">${sel ? "&#10003;" : ""}</span>
              </div>`;
                        }).join("");
                    }
                    assignListEl.querySelectorAll(`.${p}-assign-opt`).forEach((opt) => opt.addEventListener("click", () => toggleAssignee(opt)));
                }
                function toggleAssignee(opt) {
                    const { id, type, name, avatar } = opt.dataset;
                    const idx = selectedAssignees.findIndex(a => a.id === id);
                    if (idx >= 0) {
                        selectedAssignees.splice(idx, 1);
                    }
                    else {
                        selectedAssignees.push({ id, name, avatar: avatar || "", type });
                    }
                    renderAssignChips();
                    renderAssignList(assignSearchInp.value);
                }
                function renderAssignChips() {
                    if (!selectedAssignees.length) {
                        assignChipsEl.innerHTML = "";
                        return;
                    }
                    assignChipsEl.innerHTML = selectedAssignees.map(a => {
                        const initials = a.name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
                        const bgStyle = a.type === "group" ? "style=\"background:var(--gray)\"" : "";
                        const avHtml = a.avatar
                            ? `<div class="${p}-assign-chip-av"><img src="${esc(a.avatar)}" alt=""></div>`
                            : `<div class="${p}-assign-chip-av" ${bgStyle}>${initials}</div>`;
                        return `
            <span class="${p}-assign-chip">
              ${avHtml}
              ${esc(a.name)}
              <span class="${p}-assign-chip-x" data-id="${a.id}">&times;</span>
            </span>`;
                    }).join("");
                    assignChipsEl.querySelectorAll(`.${p}-assign-chip-x`).forEach((btn) => btn.addEventListener("click", () => {
                        selectedAssignees = selectedAssignees.filter(a => a.id !== btn.dataset.id);
                        renderAssignChips();
                        renderAssignList(assignSearchInp.value);
                    }));
                }
                tabUsersBtn.addEventListener("click", () => {
                    assignTab = "user";
                    tabUsersBtn.classList.add("active");
                    tabGroupsBtn.classList.remove("active");
                    renderAssignList(assignSearchInp.value);
                });
                tabGroupsBtn.addEventListener("click", () => {
                    assignTab = "group";
                    tabGroupsBtn.classList.add("active");
                    tabUsersBtn.classList.remove("active");
                    renderAssignList(assignSearchInp.value);
                });
                assignSearchInp.addEventListener("input", () => renderAssignList(assignSearchInp.value));
                // ── Pull from sheet ───────────────────────────────────────────────
                pullBtn.addEventListener("click", () => tasks_integration_widget_awaiter(this, void 0, void 0, function* () {
                    pullBtn.disabled = true;
                    pullBtn.innerHTML = `<span class="${p}-spin"></span>`;
                    statusEl.style.display = "none";
                    try {
                        // Append ?sheet=Name if a sheet name is configured
                        const pullUrl = sheetName
                            ? `${appsScriptUrl}${appsScriptUrl.includes("?") ? "&" : "?"}sheet=${encodeURIComponent(sheetName)}`
                            : appsScriptUrl;
                        const res = yield fetch(pullUrl);
                        if (!res.ok)
                            throw new Error(`HTTP ${res.status}`);
                        let data;
                        try {
                            data = yield res.json();
                        }
                        catch (_) {
                            throw new Error("Response was not valid JSON — check Apps Script logs for errors");
                        }
                        if (data.error) {
                            throw new Error(`Apps Script error: ${data.error}`);
                        }
                        const tasks = data.tasks || [];
                        if (!tasks.length) {
                            showStatus("info", tx("noTasksInSheet"));
                        }
                        else {
                            tbody.innerHTML = "";
                            tasks.forEach((t) => { var _a, _b; return addRow(t.title, t.description, (_a = t.dueDate) !== null && _a !== void 0 ? _a : "", (_b = t.taskType) !== null && _b !== void 0 ? _b : ""); });
                            showStatus("success", `Pulled ${tasks.length} task${tasks.length !== 1 ? "s" : ""} — any existing tasks were replaced. Review and edit below, then click Update your Tasks.`);
                        }
                    }
                    catch (e) {
                        showStatus("error", `Pull failed: ${e.message}`);
                    }
                    pullBtn.disabled = false;
                    pullBtn.innerHTML = iconDownload;
                    validate();
                }));
                // ── Add blank row ─────────────────────────────────────────────────
                addRowBtn.addEventListener("click", () => {
                    addRow();
                });
                // ── Update Staffbase ──────────────────────────────────────────────
                submitBtn.addEventListener("click", () => tasks_integration_widget_awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c, _d, _e;
                    const tasks = collectTasks();
                    if (!tasks.length || !selectedStores.length)
                        return;
                    const name = listName.value.trim();
                    const updateTarget = (_a = existingSel === null || existingSel === void 0 ? void 0 : existingSel.value) !== null && _a !== void 0 ? _a : "";
                    const palette = ["#D62300", "#FF6B00", "#2E7D4A", "#4A90A4", "#8B4513"];
                    const color = palette[Math.floor(Math.random() * palette.length)];
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `<span class="${p}-spin"></span> Updating…`;
                    progressEl.style.display = "block";
                    progLog.innerHTML = "";
                    statusEl.style.display = "none";
                    const totalOps = selectedStores.length * (tasks.length + 1);
                    let doneOps = 0, okCount = 0, failCount = 0;
                    const mediaCache = new Map(); // upload each file once, reuse across stores
                    for (const store of selectedStores) {
                        try {
                            let listId;
                            if (updateTarget) {
                                const [, targetListId] = updateTarget.split("::");
                                listId = targetListId;
                                setProgress(Math.round((doneOps / totalOps) * 100), `Clearing ${store.title}…`);
                                const existing = yield fetch(`${baseUrl}/tasks/${store.id}/task?listId=${listId}`, apiOpts()).then(r => (r.ok ? r.json() : [])).catch(() => []);
                                for (const et of existing) {
                                    yield fetch(`${baseUrl}/tasks/${store.id}/task/${et.id}`, apiOpts({ method: "DELETE" })).catch(() => { });
                                }
                                doneOps++;
                            }
                            else {
                                setProgress(Math.round((doneOps / totalOps) * 100), `Creating list in ${store.title}…`);
                                const listRes = yield fetch(`${baseUrl}/tasks/${store.id}/lists`, Object.assign(Object.assign({ method: "POST" }, apiOpts()), { body: JSON.stringify({ name, color }) }));
                                if (!listRes.ok)
                                    throw new Error(`List creation failed (${listRes.status})`);
                                const listData = yield listRes.json();
                                listId = (_b = listData.id) !== null && _b !== void 0 ? _b : (_c = listData.data) === null || _c === void 0 ? void 0 : _c.id;
                                if (!listId)
                                    throw new Error("No list ID in response");
                                doneOps++;
                            }
                            let created = 0;
                            for (let j = 0; j < tasks.length; j++) {
                                const t = tasks[j];
                                setProgress(Math.round((doneOps / totalOps) * 100), `Task ${j + 1}/${tasks.length} → ${store.title}…`);
                                try {
                                    const body = {
                                        title: t.title,
                                        description: t.description,
                                        status: "OPEN",
                                        priority: "Priority_3",
                                        taskListId: listId,
                                        assigneeIds: selectedAssignees.filter(a => a.type === "user").map(a => a.id),
                                        groupIds: selectedAssignees.filter(a => a.type === "group").map(a => a.id),
                                    };
                                    if (t.dueDate)
                                        body.dueDate = t.dueDate;
                                    const r = yield fetch(`${baseUrl}/tasks/${store.id}/task`, Object.assign(Object.assign({ method: "POST" }, apiOpts()), { body: JSON.stringify(body) }));
                                    if (r.ok) {
                                        created++;
                                        // Attach files: upload each once (cached across stores), then PATCH the new task.
                                        if (t.files.length) {
                                            const data = yield r.json().catch(() => null);
                                            const taskId = (_d = data === null || data === void 0 ? void 0 : data.id) !== null && _d !== void 0 ? _d : (_e = data === null || data === void 0 ? void 0 : data.data) === null || _e === void 0 ? void 0 : _e.id;
                                            if (taskId) {
                                                const ids = [];
                                                for (const f of t.files) {
                                                    try {
                                                        let mid = mediaCache.get(f);
                                                        if (!mid) {
                                                            mid = yield uploadMedia(f);
                                                            mediaCache.set(f, mid);
                                                        }
                                                        ids.push(mid);
                                                    }
                                                    catch (_) { /* skip a failed upload, keep the task */ }
                                                }
                                                if (ids.length) {
                                                    yield fetch(`${baseUrl}/tasks/${store.id}/task/${taskId}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ attachmentIds: ids }) })).catch(() => { });
                                                }
                                            }
                                        }
                                    }
                                }
                                catch (_) { /* non-fatal */ }
                                doneOps++;
                                yield new Promise(r => setTimeout(r, 50));
                            }
                            logLine(`\u2713 ${store.title}: ${tx("nTasksAdded").replace("{n}", String(created))}`, "ok");
                            okCount++;
                        }
                        catch (e) {
                            logLine(`\u2717 ${store.title}: ${e.message}`, "err");
                            failCount++;
                            doneOps += tasks.length + 1;
                        }
                    }
                    setProgress(100, tx("done"));
                    if (failCount === 0) {
                        showStatus("success", `All done! "${name}" with ${tasks.length} tasks pushed to ${okCount} ${okCount === 1 ? storeS : storeP}.`);
                    }
                    else if (okCount > 0) {
                        showStatus("info", `Partial success: ${okCount} succeeded, ${failCount} failed.`);
                    }
                    else {
                        showStatus("error", "All failed. Check your API token and installation IDs.");
                    }
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `${iconUpload} Update your Tasks`;
                    validate();
                }));
                // ── Init ──────────────────────────────────────────────────────────
                // Pre-fill list name with today's date so it's one less thing to do
                listName.value = `Tasks – ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
                validate();
                fetchInstallations();
                fetchUsersAndGroups();
            });
        }
        static get observedAttributes() {
            return [
                "appsscripturl",
                "apitoken",
                "baseurl",
                "primarycolor",
                "accentcolor",
                "backgroundcolor",
                "storelabelsingular",
                "storelabelplural",
                "enabletasklistupdating",
                "sheetname",
                "enabletasktypes",
                "tasktypes",
            ];
        }
    };
};
// ── Block registration ────────────────────────────────────────────────────────
const blockDefinition = {
    name: "tasks-integration-widget",
    label: "Tasks Integration Widget",
    attributes: [
        "appsscripturl",
        "apitoken",
        "baseurl",
        "primarycolor",
        "accentcolor",
        "backgroundcolor",
        "storelabelsingular",
        "storelabelplural",
        "enabletasklistupdating",
        "sheetname",
        "enabletasktypes",
        "tasktypes",
    ],
    factory,
    configurationSchema,
    uiSchema,
    blockLevel: "block",
    iconUrl: "",
};
const externalBlockDefinition = {
    blockDefinition,
    author: "Staffbase",
    version: "1.0.0",
};
window.defineBlock(externalBlockDefinition);

/******/ })()
;