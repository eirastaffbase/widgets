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
      title: "Salesforce Login URL",
      default: "https://orgfarm-fa85c3dbc8-dev-ed.develop.my.salesforce.com",
    },
    salesforceconsumerkey: {
      type: "string",
      title: "Salesforce Consumer Key",
    },
    salesforceconsumersecret: {
      type: "string",
      title: "Salesforce Consumer Secret",
    },
    soqlquery: {
        type: "string",
        title: "Salesforce SOQL Query",
        default: "SELECT Name, StageName, Amount, CloseDate, Owner.Name FROM Opportunity WHERE IsClosed = false ORDER BY Amount DESC LIMIT 50",
    },
  },
  required: [
    "salesforceloginurl",
    "salesforceconsumerkey",
    "salesforceconsumersecret",
    "soqlquery",
  ]
};

export const uiSchema: UiSchema = {
  salesforceloginurl: {
    "ui:help": "Your sandbox or production login URL (e.g., https://test.salesforce.com).",
  },
  salesforceconsumerkey: {
    "ui:widget": "password",
    "ui:help": "The Consumer Key from your Salesforce Connected App.",
  },
  salesforceconsumersecret: {
    "ui:widget": "password",
    "ui:help": "The Consumer Secret from your Salesforce Connected App.",
  },
  soqlquery: {
    "ui:widget": "textarea",
    "ui:help": "Enter the SOQL query to fetch data. Example: SELECT Name, AnnualRevenue, Industry FROM Account LIMIT 15",
    "ui:options": {
        rows: 5,
    }
  }
};