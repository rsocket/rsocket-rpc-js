/**
 * @name ISample.js
 * @fileoverview The "ISample" interface.
 * @copyright Copyright (c) 2017-present, Netifi Inc.
 * @license Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @flow
 * @exports ISample
 */

'use strict';

/**
 */
export interface ISample<T> {
  /**
   * Initialize the sample.
   */
  init(): void;
  /**
   * Add a value (and optionally its timestamp) to the sample.
   * @param {T} val the value to sample
   * @param {number} [timestamp] (optional) the timestamp at which this value was generated or sampled
   */
  update(val: T, timestamp?: number): void;
  /**
   * Clear the items from the sample and reset its size to zero.
   */
  clear(): void;
  /**
   * Get the number of items in the sample.
   * @returns {number} the number of items inthe sample
   */
  size(): number;
  /**
   * Get the items in the sample as an array.
   * @returns {T[]} the items in the sample
   */
  getValues(): T[];
  /**
   */
  print(): void;
}
