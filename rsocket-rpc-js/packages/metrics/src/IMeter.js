/**
 * @name IMeter.js
 * @fileoverview Defines the IMeter interface.
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
 *
 * @requires RawMeterTag
 * @requires metrics_pb
 * @exports IMeter
 */

'use strict';

import RawMeterTag from './RawMeterTag';
import {Meter} from './proto/metrics_pb';

/**
 */
export interface IMeter {
  name: string;
  description: ?string;
  statistic: string;
  type: string;
  tags: RawMeterTag[];
  units?: string;

  /**
   * @abstract
   * @returns {Object}
   */
  rates(): Object;

  /**
   * @abstract
   * @param {function} converter
   * @returns {Meter[]}
   */
  convert(converter: (IMeter) => Meter[]): Meter[];
}
