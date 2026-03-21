/*
  Industry Switcher Widget
  ========================
  Auth: widgetApi.getUserInformation() for user ID (SDK-native, mobile-safe)
        Basic auth API key for group PATCH calls (bypasses mobile cookie issues)

  Debug mode: enable "Debug Mode" in widget config to see a live log panel
              showing every API call, status code, and response body.

  Build: npm run build → dist/industry-switcher.js
*/

import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from "@staffbase/widget-sdk";

import { JSONSchema7 } from "json-schema";
import { UiSchema } from "@rjsf/utils";

/* ============================================================
   API KEY — Basic auth for group membership PATCH calls.
   Bypasses mobile webview cookie auth issues.
   (Showcase-only env; not a multi-tenant secret.)
   ============================================================ */
const API_KEY =
  "NjliZGQ4YjU1MjIyMjU1YjEyODRmZmNmOl14XU83ciFeLE9rRUZjV1BaZ1E1KE82JDFrIVNTeGxVWFQoSVRfNGhlQ3h7RXRNfTt4Ym9YQ2JuQ1tHIVBoQTI=";

/* ============================================================
   INDUSTRY STATIC CONFIG
   ============================================================ */
const INDUSTRY_CONFIG = [
  {
    name: "Manufacturing",
    groupAttr: "manufacturinggroupid",
    pathAttr: "manufacturingpath",
    defaultGroupId: "69672894afdf7d24c5feaafd",
    defaultPath: "/content/page/6912676de1744e7a2d2e4065",
  },
  {
    name: "Education",
    groupAttr: "educationgroupid",
    pathAttr: "educationpath",
    defaultGroupId: "69672db75cff0a6a031724d7",
    defaultPath: "/content/page/6912a1cf36f42e0f440cd6c4",
  },
  {
    name: "Financial Services",
    groupAttr: "financialservicesgroupid",
    pathAttr: "financialservicespath",
    defaultGroupId: "69672f84a2c10951567a0552",
    defaultPath: "in progress",
  },
  {
    name: "Healthcare",
    groupAttr: "healthcaregroupid",
    pathAttr: "healthcarepath",
    defaultGroupId: "69535e6338dc171a511fecbe",
    defaultPath: "/content/page/6912a1919fd60b3f5591c8b1",
  },
  {
    name: "Retail",
    groupAttr: "retailgroupid",
    pathAttr: "retailpath",
    defaultGroupId: "69672fbaafdf7d24c5feef0c",
    defaultPath: "/content/page/69129eb69ea6a346d249dac6",
  },
  {
    name: "Futures",
    groupAttr: "futuresgroupid",
    pathAttr: "futurespath",
    defaultGroupId: "69673076a2c10951567a0db5",
    defaultPath: "in progress",
  },
];

const IN_PROGRESS = "in progress";

const ALL_ATTRIBUTES = [
  "widgettitle",
  "debugmode",
  ...INDUSTRY_CONFIG.flatMap((i) => [i.groupAttr, i.pathAttr]),
];

/* ============================================================
   SCHEMA
   ============================================================ */
const configurationSchema: JSONSchema7 = {
  properties: {
    widgettitle: {
      type: "string",
      title: "Widget Title",
    },
    debugmode: {
      type: "boolean",
      title: "Debug Mode",
      default: false,
    },

    manufacturinggroupid: {
      type: "string",
      title: "Manufacturing — Group ID",
      default: "69672894afdf7d24c5feaafd",
    },
    manufacturingpath: {
      type: "string",
      title: "Manufacturing — Page Path",
      default: "/content/page/6912676de1744e7a2d2e4065",
    },

    educationgroupid: {
      type: "string",
      title: "Education — Group ID",
      default: "69672db75cff0a6a031724d7",
    },
    educationpath: {
      type: "string",
      title: "Education — Page Path",
      default: "/content/page/6912a1cf36f42e0f440cd6c4",
    },

    financialservicesgroupid: {
      type: "string",
      title: "Financial Services — Group ID",
      default: "69672f84a2c10951567a0552",
    },
    financialservicespath: {
      type: "string",
      title: "Financial Services — Page Path",
      default: "in progress",
    },

    healthcaregroupid: {
      type: "string",
      title: "Healthcare — Group ID",
      default: "69535e6338dc171a511fecbe",
    },
    healthcarepath: {
      type: "string",
      title: "Healthcare — Page Path",
      default: "/content/page/6912a1919fd60b3f5591c8b1",
    },

    retailgroupid: {
      type: "string",
      title: "Retail — Group ID",
      default: "69672fbaafdf7d24c5feef0c",
    },
    retailpath: {
      type: "string",
      title: "Retail — Page Path",
      default: "/content/page/69129eb69ea6a346d249dac6",
    },

    futuresgroupid: {
      type: "string",
      title: "Futures — Group ID",
      default: "69673076a2c10951567a0db5",
    },
    futurespath: {
      type: "string",
      title: "Futures — Page Path",
      default: "in progress",
    },
  },
};

