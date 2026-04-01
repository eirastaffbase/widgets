import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from "@staffbase/widget-sdk";

import { JSONSchema7 } from "json-schema";
import { UiSchema } from "@rjsf/utils";

const DEFAULT_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzjRX4XgKyPk4mW0QeaaHjd5Xp5yaFtUsaVmNi0H0IGEOHIeht4PpRmh5zrTlMx2LQ50w/exec";

const configurationSchema: JSONSchema7 = {
  properties: {
    resourceid: {
      type: "string",
      title: "Resource ID",
    },
    scripturl: {
      type: "string",
      title: "Google Apps Script URL",
    },
  },
};

const uiSchema: UiSchema = {
  resourceid: {
    "ui:help": "The ID of the resource/post users are attesting to",
  },
  scripturl: {
    "ui:help":
      "Override the default Google Apps Script URL (leave blank to use the default)",
  },
};

const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  return class AttestationWidget extends BaseBlockClass implements BaseBlock {
    constructor() {
      super();
    }

    async renderBlock(container: any) {
      const resourceId = this.getAttribute("resourceid") || "";
      const scriptUrl =
        this.getAttribute("scripturl")?.trim() || DEFAULT_SCRIPT_URL;

      container.innerHTML =
        this.buildStyles() +
        `<div class="att-wrap"><h2>Checking for signature...</h2></div>`;

      // Get the logged-in user via the widget SDK (same approach as industry-switcher)
      let userId = "";
      try {
        const profile = await widgetApi.getUserInformation();
        userId = profile.id;
      } catch (_e) {
        // Can't identify the user — show the pad in offline/fallback mode (blue outline)
        this.renderSignaturePad(container, "", resourceId, scriptUrl, false);
        return;
      }

      if (!resourceId) {
        // No resource configured — show pad in fallback mode
        this.renderSignaturePad(container, userId, resourceId, scriptUrl, false);
        return;
      }

      // Check whether the user has already signed for this resource
      try {
        const fetchUrl = `${scriptUrl}?userId=${encodeURIComponent(
          userId
        )}&resourceId=${encodeURIComponent(resourceId)}`;
        const response = await this.fetchWithRetry(fetchUrl);
        const result = await response.json();

        if (result.status === "success") {
          // Already signed — show their stored signature (green outline implied by result view)
          this.renderResultView(container, result.data, true);
        } else {
          // not_found or any other status — show signing pad, Google Sheet is online (green)
          this.renderSignaturePad(container, userId, resourceId, scriptUrl, true);
        }
      } catch (_e) {
        // Google Sheet unreachable — still show the pad but with blue outline
        this.renderSignaturePad(container, userId, resourceId, scriptUrl, false);
      }
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    private fetchWithRetry(url: string, retries = 1): Promise<Response> {
      return fetch(url).catch((err) => {
        if (retries > 0) return this.fetchWithRetry(url, retries - 1);
        throw err;
      });
    }

    private buildStyles(): string {
      return `<style>
        .att-wrap {
          font-family: Helvetica, Arial, sans-serif;
          text-align: center;
          padding: 10px;
          box-sizing: border-box;
          overflow: hidden;
        }
        .att-wrap h2, .att-wrap h3 {
          word-break: break-word;
          max-width: 100%;
        }
        .att-signature-container {
          display: inline-block;
          border-radius: 5px;
          margin-top: 10px;
          max-width: 100%;
        }
        /* Green outline = Google Sheet is reachable */
        .att-signature-container.online  { border: 2px dashed #28a745; }
        /* Blue outline  = Google Sheet unavailable (fallback mode) */
        .att-signature-container.offline { border: 2px dashed #007bff; }
        #att-signature-pad {
          background-color: #fff;
          cursor: crosshair;
          display: block;
          max-width: 100%;
        }
        .att-button-container { margin-top: 15px; }
        .att-btn {
          font-size: 1rem;
          padding: 10px 15px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          margin: 0 5px;
        }
        #att-clear-btn { background-color: #dc3545; color: white; }
        #att-save-btn  { background-color: #28a745; color: white; }
        #att-save-btn:disabled { background-color: #ccc; color: #666; cursor: default; }
        #att-signature-display {
          max-width: 100%;
          min-height: 200px;
          background-color: #fff;
          color: #333;
          text-align: center;
          padding: 10px;
          border-radius: 5px;
          border: 1px solid #ddd;
          box-sizing: border-box;
          display: grid;
          place-items: center;
          margin-top: 10px;
          overflow-y: auto;
        }
        #att-signature-display svg { max-width: 100%; }
      </style>`;
    }

    // ---------------------------------------------------------------------------
    // View renderers
    // ---------------------------------------------------------------------------

    private renderSignaturePad(
      container: any,
      userId: string,
      resourceId: string,
      scriptUrl: string,
      googleSheetOnline: boolean
    ) {
      const borderClass = googleSheetOnline ? "online" : "offline";
      // Disable save if we don't have both IDs (nothing to save against)
      const canSave = !!(userId && resourceId);

      container.innerHTML =
        this.buildStyles() +
        `<div class="att-wrap">
          <h2>Please sign below:</h2>
          <div class="att-signature-container ${borderClass}">
            <svg id="att-signature-pad" width="400" height="200"></svg>
          </div>
          <div class="att-button-container">
            <button class="att-btn" id="att-clear-btn">Clear</button>
            <button class="att-btn" id="att-save-btn"${
              !canSave ? ' disabled style="background-color:#ccc;color:#666"' : ""
            }>Save signature</button>
          </div>
        </div>`;

      this.attachPadHandlers(
        container,
        userId,
        resourceId,
        scriptUrl,
        googleSheetOnline
      );
    }

    private renderResultView(
      container: any,
      svgData: string,
      alreadySigned: boolean
    ) {
      // Inject viewBox so the stored 400×200 SVG scales correctly inside the display box
      let fixedSvg = svgData || "";
      if (fixedSvg.startsWith("<svg") && !fixedSvg.includes("viewBox")) {
        fixedSvg = fixedSvg.replace("<svg", '<svg viewBox="0 0 400 200"');
      }

      const heading = alreadySigned
        ? "Welcome back! You have already signed for this resource."
        : "Signature saved!";

      container.innerHTML =
        this.buildStyles() +
        `<div class="att-wrap">
          <h3>${heading}</h3>
          <div id="att-signature-display">${fixedSvg}</div>
        </div>`;
    }

    // ---------------------------------------------------------------------------
    // Signature pad drawing + save logic
    // ---------------------------------------------------------------------------

    private attachPadHandlers(
      container: any,
      userId: string,
      resourceId: string,
      scriptUrl: string,
      googleSheetOnline: boolean
    ) {
      const svg = container.querySelector("#att-signature-pad") as SVGSVGElement;
      const clearBtn = container.querySelector("#att-clear-btn") as HTMLButtonElement;
      const saveBtn = container.querySelector("#att-save-btn") as HTMLButtonElement;

      if (!svg) return;

      const NS = "http://www.w3.org/2000/svg";
      let drawing = false;
      let points: Array<{ x: number; y: number; width: number }> = [];

      const getPos = (e: any) => {
        const rect = svg.getBoundingClientRect();
        if (e.touches?.length > 0) {
          return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top,
          };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      };

      const dist = (a: any, b: any) =>
        Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
      const mid = (a: any, b: any) => ({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      });

      const startDrawing = (e: any) => {
        e.preventDefault();
        drawing = true;
        const { x, y } = getPos(e);
        points = [{ x, y, width: 0.5 }];
      };

      const draw = (e: any) => {
        if (!drawing) return;
        e.preventDefault();
        const newPt = getPos(e);
        const last = points[points.length - 1];
        const d = dist(last, newPt);
        if (d < 2) return;

        const w = Math.min(2.5, Math.max(0.5, 2.5 - d / 14));
        points.push({ ...newPt, width: w });

        const path = document.createElementNS(NS, "path");
        path.setAttribute("stroke", "#000");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("fill", "none");

        if (points.length === 2) {
          const p0 = points[0];
          const p1 = points[1];
          const m = mid(p0, p1);
          path.setAttribute(
            "d",
            `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} L ${m.x.toFixed(2)} ${m.y.toFixed(2)}`
          );
          path.setAttribute(
            "stroke-width",
            (((p0.width + p1.width) / 2)).toFixed(2)
          );
        } else if (points.length > 2) {
          const p0 = points[points.length - 3];
          const p1 = points[points.length - 2];
          const p2 = points[points.length - 1];
          const m1 = mid(p0, p1);
          const m2 = mid(p1, p2);
          path.setAttribute(
            "d",
            `M ${m1.x.toFixed(2)} ${m1.y.toFixed(2)} Q ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}, ${m2.x.toFixed(2)} ${m2.y.toFixed(2)}`
          );
          path.setAttribute(
            "stroke-width",
            (((p1.width + p2.width) / 2)).toFixed(2)
          );
        }
        svg.appendChild(path);
      };

      const stopDrawing = () => {
        if (!drawing) return;
        drawing = false;

        if (points.length === 1) {
          const dot = document.createElementNS(NS, "circle");
          dot.setAttribute("cx", points[0].x.toFixed(2));
          dot.setAttribute("cy", points[0].y.toFixed(2));
          dot.setAttribute("r", "1.25");
          dot.setAttribute("fill", "#000");
          svg.appendChild(dot);
        } else if (points.length > 1) {
          const last = points[points.length - 1];
          const prev = points[points.length - 2];
          const lastMid = mid(prev, last);
          const path = document.createElementNS(NS, "path");
          path.setAttribute(
            "d",
            `M ${lastMid.x.toFixed(2)} ${lastMid.y.toFixed(2)} L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`
          );
          path.setAttribute("stroke", "#000");
          path.setAttribute(
            "stroke-width",
            ((((prev.width + last.width) / 2) + 0.5) / 2).toFixed(2)
          );
          path.setAttribute("stroke-linecap", "round");
          path.setAttribute("fill", "none");
          svg.appendChild(path);
        }
        points = [];
      };

      svg.addEventListener("mousedown", startDrawing);
      svg.addEventListener("mousemove", draw);
      svg.addEventListener("touchstart", startDrawing, { passive: false });
      svg.addEventListener("touchmove", draw, { passive: false });
      window.addEventListener("mouseup", stopDrawing);
      window.addEventListener("touchend", stopDrawing);

      clearBtn?.addEventListener("click", () => {
        svg.innerHTML = "";
      });

      saveBtn?.addEventListener("click", () => {
        if (svg.children.length === 0) {
          alert("Please provide a signature first.");
          return;
        }

        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">${svg.innerHTML}</svg>`;

        saveBtn.textContent = "Saving...";
        saveBtn.disabled = true;
        clearBtn.disabled = true;

        fetch(scriptUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ userId, resourceId, svgData: svgString }),
        })
          .then((r) => r.json())
          .then((result) => {
            if (result.status !== "success") {
              throw new Error(result.message || "Failed to save signature.");
            }
            this.renderResultView(container, svgString, false);
          })
          .catch(() => {
            // Silent failure — restore the pad (signature still on canvas)
            this.renderSignaturePad(
              container,
              userId,
              resourceId,
              scriptUrl,
              googleSheetOnline
            );
          });
      });
    }

    static get observedAttributes() {
      return ["resourceid", "scripturl"];
    }
  };
};

const blockDefinition: BlockDefinition = {
  name: "attestation-widget",
  label: "Attestation Widget",
  attributes: ["resourceid", "scripturl"],
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
