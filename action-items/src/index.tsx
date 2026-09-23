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

import React from "react";
import ReactDOM from "react-dom/client";

import { BlockFactory, BlockDefinition, ExternalBlockDefinition, BaseBlock } from "widget-sdk";
import { ActionItemsProps, ActionItems } from "./action-items";
import {
  configurationSchema,
  uiSchema,
  DEFAULT_BASE_URL,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_ACCENT_COLOR,
} from "./configuration-schema";
import { fetchThemeColors, ThemeSurface } from "./theming";
import icon from "../resources/action-items.svg";
import pkg from "../package.json";

/**
 * Attributes handled by the widget. Mirrors the configuration schema.
 */
const widgetAttributes: string[] = [
  "tasksjson",
  "widgettitle",
  "apitoken",
  "baseurl",
  "usethemecolors",
  "primarycolor",
  "accentcolor",
  "backgroundcolor",
  "darkmode",
  "showcompleted",
];

const factory: BlockFactory = (BaseBlockClass, _widgetApi) => {
  /**
   *  <action-items tasksjson="[...]"></action-items>
   */
  return class ActionItemsBlock extends BaseBlockClass implements BaseBlock {
    private _root: ReactDOM.Root | null = null;
    // Staffbase calls renderBlock once per attribute change, and the theme
    // lookup is async. Each render claims a generation, and a fetch that
    // resolves after a newer render started is dropped instead of painting
    // stale brand colors over the current configuration.
    private _generation = 0;

    public constructor() {
      super();
    }

    private get props(): ActionItemsProps {
      const attrs = this.parseAttributes<ActionItemsProps>();
      return {
        ...attrs,
        contentLanguage: this.contentLanguage,
      };
    }

    public renderBlock(container: HTMLElement): void {
      const generation = ++this._generation;
      const props = this.props;
      this._root ??= ReactDOM.createRoot(container);

      // Paint immediately with the configured colors so there's never a blank
      // frame waiting on the network.
      this._root.render(<ActionItems {...props} />);

      if (String(this.getAttribute("usethemecolors")) !== "true") return;

      const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/$/, "");
      const apiToken = this.getAttribute("apitoken") || "";
      const surface: ThemeSurface = String(this.getAttribute("darkmode")) === "true" ? "dark" : "light";

      void fetchThemeColors(baseUrl, apiToken, "primary", surface).then(theme => {
        if (generation !== this._generation || !this._root) return;
        if (!theme.primary && !theme.accent) return;
        this._root.render(
          <ActionItems
            {...props}
            primarycolor={theme.primary || props.primarycolor || DEFAULT_PRIMARY_COLOR}
            accentcolor={theme.accent || props.accentcolor || DEFAULT_ACCENT_COLOR}
          />
        );
      });
    }

    /**
     * The observed attributes, where the widget reacts on.
     */
    public static get observedAttributes(): string[] {
      return widgetAttributes;
    }

    /**
     * Callback invoked on every change of an observed attribute. Call the parental method before
     * applying own logic.
     */
    public attributeChangedCallback(...args: [string, string | undefined, string | undefined]): void {
      super.attributeChangedCallback.apply(this, args);
    }
  };
};

/**
 * The definition of the block, to let it successfully register to the hosting application
 */
const blockDefinition: BlockDefinition = {
  name: "action-items",
  factory: factory,
  attributes: widgetAttributes,
  blockLevel: "block",
  configurationSchema: configurationSchema,
  uiSchema: uiSchema,
  label: "Action Items",
  iconUrl: icon,
};

/**
 * Wrapping definition, which defines meta informations about the block.
 */
const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: pkg.author,
  version: pkg.version,
};

/**
 * This call is mandatory to register the block in the hosting application.
 */
window.defineBlock(externalBlockDefinition);
