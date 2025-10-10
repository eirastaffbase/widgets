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
    title: {
      type: "string",
      title: "Widget Title",
      default: "Inbox",
    },
    conversationlimit: {
      type: "integer",
      title: "Conversation Limit",
      default: 10,
    },
    apitoken: {
      type: "string",
      title: "API Token (for sending messages)",
    },
  },
};

/**
 * schema to add more customization to the form's look and feel
 * @see https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema
 */
export const uiSchema: UiSchema = {
  title: {
    "ui:help": "The title displayed at the top of the widget.",
  },
  conversationlimit: {
    "ui:help": "The maximum number of recent conversations to display.",
  },
  apitoken: {
    "ui:help": "Optional: Enter an API token to enable sending messages. Viewing messages works without a token.",
  },
};