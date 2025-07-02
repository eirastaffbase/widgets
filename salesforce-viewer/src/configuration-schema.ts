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
  title: "Salesforce Configuration",
  properties: {
    salesforceloginurl: {
      type: "string",
      title: "salesforce login url",
      default: "https://test.salesforce.com",
    },
    salesforceusername: {
      type: "string",
      title: "salesforce username",
    },
    salesforcepassword: {
      type: "string",
      title: "salesforce password and security token",
    },
    salesforceconsumerkey: {
      type: "string",
      title: "salesforce consumer key",
    },
    salesforceconsumersecret: {
        type: "string",
        title: "salesforce consumer secret",
    }
  },
  required: [
    "salesforceloginurl",
    "salesforceusername",
    "salesforcepassword",
    "salesforceconsumerkey",
    "salesforceconsumersecret"
  ]
};

export const uiSchema: UiSchema = {
  salesforceloginurl: {
    "ui:help": "Your sandbox login URL (e.g., https://test.salesforce.com).",
  },
  salesforceusername: {
    "ui:help": "The username for your sandbox account.",
  },
  salesforcepassword: {
    "ui:widget": "password",
    "ui:help": "Your sandbox password with your security token appended to the end.",
  },
  salesforceconsumerkey: {
    "ui:widget": "password",
    "ui:help": "The Consumer Key from your Salesforce Connected App.",
  },
  salesforceconsumersecret: {
    "ui:widget": "password",
    "ui:help": "The Consumer Secret from your Salesforce Connected App.",
  },
};