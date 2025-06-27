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

/**
 * schema used for generation of the configuration dialog
 * see https://rjsf-team.github.io/react-jsonschema-form/docs/ for documentation
 */
export const configurationSchema: JSONSchema7 = {
  properties: {
    detailView: {
      type: "boolean",
      title: "Detail View",
      default: true,
    },
    shifts: {
      type: "array",
      title: "Shifts",
      items: {
        type: "object",
        properties: {
          shiftDate: {
            type: "string",
            title: "Shift Date",
            default: "today+1",
          },
          shiftDuration: {
            type: "number",
            title: "Shift Duration (hours)",
            default: 8,
          },
          shiftTimeStart: {
            type: "string",
            title: "Shift Start Time",
            default: "09:00",
          },
          shiftLocation: {
            type: "string",
            title: "Shift Location",
          },
          shiftName: {
            type: "string",
            title: "Shift Name",
          },
        },
      },
      default: [
        {
          shiftDate: "today+1",
          shiftDuration: 8,
          shiftTimeStart: "09:00",
          shiftLocation: "Apple Fifth Avenue",
          shiftName: "Genius Bar",
        },
        {
          shiftDate: "today+3",
          shiftDuration: 6,
          shiftTimeStart: "12:00",
          shiftLocation: "Apple Grand Central",
          shiftName: "Technical Specialist",
        },
        {
          shiftDate: "today+4",
          shiftDuration: 8,
          shiftTimeStart: "10:00",
          shiftLocation: "Apple SoHo",
          shiftName: "Creative",
        },
        {
          shiftDate: "today+5",
          shiftDuration: 7,
          shiftTimeStart: "11:00",
          shiftLocation: "Apple World Trade Center",
          shiftName: "Genius Bar",
        },
        {
          shiftDate: "today+6",
          shiftDuration: 8,
          shiftTimeStart: "09:30",
          shiftLocation: "Apple Williamsburg",
          shiftName: "Specialist",
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
  detailView: {
    "ui:help": "Toggle between detail and normal view.",
  },
  shifts: {
    items: {
      shiftDate: {
        "ui:help": "Enter a date reference like 'today', 'today+1', 'today-1'.",
      },
      shiftDuration: {
        "ui:widget": "updown",
      },
      shiftTimeStart: {
        "ui:widget": "time",
      },
    },
  },
};