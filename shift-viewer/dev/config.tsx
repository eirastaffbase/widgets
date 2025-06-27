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

import { ExternalBlockDefinition } from "widget-sdk";
import { configurationSchema, uiSchema } from "../src/configuration-schema";
import React, { FC } from "react";
import Form from "@rjsf/mui";
import validator from "@rjsf/validator-ajv8";
import {prepareAttributes} from './utils/DataUtil'

const updateWidget = (data: Record<string, string>) => {
  const attributes = prepareAttributes(data)
  const el = document.querySelector("#preview > :first-child");

  for (const key in attributes) {
    el?.setAttribute(key, attributes[key]);
  }
};

type BlockDefinition = ExternalBlockDefinition["blockDefinition"];

type Props = {
  blockDefinition: BlockDefinition;
};

const Config: FC<Props> = ({ blockDefinition }) => {
  return (
    <div className="display: flex; flex-direction: column; justify-content: space-evenly">
      <div className="box">
        <h3>Icon preview:</h3>
        <section id="icon">
          <div
            aria-label={blockDefinition.label}
            style={{
              background: "rgb(247, 247, 247)",
              height: "96px",
              flex: "0 0 20%",
              borderRadius: "3px",
              padding: "0px",
              margin: "5px 0px 0px 0px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            <img
              height="28"
              src={blockDefinition.iconUrl}
              style={{ maxWidth: "80px" }}
              alt={blockDefinition.label}
            />
            <div
              aria-hidden="true"
              style={{
                textAlign: "center",
                fontSize: "14px",
                color: "rgb(120, 120, 120)",
                marginTop: "8px",
                width: "100%",
              }}
            >
              {blockDefinition.label}
            </div>
          </div>
        </section>
      </div>
      <div className="box">
        <h3>Configuration preview:</h3>
        <section id="config">
          <Form
            schema={configurationSchema}
            uiSchema={uiSchema}
            validator={validator}
            onSubmit={(e) => {
              updateWidget(e.formData);
            }}
            autoComplete={"off"}
          />
        </section>
      </div>
    </div>
  );
};

export default Config;
