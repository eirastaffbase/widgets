import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from "@staffbase/widget-sdk";

import { JSONSchema7 } from "json-schema";
import { UiSchema } from "@rjsf/utils";

import { detectLocale, isRtl, makeT, translateMap, DEFAULT_LOCALE } from "../shared/i18n";
import { fetchThemeColors } from "../shared/theming";
import { STRINGS } from "./strings";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_API_TOKEN = "";
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#da2e32";
const DEFAULT_ACCENT_COLOR  = "#da2e32";

// ── Config schema ─────────────────────────────────────────────────────────────

const configurationSchema: JSONSchema7 = {
  properties: {
    apitoken:        { type:"string",  title:"API Token",       default: DEFAULT_API_TOKEN },
    baseurl:         { type:"string",  title:"Base URL",        default: DEFAULT_BASE_URL },
    tasklist:        { type:"string",  title:"Tasks (store ID / task ID per line)", default: "" },
    showcompleted:   { type:"boolean", title:"Show Completed Tasks", default: true },
    allowtoggle:     { type:"boolean", title:"Allow Check Off",      default: true },
    enablecomments:  { type:"boolean", title:"Enable Comments",      default: true },
    requirephotoproof:{ type:"boolean", title:"Require Photo Proof",  default: false },
    onlyassignedtome:{ type:"boolean", title:"Only Show Tasks Assigned To Me", default: false },
    usethemecolors:  { type:"boolean", title:"Use Theme Colors",     default: false },
    backgroundcolor: { type:"string",  title:"Background Color",     default: "" },
    limitheight:     { type:"boolean", title:"Limit Height",         default: false },
  },
  // When "Use Theme Colors" is off, expose the manual Primary/Accent pickers.
  // When "Limit Height" is on, reveal the Max Height field.
  dependencies: {
    usethemecolors: {
      oneOf: [
        { properties: { usethemecolors: { const: false },
            primarycolor: { type:"string", title:"Primary Color", default: DEFAULT_PRIMARY_COLOR },
            accentcolor:  { type:"string", title:"Accent Color",  default: DEFAULT_ACCENT_COLOR } } },
        { properties: { usethemecolors: { const: true } } },
      ],
    },
    limitheight: {
      oneOf: [
        { properties: { limitheight: { const: false } } },
        { properties: { limitheight: { const: true }, maxheight: { type:"string", title:"Max Height (px)", default:"600" } } },
      ],
    },
  },
};

const uiSchema: UiSchema = {
  apitoken:        { "ui:widget":"password", "ui:help":"Staffbase Basic auth token" },
  baseurl:         { "ui:help":"Staffbase API base URL" },
  tasklist:        { "ui:widget":"textarea", "ui:help":"One task per line, as storeID/taskID — the store (installation) ID and the task ID, separated by a / or :. Both IDs appear in the task's URL and in the Tasks API responses." },
  showcompleted:   { "ui:help":"When off, tasks already marked done are hidden from the checklist" },
  allowtoggle:     { "ui:help":"Let viewers check tasks off (marks them done via the API). Turn off for a read-only checklist." },
  enablecomments:  { "ui:help":"Show a comments section in the task detail panel (uses the logged-in user's session)" },
  requirephotoproof:{ "ui:help":"When on, checking a task off requires the viewer to submit a photo. The photo is posted as a proof comment on the task, and the task is only marked done once the photo is uploaded." },
  onlyassignedtome:{ "ui:help":"Filter this list down to tasks assigned directly to the viewer, or to a group the viewer belongs to — same matching the My Tasks widget uses" },
  usethemecolors:  { "ui:help":"Pull Primary & Accent from the app's branding theme (uses the API Token). Hides the color pickers below." },
  primarycolor:    { "ui:widget":"color", "ui:help":"Primary brand color" },
  accentcolor:     { "ui:widget":"color", "ui:help":"Accent / secondary color" },
  backgroundcolor: { "ui:widget":"color", "ui:help":"Widget background color — leave blank for transparent" },
  limitheight:     { "ui:help":"Cap the widget's height — anything taller scrolls inside a styled scrollbar" },
  maxheight:       { "ui:help":"Maximum height in pixels (e.g. 600). You can also include a CSS unit like 600px or 70vh." },
};

// ── Utilities ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const h = (hex.replace("#","")+"000000").slice(0,6);
  return `${parseInt(h.slice(0,2),16)||0},${parseInt(h.slice(2,4),16)||0},${parseInt(h.slice(4,6),16)||0}`;
}
function contrastColor(hex: string): string {
  const h = (hex.replace("#","")+"000000").slice(0,6);
  const r=parseInt(h.slice(0,2),16)/255, g=parseInt(h.slice(2,4),16)/255, b=parseInt(h.slice(4,6),16)/255;
  const lin=(c:number)=>c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);
  const L=0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
  return L>0.45?"#1a1a1a":"#ffffff";
}

const TYPE_REGEX = /\[type:\s*([^\]]+)\]/i;
const RECUR_REGEX = /\[recur:\s*[^\]]+\]/i;
// Recurring Tasks widget stamps unfired templates with [type: recur-template] — treat
// that as the "Recurring" badge rather than a literal type badge.
const RECUR_TEMPLATE_TYPE = "recur-template";
function parseTaskType(text: string): string|null { const m=TYPE_REGEX.exec(text); return m?m[1].trim().toLowerCase():null; }
// Strip the hidden bracket markers other task widgets stamp into titles/descriptions.
function stripTags(text: string): string {
  return text.replace(/\[[a-zA-Z]+:[^\]]*\]/g, "").replace(/\s{2,}/g, " ").trim();
}

// Type-badge color — deterministic per type (no palette config on this widget).
const TYPE_COLORS: Record<string,string> = {
  storetask:"#da2e32", compliance:"#8B4513", maintenance:"#2E7D4A",
  training:"#4A90A4", audit:"#7C3AED", safety:"#D97706", inventory:"#0369A1",
  finance:"#0369A1", operations:"#2E7D4A", merchandising:"#7C3AED",
};
function typeColor(type: string): string {
  const key=type.toLowerCase();
  if(TYPE_COLORS[key]) return TYPE_COLORS[key];
  let h=0; for(let i=0;i<key.length;i++) h=(h*31+key.charCodeAt(i))&0xffffff;
  return `hsl(${((h>>16)&0xff)%360},55%,40%)`;
}
function priorityColor(p: string): string { return p==="Priority_1"?"#C41E3A":p==="Priority_2"?"#D97706":"#6b7280"; }

// ── Widget factory ────────────────────────────────────────────────────────────

