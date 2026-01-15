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

const defaultDummyData = {
  currentUser: {
    id: "67db0d546f71c1262a47fe07",
    firstName: "You",
    lastName: "",
    avatar: { icon: { url: "https://i.pravatar.cc/150?u=nicoleadams" } }
  },
  senders: {
    nicoleAdams: {
      id: "67db0d546f71c1262a47fe07",
      firstName: "Nicole",
      lastName: "Adams",
      avatar: { icon: { url: "https://i.pravatar.cc/150?u=nicoleadams" } }
    },
    patrickAnderson: {
      id: "67db0d54cf14a943ab2300fd",
      firstName: "Patrick",
      lastName: "Anderson",
      avatar: { icon: { url: "https://i.pravatar.cc/150?u=guy3" } }
    },
    henryFitz: {
      id: "67db0d568422de3bf0be6a0e",
      firstName: "Henry",
      lastName: "Fitz",
      avatar: { icon: { url: "https://i.pravatar.cc/150?u=henryfitz" } }
    },
    mariaGarcia: {
      id: "user-maria-hypothetical",
      firstName: "Maria",
      lastName: "Garcia",
      avatar: { icon: { url: "https://i.pravatar.cc/150?u=mariagarcia" } }
    }
  },
  conversations: [
    {
      id: "68d17acea93dbb47bb2faa40",
      type: "group",
      meta: { title: "Mohammed, Maria" },
      lastMessage: {
        id: "68d17ad333439d03f7c68753",
        senderID: "67db0d546f71c1262a47fe07",
        parts: [{ body: "Hello!" }],
        senderRef: "nicoleAdams",
        created: "2025-09-22T16:35:31.065Z"
      }
    },
    {
      id: "68d17a58d47b5b43a83ae926",
      type: "group",
      meta: { title: "Operations #574" },
      lastMessage: {
        id: "68d17aa8d47b5b43a83aecee",
        senderID: "67db0d546f71c1262a47fe07",
        parts: [{ body: "Hi everyone! Welcome to Flight A243 :)" }],
        senderRef: "nicoleAdams",
        created: "2025-09-22T16:34:48.775Z"
      }
    },
    {
      id: "681cff0808817a06dcab4e7c",
      type: "direct",
      meta: { title: "Patrick Anderson" },
      partnerRef: "patrickAnderson",
      lastMessage: {
        id: "681cff0808817a06dcab4e7d",
        senderID: "67db0d546f71c1262a47fe07",
        parts: [{ body: "I need hardhats!" }],
        senderRef: "nicoleAdams",
        created: "2025-05-08T18:59:20.400Z"
      }
    },
    {
      id: "67fe89ffe6ffb4345ba56fe1",
      type: "group",
      meta: { title: "Patrick, Maria" },
      lastMessage: {
        id: "67fe8a062aa1c40cd2a828e9",
        senderID: "67db0d546f71c1262a47fe07",
        parts: [{ body: "Looking forward to the team meeting!" }],
        senderRef: "nicoleAdams",
        created: "2025-04-15T16:32:06.347Z"
      }
    },
    {
      id: "67f97347cf03e26581dc97de",
      type: "direct",
      meta: { title: "Henry Fitz" },
      partnerRef: "henryFitz",
      lastMessage: {
        id: "67f97347cf03e26581dc97df",
        senderID: "67db0d546f71c1262a47fe07",
        parts: [{ body: "Hey Henry, great to connect!" }],
        senderRef: "nicoleAdams",
        created: "2025-04-11T19:53:43.394Z"
      }
    }
  ],
  messages: {
    "68d17a58d47b5b43a83ae926": [
      {
        id: "msg-ops-2",
        senderID: "user-maria-hypothetical",
        parts: [{ body: "Thanks, Nicole! Glad to be here." }],
        senderRef: "mariaGarcia",
        created: "2025-09-22T16:35:10.000Z"
      },
      {
        id: "68d17aa8d47b5b43a83aecee",
        senderID: "67db0d546f71c1262a47fe07",
        parts: [{ body: "Hi everyone! Welcome to Flight A243 :)" }],
        senderRef: "nicoleAdams",
        created: "2025-09-22T16:34:48.775Z"
      }
    ],
    "681cff0808817a06dcab4e7c": [
      {
        id: "msg-pa-2",
        senderID: "67db0d54cf14a943ab2300fd",
        parts: [{ body: "On it. Which site needs them?" }],
        senderRef: "patrickAnderson",
        created: "2025-05-08T19:00:00.000Z"
      },
      {
        id: "681cff0808817a06dcab4e7d",
        senderID: "67db0d546f71c1262a47fe07",
        parts: [{ body: "I need hardhats!" }],
        senderRef: "nicoleAdams",
        created: "2025-05-08T18:59:20.400Z"
      }
    ],
    "68d17acea93dbb47bb2faa40": [
      {
        id: "68d17ad333439d03f7c68753",
        senderID: "67db0d546f71c1262a47fe07",
        parts: [{ body: "Hello!" }],
        senderRef: "nicoleAdams",
        created: "2025-09-22T16:35:31.065Z"
      }
    ]
  }
};

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
    debugmode: {
      type: "boolean",
      title: "Enable Debug Mode",
      default: false,
    },
    // MODIFICATION: Added dummy data configuration
    dummydatajson: {
      type: "string",
      title: "Dummy Data (JSON)",
      default: JSON.stringify(defaultDummyData, null, 2),
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
  debugmode: {
    "ui:help": "If enabled, shows API request and response information above the widget for troubleshooting.",
  },
  dummydatajson: {
    "ui:widget": "textarea",
    "ui:help": "Edit the JSON to customize the dummy data shown when API calls fail. Uses references (senderRef, partnerRef) to link data.",
    "ui:options": {
      rows: 20,
    }
  },
};