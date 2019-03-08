/**
 * @fileOverview Defines the "UniformSample" class.
 *
 * @flow
 *
 * @requires Sample
 * @exports UniformSample
 */

'use strict';

import Sample from './Sample';

/**
 * Take a uniform sample of size size for all values
 * @extends Sample
 */
export default class UniformSample<T> extends Sample<T> {
  /**
   * @member
   */
  limit: number;
  /**
   * @member
   */
  count: number;

  /**
   * @constructs UniformSample
   */
  constructor(size: number) {
    super();
    this.limit = size;
    this.count = 0;
    this.init();
  }

  /**
   * Add <tt>val</tt> to the set of values that make up the sample.
   */
  update(val: T, timestamp?: number): void {
    this.count++;
    if (this.size() < this.limit) {
      //console.log("Adding "+val+" to values.");
      this.values.push(val);
    } else {
      var rand = parseInt(Math.random() * this.count);
      if (rand < this.limit) {
        this.values[rand] = val;
      }
    }
  }
}
