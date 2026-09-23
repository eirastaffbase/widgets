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

import { Base64 } from "js-base64";

type Value =
  | string
  | number
  | boolean
  | unknown[]
  | Record<string, unknown>
  | null
  | undefined;

export type ValueMap = Record<string, unknown>;
type AttributeMap = Record<string, string>;

type EncondingFN = (value: NonNullable<unknown>) => string;
type PrepareFN = (
  attributes: ValueMap,
  encodingFN?: EncondingFN
) => AttributeMap;

export const DATA_URI_PREFIX = "data:text/plain;base64,";

export const encodeValues = (values: unknown): string =>
  Base64.encode(JSON.stringify(values));

export const decodeValues = <T = unknown>(attribute: string): T =>
  JSON.parse(Base64.decode(attribute)) as T;

/**
 * Tests if the given value is null, undefined or an empty string
 *
 * @param x
 */
const isNotEmpty = (x: unknown): x is NonNullable<Value> =>
  x !== null && x !== undefined && x !== "";

/**
 * Tests if the given value is an Array or an Object
 *
 * @param x
 */
const isObjectOrArray = (x: Value): x is unknown[] | Record<string, unknown> =>
  typeof x === "object" || Array.isArray(x);

/**
 * Encodes a value to base64 and adds a data uri prefix
 *
 * @param values the values to decode
 */
export const toDataUri = (values: unknown): string =>
  DATA_URI_PREFIX + encodeValues(values);

/**
 * Encodes a data uri prefixed value, or returns the string itself, if no prefix is found
 *
 * @param value the string to decode
 */
export const fromDataUri = <T>(value: string): T | string => {
  if (value.startsWith(DATA_URI_PREFIX)) {
    return decodeValues<T>(value.substr(DATA_URI_PREFIX.length));
  }

  return value;
};

/**
 * Filters the empty values and encode all values to Base64
 *
 * @param attributes a key/value map of the attributes
 *
 */
export const prepareAttributes: PrepareFN = (
  attributes,
  encodingFN = toDataUri
) =>
  Object.entries(attributes).reduce<AttributeMap>((result, [key, value]) => {
    if (isNotEmpty(value)) {
      result[key] = isObjectOrArray(value)
        ? encodingFN(value)
        : value.toString();
    }
    return result;
  }, {});
