/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { UiSchema } from "@rjsf/utils";
import { JSONSchema7 } from "json-schema";

export const defaultShifts = [
  {
    shiftdate: "today+1",
    shiftduration: 8,
    shifttimestart: "09:00",
    shiftlocation: "Apple Fifth Avenue",
    shiftname: "Genius Bar",
  },
  {
    shiftdate: "today+3",
    shiftduration: 6,
    shifttimestart: "12:00",
    shiftlocation: "Apple Grand Central",
    shiftname: "Technical Specialist",
  },
  {
    shiftdate: "today+4",
    shiftduration: 8,
    shifttimestart: "10:00",
    shiftlocation: "Apple SoHo",
    shiftname: "Creative",
  },
  {
    shiftdate: "today+5",
    shiftduration: 7,
    shifttimestart: "11:00",
    shiftlocation: "Apple World Trade Center",
    shiftname: "Genius Bar",
  },
  {
    shiftdate: "today+6",
    shiftduration: 8,
    shifttimestart: "09:30",
    shiftlocation: "Apple Williamsburg",
    shiftname: "Specialist",
  },
];

/**
 * schema used for generation of the configuration dialog
 * see https://rjsf-team.github.io/react-jsonschema-form/docs/ for documentation
 */
export const configurationSchema: JSONSchema7 = {
  properties: {
    detailview: {
      type: "boolean",
      title: "Detail View",
      default: false,
    },
    detailpagelink: {
      type: "string",
      title: "Detail Page Link",
      default: "",
    },
    edittextmode: {
      type: "boolean",
      title: "Edit Shifts as Raw Text",
      default: true,
    },
  },
  dependencies: {
    edittextmode: {
      oneOf: [
        {
          // This block is now shown when edittextmode is FALSE
          properties: {
            edittextmode: { const: false },
            shifts: {
              type: "array",
              title: "Shifts",
              default: defaultShifts,
              items: {
                type: "object",
                properties: {
                  shiftdate: { type: "string", title: "Shift Date" },
                  shiftduration: { type: "number", title: "Shift Duration (hours)" },
                  shifttimestart: { type: "string", title: "Shift Start Time" },
                  shiftlocation: { type: "string", title: "Shift Location" },
                  shiftname: { type: "string", title: "Shift Name" },
                },
              },
            },
          },
        },
        {
          // This block is now shown when edittextmode is TRUE
          properties: {
            edittextmode: { const: true },
            shiftsastext: {
              type: "string",
              title: "Shifts (JSON Format)",
              default: JSON.stringify(defaultShifts, null, 2),
            },
          },
        },
      ],
    },
  },
};

/**
 * schema to add more customization to the form's look and feel
 * @see https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema
 */
export const uiSchema: UiSchema = {
  detailview: { "ui:help": "Toggle between detail and normal view." },
  edittextmode: { "ui:help": "Switch to a raw text editor for bulk-editing shifts in JSON format." },
  shifts: {
    items: {
      shiftduration: { "ui:widget": "updown" },
      shifttimestart: { "ui:widget": "time" },
      shiftdate: { "ui:help": "Use 'today+1', 'today-1', or a date like '2025-07-28'." },
    },
  },
  shiftsastext: {
    "ui:widget": "textarea",
    "ui:options": { rows: 20 },
    "ui:help": "Edit the shifts as a raw JSON array. Ensure the JSON is valid.",
  },
  detailpagelink: {
    "ui:widget": "text",
    "ui:help": "Link to the detail page.",
  }
};