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
  title: "Profile Cloud Settings",
  properties: {
    profilefieldmappings: {
      type: "string",
      title: "Profile Field Mappings",
      description: "Define the fields available in the dropdown. Enter one per line in the format: api_slug:DisplayName. For example: ispeak:Language",
      default: "ispeak:Language\nlocation:Location\nskill:Skill\ndepartment:Department\nhobby:Hobby",
    },
    defaultprofilefield: {
        type: "string",
        title: "Default Selected Field Slug",
        description: "Enter the API slug of the field that should be selected by default (e.g., ispeak).",
        default: "ispeak",
    },
    coloroptions: {
      type: "string",
      title: "Color Palette (Hex Codes)",
      description: "Enter a list of hex color codes, separated by commas or newlines.",
      default: "#0d47a1, #1976d2, #2196f3, #64b5f6, #bbdefb",
    },
  },
};

/**
 * schema to add more customization to the form's look and feel
 * @see https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema
 */
export const uiSchema: UiSchema = {
  profilefieldmappings: {
    "ui:widget": "textarea",
    "ui:options": {
      rows: 10,
    },
    "ui:help": "Each line represents one option in the filter dropdown.",
  },
  defaultprofilefield: {
      "ui:help": "This must match one of the API slugs from the list above.",
  },
  coloroptions: {
    "ui:widget": "textarea",
    "ui:options": {
      rows: 5,
    },
    "ui:help": "The widget will cycle through these colors for the words in the cloud.",
  },
};