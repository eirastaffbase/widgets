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
    postid: {
      type: "string",
      title: "Post ID",
    },
  },
};

/**
 * schema to add more customization to the form's look and feel
 * @see https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema
 */
export const uiSchema: UiSchema = {
  postid: {
    "ui:help": "Enter the ID of the post to analyze. Leave blank for dummy data.",
    "ui:placeholder": "e.g., 68bc9ad88f5c3e2b97a16845",
  },
};