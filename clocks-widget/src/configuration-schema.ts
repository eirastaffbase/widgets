/*!
 * Copyright 2023, Staffbase GmbH and contributors.
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

import { UiSchema } from "@rjsf/core";
import { JSONSchema7 } from "json-schema";

/**
 * schema used for generation of the configuration dialog
 * see https://react-jsonschema-form.readthedocs.io/en/latest/ for documentation
 */
export const configurationSchema: JSONSchema7 = {
  required: ["timezone"],
  properties: {
    timezone: {
      type: "string",
      title: "Timezone",
      default: "Europe/Berlin",
    },
    usedigitalclockstyle: {
      type: "boolean",
      title: "Use Digital Clock Style",
      default: false,
    },
    useanalogclockstyle: {
      type: "boolean",
      title: "Use Analog Clock Style",
      default: false,
    },
    showheading: {
      type: "boolean",
      title: "Show Heading",
      default: false,
    },
  },
  dependencies: {
    useanalogclockstyle: {
      oneOf: [
        {
          properties: {
            useanalogclockstyle: {
              enum: [true],
            },
            analogclocksize: {
              type: "number",
              title: "Analog Clock Size",
              minimum: 8,
              maximum: 20,
              default: 8,
              multipleOf: 0.5,
            },
            analogclockbackgroundcolor: {
              type: "string",
              title: "Analog Clock Background Color",
              default: "#FFFFFF",
            },
            analogclockbordercolor: {
              type: "string",
              title: "Analog Clock Border Color",
              default: "#FFFFFF",
            },
            analogclockshowhournotchonly: {
              type: "boolean",
              title: "Only show hour notches",
              default: false,
            },
            analogclocknotchcolor: {
              type: "string",
              title: "Analog Clock Notch Color",
              default: "#000000",
            },
            analogclocknotchcolorhour: {
              type: "string",
              title: "Analog Clock Notch Color: Hour",
              default: "#000000",
            },
            analogclockhandcolorhour: {
              type: "string",
              title: "Analog Clock Hand Color: Hour",
              default: "#000000",
            },
            analogclockhandcolorminute: {
              type: "string",
              title: "Analog Clock Hand Color: Minute",
              default: "#000000",
            },
            analogclockhandcolorsecond: {
              type: "string",
              title: "Analog Clock Hand Color: Second",
              default: "#FF0000",
            },
          },
          required: [
            "analogclocksize",
            "analogclockbackgroundcolor",
            "analogclockbordercolor",
            "analogclockshowhournotchonly",
            "analogclocknotchcolor",
            "analogclocknotchcolorhour",
            "analogclockhandcolorhour",
            "analogclockhandcolorminute",
            "analogclockhandcolorsecond",
          ],
        },
      ],
    },
    usedigitalclockstyle: {
      oneOf: [
        {
          properties: {
            usedigitalclockstyle: {
              enum: [true],
            },
            digitalclockformat: {
              type: "string",
              title: "Digital Clock Format",
              default: "HH:mm:ss a",
            },
            digitalclockcolor: {
              type: "string",
              title: "Digital Clock Color",
              default: "#000000",
            },
            digitalclockfontsize: {
              type: "number",
              title: "Digital Clock Font Size",
              minimum: 14,
              maximum: 100,
              default: 14,
              multipleOf: 1,
            },
          },
          required: [
            "digitalclockformat",
            "digitalclockcolor",
            "digitalclockfontsize",
          ],
        },
      ],
    },
    showheading: {
      oneOf: [
        {
          properties: {
            showheading: {
              enum: [true],
            },
            heading: {
              type: "string",
              title: "Heading",
              default: "BERLIN",
            },
            headingplacement: {
              type: "string",
              title: "Heading Placement",
              enum: ["top", "bottom"],
              default: "top",
            },
            headingcolor: {
              type: "string",
              title: "Heading Color",
              default: "#000000",
            },
            headingfontsize: {
              type: "number",
              title: "Heading Font Size",
              minimum: 14,
              maximum: 100,
              default: 14,
              multipleOf: 1,
            },
          },
          required: [
            "heading",
            "headingplacement",
            "headingcolor",
            "headingfontsize",
          ],
        },
      ],
    },
  },
};