const uiSchema: UiSchema = {
  widgettitle: {
    "ui:help": "Optional heading shown above the industry cards",
  },
  debugmode: {
    "ui:help":
      "Show a live API log panel below the cards — useful for diagnosing mobile issues",
  },
  manufacturingpath: {
    "ui:help": 'Page path, or type "in progress" to show Under Construction',
  },
  educationpath: {
    "ui:help": 'Page path, or type "in progress" to show Under Construction',
  },
  financialservicespath: {
    "ui:help": 'Page path, or type "in progress" to show Under Construction',
  },
  healthcarepath: {
    "ui:help": 'Page path, or type "in progress" to show Under Construction',
  },
  retailpath: {
    "ui:help": 'Page path, or type "in progress" to show Under Construction',
  },
  futurespath: {
    "ui:help": 'Page path, or type "in progress" to show Under Construction',
  },
};

/* ============================================================
   FACTORY
   ============================================================ */
const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  return class IndustrySwitcher extends BaseBlockClass implements BaseBlock {
    private isProcessing = false;
    private debugLogs: string[] = [];

    constructor() {
      super();
    }

    isDebug(): boolean {
      const val = this.getAttribute("debugmode");
      return val === "true" || val === "1";
    }

    getIndustries() {
      return INDUSTRY_CONFIG.map((ind) => {
        const groupId =
          this.getAttribute(ind.groupAttr)?.trim() || ind.defaultGroupId;
        const path =
          this.getAttribute(ind.pathAttr)?.trim() || ind.defaultPath;
        return {
          name: ind.name,
          groupId,
          path,
          disabled: path.toLowerCase() === IN_PROGRESS,
        };
      });
    }

    getIndustryGroupIds(): Set<string> {
      return new Set(this.getIndustries().map((i) => i.groupId));
    }

    async renderBlock(container: HTMLElement) {
      this.debugLogs = [];
      container.innerHTML = this.buildStyles() + this.buildHTML();
      this.attachHandlers(container);
    }

    /* ----------------------------------------------------------
       DEBUG LOGGING
    ---------------------------------------------------------- */
    dbLog(msg: string, level: "info" | "ok" | "err" = "info") {
      const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
      const entry = `[${ts}] ${msg}`;
      console.log("[Switcher]", entry);
      this.debugLogs.push(`<span class="db-${level}">${this.escapeHtml(entry)}</span>`);
    }

    flushDebugPanel(container: HTMLElement) {
      const panel = container.querySelector<HTMLElement>("#sw-debug");
      if (!panel) return;
      panel.innerHTML = this.debugLogs.join("<br>");
      panel.scrollTop = panel.scrollHeight;
    }

    /* ----------------------------------------------------------
       STYLES
    ---------------------------------------------------------- */
    buildStyles(): string {
      return `
        <style>
          .sw-wrap {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 4px 0;
          }
          .sw-heading {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #888;
            margin: 0 0 12px 2px;
          }
          .sw-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .sw-card {
            border-radius: 12px;
            padding: 16px 12px;
            background: #f4f4f4;
            text-align: center;
            border: 2px solid transparent;
            transition: background 0.15s, border-color 0.15s;
            -webkit-tap-highlight-color: transparent;
            user-select: none;
          }
          .sw-card:not(.sw-disabled) { cursor: pointer; }
          .sw-card:not(.sw-disabled):active {
            background: #e8f0fe;
            border-color: #1a73e8;
          }
          .sw-card.sw-disabled {
            opacity: 0.45;
            cursor: default;
            pointer-events: none;
          }
          .sw-name {
            font-weight: 600;
            font-size: 14px;
            color: #111;
            margin-bottom: 10px;
            line-height: 1.3;
          }
          .sw-btn {
            display: block;
            padding: 7px 14px;
            background: #1a73e8;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            touch-action: manipulation;
            box-sizing: border-box;
          }
          .sw-btn:disabled { background: #aaa; cursor: default; }
          .sw-badge {
            display: inline-block;
            padding: 3px 8px;
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffc107;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.03em;
            text-transform: uppercase;
          }
          .sw-status {
            margin-top: 12px;
            font-size: 13px;
            color: #555;
            text-align: center;
            min-height: 20px;
          }
          .sw-status.sw-error { color: #c5221f; }

          /* Debug panel */
          #sw-debug {
            margin-top: 14px;
            padding: 10px 12px;
            background: #0d1117;
            border-radius: 8px;
            font-family: 'Menlo', 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.7;
            color: #c9d1d9;
            max-height: 280px;
            overflow-y: auto;
            word-break: break-all;
          }
          #sw-debug .db-ok  { color: #3fb950; }
          #sw-debug .db-err { color: #f85149; }
          #sw-debug .db-info { color: #79c0ff; }
          .sw-debug-label {
            margin-top: 10px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #aaa;
          }
        </style>
      `;
    }

    /* ----------------------------------------------------------
       HTML
    ---------------------------------------------------------- */
    buildHTML(): string {
      const title = this.getAttribute("widgettitle");
      const headingHTML = title
        ? `<div class="sw-heading">${this.escapeHtml(title)}</div>`
        : "";

      const cards = this.getIndustries()
        .map((ind) => {
          if (ind.disabled) {
            return `
              <div class="sw-card sw-disabled">
                <div class="sw-name">${ind.name}</div>
                <span class="sw-badge">Under Construction</span>
              </div>`;
          }
          return `
            <div class="sw-card">
              <div class="sw-name">${ind.name}</div>
              <button class="sw-btn" data-group="${ind.groupId}" data-path="${ind.path}">
                Explore
              </button>
            </div>`;
        })
        .join("");

      const debugPanel = this.isDebug()
        ? `<div class="sw-debug-label">Debug Log</div>
           <div id="sw-debug">Waiting for tap...</div>`
        : "";

      return `
        <div class="sw-wrap">
          ${headingHTML}
          <div class="sw-grid">${cards}</div>
          <div class="sw-status" id="sw-status"></div>
          ${debugPanel}
        </div>`;
    }

    escapeHtml(str: string): string {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    /* ----------------------------------------------------------
       EVENT HANDLERS
    ---------------------------------------------------------- */
    attachHandlers(container: HTMLElement) {
      container
        .querySelectorAll<HTMLButtonElement>(".sw-btn")
        .forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const groupId = btn.getAttribute("data-group");
            const path = btn.getAttribute("data-path");
            if (groupId && path) {
              this.handleSwitch(groupId, path, container);
            }
          });
        });
    }

    /* ----------------------------------------------------------
       STATUS HELPERS
    ---------------------------------------------------------- */
    setStatus(container: HTMLElement, msg: string, isError = false) {
      const el = container.querySelector<HTMLElement>("#sw-status");
      if (!el) return;
      el.textContent = msg;
      el.className = "sw-status" + (isError ? " sw-error" : "");
    }

    setButtonsDisabled(container: HTMLElement, disabled: boolean) {
      container
        .querySelectorAll<HTMLButtonElement>(".sw-btn")
        .forEach((b) => (b.disabled = disabled));
    }

    /* ----------------------------------------------------------
       CORE: GET CURRENT USER (SDK-native, works on mobile)
    ---------------------------------------------------------- */
    async getCurrentUser(
      container: HTMLElement
    ): Promise<{ userId: string; groupIDs: string[] }> {
      this.dbLog("widgetApi.getUserInformation() →");
      this.flushDebugPanel(container);

      const profile = await widgetApi.getUserInformation();

      this.dbLog(
        `  userId=${profile.id} groupIDs=[${(profile.groupIDs || []).join(", ")}]`,
        "ok"
      );
      this.flushDebugPanel(container);

      return {
        userId: profile.id,
        groupIDs: Array.isArray(profile.groupIDs) ? profile.groupIDs : [],
      };
    }

    /* ----------------------------------------------------------
       CORE: UPDATE GROUP MEMBERSHIP
       Uses Basic auth (bypasses mobile cookie/session issues)
    ---------------------------------------------------------- */
    async updateMembership(
      groupId: string,
      action: "add" | "remove",
      userId: string,
      container: HTMLElement
    ): Promise<void> {
      const mediaType =
        action === "add"
          ? "application/vnd.staffbase.accessors.group.members-add.v1+json"
          : "application/vnd.staffbase.accessors.group.members-remove.v1+json";

      const endpoint = `/api/groups/${groupId}/members`;
      this.dbLog(`PATCH ${endpoint} [${action}] userId=${userId} →`);
      this.flushDebugPanel(container);

      let res: Response;
      let responseText = "";
      try {
        res = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            accept: mediaType,
            "content-type": mediaType,
            authorization: `Basic ${API_KEY}`,
          },
          body: JSON.stringify({ userIds: [userId] }),
        });
        responseText = await res.text();
      } catch (fetchErr: any) {
        this.dbLog(`  NETWORK ERROR: ${fetchErr.message}`, "err");
        this.flushDebugPanel(container);
        if (action === "add") throw new Error(`Network error: ${fetchErr.message}`);
        return;
      }

      if (res.ok) {
        this.dbLog(`  ${res.status} OK`, "ok");
      } else {
        this.dbLog(`  ${res.status} FAILED — ${responseText.slice(0, 120)}`, "err");
      }
      this.flushDebugPanel(container);

      if (!res.ok && action === "add") {
        throw new Error(`Add to group failed (${res.status}): ${responseText.slice(0, 200)}`);
      }
    }

    /* ----------------------------------------------------------
       CORE: SWITCH GROUP
    ---------------------------------------------------------- */
    async switchGroup(
      targetGroupId: string,
      userId: string,
      currentGroupIDs: string[],
      container: HTMLElement
    ): Promise<void> {
      const industryGroupIds = this.getIndustryGroupIds();

      const toRemove = currentGroupIDs.filter(
        (gid) => industryGroupIds.has(gid) && gid !== targetGroupId
      );
      const needsAdd = !currentGroupIDs.includes(targetGroupId);

      this.dbLog(`Plan: remove=[${toRemove.join(", ")}] add=${needsAdd ? targetGroupId : "none"}`);
      this.flushDebugPanel(container);

      if (!toRemove.length && !needsAdd) {
        this.dbLog("Already in target group, skipping", "ok");
        this.flushDebugPanel(container);
        return;
      }

      if (toRemove.length) {
        await Promise.allSettled(
          toRemove.map((gid) =>
            this.updateMembership(gid, "remove", userId, container)
          )
        );
      }

      if (needsAdd) {
        await this.updateMembership(targetGroupId, "add", userId, container);
      }
    }

    /* ----------------------------------------------------------
       MAIN: HANDLE TAP
    ---------------------------------------------------------- */
    async handleSwitch(
      groupId: string,
      path: string,
      container: HTMLElement
    ): Promise<void> {
      if (this.isProcessing) return;
      this.isProcessing = true;
      this.debugLogs = [];
      this.setButtonsDisabled(container, true);
      this.setStatus(container, "Switching industry...");

      const debugPanel = container.querySelector<HTMLElement>("#sw-debug");
      if (debugPanel) debugPanel.innerHTML = "";

      this.dbLog(`Tap → groupId=${groupId} path=${path}`);
      this.flushDebugPanel(container);

      try {
        const { userId, groupIDs } = await this.getCurrentUser(container);
        await this.switchGroup(groupId, userId, groupIDs, container);

        this.dbLog("Group switch complete ✓", "ok");
        this.flushDebugPanel(container);
        this.setStatus(container, "Done! Taking you there...");

        if (this.isDebug()) {
          // In debug mode hold for 8s so user can read the log before navigating
          this.dbLog(`Navigating to ${path} in 8s...`, "info");
          this.flushDebugPanel(container);
          setTimeout(() => {
            window.location.href = path;
          }, 8000);
        } else {
          setTimeout(() => {
            window.location.href = path;
          }, 150);
        }
      } catch (err: any) {
        console.error("[Switcher] Error:", err);
        this.dbLog(`FATAL: ${err.message}`, "err");
        this.flushDebugPanel(container);

        if (this.isDebug()) {
          // Show full log + error for as long as needed — no timeout, user can read
          this.setStatus(
            container,
            `Switch failed — see debug log below`,
            true
          );
        } else {
          this.setStatus(container, `Error: ${err.message}`, true);
        }

        this.setButtonsDisabled(container, false);
        this.isProcessing = false;
      }
    }

    static get observedAttributes() {
      return ALL_ATTRIBUTES;
    }
  };
};

/* ============================================================
   REGISTRATION
   ============================================================ */
const blockDefinition: BlockDefinition = {
  name: "industry-switcher",
  label: "Industry Switcher",
  attributes: ALL_ATTRIBUTES,
  factory: factory,
  configurationSchema: configurationSchema,
  uiSchema: uiSchema,
  blockLevel: "block",
  iconUrl: "",
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: "Eira Tope",
  version: "1.0.0",
};

window.defineBlock(externalBlockDefinition);
