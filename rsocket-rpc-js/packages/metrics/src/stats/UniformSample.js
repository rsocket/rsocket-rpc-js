/**
 * @name UniformSample.js
 * @fileoverview Defines the "UniformSample" class.
 *
 * @flow
 *
 * @requires Sample
 * @exports UniformSample
 */

'use strict';

import Sample from './Sample';

/**
 * Take a uniform sample of size "size" for all values.
 * @extends {Sample}
 */
export default class UniformSample<T> extends Sample<T> {
  limit: number;
  count: number;

  /**
   * @param {number} size - the maximum number of items in this sample
   */
  constructor(size: number) {
    super();
    /** @type {number} */
    this.limit = size;
    /** @type {number} */
    this.count = 0;
    this.init();
  }

  /**
   * Add {@link val} to the set of values that make up the sample. Note, if
   * the sample size is already equal to the maximum sample size, the new value
   * may replace a randomly-chosen existing sample value.
   *
   * @param {T} val - the value to add to those sampled
   * @param {?number} timestamp - the time when {@link val} was sampled (currently unused)
   */
  update(val: T, timestamp?: number): void {
    this.count++;
    if (this.size() < this.limit) {
      // console.log("Adding "+val+" to values.");
      this.values.push(val);
    } else {
      var rand = parseInt(Math.random() * this.count);
      if (rand < this.limit) {
        this.values[rand] = val;
      }
    }
  }
}
