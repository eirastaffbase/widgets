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

/**
 * schema used for generation of the configuration dialog
 * see https://rjsf-team.github.io/react-jsonschema-form/docs/ for documentation
 */
export const configurationSchema: JSONSchema7 = {
  properties: {
    linkedinurl: {
      type: "string",
      title: "LinkedIn Company URL",
    },
    numberofposts: {
      type: "integer",
      title: "Number of Posts to Show",
      default: 5,
    },
  },
  required: ["linkedinurl"],
};

/**
 * schema to add more customization to the form's look and feel
 * @see https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema
 */
export const uiSchema: UiSchema = {
  linkedinurl: {
    "ui:help": "Please enter the full URL of the company's LinkedIn page.",
    "ui:placeholder": "https://www.linkedin.com/company/your-company-name",
  },
  numberofposts: {
    "ui:help": "Enter the number of recent posts you want to display.",
    "ui:widget": "updown",
  },
};