const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  return class SimpleTaskWidget extends BaseBlockClass implements BaseBlock {
    constructor() { super(); }

    async renderBlock(container: any) {
      const apiToken     = this.getAttribute("apitoken")        || DEFAULT_API_TOKEN;
      const baseUrl      = (this.getAttribute("baseurl")||DEFAULT_BASE_URL).replace(/\/$/,"");
      let   primaryColor = this.getAttribute("primarycolor")    || DEFAULT_PRIMARY_COLOR;
      let   accentColor  = this.getAttribute("accentcolor")     || DEFAULT_ACCENT_COLOR;
      const bgColor      = this.getAttribute("backgroundcolor") || "";
      if (this.getAttribute("usethemecolors") === "true") {
        const themed = await fetchThemeColors(baseUrl, apiToken);
        if (themed.primary) primaryColor = themed.primary;
        if (themed.accent)  accentColor  = themed.accent;
      }
      const showCompleted = this.getAttribute("showcompleted") !== "false";
      const allowToggle   = this.getAttribute("allowtoggle")   !== "false";
      const enableComments= this.getAttribute("enablecomments")!== "false";
      const requireProof  = this.getAttribute("requirephotoproof") === "true";
      const onlyMine       = this.getAttribute("onlyassignedtome") === "true";

      // ── Limit height / scroll (same pattern as the other task widgets) ──
      const limitHeight = this.getAttribute("limitheight") === "true";
      let   maxHeight   = (this.getAttribute("maxheight") || "").trim();
      if (!maxHeight) maxHeight = "600px";
      else if (/^\d+(\.\d+)?$/.test(maxHeight)) maxHeight += "px";

      const primaryRgb  = hexToRgb(primaryColor);
      const accentRgb   = hexToRgb(accentColor);
      const primaryText = contrastColor(primaryColor);
      const p = "stw";

      // ── Parse configured task refs: "installationId/taskId" per line ──
      type Ref = { installId: string; taskId: string };
      const refs: Ref[] = (this.getAttribute("tasklist") || "")
        .split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
        .map(s => { const m = s.split(/[\/:]/).map(x => x.trim()).filter(Boolean); return m.length >= 2 ? { installId: m[0], taskId: m[1] } : null; })
        .filter((x): x is Ref => !!x);

      type Task = {
        id:string; installId:string; title:string; description:string; status:string;
        dueDate:string|null; priority:string; taskType:string|null; isRecurring:boolean;
        groupIds:string[]; assigneeIds:string[]; attachmentIds:string[]; ok:boolean;
      };
      let tasks: Task[] = [];

      let locale = DEFAULT_LOCALE;
      let tr = makeT(STRINGS, locale);
      let currentUserId = "";
      let userGroupIds: string[] = [];

      // ── Content translation (titles + description) ──────────────────────
      let contentTranslated = false, translateBusy = false;
      const ctCache: {[k:string]:string} = {};
      const ct = (s:string):string => { if(!contentTranslated||!s) return s; return ctCache[s.trim()]||s; };
      // Comment translation (independent of content translation)
      let cmtTranslated = false, cmtTrBusy = false;
      const cmtCache: {[k:string]:string} = {};
      let lastCmt: { comments:any[]; authors:any[]; bodies:string[]; task:Task } | null = null;

      const groupMap = new Map<string,string>();
      let groupsLoaded = false;

      // ── Auth / fetch helpers ────────────────────────────────────────────
      const apiOpts = (extra?: RequestInit): RequestInit => ({
        ...extra, credentials:"omit",
        headers:{ Authorization:`Basic ${apiToken}`, "Content-Type":"application/json" },
      });
      function readCsrf():string{
        const w:any=window;
        try{ const t=w.we?.authMgr?.csrfToken; if(t) return String(t); }catch(_){}
        if(w.csrfToken) return String(w.csrfToken);
        const m=document.cookie.match(/(?:^|;\s*)(?:csrf|XSRF-TOKEN|csrftoken)=([^;]+)/i);
        if(m) return decodeURIComponent(m[1]);
        const meta=document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement|null;
        return meta?.content||"";
      }
      function sessionOpts(extra?:RequestInit):RequestInit{
        const csrf=readCsrf();
        return { ...extra, credentials:"include", headers:{ ...(csrf?{"x-csrf-token":csrf}:{}), ...(extra?.headers||{}) } };
      }
      const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      const isDone = (s: string) => s === "DONE" || s === "done" || s === "CLOSED";

      // ── Date / labels ───────────────────────────────────────────────────
      function formatDate(iso:string|null):{text:string;overdue:boolean}{
        if(!iso) return{text:"",overdue:false};
        const datePart=iso.split("T")[0];
        if(!datePart||!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return{text:"",overdue:false};
        const[year,month,day]=datePart.split("-").map(Number);
        const d=new Date(year,month-1,day);
        if(isNaN(d.getTime())) return{text:"",overdue:false};
        const now=new Date(); now.setHours(0,0,0,0);
        const overdue=d<now;
        let text:string;
        try{ text=d.toLocaleDateString(locale.replace("_","-"),{month:"short",day:"numeric",year:"numeric"}); }
        catch(_){ text=d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
        return{text,overdue};
      }
      function prioLabel(pr:string):string{ return pr==="Priority_1"?tr("high"):pr==="Priority_2"?tr("medium"):tr("normal"); }

      // ── Media / attachments ─────────────────────────────────────────────
      const MEDIA_MAX = 25 * 1024 * 1024;
      function humanSize(b:number):string{ if(b<1024) return `${b} B`; if(b<1048576) return `${(b/1024).toFixed(0)} KB`; return `${(b/1048576).toFixed(1)} MB`; }
      function b64utf8(s:string):string{ let out=""; const bytes=new TextEncoder().encode(s); for(const byte of bytes) out+=String.fromCharCode(byte); return btoa(out); }
      async function uploadMedia(file:File):Promise<{id:string;url:string}>{
        const create=await fetch(`${baseUrl}/media/tus`,{ method:"POST",credentials:"omit",
          headers:{ Authorization:`Basic ${apiToken}`, "Tus-Resumable":"1.0.0", "Upload-Length":String(file.size),
            "Upload-Metadata":`filename ${b64utf8(file.name)},filetype ${b64utf8(file.type||"application/octet-stream")}` } });
        if(create.status!==201) throw new Error(`upload init failed (${create.status})`);
        const loc=create.headers.get("Location"); if(!loc) throw new Error("no upload URL");
        const buf=await file.arrayBuffer(); const CHUNK=5*1024*1024; let offset=0; let media:any=null;
        while(offset<buf.byteLength){
          const end=Math.min(offset+CHUNK,buf.byteLength);
          const res=await fetch(loc,{ method:"PATCH",credentials:"omit",
            headers:{ Authorization:`Basic ${apiToken}`, "Tus-Resumable":"1.0.0", "Upload-Offset":String(offset), "Content-Type":"application/offset+octet-stream" },
            body:buf.slice(offset,end) });
          if(!res.ok) throw new Error(`upload failed (${res.status})`);
          offset=end; try{ media=await res.clone().json(); }catch(_){}
        }
        if(!media?.id) throw new Error("no media id returned");
        const url=media.resourceInfo?.url||media.transformations?.t_preview?.resourceInfo?.url||"";
        return {id:media.id,url};
      }
      async function mediaMeta(id:string):Promise<any|null>{ try{ const r=await fetch(`${baseUrl}/media/medium/${id}/metadata`,apiOpts()); return r.ok?await r.json():null; }catch(_){ return null; } }
      function originalUrl(m:any):string{
        const t=m?.thumbnail?.url||""; if(!t) return "";
        const ext=((String(m?.fileName||"").match(/\.[a-z0-9]+$/i))||[])[0] || (m?.type==="pdf"?".pdf":"");
        let u=t.replace(/\/upload\/[^/]+\//,"/upload/");
        if(ext) u=u.replace(/\.[a-z0-9]+($|\?)/i, ext+"$1");
        return u;
      }
      function attKind(m:any):string{
        const fn=String(m?.fileName||""); const mime=String(m?.mimeType||m?.contentType||"").toLowerCase();
        if(/^image\//.test(mime)||/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(fn)) return "img";
        if(mime.indexOf("pdf")>=0||m?.type==="pdf"||/\.pdf$/i.test(fn)) return "pdf";
        return "other";
      }
      const mediaCache=new Map<string,any>();
      async function metaCached(id:string){ if(mediaCache.has(id)) return mediaCache.get(id); const m=await mediaMeta(id); mediaCache.set(id,m); return m; }
      const ATT_TOKEN=/\[attachment:([A-Za-z0-9]+)\]/g;
      function resolveAttachments(html:string):string{
        return html.replace(ATT_TOKEN,(_m,id)=>{
          const meta=mediaCache.get(id);
          const name=esc(meta?.fileName||"attachment"); const fn=meta?.fileName||"attachment";
          const turl=meta?.thumbnail?.url||""; const full=originalUrl(meta)||turl; const kind=attKind(meta);
          const data=`data-att-url="${esc(full)}" data-att-preview="${esc(turl)}" data-att-name="${esc(fn)}" data-att-kind="${kind}"`;
          if(kind==="img"&&turl) return `<a href="${esc(full)}" target="_blank" rel="noopener" ${data}><img class="${p}-cmt-att-img" src="${esc(turl)}" alt="${name}"></a>`;
          return `<a class="${p}-cmt-att" href="${esc(full)||"#"}" target="_blank" rel="noopener" ${data}>${iClip}<span>${name}</span></a>`;
        });
      }

      // ── Comments ────────────────────────────────────────────────────────
      const CMT_CREATE_CT="application/vnd.staffbase.tasks.comment-create.v1+json";
      const CMT_HTML_ACCEPT="application/vnd.staffbase.tasks.comment.html-content.v1+json";
      // Photo-proof comments are stamped with this marker; the token is stripped
      // from the visible comment body but the attached image still renders.
      const PROOF_MARK="[proof]";
      const stripProof=(html:string):string=>html.replace(/\[proof\]/gi,"").trim();
      function commentDoc(text:string):any{ const html=`<p>${esc(text)}</p>`; return { blocks:{ b1:{ type:"text", children:[], config:{ html, text } } }, content:["b1"] }; }
      async function loadComments(task:Task):Promise<any[]>{
        const url=`${baseUrl}/tasks/${task.installId}/task/${task.id}/comments${currentUserId?`?viewedBy=${currentUserId}`:""}`;
        const r=await fetch(url,apiOpts({headers:{Accept:CMT_HTML_ACCEPT}}));
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        let d:any; try{ d=await r.json(); }catch(_){ d=[]; }
        const arr:any[]=Array.isArray(d)?d:(d.data||[]);
        // Hide the hidden [tasks:edit] audit comments other widgets stamp.
        return arr.filter(c=>commentText(c).replace(/<[^>]+>/g," ").trim().indexOf("[tasks:edit]")!==0);
      }
      async function postComment(task:Task,text:string):Promise<any>{
        const url=`${baseUrl}/tasks/${task.installId}/task/${task.id}/comments`;
        const r=await fetch(url,sessionOpts({ method:"POST", headers:{ "Content-Type":CMT_CREATE_CT, Accept:CMT_HTML_ACCEPT }, body:JSON.stringify({ content: commentDoc(text) }) }));
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        try{ return await r.json(); }catch(_){ return null; }
      }
      // Hidden activity comment ([tasks:edit] prefix) — feeds the Manager Tasks
      // activity feed and the My Tasks calendar's completion date. Best-effort;
      // these comments are filtered out of the visible list above.
      async function postEditComment(task:Task, action:string){
        try{ await postComment(task, `[tasks:edit] ${action}`); }catch(_){}
      }
      function commentText(c:any):string{
        const ctn=c.content;
        if(typeof ctn==="string") return ctn;
        if(ctn?.html) return ctn.html;
        if(ctn?.blocks){
          const order:string[]=Array.isArray(ctn.content)?ctn.content:Object.keys(ctn.blocks);
          const parts=order.map((id:string)=>{ const b=ctn.blocks[id]; const cfg=b&&b.config||{}; return cfg.html||(cfg.text?`<p>${esc(cfg.text)}</p>`:""); }).filter(Boolean);
          if(parts.length) return parts.join("");
        }
        if(c.text) return c.text;
        return "";
      }
      function commentAuthorId(c:any):string{ return c.authorId||c.authorID||c.author?.id||""; }
      function commentTime(iso:string):string{
        const t=Date.parse(iso); if(isNaN(t)) return "";
        const s=Math.floor((Date.now()-t)/1000);
        if(s<60) return "just now";
        if(s<3600) return `${Math.floor(s/60)}m ago`;
        if(s<86400) return `${Math.floor(s/3600)}h ago`;
        if(s<604800) return `${Math.floor(s/86400)}d ago`;
        return new Date(t).toLocaleDateString();
      }

      // ── Users / avatars ─────────────────────────────────────────────────
      const userCache=new Map<string,{name:string;avatar:string}>();
      async function fetchUser(id:string):Promise<{name:string;avatar:string}>{
        if(!id) return {name:"User",avatar:""};
        const hit=userCache.get(id); if(hit) return hit;
        let info={name:"User",avatar:""};
        try{
          const r=await fetch(`${baseUrl}/users/${id}`,apiOpts());
          if(r.ok){ const u=await r.json();
            const name=[u.firstName,u.lastName].filter(Boolean).join(" ")||u.displayName||u.userName||"User";
            const avatar=u.avatar?.icon?.url||u.avatar?.thumb?.url||u.avatar?.original?.url||"";
            info={name,avatar}; }
        }catch(_){}
        userCache.set(id,info); return info;
      }
      async function fetchGroups(){
        if(groupsLoaded) return; groupsLoaded=true;
        try{
          const r=await fetch(`${baseUrl}/groups?limit=200`,apiOpts());
          if(r.ok){ const d=await r.json();
            for(const g of (d.data||[])){ const name=g.config?.localization?.en_US?.title||g.config?.localization?.en_US?.name||g.name||g.id; if(g.id&&name) groupMap.set(g.id,name); } }
        }catch(_){}
      }
      function initials(name:string):string{ const parts=name.trim().split(/\s+/); return ((parts[0]?.[0]||"")+(parts[1]?.[0]||"")).toUpperCase()||"?"; }
      function avatarHtml(info:{name:string;avatar:string}):string{
        if(info.avatar) return `<img class="${p}-cmt-av" src="${esc(info.avatar)}" alt="${esc(info.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="${p}-cmt-av ${p}-cmt-av-fb" style="display:none">${esc(initials(info.name))}</span>`;
        return `<span class="${p}-cmt-av ${p}-cmt-av-fb">${esc(initials(info.name))}</span>`;
      }

      // ── Translation network (user-session) ──────────────────────────────
      async function translateSend(payload:string):Promise<string>{
        const r=await fetch(`${baseUrl}/translations`, sessionOpts({ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({sourceLanguage:DEFAULT_LOCALE, targetLanguage:locale, contents:{value:payload}}) }));
        if(!r.ok) throw new Error("translate "+r.status);
        const d=await r.json(); return d?.contents?.value||"";
      }

      // ── Icons ───────────────────────────────────────────────────────────
      const iconCheck=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      const iClip=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
      const iFileGeneric=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
      const iXsmall=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      const iSend=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
      const iGlobe=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/></svg>`;
      const iCal=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
      const iUser=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      const iGroup=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
      const iconRecur=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;

      const limitCss = limitHeight ? `
          .${p}.${p}-limited{max-height:${maxHeight};overflow-y:auto;box-sizing:border-box;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(${primaryRgb},.45) transparent}
          .${p}.${p}-limited::-webkit-scrollbar{width:10px;height:10px}
          .${p}.${p}-limited::-webkit-scrollbar-track{background:transparent;margin:6px 0}
          .${p}.${p}-limited::-webkit-scrollbar-thumb{background:rgba(${primaryRgb},.32);border-radius:8px;border:3px solid transparent;background-clip:padding-box}
          .${p}.${p}-limited::-webkit-scrollbar-thumb:hover{background:rgba(${primaryRgb},.55);background-clip:padding-box}` : "";

      // ── Cleanup any panels from a prior render of this instance ──────────
      const self: any = this;
      if (self._stwOverlay) { self._stwOverlay.remove(); self._stwOverlay = undefined; }
      if (self._stwDetail)  { self._stwDetail.remove();  self._stwDetail  = undefined; }
      if (self._stwAModal)  { self._stwAModal.remove();  self._stwAModal  = undefined; }
      if (self._stwProof)   { self._stwProof.remove();   self._stwProof   = undefined; }
      if (self._stwDocKey)  { document.removeEventListener("keydown", self._stwDocKey); self._stwDocKey = undefined; }
      if (self._stwVV && (window as any).visualViewport) {
        (window as any).visualViewport.removeEventListener("resize", self._stwVV);
        (window as any).visualViewport.removeEventListener("scroll", self._stwVV);
        self._stwVV = undefined;
      }
      const instId = Math.random().toString(36).slice(2);

      try { container.setAttribute("dir", isRtl(locale) ? "rtl" : "ltr"); } catch (_) {}

      // ── Skeleton ───────────────────────────────────────────────────────
      container.innerHTML = `
        <style>
          .${p}{--primary:${primaryColor};--primary-rgb:${primaryRgb};--accent:${accentColor};--accent-rgb:${accentRgb};--primary-text:${primaryText};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);background:${bgColor||"transparent"};padding:16px}
          .${p} *,.${p} *::before,.${p} *::after{box-sizing:border-box;margin:0;padding:0}
          .${p}-banner{display:none;margin-bottom:10px;padding:9px 12px;border-radius:var(--r-md);font-size:12.5px;font-weight:600;background:rgba(196,30,58,.08);color:var(--error);border:1px solid rgba(196,30,58,.2)}
          .${p}-top{display:flex;justify-content:flex-end;margin-bottom:10px}
          .${p} .${p}-tr-btn{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px!important;border:1.5px solid var(--border)!important;border-radius:var(--r-md)!important;background:#fff!important;color:var(--gray)!important;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;width:auto!important;margin:0!important;line-height:normal!important}
          .${p} .${p}-tr-btn:hover{border-color:var(--primary)!important;color:var(--primary)!important}
          .${p}-tr-btn svg{stroke:currentColor!important}
          .${p}-list{display:flex;flex-direction:column;gap:8px}
          .${p}-row{display:flex;align-items:flex-start;gap:12px;padding:11px 13px;background:#fff;border:1px solid var(--border);border-radius:var(--r-md);box-shadow:0 1px 3px rgba(0,0,0,.05),0 1px 2px rgba(0,0,0,.04);transition:opacity .25s ease,transform .15s ease,box-shadow .15s ease;cursor:pointer}
          .${p}-row:hover{box-shadow:0 4px 14px rgba(0,0,0,.09);transform:translateY(-1px)}
          .${p}-row.done{opacity:.65}
          .${p}-check-wrap{flex-shrink:0;padding-top:1px;position:relative}
          .${p} .${p}-check{width:20px!important;height:20px;border-radius:50%!important;border:2px solid #d1d5db!important;background:#fff!important;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;padding:0!important;margin:0!important;line-height:0;font-family:inherit}
          .${p} .${p}-check:hover{border-color:var(--primary)!important;background:rgba(var(--primary-rgb),.06)!important}
          .${p} .${p}-check.checked{background:var(--success)!important;border-color:var(--success)!important}
          .${p} .${p}-check:disabled{cursor:default}
          .${p} .${p}-check.checked:disabled{border-color:var(--success)!important;background:var(--success)!important}
          .${p}-check-icon{display:none}
          .${p}-check.checked .${p}-check-icon{display:block}
          .${p}-row-main{flex:1;min-width:0;padding-top:1px}
          .${p}-row-title{font-size:14px;font-weight:600;color:var(--dark);line-height:1.45;word-break:break-word;position:relative;display:inline}
          .${p}-row-title::after{content:"";position:absolute;left:0;top:50%;height:1.5px;background:var(--gray);width:0;transform:translateY(-50%);transition:width .35s ease;display:block}
          .${p}-row.done .${p}-row-title{color:var(--gray)}
          .${p}-row.done .${p}-row-title::after{width:100%}
          .${p}-row-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:5px}
          .${p}-row-badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:4px;font-size:9.5px;font-weight:700;line-height:1.4;letter-spacing:.4px;text-transform:uppercase;color:#fff;flex-shrink:0}
          .${p}-row-due{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--gray-lt);font-weight:500}
          .${p}-row-due svg{width:12px;height:12px;flex-shrink:0}
          .${p}-row-due.overdue{color:var(--error);font-weight:700}
          .${p}-row.done .${p}-row-due,.${p}-row.done .${p}-row-badge{opacity:.75}
          .${p}-state{padding:22px 8px;text-align:center;color:var(--gray);font-size:13px}
          .${p}-spin{width:18px;height:18px;border-radius:50%;border:2.5px solid rgba(var(--primary-rgb),.2);border-top-color:var(--primary);animation:${p}-spin .7s linear infinite;display:inline-block;vertical-align:middle;margin-right:7px}
          @keyframes ${p}-spin{to{transform:rotate(360deg)}}
          @keyframes ${p}-check-pop{0%{transform:scale(1)}35%{transform:scale(1.35);box-shadow:0 0 0 6px rgba(var(--primary-rgb),.12)}65%{transform:scale(.88)}100%{transform:scale(1);box-shadow:none}}
          @keyframes ${p}-uncheck-pop{0%{transform:scale(1)}40%{transform:scale(1.2)}100%{transform:scale(1)}}
          .${p}-check.pop-done{animation:${p}-check-pop .38s cubic-bezier(.34,1.56,.64,1) forwards}
          .${p}-check.pop-undone{animation:${p}-uncheck-pop .28s cubic-bezier(.34,1.56,.64,1) forwards}
          @keyframes ${p}-spark{0%{transform:scale(0) translate(0,0);opacity:1}100%{transform:scale(1) translate(var(--tx),var(--ty));opacity:0}}
          .${p}-spark{position:absolute;width:5px;height:5px;border-radius:50%;pointer-events:none;animation:${p}-spark .5s ease-out forwards}

          /* ── Detail panel ── */
          .${p}-overlay{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .25s ease}
          .${p}-overlay.open{opacity:1;pointer-events:auto}
          .${p}-detail{--primary:${primaryColor};--primary-rgb:${primaryRgb};--primary-text:${primaryText};--accent:${accentColor};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#fff;border-radius:20px 20px 0 0;max-height:88vh;display:flex;flex-direction:column;transform:translateY(102%);transition:transform .32s cubic-bezier(.32,.72,0,1);overflow:hidden}
          .${p}-detail.open{transform:translateY(0)}
          .${p}-detail.side{left:50%;top:50%;right:auto;bottom:auto;width:min(460px,92vw);max-height:min(86vh,760px);border-radius:20px;transform:translate(-50%,-48%) scale(.97);opacity:0;pointer-events:none;box-shadow:0 24px 64px rgba(0,0,0,.28);transition:opacity .2s ease,transform .26s cubic-bezier(.32,.72,0,1)}
          .${p}-detail.side.open{transform:translate(-50%,-50%) scale(1);opacity:1;pointer-events:auto}
          .${p}-detail button{margin:0!important;box-sizing:border-box}
          .${p}-detail-handle{width:40px;height:5px;border-radius:3px;background:var(--border);margin:9px auto 2px;flex-shrink:0;cursor:grab;touch-action:none}
          .${p}-detail.side .${p}-detail-handle{display:none}
          .${p}-detail-head{display:flex;align-items:center;gap:10px;padding:16px 20px 12px;flex-shrink:0;border-bottom:1px solid var(--border);touch-action:none}
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
          .${p}-detail-meta-av{width:20px;height:20px;border-radius:50%;object-fit:cover;background:#e5e7eb;flex-shrink:0}
          .${p}-detail-desc-label{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-lt);margin-bottom:6px}
          .${p}-detail-desc{font-size:13px;color:var(--gray);line-height:1.65;white-space:pre-wrap;word-break:break-word}
          .${p}-detail-desc.empty{font-style:italic;color:var(--gray-lt)}
          .${p}-detail-foot{padding:14px 20px;border-top:1px solid var(--border);flex-shrink:0}
          .${p}-detail-toggle-btn{width:100%;padding:11px;border-radius:var(--r-md);border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:8px}
          .${p}-detail-toggle-btn.done-btn{background:rgba(var(--primary-rgb),.08);border:1.5px solid rgba(var(--primary-rgb),.2);color:var(--primary)}
          .${p}-detail-toggle-btn.done-btn:hover{background:var(--primary);color:var(--primary-text)}
          .${p}-detail-toggle-btn.open-btn{background:#f3f4f6;border:1.5px solid var(--border);color:var(--gray)}
          .${p}-detail-toggle-btn.open-btn:hover{background:var(--border);color:var(--dark)}
          .${p}-type-badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;line-height:1.4;letter-spacing:.5px;text-transform:uppercase;color:#fff;flex-shrink:0}
          .${p}-prio-badge{display:inline-flex;align-items:center;padding:1.5px 7px;border-radius:4px;font-size:10px;font-weight:700;line-height:1.4;letter-spacing:.3px;flex-shrink:0;border:1.5px solid currentColor}
          .${p}-recur-badge{display:inline-flex;align-items:center;gap:3px;padding:3px 7px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.3px;flex-shrink:0;text-transform:uppercase;background:rgba(var(--primary-rgb),.1);color:var(--primary)}
          .${p}-recur-badge svg{width:9px;height:9px}
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
          .${p}-att-link{display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none;min-width:0;cursor:pointer}
          .${p}-att-thumb{width:34px;height:34px;border-radius:var(--r-sm);object-fit:cover;flex-shrink:0;background:#f3f4f6}
          .${p}-att-ico{width:34px;height:34px;border-radius:var(--r-sm);background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:var(--gray-lt);flex-shrink:0}
          .${p}-att-meta{min-width:0;display:flex;flex-direction:column;gap:1px}
          .${p}-att-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px;font-weight:500}
          .${p}-att-size{color:var(--gray-lt);font-size:11px}
          .${p}-att-x{width:auto!important;margin:0 0 0 2px!important;border:none!important;background:none!important;color:var(--gray-lt);cursor:pointer;padding:3px!important;display:flex!important;border-radius:50%;flex-shrink:0;transition:color .15s,background .15s}
          .${p}-att-x:hover{color:var(--error);background:rgba(196,30,58,.08)}
          .${p}-att-empty{font-size:12px;color:var(--gray-lt)}
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
          /* ── Photo proof modal ── */
          .${p}-proof{--primary:${primaryColor};--primary-rgb:${primaryRgb};--primary-text:${primaryText};--accent:${accentColor};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;position:fixed;inset:0;z-index:100003;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:16px}
          .${p}-proof.open{display:flex}
          .${p}-proof-card{background:#fff;border-radius:var(--r-lg);width:100%;max-width:min(420px,96vw);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.4)}
          .${p}-proof-head{display:flex;align-items:center;gap:8px;padding:13px 14px;border-bottom:1px solid var(--border);flex-shrink:0}
          .${p}-proof-title{flex:1;min-width:0;font-size:14px;font-weight:800;color:var(--dark)}
          .${p}-proof-x{width:30px;height:30px;flex-shrink:0;border:none;border-radius:50%;background:#f3f4f6;color:var(--gray);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
          .${p}-proof-x:disabled{opacity:.4;cursor:default}
          .${p}-proof-body{padding:14px}
          .${p}-proof-desc{margin:0 0 12px;font-size:13px;color:var(--gray);line-height:1.5}
          .${p}-proof-drop{display:block;position:relative;border:1.5px dashed rgba(var(--primary-rgb),.4);border-radius:var(--r-md);background:rgba(var(--primary-rgb),.04);cursor:pointer;overflow:hidden;transition:border-color .15s,background .15s}
          .${p}-proof-drop:hover{border-color:var(--primary);background:rgba(var(--primary-rgb),.08)}
          .${p}-proof-drop.has{border-style:solid;border-color:var(--primary)}
          .${p}-proof-drop-inner{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:150px;padding:20px;color:var(--primary);font-size:13px;font-weight:700;text-align:center}
          .${p}-proof-drop.has .${p}-proof-drop-inner{padding:0;gap:0}
          .${p}-proof-preview{width:100%;max-height:260px;object-fit:contain;display:block;background:#f1f3f5}
          .${p}-proof-fname{padding:8px 10px;font-size:12px;color:var(--gray);font-weight:600;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
          .${p}-proof-file{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
          .${p}-proof-err{margin-top:10px;font-size:12px;color:var(--error);font-weight:600}
          .${p}-proof-err:empty{display:none}
          .${p}-proof-foot{display:flex;gap:8px;padding:12px 14px;border-top:1px solid var(--border);flex-shrink:0}
          .${p}-proof-btn{flex:1;padding:10px;border-radius:var(--r-md);border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:7px;transition:all .15s}
          .${p}-proof-cancel{background:#f3f4f6;color:var(--gray)}
          .${p}-proof-cancel:disabled{opacity:.5;cursor:default}
          .${p}-proof-confirm{background:var(--primary);color:var(--primary-text,#fff)}
          .${p}-proof-confirm:disabled{opacity:.5;cursor:default}
          .${p}-proof-spin{width:13px;height:13px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;display:inline-block;animation:${p}-spin .7s linear infinite}
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
          .${p}-cmt-body p{margin:0 0 4px}.${p}-cmt-body p:last-child{margin-bottom:0}
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
          .${p}-cmt-chips{display:flex;flex-wrap:nowrap;gap:5px;flex:1;min-width:0;overflow-x:auto;margin:0;scrollbar-width:none}
          .${p}-cmt-chips::-webkit-scrollbar{display:none}
          .${p}-cmt-chip{display:inline-flex;align-items:center;gap:5px;max-width:130px;flex-shrink:0;font-size:11px;font-weight:600;background:rgba(var(--primary-rgb),.08);color:var(--primary);border-radius:12px;padding:3px 4px 3px 9px}
          .${p}-cmt-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .${p}-cmt-chip button{width:auto!important;margin:0!important;border:none!important;background:none!important;cursor:pointer;color:inherit;padding:1px!important;display:flex!important;opacity:.7}
          .${p}-cmt-chip button:hover{opacity:1}
          .${p}-cmt-att{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--primary)!important;text-decoration:none;background:rgba(var(--primary-rgb),.08);border-radius:6px;padding:3px 9px;margin:3px 4px 3px 0}
          .${p}-cmt-att svg{width:12px;height:12px;flex-shrink:0}
          .${p}-cmt-att-img{max-width:180px;max-height:140px;border-radius:8px;display:block;margin:5px 0;border:1px solid var(--border);cursor:pointer}
          @keyframes ${p}-cmt-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
          .${p}-cmt-item{animation:${p}-cmt-in .32s ease both}
          ${[1,2,3,4,5,6,7,8].map(n=>`.${p}-cmt-list .${p}-cmt-item:nth-child(${n}){animation-delay:${(n-1)*0.04}s}`).join("")}
          @media (prefers-reduced-motion:reduce){.${p}-cmt-item{animation:none!important}}
          ${limitCss}
        </style>

        <div class="${p}${limitHeight ? ` ${p}-limited` : ""}">
          <div class="${p}-banner" id="${p}-banner"></div>
          <div class="${p}-top" id="${p}-top" style="display:none">
            <button type="button" class="${p}-tr-btn" id="${p}-translate" title="${tr("translateBtn")}">${iGlobe}<span id="${p}-translate-lbl">${tr("translateBtn")}</span></button>
          </div>
          <div class="${p}-list" id="${p}-list">
            <div class="${p}-state"><span class="${p}-spin"></span>${tr("loading")}</div>
          </div>
        </div>
      `;

      const listEl   = container.querySelector(`#${p}-list`) as HTMLElement;
      const bannerEl = container.querySelector(`#${p}-banner`) as HTMLElement;
      const topEl    = container.querySelector(`#${p}-top`) as HTMLElement;

      function showError(msg: string) {
        bannerEl.textContent = msg; bannerEl.style.display = "block";
        window.clearTimeout((bannerEl as any)._t);
        (bannerEl as any)._t = window.setTimeout(() => { bannerEl.style.display = "none"; }, 4000);
      }

      // ── Overlay + detail panel + attachment modal (appended to body) ────
      const overlayEl = document.createElement("div");
      overlayEl.className = `${p}-overlay`; overlayEl.dataset.sbPortal = instId;
      document.body.appendChild(overlayEl); self._stwOverlay = overlayEl;

      const detailEl = document.createElement("div");
      detailEl.className = `${p}-detail`; detailEl.dataset.sbPortal = instId;
      detailEl.innerHTML = `
        <div class="${p}-detail-handle"></div>
        <div class="${p}-detail-head">
          <div class="${p}-detail-head-badges" id="${p}-detail-badges-${instId}"></div>
          <button type="button" class="${p}-detail-close" id="${p}-detail-close-${instId}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="${p}-detail-body" id="${p}-detail-body-${instId}"></div>
        <div class="${p}-detail-foot"><button type="button" class="${p}-detail-toggle-btn" id="${p}-detail-toggle-${instId}"></button></div>
      `;
      document.body.appendChild(detailEl); self._stwDetail = detailEl;
      const detailBadges = detailEl.querySelector(`#${p}-detail-badges-${instId}`) as HTMLElement;
      const detailBody   = detailEl.querySelector(`#${p}-detail-body-${instId}`) as HTMLElement;
      const detailToggle = detailEl.querySelector(`#${p}-detail-toggle-${instId}`) as HTMLButtonElement;
      const detailClose  = detailEl.querySelector(`#${p}-detail-close-${instId}`) as HTMLButtonElement;

      const attModal = document.createElement("div");
      attModal.className = `${p}-amodal`; attModal.dataset.sbPortal = instId;
      attModal.innerHTML = `
        <div class="${p}-amodal-card">
          <div class="${p}-amodal-head">
            <span class="${p}-amodal-name" id="${p}-amodal-name-${instId}"></span>
            <button type="button" class="${p}-amodal-dl" id="${p}-amodal-dl-${instId}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>
            <button type="button" class="${p}-amodal-x" id="${p}-amodal-x-${instId}" aria-label="Close"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="${p}-amodal-body" id="${p}-amodal-body-${instId}"></div>
        </div>`;
      document.body.appendChild(attModal); self._stwAModal = attModal;
      const aName = attModal.querySelector(`#${p}-amodal-name-${instId}`) as HTMLElement;
      const aBody = attModal.querySelector(`#${p}-amodal-body-${instId}`) as HTMLElement;
      const aDl   = attModal.querySelector(`#${p}-amodal-dl-${instId}`) as HTMLButtonElement;
      const aX    = attModal.querySelector(`#${p}-amodal-x-${instId}`) as HTMLButtonElement;
      let dlUrl = "", dlName = "";
      function openAttModal(previewUrl:string,downloadUrl:string,name:string,kind:string){
        dlUrl=downloadUrl||previewUrl; dlName=name||"file"; aName.textContent=dlName;
        const none=`<div class="${p}-amodal-none"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${tr("noPreview")}</span></div>`;
        if(kind==="pdf"&&downloadUrl){ aBody.innerHTML=`<object class="${p}-amodal-pdf" data="${esc(downloadUrl)}" type="application/pdf"><iframe src="${esc(downloadUrl)}" title="${esc(dlName)}"></iframe></object>`; }
        else if(kind==="img"){ aBody.innerHTML=`<img alt="${esc(dlName)}">`; const img=aBody.querySelector("img") as HTMLImageElement; img.src=downloadUrl||previewUrl; img.onerror=()=>{ if(previewUrl&&img.getAttribute("src")!==previewUrl){ img.src=previewUrl; } }; }
        else { aBody.innerHTML=none; }
        attModal.classList.add("open");
      }
      function closeAttModal(){ attModal.classList.remove("open"); aBody.innerHTML=""; }
      aX.addEventListener("click",closeAttModal);
      attModal.addEventListener("click",e=>{ if(e.target===attModal) closeAttModal(); });
      aDl.addEventListener("click",async()=>{
        if(!dlUrl) return; const name=dlName;
        try{
          const res=await fetch(dlUrl); const blob=await res.blob(); const navAny=navigator as any;
          const file=new File([blob],name,{type:blob.type||"application/octet-stream"});
          if(navAny.canShare && navAny.canShare({files:[file]})){ await navAny.share({files:[file],title:name}); return; }
          const obj=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=obj; a.download=name; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(()=>URL.revokeObjectURL(obj),5000);
        }catch(_){ window.open(dlUrl,"_blank"); }
      });
      detailBody.addEventListener("click",e=>{
        const a=(e.target as HTMLElement).closest("[data-att-url]") as HTMLElement|null;
        if(!a) return; e.preventDefault();
        openAttModal(a.dataset.attPreview||a.dataset.attUrl||"", a.dataset.attUrl||"", a.dataset.attName||"file", a.dataset.attKind||"other");
      });

      // ── Photo-proof modal (gates "mark done" when Require Photo Proof is on) ──
      const iCamera=`<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
      const proofModal = document.createElement("div");
      proofModal.className = `${p}-proof`; proofModal.dataset.sbPortal = instId;
      proofModal.innerHTML = `
        <div class="${p}-proof-card">
          <div class="${p}-proof-head">
            <span class="${p}-proof-title">${tr("proofTitle")}</span>
            <button type="button" class="${p}-proof-x" id="${p}-proof-x-${instId}" aria-label="${tr("cancel")}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="${p}-proof-body">
            <p class="${p}-proof-desc">${tr("proofDesc")}</p>
            <label class="${p}-proof-drop" id="${p}-proof-drop-${instId}" for="${p}-proof-file-${instId}">
              <div class="${p}-proof-drop-inner" id="${p}-proof-inner-${instId}">${iCamera}<span>${tr("proofPick")}</span></div>
            </label>
            <input type="file" accept="image/*" class="${p}-proof-file" id="${p}-proof-file-${instId}">
            <div class="${p}-proof-err" id="${p}-proof-err-${instId}"></div>
          </div>
          <div class="${p}-proof-foot">
            <button type="button" class="${p}-proof-btn ${p}-proof-cancel" id="${p}-proof-cancel-${instId}">${tr("cancel")}</button>
            <button type="button" class="${p}-proof-btn ${p}-proof-confirm" id="${p}-proof-confirm-${instId}" disabled>${tr("proofConfirm")}</button>
          </div>
        </div>`;
      document.body.appendChild(proofModal); self._stwProof = proofModal;
      const pFile    = proofModal.querySelector(`#${p}-proof-file-${instId}`)    as HTMLInputElement;
      const pDrop    = proofModal.querySelector(`#${p}-proof-drop-${instId}`)    as HTMLElement;
      const pInner   = proofModal.querySelector(`#${p}-proof-inner-${instId}`)   as HTMLElement;
      const pErr     = proofModal.querySelector(`#${p}-proof-err-${instId}`)     as HTMLElement;
      const pCancel  = proofModal.querySelector(`#${p}-proof-cancel-${instId}`)  as HTMLButtonElement;
      const pConfirm = proofModal.querySelector(`#${p}-proof-confirm-${instId}`) as HTMLButtonElement;
      const pX       = proofModal.querySelector(`#${p}-proof-x-${instId}`)       as HTMLButtonElement;
      let proofResolve:((v:boolean)=>void)|null = null;
      let proofFile:File|null = null;
      let proofTask:Task|null = null;
      let proofBusy = false;
      let proofPreviewUrl = "";
      function resetProof(){
        proofFile=null; pErr.textContent=""; pConfirm.disabled=true; pConfirm.innerHTML=tr("proofConfirm");
        pDrop.classList.remove("has"); pInner.innerHTML=`${iCamera}<span>${tr("proofPick")}</span>`;
        pFile.value=""; if(proofPreviewUrl){ URL.revokeObjectURL(proofPreviewUrl); proofPreviewUrl=""; }
      }
      function closeProof(result:boolean){
        if(proofBusy) return;
        proofModal.classList.remove("open");
        const r=proofResolve; proofResolve=null; proofTask=null; resetProof();
        if(r) r(result);
      }
      // Opens the proof modal and resolves true only after the photo is uploaded
      // and posted as a [proof] comment; false if the viewer cancels.
      function openProof(task:Task):Promise<boolean>{
        proofTask=task; resetProof(); proofModal.classList.add("open");
        return new Promise<boolean>(res=>{ proofResolve=res; });
      }
      pFile.addEventListener("change",()=>{
        const f=(pFile.files||[])[0]; if(!f) return;
        if(!/^image\//.test(f.type)){ pErr.textContent=tr("proofOnlyImages"); return; }
        if(f.size>MEDIA_MAX){ pErr.textContent=`"${f.name}" exceeds ${humanSize(MEDIA_MAX)}.`; return; }
        proofFile=f; pErr.textContent="";
        if(proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
        proofPreviewUrl=URL.createObjectURL(f);
        pInner.innerHTML=`<img class="${p}-proof-preview" src="${proofPreviewUrl}" alt=""><span class="${p}-proof-fname">${esc(f.name)}</span>`;
        pDrop.classList.add("has"); pConfirm.disabled=false;
      });
      pCancel.addEventListener("click",()=>closeProof(false));
      pX.addEventListener("click",()=>closeProof(false));
      proofModal.addEventListener("click",e=>{ if(e.target===proofModal) closeProof(false); });
      pConfirm.addEventListener("click",async()=>{
        if(!proofFile||!proofTask||proofBusy) return;
        const task=proofTask, file=proofFile;
        proofBusy=true; pConfirm.disabled=true; pCancel.disabled=true; pX.disabled=true; pErr.textContent="";
        pConfirm.innerHTML=`<span class="${p}-proof-spin"></span> ${tr("proofUploading")}`;
        try{
          const m=await uploadMedia(file);
          await postComment(task, `${PROOF_MARK} [attachment:${m.id}]`);
          // Keep the media referenced on the task so it persists and can surface later.
          const nextIds=[...(task.attachmentIds||[]), m.id];
          try{ await fetch(`${baseUrl}/tasks/${task.installId}/task/${task.id}`,{method:"PATCH",...apiOpts(),body:JSON.stringify({attachmentIds:nextIds})}); task.attachmentIds=nextIds; }catch(_){}
          proofBusy=false; pCancel.disabled=false; pX.disabled=false;
          closeProof(true);
        }catch(e:any){
          proofBusy=false; pCancel.disabled=false; pX.disabled=false; pConfirm.disabled=false;
          pConfirm.innerHTML=tr("proofConfirm"); pErr.textContent=`${tr("proofFailed")}: ${e.message}`;
        }
      });

      // ── Drag-to-dismiss the bottom sheet (mobile only) ──────────────────
      (function setupSheetDrag(){
        let startY=0, dy=0, dragging=false;
        const begin=(y:number)=>{ if(detailEl.classList.contains("side")) return; dragging=true; startY=y; dy=0; detailEl.style.transition="none"; };
        const move=(y:number)=>{ if(!dragging) return; dy=Math.max(0,y-startY); detailEl.style.transform=`translateY(${dy}px)`; overlayEl.style.opacity=String(Math.max(0,1-dy/420)); };
        const end=()=>{ if(!dragging) return; dragging=false; detailEl.style.transition=""; detailEl.style.transform=""; overlayEl.style.opacity=""; if(dy>110) closeDetail(); };
        [`.${p}-detail-handle`,`.${p}-detail-head`].forEach(sel=>{
          const el=detailEl.querySelector(sel) as HTMLElement|null; if(!el) return;
          el.addEventListener("touchstart",(e:any)=>begin(e.touches[0].clientY),{passive:true});
          el.addEventListener("touchmove",(e:any)=>{ move(e.touches[0].clientY); if(dragging&&dy>0) e.preventDefault(); },{passive:false});
          el.addEventListener("touchend",end); el.addEventListener("touchcancel",end);
        });
      })();

      detailEl.addEventListener("click",e=>e.stopPropagation());
      overlayEl.addEventListener("click",closeDetail);
      detailClose.addEventListener("click",e=>{e.stopPropagation();closeDetail();});
      const onDocKey=(e:KeyboardEvent)=>{ if(e.key==="Escape"&&detailTask) closeDetail(); };
      document.addEventListener("keydown",onDocKey); self._stwDocKey=onDocKey;

      // Lift the bottom-sheet above the on-screen keyboard (mobile).
      const vv:any=(window as any).visualViewport;
      const onViewport=()=>{
        if(!detailTask||detailEl.classList.contains("side")){ detailEl.style.bottom=""; return; }
        if(!vv) return;
        const kb=Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        detailEl.style.bottom = kb>80 ? kb+"px" : "";
      };
      if(vv){ vv.addEventListener("resize",onViewport); vv.addEventListener("scroll",onViewport); self._stwVV=onViewport; }

      detailToggle.addEventListener("click",async()=>{
        if(!detailTask) return;
        const task=detailTask; const wasDone=isDone(task.status);
        const next=wasDone?"OPEN":"CLOSED";
        detailToggle.disabled=true;
        if(!wasDone && requireProof){
          const ok=await openProof(task);
          if(!ok){ detailToggle.disabled=false; return; }
        }
        try{
          const res=await fetch(`${baseUrl}/tasks/${task.installId}/task/${task.id}`,{method:"PATCH",...apiOpts(),body:JSON.stringify({status:next})});
          if(!res.ok) throw new Error(`HTTP ${res.status}`);
          task.status=next; renderDetailContent(task); render();
          // Record the status change so it surfaces in the activity feed / calendar.
          postEditComment(task, `${next==="CLOSED"?"completed":"reopened"} “${task.title}”`);
        }catch(e:any){ showError(tr("errorToggle")); }
        detailToggle.disabled=false;
      });

      // ── Sparkle burst ───────────────────────────────────────────────────
      function spawnSparks(wrap:HTMLElement,color:string){
        [0,45,90,135,180,225,270,315].forEach(deg=>{
          const spark=document.createElement("div"); spark.className=`${p}-spark`;
          const rad=(deg*Math.PI)/180; const dist=14+Math.random()*8;
          spark.style.cssText=`background:${color};left:50%;top:50%;margin:-2.5px;--tx:${Math.cos(rad)*dist}px;--ty:${Math.sin(rad)*dist}px;`;
          wrap.appendChild(spark); spark.addEventListener("animationend",()=>spark.remove());
        });
      }

      // ── Comments rendering ──────────────────────────────────────────────
      async function renderComments(task:Task){
        const list=detailBody.querySelector(`#${p}-cmt-list-${instId}`) as HTMLElement|null;
        if(!list) return;
        list.innerHTML=`<div class="${p}-cmt-empty">${tr("loading")}</div>`;
        let comments:any[]=[];
        try{ comments=await loadComments(task); }
        catch(e:any){ if(detailTask!==task) return; list.innerHTML=`<div class="${p}-cmt-empty">${tr("couldntLoadComments")}</div>`; return; }
        if(detailTask!==task) return;
        if(!comments.length){ list.innerHTML=`<div class="${p}-cmt-empty">${tr("noCommentsYet")}</div>`; return; }
        const authors=await Promise.all(comments.map(c=>fetchUser(commentAuthorId(c))));
        const bodies=comments.map(c=>commentText(c));
        const attIds=new Set<string>();
        bodies.forEach(b=>{ let m; ATT_TOKEN.lastIndex=0; while((m=ATT_TOKEN.exec(b))) attIds.add(m[1]); });
        if(attIds.size) await Promise.all([...attIds].map(metaCached));
        if(detailTask!==task) return;
        cmtTranslated=false; cmtTrBusy=false;
        lastCmt={comments,authors,bodies,task};
        paintComments();
      }
      function paintComments(){
        if(!lastCmt) return;
        const list=detailBody.querySelector(`#${p}-cmt-list-${instId}`) as HTMLElement|null;
        if(!list||detailTask!==lastCmt.task) return;
        const {comments,authors,bodies}=lastCmt;
        const showBtn=locale!==DEFAULT_LOCALE;
        const btnLbl=cmtTrBusy?tr("translating"):cmtTranslated?tr("showOriginal"):tr("translateBtn");
        list.innerHTML=comments.map((c:any,i:number)=>{
          const a=authors[i];
          const body=cmtTranslated?(cmtCache[bodies[i].trim()]||bodies[i]):bodies[i];
          return `
          <div class="${p}-cmt-item">
            ${showBtn?`<button type="button" class="${p}-cmt-tr" title="${btnLbl}">${iGlobe}<span>${btnLbl}</span></button>`:""}
            ${avatarHtml(a)}
            <div class="${p}-cmt-main">
              <div class="${p}-cmt-head"><span class="${p}-cmt-author">${esc(a.name)}</span><span class="${p}-cmt-time">${esc(commentTime(c.createdAt||c.created||""))}</span></div>
              <div class="${p}-cmt-body" dir="auto">${resolveAttachments(stripProof(body))||"<em>(empty)</em>"}</div>
            </div>
          </div>`;
        }).join("");
        list.querySelectorAll(`.${p}-cmt-item`).forEach(it=>it.addEventListener("click",()=>it.classList.toggle("show-tr")));
        list.querySelectorAll(`.${p}-cmt-tr`).forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();toggleComments();}));
      }
      async function toggleComments(){
        if(cmtTrBusy||!lastCmt) return;
        if(!cmtTranslated){
          cmtTrBusy=true; paintComments();
          const map=await translateMap(lastCmt.bodies, translateSend);
          Object.assign(cmtCache,map); cmtTrBusy=false; cmtTranslated=true;
        } else { cmtTranslated=false; }
        paintComments();
      }

      // ── Attachments rendering ───────────────────────────────────────────
      async function renderAttachments(task:Task){
        const grid=detailBody.querySelector(`#${p}-att-grid-${instId}`) as HTMLElement|null;
        if(!grid) return;
        const ids=task.attachmentIds||[];
        if(!ids.length){ grid.innerHTML=`<span class="${p}-att-empty">${tr("noAttachments")}</span>`; return; }
        grid.innerHTML=`<span class="${p}-att-empty">${tr("loading")}</span>`;
        const metas=await Promise.all(ids.map(metaCached));
        if(detailTask!==task) return;
        grid.innerHTML=ids.map((id,i)=>{
          const m=metas[i]; const name=esc(m?.fileName||"file");
          const size=m?.size?`<span class="${p}-att-size">${humanSize(m.size)}</span>`:"";
          const thumb=m?.thumbnail?.url?`<img class="${p}-att-thumb" src="${esc(m.thumbnail.url)}" alt="">`:`<span class="${p}-att-ico">${iFileGeneric}</span>`;
          const fn=m?.fileName||"file"; const turl=m?.thumbnail?.url||""; const full=originalUrl(m)||turl; const kind=attKind(m);
          return `<div class="${p}-att-tile">
            <a class="${p}-att-link" href="${esc(full)}" target="_blank" rel="noopener" data-att-url="${esc(full)}" data-att-preview="${esc(turl)}" data-att-name="${esc(fn)}" data-att-kind="${kind}">
              ${thumb}<span class="${p}-att-meta"><span class="${p}-att-name">${name}</span>${size}</span>
            </a>
            <button type="button" class="${p}-att-x" data-id="${esc(id)}" title="Remove">${iXsmall}</button>
          </div>`;
        }).join("");
        grid.querySelectorAll(`.${p}-att-x`).forEach(btn=>{
          btn.addEventListener("click",async()=>{
            const rid=(btn as HTMLElement).dataset.id||"";
            const nextIds=(task.attachmentIds||[]).filter(x=>x!==rid);
            (btn as HTMLButtonElement).disabled=true;
            try{
              const res=await fetch(`${baseUrl}/tasks/${task.installId}/task/${task.id}`,{method:"PATCH",...apiOpts(),body:JSON.stringify({attachmentIds:nextIds})});
              if(!res.ok) throw new Error(`HTTP ${res.status}`);
              task.attachmentIds=nextIds; renderAttachments(task);
            }catch(e:any){ showError(`Could not remove: ${e.message}`); (btn as HTMLButtonElement).disabled=false; }
          });
        });
      }

      // ── Detail content ──────────────────────────────────────────────────
      let detailTask: Task|null = null;

      function openDetail(task:Task){
        detailTask=task;
        const isWide=window.innerWidth>=720;
        detailEl.classList.toggle("side",isWide);
        renderDetailContent(task);
        overlayEl.classList.add("open");
        void detailEl.offsetWidth; // commit the closed (centered) state so the first open animates from it, not from the bottom
        requestAnimationFrame(()=>detailEl.classList.add("open"));
      }
      function closeDetail(){
        overlayEl.classList.remove("open"); detailEl.classList.remove("open");
        detailEl.style.bottom=""; detailTask=null;
      }

      function renderDetailContent(task:Task){
        const done=isDone(task.status);
        const dueInfo=formatDate(task.dueDate);
        const typeCol=task.taskType?typeColor(task.taskType):"";
        const typeText=task.taskType?contrastColor(typeCol):"";
        const prioCol=priorityColor(task.priority);
        const cleanDesc=task.description?stripTags(task.description):"";

        detailBadges.innerHTML=`
          ${task.taskType?`<span class="${p}-type-badge" style="background:${typeCol};color:${typeText}" dir="auto">${esc(ct(task.taskType))}</span>`:""}
          ${task.isRecurring?`<span class="${p}-recur-badge">${iconRecur}${tr("recurring")}</span>`:""}
          ${(task.priority&&task.priority!=="Priority_3")?`<span class="${p}-prio-badge" style="color:${prioCol};border-color:${prioCol}">${prioLabel(task.priority)}</span>`:""}`;

        const groupRows=task.groupIds.map(gid=>`<div class="${p}-detail-meta-row">${iGroup} ${esc(groupMap.get(gid)||gid)}</div>`).join("");
        const personRows=task.assigneeIds.map(aid=>`<div class="${p}-detail-meta-row" data-uid="${esc(aid)}">${iUser} <span>${esc(aid)}</span></div>`).join("");

        detailBody.innerHTML=`
          <div class="${p}-detail-title ${done?"done":""}" dir="auto">${esc(ct(task.title))}</div>
          <div class="${p}-detail-meta">
            ${dueInfo.text?`<div class="${p}-detail-meta-row ${dueInfo.overdue&&!done?"overdue":""}">${iCal}${dueInfo.overdue&&!done?tr("overdueLabel")+" · ":tr("dueLabel")+" "}<span dir="auto">${dueInfo.text}</span></div>`:""}
            ${groupRows}${personRows}
          </div>
          ${cleanDesc
            ? `<div class="${p}-detail-desc-label">${tr("description")}</div><div class="${p}-detail-desc" dir="auto">${esc(ct(cleanDesc))}</div>`
            : `<div class="${p}-detail-desc empty">${tr("noDescription")}</div>`}
          <div class="${p}-att">
            <div class="${p}-att-head">
              <span class="${p}-att-label">${tr("attachments")}</span>
              <label class="${p}-att-add" id="${p}-att-add-${instId}" for="${p}-att-input-${instId}">${iClip} ${tr("add")}</label>
            </div>
            <div class="${p}-att-grid" id="${p}-att-grid-${instId}"></div>
            <input type="file" multiple class="${p}-cmt-file" id="${p}-att-input-${instId}">
          </div>
          ${enableComments?`
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
          </div>`:""}
        `;

        // Footer toggle button
        const iconUndo=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`;
        const iconChk=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        if(done){ detailToggle.className=`${p}-detail-toggle-btn open-btn`; detailToggle.innerHTML=`${iconUndo} ${tr("reopen")}`; }
        else    { detailToggle.className=`${p}-detail-toggle-btn done-btn`; detailToggle.innerHTML=`${iconChk} ${tr("markDone")}`; }

        renderAttachments(task);

        // Resolve assignee IDs → names (avatars too).
        detailBody.querySelectorAll(`.${p}-detail-meta-row[data-uid]`).forEach(row=>{
          const uid=(row as HTMLElement).dataset.uid||"";
          fetchUser(uid).then(u=>{
            if(detailTask!==task) return;
            const s=row.querySelector("span"); if(s&&u.name) s.textContent=u.name;
            if(u.avatar){ const svg=row.querySelector("svg"); if(svg){ const img=document.createElement("img"); img.className=`${p}-detail-meta-av`; img.src=u.avatar; img.alt=""; svg.replaceWith(img); } }
          });
        });

        if(enableComments){
          renderComments(task);
          if(currentUserId) fetchUser(currentUserId).then(me=>{ if(detailTask!==task) return; const slot=detailBody.querySelector(`#${p}-cmt-me-${instId}`) as HTMLElement|null; if(slot) slot.innerHTML=avatarHtml(me); });
          wireCompose(task);
        }
      }

      function wireCompose(task:Task){
        const cInput=detailBody.querySelector(`#${p}-cmt-input-${instId}`) as HTMLTextAreaElement|null;
        const cSend =detailBody.querySelector(`#${p}-cmt-send-${instId}`) as HTMLButtonElement|null;
        const cBar  =detailBody.querySelector(`#${p}-cmt-bar-${instId}`)  as HTMLElement|null;
        const cAttach=detailBody.querySelector(`#${p}-cmt-attach-${instId}`) as HTMLButtonElement|null;
        const cFile =detailBody.querySelector(`#${p}-cmt-file-${instId}`)  as HTMLInputElement|null;
        const cChips=detailBody.querySelector(`#${p}-cmt-chips-${instId}`) as HTMLElement|null;
        if(!cInput||!cSend) return;
        const pending:Array<{id:string;url:string;name:string}> = [];
        const hasContent=()=>!!(cInput.value.trim()||pending.length);
        const updateSendVisibility=()=>{ if(cBar) cBar.classList.toggle("show", document.activeElement===cInput || hasContent()); cSend.classList.toggle("show", hasContent()); };
        const isTouch=(()=>{try{return window.matchMedia("(pointer:coarse)").matches;}catch(_){return "ontouchstart" in window;}})();
        cInput.addEventListener("focus",()=>{ cBar?.classList.add("show"); if(!isTouch) return; detailBody.style.paddingBottom="55vh"; setTimeout(()=>cInput.scrollIntoView({block:"center",behavior:"smooth"}),350); });
        cInput.addEventListener("blur",()=>{ setTimeout(()=>{ if(isTouch) detailBody.style.paddingBottom=""; if(!hasContent()) cBar?.classList.remove("show"); },200); });
        cSend.addEventListener("mousedown",e=>e.preventDefault());
        const renderChips=()=>{
          if(!cChips) return;
          cChips.innerHTML=pending.map((f,i)=>`<span class="${p}-cmt-chip"><span>${esc(f.name)}</span><button type="button" data-idx="${i}">${iXsmall}</button></span>`).join("");
          cChips.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{ const idx=parseInt((b as HTMLElement).dataset.idx||"-1",10); if(idx>=0){ pending.splice(idx,1); renderChips(); updateSendVisibility(); } }));
        };
        cInput.addEventListener("input",()=>{ cInput.style.height="auto"; cInput.style.height=Math.min(cInput.scrollHeight,140)+"px"; updateSendVisibility(); });
        cFile?.addEventListener("change",async()=>{
          const files=Array.from(cFile.files||[]); cFile.value=""; if(!files.length) return;
          const tooBig=files.find(f=>f.size>MEDIA_MAX); if(tooBig){ showError(`"${tooBig.name}" exceeds ${humanSize(MEDIA_MAX)}.`); return; }
          if(cAttach) cAttach.disabled=true;
          try{ for(const f of files){ const m=await uploadMedia(f); pending.push({id:m.id,url:m.url,name:f.name}); } }
          catch(e:any){ showError(`Upload failed: ${e.message}`); }
          if(cAttach) cAttach.disabled=false; renderChips(); updateSendVisibility();
        });
        const submit=async()=>{
          const text=cInput.value.trim();
          if((!text&&!pending.length)) return;
          cSend.disabled=true; cInput.disabled=true;
          let ok=false;
          try{
            const tokens=pending.map(f=>`[attachment:${f.id}]`).join(" ");
            const full=[text,tokens].filter(Boolean).join(text&&tokens?"\n":"");
            await postComment(task,full);
            if(pending.length){
              const nextIds=[...(task.attachmentIds||[]),...pending.map(f=>f.id)];
              try{ await fetch(`${baseUrl}/tasks/${task.installId}/task/${task.id}`,{method:"PATCH",...apiOpts(),body:JSON.stringify({attachmentIds:nextIds})}); task.attachmentIds=nextIds; renderAttachments(task); }catch(_){}
            }
            cInput.value=""; cInput.style.height="auto"; pending.length=0; renderChips();
            cSend.classList.remove("show"); cBar?.classList.remove("show");
            await renderComments(task); ok=true;
          }catch(e:any){ showError(`Couldn't post comment: ${e.message}`); }
          cSend.disabled=false; cInput.disabled=false;
          if(ok) cInput.blur(); else cInput.focus();
        };
        cSend.addEventListener("click",submit);
        cInput.addEventListener("keydown",e=>{ if((e.metaKey||e.ctrlKey)&&e.key==="Enter") submit(); });
      }

      // ── Content translate toggle ────────────────────────────────────────
      function updateTranslateBtn(){ const lbl=container.querySelector(`#${p}-translate-lbl`); if(lbl) lbl.textContent=translateBusy?tr("translating"):contentTranslated?tr("showOriginal"):tr("translateBtn"); }
      async function toggleTranslate(){
        if(translateBusy) return;
        if(!contentTranslated){
          const texts:string[]=[];
          for(const t of tasks){ if(!t.ok) continue; if(t.title) texts.push(t.title); if(t.taskType) texts.push(t.taskType); const cd=t.description?stripTags(t.description):""; if(cd) texts.push(cd); }
          if(texts.length){ translateBusy=true; updateTranslateBtn(); const map=await translateMap(texts, translateSend); Object.assign(ctCache, map); translateBusy=false; }
          contentTranslated=true;
        } else { contentTranslated=false; }
        updateTranslateBtn(); render();
        if(detailTask) renderDetailContent(detailTask);
      }

      // ── List ────────────────────────────────────────────────────────────
      function rowHtml(t:Task){
        const done=isDone(t.status);
        const dueInfo=formatDate(t.dueDate);
        const typeCol=t.taskType?typeColor(t.taskType):"";
        const typeText=t.taskType?contrastColor(typeCol):"";
        const meta:string[]=[];
        if(t.taskType) meta.push(`<span class="${p}-row-badge" style="background:${typeCol};color:${typeText}" dir="auto">${esc(ct(t.taskType))}</span>`);
        if(t.isRecurring) meta.push(`<span class="${p}-recur-badge">${iconRecur}${tr("recurring")}</span>`);
        if(dueInfo.text) meta.push(`<span class="${p}-row-due${dueInfo.overdue&&!done?" overdue":""}">${iCal}${dueInfo.overdue&&!done?`${tr("overdueLabel")} · ${esc(dueInfo.text)}`:esc(dueInfo.text)}</span>`);
        return `<div class="${p}-row${done?" done":""}" data-id="${esc(t.id)}" data-inst="${esc(t.installId)}">
          <div class="${p}-check-wrap">
            <button type="button" class="${p}-check${done?" checked":""}" aria-label="${esc(tr("toggleTask"))}"${allowToggle?"":" disabled"}>
              <span class="${p}-check-icon">${iconCheck}</span>
            </button>
          </div>
          <div class="${p}-row-main">
            <span class="${p}-row-title" dir="auto">${esc(ct(t.title))}</span>
            ${meta.length?`<div class="${p}-row-meta">${meta.join("")}</div>`:""}
          </div>
        </div>`;
      }
      // Same "mine" match as the My Tasks widget: direct assignment or via a group I'm in.
      function isMyTask(t:Task):boolean{
        if(!currentUserId) return true;
        const direct=t.assigneeIds.indexOf(currentUserId)!==-1;
        const grp=t.groupIds.some(gid=>userGroupIds.indexOf(gid)!==-1);
        return direct||grp;
      }
      function render(){
        const visible=tasks.filter(t=>t.ok && (showCompleted || !isDone(t.status)) && (!onlyMine || isMyTask(t)));
        if(!visible.length){ listEl.innerHTML=`<div class="${p}-state">${refs.length?tr("empty"):tr("noneConfigured")}</div>`; return; }
        listEl.innerHTML=visible.map(rowHtml).join("");
        listEl.querySelectorAll(`.${p}-row`).forEach(row=>{
          const id=(row as HTMLElement).dataset.id!, inst=(row as HTMLElement).dataset.inst!;
          const t=tasks.find(x=>x.id===id&&x.installId===inst);
          const check=row.querySelector(`.${p}-check`) as HTMLButtonElement;
          if(allowToggle&&check) check.addEventListener("click",e=>{ e.stopPropagation(); toggle(check); });
          row.addEventListener("click",()=>{ if(t) openDetail(t); });
        });
      }
      async function toggle(btn:HTMLButtonElement){
        const row=btn.closest(`.${p}-row`) as HTMLElement;
        const t=tasks.find(x=>x.id===row.dataset.id&&x.installId===row.dataset.inst); if(!t) return;
        const done=isDone(t.status); const next=done?"OPEN":"CLOSED";
        const wrap=btn.closest(`.${p}-check-wrap`) as HTMLElement;
        if(!done && requireProof){
          btn.disabled=true;
          const ok=await openProof(t);
          btn.disabled=false;
          if(!ok) return;
        }
        btn.classList.remove("pop-done","pop-undone"); void btn.offsetWidth; btn.classList.add(done?"pop-undone":"pop-done");
        if(!done){ btn.classList.add("checked"); row.classList.add("done"); spawnSparks(wrap,primaryColor); } else { btn.classList.remove("checked"); row.classList.remove("done"); }
        btn.disabled=true;
        try{
          const res=await fetch(`${baseUrl}/tasks/${t.installId}/task/${t.id}`,{method:"PATCH",...apiOpts(),body:JSON.stringify({status:next})});
          if(!res.ok) throw new Error(`HTTP ${res.status}`);
          t.status=next;
          // Record the status change so it surfaces in the activity feed / calendar.
          postEditComment(t, `${next==="CLOSED"?"completed":"reopened"} “${t.title}”`);
          if(detailTask===t) renderDetailContent(t);
          if(!showCompleted && next==="CLOSED") setTimeout(render,420);
        }catch(e:any){
          if(!done){ btn.classList.remove("checked"); row.classList.remove("done"); } else { btn.classList.add("checked"); row.classList.add("done"); }
          showError(tr("errorToggle"));
        }
        if(allowToggle) btn.disabled=false;
      }

      // ── Locale ──────────────────────────────────────────────────────────
      async function applyLocale(){
        const available=Object.keys(STRINGS);
        let configLocale="";
        try{
          const prof:any=await widgetApi.getUserInformation();
          currentUserId=prof?.id||"";
          userGroupIds=prof?.groupIDs||[];
          if(currentUserId){ const r=await fetch(`${baseUrl}/users/${currentUserId}`,apiOpts()); if(r.ok){ const u=await r.json(); configLocale=(u?.config?.locale)||""; } }
        }catch(_){}
        locale=detectLocale({ configLocale, available }); tr=makeT(STRINGS, locale);
        const rtl=isRtl(locale); const dir=rtl?"rtl":"ltr";
        try{ container.setAttribute("dir",dir); }catch(_){}
        try{ overlayEl.setAttribute("dir",dir); detailEl.setAttribute("dir",dir); attModal.setAttribute("dir",dir); }catch(_){}
        // Translate button only meaningful off the default locale.
        if(locale!==DEFAULT_LOCALE){ topEl.style.display=""; updateTranslateBtn(); const b=container.querySelector(`#${p}-translate`); if(b) b.addEventListener("click",toggleTranslate); }
        else topEl.style.display="none";
      }

      // ── Load ────────────────────────────────────────────────────────────
      async function load(){
        await applyLocale();
        if(!refs.length){ listEl.innerHTML=`<div class="${p}-state">${tr("noneConfigured")}</div>`; return; }
        const needGroups=true; // groups resolved lazily; fetch once up front (cheap)
        if(needGroups) fetchGroups();
        tasks=await Promise.all(refs.map(async (r):Promise<Task>=>{
          const base:Task={ id:r.taskId, installId:r.installId, title:"", description:"", status:"", dueDate:null, priority:"Priority_3", taskType:null, isRecurring:false, groupIds:[], assigneeIds:[], attachmentIds:[], ok:false };
          try{
            const res=await fetch(`${baseUrl}/tasks/${r.installId}/task/${r.taskId}`,apiOpts());
            if(!res.ok) return base;
            const d:any=await res.json();
            const desc=d.description||"";
            const rawType=parseTaskType(d.title||"")||parseTaskType(desc);
            const isTemplate=rawType===RECUR_TEMPLATE_TYPE;
            return { id:d.id||r.taskId, installId:r.installId,
              title:stripTags(d.title||"")||"(untitled)", description:desc, status:d.status||"OPEN",
              dueDate:d.dueDate||null, priority:d.priority||"Priority_3",
              taskType:isTemplate?null:rawType, isRecurring:isTemplate||RECUR_REGEX.test(desc),
              groupIds:d.groupIds||[], assigneeIds:d.assigneeIds||[], attachmentIds:d.attachmentIds||[], ok:true };
          }catch(_){ return base; }
        }));
        render();
      }

      load();
    }
  };
};

// ── Block registration ──────────────────────────────────────────────────────────────

const blockDefinition: BlockDefinition = {
  name: "simple-task-widget",
  label: "Simple Tasks Widget",
  attributes: ["apitoken","baseurl","tasklist","showcompleted","allowtoggle","enablecomments","requirephotoproof","onlyassignedtome","usethemecolors","primarycolor","accentcolor","backgroundcolor","limitheight","maxheight"],
  factory, configurationSchema, uiSchema, blockLevel: "block",
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48Y2lyY2xlIGN4PSI4NS41IiBjeT0iODUuNSIgcj0iODUuNSIgZmlsbD0iIzE2QTM0QSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQzLjUgNDMuNSkgc2NhbGUoMy41KSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIxIDEwLjVWMTlhMiAyIDAgMCAxLTIgMkg1YTIgMiAwIDAgMS0yLTJWNWEyIDIgMCAwIDEgMi0yaDEyLjUiLz48cGF0aCBkPSJtOSAxMSAzIDNMMjIgNCIvPjwvZz48L3N2Zz4=",
};

window.defineBlock({ blockDefinition, author: "Staffbase", version: "1.0.0" } as ExternalBlockDefinition);
