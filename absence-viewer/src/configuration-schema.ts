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

import { JSONSchema7 } from "json-schema";
import { UiSchema } from "@rjsf/utils";

export const configurationSchema: JSONSchema7 = {
  properties: {
    policytype: {
      type: "string",
      title: "Workday policy type",
      default: "Paid Time Off",
    },
    hoursperday: {
      type: "number",
      title: "Hours per work day",
      default: 8,
      minimum: 1,
    },
  },
};

export const uiSchema: UiSchema = {
  policytype: { "ui:help": 'Exactly as it appears in the Workday response.' },
  hoursperday: { "ui:help": "Used to convert hours ↔︎ days (toggle button)." },
};
