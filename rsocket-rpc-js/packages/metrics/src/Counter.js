/**
 * @name Counter.js
 * @fileoverview A simple counter object.
 *
 * @flow
 *
 * @requires BaseMeter
 * @requires RawMeterTag
 * @exports Counter
 */

'use strict';

import BaseMeter from './BaseMeter';
import RawMeterTag from './RawMeterTag';

/**
 * @param {string} name
 * @param {string} [description]
 * @param {string} units
 * @param {RawMeterTag[]} [tags]
 * @extends BaseMeter
 */
export default class Counter extends BaseMeter {

  constructor(
    name: string,
    description?: string,
    units: string,
    tags?: RawMeterTag[],
  ) {
    super(name, description, tags);
    this.type = 'counter';
    this.statistic = 'count';
    this.units = units;
  }

  /**
   * Increment the count by a certain number of items.
   *
   * @param {number} [val] the number of items to increment
   */
  inc(val: ?number): void {
    this.mark(val);
  }

  /**
   * Decrement the count by a certain number of items.
   *
   * @param {number} [val=1] the number of items to decrement
   */
  dec(val: ?number): void {
    if (!val) {
      val = 1;
    }
    this.mark(-1 * val);
  }

  /**
   * Reset the number of items in the count to zero.
   */
  clear(): void {
    this.count = 0;
  }
}
