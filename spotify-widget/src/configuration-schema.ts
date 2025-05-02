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
  properties: {
    src: {
      type: "string",
      title: "src ",
      default: "https://open.spotify.com/embed/show/0owzivHioVBbYgVLA9U11c"
    },
    size: {
      type: "string",
      title: "size",
      default: "Normal",
      enum: ["Normal", "Compact"]
    },
    width: {
      type: "string",
      title: "width ",
      default: "100%"
    }
  },
};

/**
 * schema to add more customization to the form's look and feel
 * @see https://react-jsonschema-form.readthedocs.io/en/latest/api-reference/uiSchema/
 */
export const uiSchema: UiSchema = {
  src: {
    "ui:help": "src attribute from the generated Spotify embed code",
  },
  width: {
    "ui:help": "Width in % or px (example: 100% or 250px)",
  },
  size: {
    "ui:help": "Normal (352px) / Compact (152px)",
  }
};
