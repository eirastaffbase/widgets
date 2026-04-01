/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzjRX4XgKyPk4mW0QeaaHjd5Xp5yaFtUsaVmNi0H0IGEOHIeht4PpRmh5zrTlMx2LQ50w/exec";
const configurationSchema = {
    properties: {
        resourceid: {
            type: "string",
            title: "Resource ID",
        },
        scripturl: {
            type: "string",
            title: "Google Apps Script URL",
            default: "https://script.google.com/macros/s/AKfycbzjRX4XgKyPk4mW0QeaaHjd5Xp5yaFtUsaVmNi0H0IGEOHIeht4PpRmh5zrTlMx2LQ50w/exec",
        },
    },
};
const uiSchema = {
    resourceid: {
        "ui:help": "The ID of the resource/post users are attesting to",
    },
    scripturl: {
        "ui:help": "Override the default Google Apps Script URL (leave blank to use the default)",
    },
};
const factory = (BaseBlockClass, widgetApi) => {
    return class AttestationWidget extends BaseBlockClass {
        constructor() {
            super();
        }
        renderBlock(container) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a;
                const resourceId = this.getAttribute("resourceid") || "";
                const scriptUrl = ((_a = this.getAttribute("scripturl")) === null || _a === void 0 ? void 0 : _a.trim()) || DEFAULT_SCRIPT_URL;
                container.innerHTML = this.buildStyles() + this.buildLoadingHTML();
                // Get the logged-in user via the widget SDK (same approach as industry-switcher)
                let userId = "";
                try {
                    const profile = yield widgetApi.getUserInformation();
                    userId = profile.id;
                }
                catch (_e) {
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
                    const fetchUrl = `${scriptUrl}?userId=${encodeURIComponent(userId)}&resourceId=${encodeURIComponent(resourceId)}`;
                    const response = yield this.fetchWithRetry(fetchUrl);
                    const result = yield response.json();
                    if (result.status === "success") {
                        // Already signed — show their stored signature (green outline implied by result view)
                        this.renderResultView(container, result.data, true);
                    }
                    else {
                        // not_found or any other status — show signing pad, Google Sheet is online (green)
                        this.renderSignaturePad(container, userId, resourceId, scriptUrl, true);
                    }
                }
                catch (_e) {
                    // Google Sheet unreachable — still show the pad but with blue outline
                    this.renderSignaturePad(container, userId, resourceId, scriptUrl, false);
                }
            });
        }
        // ---------------------------------------------------------------------------
        // Helpers
        // ---------------------------------------------------------------------------
        fetchWithRetry(url, retries = 1) {
            return fetch(url).catch((err) => {
                if (retries > 0)
                    return this.fetchWithRetry(url, retries - 1);
                throw err;
            });
        }
        buildStyles() {
            return `
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
        <style>
          .att-wrap {
            font-family: 'Outfit', sans-serif;
            max-width: 480px;
            padding: 28px 24px 24px;
            box-sizing: border-box;
          }

          /* ── Loading ── */
          .att-loading {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 0;
            color: #8C8880;
            font-size: 12px;
            font-weight: 500;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }
          .att-loading-dots {
            display: flex;
            gap: 4px;
          }
          .att-loading-dots span {
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background: #C4BFB8;
            animation: att-pulse 1.2s ease-in-out infinite;
          }
          .att-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
          .att-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
          @keyframes att-pulse {
            0%, 80%, 100% { opacity: 0.3; transform: scale(0.9); }
            40% { opacity: 1; transform: scale(1); }
          }

          /* ── Header ── */
          .att-header {
            margin-bottom: 20px;
          }
          .att-eyebrow {
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: #8C8880;
            margin: 0 0 6px;
          }
          .att-heading {
            font-family: 'Instrument Serif', serif;
            font-size: 24px;
            font-weight: 400;
            color: #1C1B19;
            margin: 0;
            line-height: 1.25;
          }
          .att-subtext {
            font-size: 13px;
            color: #8C8880;
            margin: 6px 0 0;
            font-weight: 300;
            line-height: 1.5;
          }

          /* ── Signature pad area ── */
          .att-pad-wrap {
            margin-top: 18px;
            border-radius: 6px;
            overflow: hidden;
            transition: box-shadow 0.25s ease;
          }
          /* Green = Google Sheet reachable */
          .att-pad-wrap.online {
            border: 1.5px solid #2D5A3D;
            box-shadow: 0 0 0 3px rgba(45, 90, 61, 0.07);
          }
          /* Blue = offline / fallback */
          .att-pad-wrap.offline {
            border: 1.5px dashed #2B4B7A;
            box-shadow: 0 0 0 3px rgba(43, 75, 122, 0.07);
          }
          .att-pad-inner {
            position: relative;
            background: #F8F7F5;
          }
          .att-pad-watermark {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            user-select: none;
          }
          .att-pad-watermark span {
            font-family: 'Instrument Serif', serif;
            font-style: italic;
            font-size: 15px;
            color: rgba(0,0,0,0.08);
            letter-spacing: 0.04em;
          }
          #att-signature-pad {
            display: block;
            width: 100%;
            max-width: 100%;
            cursor: crosshair;
            touch-action: none;
          }
          .att-status-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            margin-top: 8px;
            font-size: 10px;
            font-weight: 500;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .att-status-badge .att-dot {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            flex-shrink: 0;
          }
          .att-status-badge.online  { color: #2D5A3D; }
          .att-status-badge.online  .att-dot { background: #2D5A3D; }
          .att-status-badge.offline { color: #2B4B7A; }
          .att-status-badge.offline .att-dot { background: #2B4B7A; }

          /* ── Buttons ── */
          .att-actions {
            display: flex;
            gap: 10px;
            margin-top: 18px;
          }
          .att-btn {
            font-family: 'Outfit', sans-serif;
            font-size: 13px;
            font-weight: 500;
            padding: 10px 20px;
            border-radius: 5px;
            border: none;
            cursor: pointer;
            letter-spacing: 0.02em;
            transition: opacity 0.15s, background 0.15s;
            white-space: nowrap;
          }
          .att-btn:active { opacity: 0.8; }
          #att-clear-btn {
            background: transparent;
            color: #8C8880;
            border: 1px solid #DDD9D3;
            flex-shrink: 0;
          }
          #att-clear-btn:hover { border-color: #C4BFB8; color: #5A5750; }
          #att-save-btn {
            background: #1C1B19;
            color: #F8F7F5;
            flex: 1;
          }
          #att-save-btn:hover { background: #2E2D2A; }
          #att-save-btn:disabled {
            background: #E5E2DB;
            color: #B0ADA8;
            cursor: default;
          }

          /* ── Result / already-signed view ── */
          .att-result-card {
            margin-top: 16px;
            border: 1px solid #E5E2DB;
            border-radius: 6px;
            overflow: hidden;
            background: #F8F7F5;
          }
          .att-result-sig {
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 120px;
          }
          .att-result-sig svg {
            max-width: 100%;
            max-height: 140px;
          }
          .att-result-footer {
            padding: 10px 16px;
            border-top: 1px solid #E5E2DB;
            display: flex;
            align-items: center;
            gap: 7px;
            font-size: 12px;
            color: #8C8880;
            font-weight: 400;
          }
          .att-check-icon {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #2D5A3D;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .att-check-icon svg {
            width: 9px;
            height: 9px;
          }

          /* ── Fade-in on state change ── */
          @keyframes att-fadein {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .att-animate {
            animation: att-fadein 0.3s ease forwards;
          }
        </style>`;
        }
        buildLoadingHTML() {
            return `<div class="att-wrap">
        <div class="att-loading">
          <div class="att-loading-dots">
            <span></span><span></span><span></span>
          </div>
          Verifying
        </div>
      </div>`;
        }
        // ---------------------------------------------------------------------------
        // View renderers
        // ---------------------------------------------------------------------------
        renderSignaturePad(container, userId, resourceId, scriptUrl, googleSheetOnline) {
            const borderClass = googleSheetOnline ? "online" : "offline";
            // Disable save if we don't have both IDs (nothing to save against)
            const canSave = !!(userId && resourceId);
            const statusLabel = googleSheetOnline ? "Connected" : "Offline mode";
            container.innerHTML =
                this.buildStyles() +
                    `<div class="att-wrap att-animate">
          <div class="att-header">
            <p class="att-eyebrow">Attestation</p>
            <h2 class="att-heading">Sign below</h2>
            <p class="att-subtext">Draw your signature to confirm your attestation.</p>
          </div>
          <div class="att-pad-wrap ${borderClass}">
            <div class="att-pad-inner">
              <div class="att-pad-watermark"><span>Sign here</span></div>
              <svg id="att-signature-pad" width="400" height="180" viewBox="0 0 400 180"></svg>
            </div>
          </div>
          <div class="att-status-badge ${borderClass}">
            <span class="att-dot"></span>${statusLabel}
          </div>
          <div class="att-actions">
            <button class="att-btn" id="att-clear-btn">Clear</button>
            <button class="att-btn" id="att-save-btn"${!canSave ? " disabled" : ""}>Save signature</button>
          </div>
        </div>`;
            this.attachPadHandlers(container, userId, resourceId, scriptUrl, googleSheetOnline);
        }
        renderResultView(container, svgData, alreadySigned) {
            // Inject viewBox so the stored 400×200 SVG scales correctly inside the display box
            let fixedSvg = svgData || "";
            if (fixedSvg.startsWith("<svg") && !fixedSvg.includes("viewBox")) {
                fixedSvg = fixedSvg.replace("<svg", '<svg viewBox="0 0 400 200"');
            }
            const heading = alreadySigned
                ? "Already on file"
                : "Attestation recorded";
            const subtext = alreadySigned
                ? "Your signature has been recorded for this resource."
                : "Your signature has been saved successfully.";
            const checkIcon = `<svg viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 5.2L4.1 7.5L8 3" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
            container.innerHTML =
                this.buildStyles() +
                    `<div class="att-wrap att-animate">
          <div class="att-header">
            <p class="att-eyebrow">Attestation</p>
            <h2 class="att-heading">${heading}</h2>
            <p class="att-subtext">${subtext}</p>
          </div>
          <div class="att-result-card">
            <div class="att-result-sig">${fixedSvg}</div>
            <div class="att-result-footer">
              <span class="att-check-icon">${checkIcon}</span>
              Signature on record
            </div>
          </div>
        </div>`;
        }
        // ---------------------------------------------------------------------------
        // Signature pad drawing + save logic
        // ---------------------------------------------------------------------------
        attachPadHandlers(container, userId, resourceId, scriptUrl, googleSheetOnline) {
            const svg = container.querySelector("#att-signature-pad");
            const clearBtn = container.querySelector("#att-clear-btn");
            const saveBtn = container.querySelector("#att-save-btn");
            if (!svg)
                return;
            const NS = "http://www.w3.org/2000/svg";
            let drawing = false;
            let points = [];
            const getPos = (e) => {
                var _a;
                const rect = svg.getBoundingClientRect();
                if (((_a = e.touches) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                    return {
                        x: e.touches[0].clientX - rect.left,
                        y: e.touches[0].clientY - rect.top,
                    };
                }
                return { x: e.clientX - rect.left, y: e.clientY - rect.top };
            };
            const dist = (a, b) => Math.sqrt(Math.pow((b.x - a.x), 2) + Math.pow((b.y - a.y), 2));
            const mid = (a, b) => ({
                x: (a.x + b.x) / 2,
                y: (a.y + b.y) / 2,
            });
            const startDrawing = (e) => {
                e.preventDefault();
                drawing = true;
                const { x, y } = getPos(e);
                points = [{ x, y, width: 0.5 }];
            };
            const draw = (e) => {
                if (!drawing)
                    return;
                e.preventDefault();
                const newPt = getPos(e);
                const last = points[points.length - 1];
                const d = dist(last, newPt);
                if (d < 2)
                    return;
                const w = Math.min(2.5, Math.max(0.5, 2.5 - d / 14));
                points.push(Object.assign(Object.assign({}, newPt), { width: w }));
                const path = document.createElementNS(NS, "path");
                path.setAttribute("stroke", "#000");
                path.setAttribute("stroke-linecap", "round");
                path.setAttribute("fill", "none");
                if (points.length === 2) {
                    const p0 = points[0];
                    const p1 = points[1];
                    const m = mid(p0, p1);
                    path.setAttribute("d", `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} L ${m.x.toFixed(2)} ${m.y.toFixed(2)}`);
                    path.setAttribute("stroke-width", (((p0.width + p1.width) / 2)).toFixed(2));
                }
                else if (points.length > 2) {
                    const p0 = points[points.length - 3];
                    const p1 = points[points.length - 2];
                    const p2 = points[points.length - 1];
                    const m1 = mid(p0, p1);
                    const m2 = mid(p1, p2);
                    path.setAttribute("d", `M ${m1.x.toFixed(2)} ${m1.y.toFixed(2)} Q ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}, ${m2.x.toFixed(2)} ${m2.y.toFixed(2)}`);
                    path.setAttribute("stroke-width", (((p1.width + p2.width) / 2)).toFixed(2));
                }
                svg.appendChild(path);
            };
            const stopDrawing = () => {
                if (!drawing)
                    return;
                drawing = false;
                if (points.length === 1) {
                    const dot = document.createElementNS(NS, "circle");
                    dot.setAttribute("cx", points[0].x.toFixed(2));
                    dot.setAttribute("cy", points[0].y.toFixed(2));
                    dot.setAttribute("r", "1.25");
                    dot.setAttribute("fill", "#000");
                    svg.appendChild(dot);
                }
                else if (points.length > 1) {
                    const last = points[points.length - 1];
                    const prev = points[points.length - 2];
                    const lastMid = mid(prev, last);
                    const path = document.createElementNS(NS, "path");
                    path.setAttribute("d", `M ${lastMid.x.toFixed(2)} ${lastMid.y.toFixed(2)} L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`);
                    path.setAttribute("stroke", "#000");
                    path.setAttribute("stroke-width", ((((prev.width + last.width) / 2) + 0.5) / 2).toFixed(2));
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
            clearBtn === null || clearBtn === void 0 ? void 0 : clearBtn.addEventListener("click", () => {
                svg.innerHTML = "";
            });
            saveBtn === null || saveBtn === void 0 ? void 0 : saveBtn.addEventListener("click", () => {
                if (svg.children.length === 0) {
                    alert("Please provide a signature first.");
                    return;
                }
                const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">${svg.innerHTML}</svg>`;
                saveBtn.textContent = "Saving...";
                saveBtn.disabled = true;
                clearBtn.disabled = true;
                // In offline/fallback mode simulate a successful save for demo purposes
                if (!googleSheetOnline) {
                    setTimeout(() => this.renderResultView(container, svgString, false), 800);
                    return;
                }
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
                    this.renderSignaturePad(container, userId, resourceId, scriptUrl, googleSheetOnline);
                });
            });
        }
        static get observedAttributes() {
            return ["resourceid", "scripturl"];
        }
    };
};
const blockDefinition = {
    name: "attestation-widget",
    label: "Attestation Widget",
    attributes: ["resourceid", "scripturl"],
    factory: factory,
    configurationSchema: configurationSchema,
    uiSchema: uiSchema,
    blockLevel: "block",
    iconUrl: "",
};
const externalBlockDefinition = {
    blockDefinition,
    author: "Eira Tope",
    version: "1.0.0",
};
window.defineBlock(externalBlockDefinition);


/******/ })()
;