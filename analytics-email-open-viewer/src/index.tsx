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

import React from "react";
import ReactDOM from "react-dom/client";

import { BlockFactory, BlockDefinition, ExternalBlockDefinition } from "widget-sdk";
import { AnalyticsEmailOpenViewerProps, AnalyticsEmailOpenViewer } from "./analytics-email-open-viewer";
import { configurationSchema, uiSchema } from "./configuration-schema";
import icon from "../resources/analytics-email-open-viewer.svg";
import pkg from '../package.json'

const widgetAttributes: string[] = [
  'emailid',
];

const factory: BlockFactory = (BaseBlockClass, _widgetApi) => {
  return class AnalyticsEmailOpenViewerBlock extends BaseBlockClass {
    private _root: ReactDOM.Root | null = null;

    public constructor() {
      super();
    }

    private get props(): AnalyticsEmailOpenViewerProps {
      const attrs = this.parseAttributes<AnalyticsEmailOpenViewerProps>();
      return {
        ...attrs,
        contentLanguage: this.contentLanguage,
      };
    }

    public renderBlock(container: HTMLElement): void {
      this._root ??= ReactDOM.createRoot(container);
      this._root.render(<AnalyticsEmailOpenViewer {...this.props} />);
    }

    public static get observedAttributes(): string[] {
      return widgetAttributes;
    }

    public attributeChangedCallback(...args: [string, string | undefined, string | undefined]): void {
      super.attributeChangedCallback.apply(this, args);
    }
  };
};

const blockDefinition: BlockDefinition = {
    name: "analytics-email-open-viewer",
    factory: factory,
    attributes: widgetAttributes,
    blockLevel: 'block',
    configurationSchema: configurationSchema,
    uiSchema: uiSchema,
    label: 'Email Performance Tracker',
    iconUrl: icon
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: pkg.author,
  version: pkg.version
};

window.defineBlock(externalBlockDefinition);