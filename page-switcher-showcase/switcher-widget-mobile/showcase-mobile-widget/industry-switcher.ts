/*
  Industry Switcher Widget
  ========================
  A Staffbase custom block that lets users switch between industry groups
  directly from the mobile app — no iframe, no postMessage, no /me endpoint.

  Auth flow:
    1. widgetApi.getUserInformation() → current user ID + groupIDs (SDK-native, works on mobile)
    2. Optionally grab CSRF token from /auth/discover for the group PATCH calls
    3. PATCH /api/groups/{id}/members to remove old industry groups + add the new one
    4. Navigate to the industry's landing page

  Per-industry config:
    Each industry has a groupid field and a path field.
    Set a path to "in progress" to show the Under Construction badge instead of Explore.

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
   INDUSTRY STATIC CONFIG
   Defines attribute names, display names, and hardcoded defaults.
   All values are overridable via widget config.
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

/* ============================================================
   SCHEMA
   One group ID + one page path field per industry.
   Set a path to "in progress" to show the Under Construction badge.
   ============================================================ */
const configurationSchema: JSONSchema7 = {
  properties: {
    widgettitle: {
      type: "string",
      title: "Widget Title",
    },

    // Manufacturing
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

    // Education
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

    // Financial Services
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

    // Healthcare
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

    // Retail
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

    // Futures
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

// All attribute names registered with the SDK
const ALL_ATTRIBUTES = [
  "widgettitle",
  ...INDUSTRY_CONFIG.flatMap((i) => [i.groupAttr, i.pathAttr]),
];

/* ============================================================
   FACTORY
   ============================================================ */
const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  return class IndustrySwitcher extends BaseBlockClass implements BaseBlock {
    private isProcessing = false;

    constructor() {
      super();
    }

    // Resolve live industry data from attributes (falls back to defaults)
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

    // Build the set of all configured industry group IDs (used to find groups to remove)
    getIndustryGroupIds(): Set<string> {
      return new Set(this.getIndustries().map((i) => i.groupId));
    }

    async renderBlock(container: HTMLElement) {
      container.innerHTML = this.buildStyles() + this.buildHTML();
      this.attachHandlers(container);
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
          .sw-card:not(.sw-disabled) {
            cursor: pointer;
          }
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
          .sw-btn:disabled {
            background: #aaa;
            cursor: default;
          }
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

      return `
        <div class="sw-wrap">
          ${headingHTML}
          <div class="sw-grid">${cards}</div>
          <div class="sw-status" id="sw-status"></div>
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
       CORE: GET CURRENT USER
       widgetApi.getUserInformation() — SDK-native, works on mobile
    ---------------------------------------------------------- */
    async getCurrentUser(): Promise<{ userId: string; groupIDs: string[] }> {
      const profile = await widgetApi.getUserInformation();
      console.log("[Switcher] Got user:", profile.id);
      return {
        userId: profile.id,
        groupIDs: Array.isArray(profile.groupIDs) ? profile.groupIDs : [],
      };
    }

    /* ----------------------------------------------------------
       CORE: GET CSRF TOKEN (optional)
    ---------------------------------------------------------- */
    async getCsrfToken(): Promise<string> {
      try {
        const res = await fetch("/auth/discover", {
          credentials: "include",
          cache: "no-store",
          headers: {
            accept: "application/vnd.staffbase.auth.discovery.v2+json",
          },
        });
        if (res.ok) {
          const data = await res.json();
          return data?.csrfToken || "";
        }
      } catch {
        // Non-fatal
      }
      return "";
    }

    /* ----------------------------------------------------------
       CORE: UPDATE GROUP MEMBERSHIP
    ---------------------------------------------------------- */
    async updateMembership(
      groupId: string,
      action: "add" | "remove",
      userId: string,
      csrfToken: string
    ): Promise<void> {
      const mediaType =
        action === "add"
          ? "application/vnd.staffbase.accessors.group.members-add.v1+json"
          : "application/vnd.staffbase.accessors.group.members-remove.v1+json";

      const headers: Record<string, string> = {
        accept: mediaType,
        "content-type": mediaType,
      };
      if (csrfToken) headers["x-csrf-token"] = csrfToken;

      console.log(`[Switcher] ${action} group ${groupId}`);
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify({ userIds: [userId] }),
      });

      if (!res.ok) {
        console.warn(`[Switcher] ${action} failed for ${groupId}:`, res.status);
        if (action === "add") throw new Error("Failed to join group");
        // remove failures are non-fatal (user may not be in that group)
      }
    }

    /* ----------------------------------------------------------
       CORE: SWITCH GROUP
       Reads configured group IDs at runtime so they stay in sync
       with whatever the admin has set in the widget config.
    ---------------------------------------------------------- */
    async switchGroup(
      targetGroupId: string,
      userId: string,
      currentGroupIDs: string[],
      csrfToken: string
    ): Promise<void> {
      // Build the set of known industry group IDs from current config
      const industryGroupIds = this.getIndustryGroupIds();

      const toRemove = currentGroupIDs.filter(
        (gid) => industryGroupIds.has(gid) && gid !== targetGroupId
      );
      const needsAdd = !currentGroupIDs.includes(targetGroupId);

      console.log("[Switcher] Plan:", { toRemove, needsAdd });
      if (!toRemove.length && !needsAdd) return;

      if (toRemove.length) {
        await Promise.allSettled(
          toRemove.map((gid) =>
            this.updateMembership(gid, "remove", userId, csrfToken)
          )
        );
      }

      if (needsAdd) {
        await this.updateMembership(targetGroupId, "add", userId, csrfToken);
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
      this.setButtonsDisabled(container, true);
      this.setStatus(container, "Switching industry...");

      try {
        const [{ userId, groupIDs }, csrfToken] = await Promise.all([
          this.getCurrentUser(),
          this.getCsrfToken(),
        ]);

        await this.switchGroup(groupId, userId, groupIDs, csrfToken);

        this.setStatus(container, "Done! Taking you there...");

        setTimeout(() => {
          window.location.href = path;
        }, 150);
      } catch (err: any) {
        console.error("[Switcher] Error:", err);
        this.setStatus(container, `Error: ${err.message}`, true);
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
