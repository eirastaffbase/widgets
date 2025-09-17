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

export const configurationSchema: JSONSchema7 = {
  properties: {
    emailid: {
      type: "string",
      title: "Email ID",
    },
    domain: {
      type: "string",
      title: "Staffbase Domain",
      default: "app.staffbase.com",
    },
  },
};

export const uiSchema: UiSchema = {
  emailid: {
    "ui:help": "Enter the ID of the email to analyze. Leave blank for dummy data.",
    "ui:placeholder": "e.g., 68caf97a86ba5b5d9deec780",
  },
  // --- NEW: Added UI schema for domain ---
  domain: {
    "ui:help": "The domain of your Staffbase instance where the API is located.",
    "ui:placeholder": "e.g., app.staffbase.com",
  },
};