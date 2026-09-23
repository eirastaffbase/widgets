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

export const ON_CARD_ATTR = "on-card";
export const WIDGET_TITLE_ATTR = "widget-title";
export const TITLE_LINK_ATTR = "title-link";
export const DEVICE_VISIBILITY_ATTR = "device-visibility";
export const GROUP_VISIBILITY_ONLYIF_ATTR = "group-visibility-onlyif";
export const GROUP_VISIBILITY_UNLESS_ATTR = "group-visibility-unless";

export const visibilityAttributes = [
  DEVICE_VISIBILITY_ATTR,
  GROUP_VISIBILITY_ONLYIF_ATTR,
  GROUP_VISIBILITY_UNLESS_ATTR,
];

export const baseAttributes = [
  ON_CARD_ATTR,
  TITLE_LINK_ATTR,
  WIDGET_TITLE_ATTR,
  ...visibilityAttributes,
];
