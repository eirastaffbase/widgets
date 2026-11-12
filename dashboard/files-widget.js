/**
 * Staffbase external block: Files. Dashboard variant of
 * gabriellebenak-arch/staffbase-dashboard-demo (ee43a892).
 *
 * Staffbase has no file-list block, so this is one. Same glass treatment and
 * type scale as the calendar block so the two sit together on a page.
 */
(function () {
  var P = "sbfl";

  var DEFAULT_FILES = [
    "Payslip - October 2026 | PDF | Added 25 Oct",
    "Employment contract | PDF | Added 12 Mar",
    "Benefits guide 2027 | PDF | Updated 1 Nov",
    "Expense policy | DOCX | Updated 18 Sep",
    "Org chart | PDF | Updated 2 Nov",
    "Remote work policy | PDF | Updated 14 Aug"
  ].join("\n");

  var DEMO_LISTS = [
    {
      locale: "en-US", added: "Added ", updated: "Updated ",
      names: ["Payslip - October 2026", "Employment contract", "Benefits guide 2027", "Expense policy", "Org chart", "Remote work policy"],
      dates: ["Added 25 Oct", "Added 12 Mar", "Updated 1 Nov", "Updated 18 Sep", "Updated 2 Nov", "Updated 14 Aug"]
    },
    {
      locale: "de-DE", added: "Hinzugefügt am ", updated: "Aktualisiert am ",
      names: ["Gehaltsabrechnung - Oktober 2026", "Arbeitsvertrag", "Leitfaden zu Zusatzleistungen 2027", "Spesenrichtlinie", "Organigramm", "Richtlinie für mobiles Arbeiten"],
      dates: ["Hinzugefügt am 25. Okt.", "Hinzugefügt am 12. März", "Aktualisiert am 1. Nov.", "Aktualisiert am 18. Sept.", "Aktualisiert am 2. Nov.", "Aktualisiert am 14. Aug."]
    },
    {
      locale: "es-ES", added: "Añadido el ", updated: "Actualizado el ",
      names: ["Nómina - octubre de 2026", "Contrato de trabajo", "Guía de prestaciones 2027", "Política de gastos", "Organigrama", "Política de trabajo a distancia"],
      dates: ["Añadido el 25 oct.", "Añadido el 12 mar.", "Actualizado el 1 nov.", "Actualizado el 18 sept.", "Actualizado el 2 nov.", "Actualizado el 14 ago."]
    },
    {
      locale: "fr-FR", added: "Ajouté le ", updated: "Mis à jour le ",
      names: ["Bulletin de paie - octobre 2026", "Contrat de travail", "Guide des avantages sociaux 2027", "Politique de frais", "Organigramme", "Politique de télétravail"],
      dates: ["Ajouté le 25 oct.", "Ajouté le 12 mars", "Mis à jour le 1 nov.", "Mis à jour le 18 sept.", "Mis à jour le 2 nov.", "Mis à jour le 14 août"]
    },
    {
      locale: "nl-NL", added: "Toegevoegd op ", updated: "Bijgewerkt op ",
      names: ["Loonstrook - oktober 2026", "Arbeidsovereenkomst", "Gids arbeidsvoorwaarden 2027", "Onkostenbeleid", "Organigram", "Thuiswerkbeleid"],
      dates: ["Toegevoegd op 25 okt.", "Toegevoegd op 12 mrt.", "Bijgewerkt op 1 nov.", "Bijgewerkt op 18 sep.", "Bijgewerkt op 2 nov.", "Bijgewerkt op 14 aug."]
    }
  ];

  // Muted fills: enough to tell the types apart without fighting the glass.
  var TINTS = {
    PDF:  ["#fdeaea", "#c0392b"],
    DOC:  ["#e8eefb", "#2d6cdf"],
    DOCX: ["#e8eefb", "#2d6cdf"],
    XLS:  ["#e7f4ec", "#1e7a4a"],
    XLSX: ["#e7f4ec", "#1e7a4a"],
    PPT:  ["#fdf0e3", "#c2610f"],
    PPTX: ["#fdf0e3", "#c2610f"],
    ZIP:  ["#efeaff", "#6b4de0"],
    IMG:  ["#eaf6fb", "#1f7f9c"]
  };

  // Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com
  // Copyright 2024 Fonticons, Inc. Icons: CC BY 4.0 - https://fontawesome.com/license/free
  var FILE_ICONS = {
    pdf: [512, "M0 64C0 28.7 28.7 0 64 0L224 0l0 128c0 17.7 14.3 32 32 32l128 0 0 144-208 0c-35.3 0-64 28.7-64 64l0 144-48 0c-35.3 0-64-28.7-64-64L0 64zm384 64l-128 0L256 0 384 128zM176 352l32 0c30.9 0 56 25.1 56 56s-25.1 56-56 56l-16 0 0 32c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-48 0-80c0-8.8 7.2-16 16-16zm32 80c13.3 0 24-10.7 24-24s-10.7-24-24-24l-16 0 0 48 16 0zm96-80l32 0c26.5 0 48 21.5 48 48l0 64c0 26.5-21.5 48-48 48l-32 0c-8.8 0-16-7.2-16-16l0-128c0-8.8 7.2-16 16-16zm32 128c8.8 0 16-7.2 16-16l0-64c0-8.8-7.2-16-16-16l-16 0 0 96 16 0zm80-112c0-8.8 7.2-16 16-16l48 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-32 0 0 32 32 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-32 0 0 48c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-64 0-64z"],
    word: [384, "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM111 257.1l26.8 89.2 31.6-90.3c3.4-9.6 12.5-16.1 22.7-16.1s19.3 6.4 22.7 16.1l31.6 90.3L273 257.1c3.8-12.7 17.2-19.9 29.9-16.1s19.9 17.2 16.1 29.9l-48 160c-3 10-12 16.9-22.4 17.1s-19.8-6.2-23.2-16.1L192 336.6l-33.3 95.3c-3.4 9.8-12.8 16.3-23.2 16.1s-19.5-7.1-22.4-17.1l-48-160c-3.8-12.7 3.4-26.1 16.1-29.9s26.1 3.4 29.9 16.1z"],
    excel: [384, "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM155.7 250.2L192 302.1l36.3-51.9c7.6-10.9 22.6-13.5 33.4-5.9s13.5 22.6 5.9 33.4L221.3 344l46.4 66.2c7.6 10.9 5 25.8-5.9 33.4s-25.8 5-33.4-5.9L192 385.8l-36.3 51.9c-7.6 10.9-22.6 13.5-33.4 5.9s-13.5-22.6-5.9-33.4L162.7 344l-46.4-66.2c-7.6-10.9-5-25.8 5.9-33.4s25.8-5 33.4 5.9z"],
    powerpoint: [384, "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM136 240l68 0c42 0 76 34 76 76s-34 76-76 76l-44 0 0 32c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-56 0-104c0-13.3 10.7-24 24-24zm68 104c15.5 0 28-12.5 28-28s-12.5-28-28-28l-44 0 0 56 44 0z"],
    zipper: [384, "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM96 48c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16zm0 64c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16zm0 64c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16zm-6.3 71.8c3.7-14 16.4-23.8 30.9-23.8l14.8 0c14.5 0 27.2 9.7 30.9 23.8l23.5 88.2c1.4 5.4 2.1 10.9 2.1 16.4c0 35.2-28.8 63.7-64 63.7s-64-28.5-64-63.7c0-5.5 .7-11.1 2.1-16.4l23.5-88.2zM112 336c-8.8 0-16 7.2-16 16s7.2 16 16 16l32 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-32 0z"],
    image: [384, "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM64 256a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm152 32c5.3 0 10.2 2.6 13.2 6.9l88 128c3.4 4.9 3.7 11.3 1 16.5s-8.2 8.6-14.2 8.6l-88 0-40 0-48 0-48 0c-5.8 0-11.1-3.1-13.9-8.1s-2.8-11.2 .2-16.1l48-80c2.9-4.8 8.1-7.8 13.7-7.8s10.8 2.9 13.7 7.8l12.8 21.4 48.3-70.2c3-4.3 7.9-6.9 13.2-6.9z"],
    file: [384, "M0 64C0 28.7 28.7 0 64 0L224 0l0 128c0 17.7 14.3 32 32 32l128 0 0 288c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 64zm384 64l-128 0L256 0 384 128z"]
  };
  var ICON_KINDS = {
    PDF: "pdf", DOC: "word", DOCX: "word", XLS: "excel", XLSX: "excel",
    PPT: "powerpoint", PPTX: "powerpoint", ZIP: "zipper", IMG: "image"
  };

  function fileKind(name, type, url) {
    var match = (url ? new URL(url).pathname : "").match(/\.([a-z0-9]+)$/i) ||
      String(name).match(/\.([a-z0-9]+)$/i);
    var kind = (type || (match ? match[1] : "FILE")).toUpperCase();
    return /^(JPE?G|PNG|GIF|WEBP|SVG|AVIF|BMP|TIFF?)$/.test(kind) ? "IMG" : kind;
  }

  function fileIcon(kind) {
    var name = ICON_KINDS[kind] || "file", icon = FILE_ICONS[name];
    return '<svg data-file-icon="' + name + '" role="img" aria-label="' + esc(kind) +
      '" focusable="false" viewBox="0 0 ' + icon[0] + ' 512"><path d="' + icon[1] + '"></path></svg>';
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /** One per line: "Name | TYPE | meta | url".  url is optional. */
  function parseFiles(raw) {
    return String(raw || "").split(/\n+/).map(function (line) {
      var b = line.split("|").map(function (x) { return x.trim(); });
      if (!b[0]) return null;
      return {
        name: b[0],
        kind: (b[1] || "").toUpperCase(),
        meta: b[2] || "",
        url:  b[3] || ""
      };
    }).filter(Boolean);
  }

  function refreshDemoDates(files) {
    // Keep the original demo dates rolling even when more files are appended.
    var demo = DEMO_LISTS.find(function (copy) {
      return files.length >= copy.names.length && files.slice(0, copy.names.length).every(function (file, i) {
        return file.name === copy.names[i] && file.meta === copy.dates[i] &&
          file.kind === (i === 3 ? "DOCX" : "PDF") && !file.url;
      });
    });
    if (!demo) return files;
    var now = new Date();
    var payDate = new Date(now.getFullYear(), now.getMonth(), 15);
    if (payDate > now) payDate.setMonth(payDate.getMonth() - 1);
    var month = new Intl.DateTimeFormat(demo.locale, { month: "long", year: "numeric" });
    var date = new Intl.DateTimeFormat(demo.locale, { day: "numeric", month: "short" });
    var offsets = [0, -210, -11, -55, -10, -90];
    return files.map(function (file, i) {
      if (i >= demo.names.length) return file;
      var when = new Date(now);
      when.setDate(when.getDate() + offsets[i]);
      if (i === 0) {
        when = payDate;
        file.name = file.name.slice(0, file.name.indexOf(" - ") + 3) + month.format(payDate);
      }
      if (i === 2) file.name = file.name.replace("2027", String(now.getFullYear() + 1));
      file.meta = (i < 2 ? demo.added : demo.updated) + date.format(when);
      return file;
    });
  }

  var CSS = [
    "." + P + "-root{--rim:rgba(255,255,255,.62);--ink:var(--rp-dashboard-ink,#2b2f33);--mute:var(--rp-dashboard-muted,#5c6660);",
    "--line:rgba(120,128,138,.18);font-family:inherit;color:var(--ink);padding:16px;",
    "border-radius:20px;background:linear-gradient(150deg,rgba(255,255,255,.36),rgba(255,255,255,.17));",
    "-webkit-backdrop-filter:blur(34px) saturate(200%);backdrop-filter:blur(34px) saturate(200%);",
    "border:1px solid var(--rim);text-shadow:0 1px 1px rgba(255,255,255,.5);",
    "box-shadow:0 8px 26px rgba(31,38,48,.10),inset 0 1px 0 rgba(255,255,255,.8),",
    "inset 0 -1px 0 rgba(255,255,255,.22)}",
    "." + P + "-root *{box-sizing:border-box}",
    "." + P + "-hd{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px}",
    "." + P + "-hd h3{margin:0;font-size:14px;font-weight:650;letter-spacing:.01em}",
    "." + P + "-hd a{font-size:12px;font-weight:600;color:var(--rp-dashboard-accent-ink,#2f5d4a);text-underline-offset:3px}",
    "." + P + "-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr));gap:6px}",
    "." + P + "-f{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:11px;",
    "border:0;background:transparent;font-family:inherit;text-align:left;width:100%;",
    "text-decoration:none;color:inherit;min-height:44px;transition:background .15s}",
    "a." + P + "-f{cursor:pointer}",
    "a." + P + "-f:hover{background:rgba(255,255,255,.55)}",
    "." + P + "-root a:focus-visible{outline:2px solid var(--rp-dashboard-accent-ink,#2f5d4a);outline-offset:2px}",
    "." + P + "-ic{flex:none;width:34px;height:34px;border-radius:10px;display:flex;",
    "align-items:center;justify-content:center;font-size:9px;font-weight:700;letter-spacing:.03em}",
    "." + P + "-ic svg{width:18px!important;height:22px!important;max-width:none!important;display:block!important}",
    "." + P + "-ic svg path{fill:currentColor!important}",
    "." + P + "-tx{min-width:0;flex:1}",
    "." + P + "-tx b{display:block;font-size:13px;font-weight:600;line-height:1.3;",
    "overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "." + P + "-tx span{font-size:11px;color:var(--mute)}",
    "." + P + "-ch{flex:none;color:var(--mute);width:16px;height:16px}",
    "." + P + "-empty{font-size:13px;color:var(--mute);margin:8px 0 0}"
  ].join("");

  function safeLink(raw) {
    if (!raw) return "";
    var url;
    try { url = new URL(raw, location.href); }
    catch (error) {
      if (!(error instanceof TypeError)) throw error;
      console.warn("[Dashboard Files] Invalid link; link disabled.");
      return "";
    }
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    console.warn("[Dashboard Files] Unsupported link protocol; link disabled.");
    return "";
  }

  var ATTRS = ["widgettitle", "files", "alllink", "seelabel"];

  var configurationSchema = {
    properties: {
      widgettitle: { type: "string", title: "Heading", default: "My Files" },
      alllink:     { type: "string", title: "“See all” link (optional)", default: "" },
      files:       { type: "string", title: "Files", default: DEFAULT_FILES },
      seelabel:    { type: "string", title: "See all label", default: "See all" }
    }
  };

  var uiSchema = {
    files: {
      "ui:widget": "textarea",
      "ui:help": "One per line:  Name | TYPE | meta | url    (url optional). Leave TYPE blank to detect it from the link or filename, or use PDF, DOCX, XLSX, PPTX, ZIP or IMG. Unchanged demo lists use rolling dates; custom entries stay as entered."
    }
  };

  var factory = function (BaseBlockClass) {
    return class FilesWidget extends BaseBlockClass {
      renderBlock(container) {
        var files = refreshDemoDates(parseFiles(this.getAttribute("files") || DEFAULT_FILES));
        var title = this.getAttribute("widgettitle") || "My Files";
        var all = safeLink((this.getAttribute("alllink") || "").trim());
        var seeLabel = this.getAttribute("seelabel") || "See all";

        var rows = files.length ? files.map(function (f) {
          var link = safeLink(f.url);
          var kind = fileKind(f.name, f.kind, link);
          var t = TINTS[kind] || ["#eceef1", "#5b6169"];
          var tag = link ? "a" : "div";
          var attr = link ? ' href="' + esc(link) + '" target="_blank" rel="noopener noreferrer"' : "";
          return "<" + tag + ' class="' + P + '-f"' + attr + ">" +
            '<span class="' + P + '-ic" style="background:' + t[0] + ";color:" + t[1] + '">' +
              fileIcon(kind) + "</span>" +
            '<span class="' + P + '-tx"><b>' + esc(f.name) + "</b>" +
              (f.meta ? "<span>" + esc(f.meta) + "</span>" : "") + "</span>" +
            (link ? '<svg aria-hidden="true" class="' + P + '-ch" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>' : "") +
          "</" + tag + ">";
        }).join("") : '<p class="' + P + '-empty">No files yet.</p>';

        container.innerHTML = "<style>" + CSS + "</style>" +
          '<div class="' + P + '-root">' +
            '<div class="' + P + '-hd"><h3>' + esc(title) + "</h3>" +
              (all ? '<a href="' + esc(all) + '">' + esc(seeLabel) + "</a>" : "") + "</div>" +
            '<div class="' + P + '-grid">' + rows + "</div>" +
          "</div>";
      }

      static get observedAttributes() { return ATTRS; }
    };
  };

  window.defineBlock({
    blockDefinition: {
      name: "replify-dashboard-files",
      label: "Files",
      attributes: ATTRS,
      factory: factory,
      configurationSchema: configurationSchema,
      uiSchema: uiSchema,
      blockLevel: "block",
      iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='10' fill='%232d6cdf'/%3E%3Cg fill='%23fff'%3E%3Cpath d='M13 9h9l6 6v16H13z'/%3E%3C/g%3E%3Cpath d='M22 9l6 6h-6z' fill='%23bcd2f5'/%3E%3C/svg%3E"
    },
    author: "Staffbase",
    version: "1.0.0"
  });
})();