/**
 * schema to add more customization to the form's look and feel
 * @see https://react-jsonschema-form.readthedocs.io/en/latest/api-reference/uiSchema/
 */
export const uiSchema: UiSchema = {
  "ui:order": [
    "timezone",
    "useanalogclockstyle",
    "analogclocksize",
    "analogclockbackgroundcolor",
    "analogclockbordercolor",
    "analogclockshowhournotchonly",
    "analogclocknotchcolor",
    "analogclocknotchcolorhour",
    "analogclockhandcolorhour",
    "analogclockhandcolorminute",
    "analogclockhandcolorsecond",
    "usedigitalclockstyle",
    "digitalclockformat",
    "digitalclockcolor",
    "digitalclockfontsize",
    "showheading",
    "heading",
    "headingplacement",
    "headingcolor",
    "headingfontsize",
  ],
  usedigitalclockstyle: {
    "ui:help": "This enables the digital clock style.",
  },
  useanalogclockstyle: {
    "ui:help": "This enables the analog clock style.",
  },
  analogclocksize: {
    "ui:widget": "range",
    "ui:options": {
      min: 8,
      max: 20,
      step: 0.5,
      label: "Size for analog clock (in rem)",
    },
    "ui:help": "Size for analog clock (in rem = The font-relative length refers to the font metrics of the element on which they are used— or, in the case of rem, the metrics of the root element.)",
  },
  analogclockbackgroundcolor: {
    "ui:widget": "color",
    "ui:help": "Set the base color for the analog clock.",
  },
  analogclockbordercolor: {
    "ui:widget": "color",
    "ui:help":
      "Set the border color for the analog clock.",
  },
  analogclockshowhournotchonly: {
    "ui:help": "Decide if only the hour notches should be shown in the analog clock.",
  },
  analogclocknotchcolor: {
    "ui:widget": "color",
    "ui:help": "Set the color for the analog clock notches.",
  },
  analogclocknotchcolorhour: {
    "ui:widget": "color",
    "ui:help": "Set the color for the analog clock notches for the hour.",
  },
  analogclockhandcolorhour: {
    "ui:widget": "color",
    "ui:help": "Set the color for the hour hand for the analog clock.",
  },
  analogclockhandcolorminute: {
    "ui:widget": "color",
    "ui:help": "Set the color for the minute hand for the analog clock.",
  },
  analogclockhandcolorsecond: {
    "ui:widget": "color",
    "ui:help": "Set the color for the second hand for the analog clock.",
  },
  digitalclockformat: {
    "ui:help":
      "Available formats: https://momentjs.com/docs/#/displaying/format/.",
  },
  digitalclockcolor: {
    "ui:widget": "color",
    "ui:help": "Set the color for the digital clock output.",
  },
  digitalclockfontsize: {
    "ui:widget": "range",
    "ui:options": {
      min: 14,
      max: 100,
      step: 1,
      label: "Font Size for Digital Clock",
    },
    "ui:help": "Set the font size for the digital clock output.",
  },
  showheading: {
    "ui:help": "Decide if a heading should be shown.",
  },
  heading: {
    "ui:help": "Enter a heading (city, country or timezone).",
  },
  headingplacement: {
    "ui:help":
      "Decide if the heading should be shown above (top) or below (bottom) the clock.",
  },
  headingcolor: {
    "ui:widget": "color",
    "ui:help": "Set the color for the heading.",
  },
  headingfontsize: {
    "ui:widget": "range",
    "ui:options": {
      min: 14,
      max: 100,
      step: 1,
      label: "Font size for the heading",
    },
    "ui:help": "Set the font size for the heading.",
  },
  timezone: {
    "ui:help":
      "Available timezones (column TZ): https://en.wikipedia.org/wiki/List_of_tz_database_time_zones",
  },
};
