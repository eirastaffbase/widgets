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

import { BaseBlock } from "@staffbase/widget-sdk";
import WidgetApiMock from "./widget-api-mock";
import { fromDataUri, prepareAttributes } from "./utils/DataUtil";
import { baseAttributes } from './constants';

/**
 * Simulated hosting class to run the widget
 */
class FakeBaseClass extends window.HTMLElement implements BaseBlock {
  renderBlock(_container: HTMLElement) {
    // noop
  }
  renderBlockInEditor() {
    // noop
  }
  unmountBlock() {
    // noop
  }
  attributeChangedCallback() {
    this.renderBlock(this);
  }

  connectedCallback(): void {
    this.renderBlock(this);
  }

  public parseAttributes<T extends Record<string, unknown>>(): T {
    return Array.from(this.attributes)
      .filter(({ name }) => !baseAttributes.includes(name))
      .reduce<T>((acc, attr) => {
        const { name, value: attribute } = attr;
        if (attribute) {
          const key = name as keyof T;
          acc[key] = fromDataUri<any>(attribute);
        }

        return acc;
      }, {} as T);
  }

  public parseConfig<T extends Record<string, unknown>>(attributes: T): Record<string, string>{
    return prepareAttributes(attributes);
  }

  widgetLabel = "fake-base-class";

  contentLanguage = "en_US";
}

window.defineBlock = function (externalBlockDefinition) {
  const customElementName = externalBlockDefinition.blockDefinition.name;
  const CustomElementClass = externalBlockDefinition.blockDefinition.factory(
    FakeBaseClass,
    WidgetApiMock
  );
  window.customElements.define(customElementName, CustomElementClass);
};
