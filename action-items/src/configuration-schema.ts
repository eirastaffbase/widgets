/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { UiSchema } from "@rjsf/utils";
import { JSONSchema7 } from "json-schema";

export const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
export const DEFAULT_PRIMARY_COLOR = "#0d004c";
export const DEFAULT_ACCENT_COLOR = "#ffce04";
export const DEFAULT_TITLE = "My Action Items";

export const DEFAULT_TASKS_JSON = `[
  {
    "title": "Fix Login Timeout on Proctor App",
    "tag": "JIRA-402",
    "tagStyle": "ticket",
    "priority": "high",
    "dueDate": "today"
  },
  {
    "title": "Video Stream Latency Spikes",
    "tag": "ADO-119",
    "tagStyle": "ticket",
    "priority": "high",
    "dueDate": "today"
  },
  {
    "title": "Mobile Responsive Header Break",
    "tag": "JIRA-405",
    "tagStyle": "ticket",
    "priority": "medium",
    "dueDate": "today+1"
  },
  {
    "title": "Q1 Security Compliance Review",
    "tag": "Governance",
    "tagStyle": "category",
    "priority": "Pending Approval",
    "dueDate": "today+7"
  },
  {
    "title": "Vendor API Access Request",
    "tag": "Governance",
    "tagStyle": "category",
    "priority": "Pending Approval",
    "dueDate": "today+14"
  }
]`;

export const configurationSchema: JSONSchema7 = {
  properties: {
    tasksjson: {
      type: "string",
      title: "Tasks JSON",
      default: DEFAULT_TASKS_JSON,
    },
    widgettitle: {
      type: "string",
      title: "Widget Title",
      default: DEFAULT_TITLE,
    },
    apitoken: {
      type: "string",
      title: "API Token",
      default: "",
    },
    baseurl: {
      type: "string",
      title: "Base URL",
      default: DEFAULT_BASE_URL,
    },
    usethemecolors: {
      type: "boolean",
      title: "Use Theme Colors",
      default: false,
    },
    backgroundcolor: {
      type: "string",
      title: "Background Color",
      default: "",
    },
    darkmode: {
      type: "boolean",
      title: "Dark Mode",
      default: false,
    },
    showcompleted: {
      type: "boolean",
      title: "Keep Completed Tasks Visible",
      default: true,
    },
  },
  // When "Use Theme Colors" is off, expose the manual Primary/Accent pickers.
  // When on, they're hidden (colors come from the branding theme instead).
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
  },
};

export const uiSchema: UiSchema = {
  "ui:order": [
    "tasksjson",
    "widgettitle",
    "usethemecolors",
    "primarycolor",
    "accentcolor",
    "darkmode",
    "backgroundcolor",
    "showcompleted",
    "apitoken",
    "baseurl",
  ],
  tasksjson: {
    "ui:widget": "textarea",
    "ui:help":
      "A JSON array of tasks. Each task needs a 'title'; 'tag', 'tagStyle' (ticket or category), 'priority' (high, medium, low, or any status text such as 'Pending Approval') and 'dueDate' ('YYYY-MM-DD', 'today', or 'today+N') are optional.",
    "ui:options": { rows: 18 },
  },
  widgettitle: {
    "ui:help": "Shown in the header bar, next to the count of open items.",
  },
  apitoken: {
    "ui:widget": "password",
    "ui:help": "Staffbase Basic auth token. Only needed when Use Theme Colors is on.",
  },
  baseurl: {
    "ui:help": "Staffbase API base URL. Only needed when Use Theme Colors is on.",
  },
  usethemecolors: {
    "ui:help":
      "Pull Primary & Accent from the app's branding theme (uses the API Token). Hides the color pickers below.",
  },
  primarycolor: {
    "ui:widget": "color",
    "ui:help": "Header bar, checkboxes and buttons.",
  },
  accentcolor: {
    "ui:widget": "color",
    "ui:help": "Count pill, completed checkmarks and note highlights.",
  },
  darkmode: {
    "ui:help": "Render the card on a dark surface with light text.",
  },
  backgroundcolor: {
    "ui:widget": "color",
    "ui:help": "Card background — leave blank to follow the light or dark surface automatically.",
  },
  showcompleted: {
    "ui:help": "When on, completed tasks stay in the list with a strikethrough. When off, they disappear once checked.",
  },
};
