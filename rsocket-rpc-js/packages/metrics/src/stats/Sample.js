/**
 * @name Sample.js
 * @fileoverview Defines the "Sample" class.
 *
 * @flow
 *
 * @requires ISample
 * @exports Sample
 */

'use strict';

import {ISample} from './ISample';

/**
 */
export default class Sample<T> implements ISample<T> {
  /**
   * The set of items in the sample.
   * @member
   */
  values: T[];
  /**
   * The number of items in the sample.
   * @member
   */
  count: number;

  constructor() {
    this.values = [];
    this.count = 0;
  }

  /**
   * Initialize the sample, setting its count to zero and clearing out any previously-stored values.
   */
  init(): void {
    this.clear();
  }
  /**
   * Add a value to the sample. Note: <tt>timestamp</tt> is currently unused.
   * @param {T} val - the value to add
   * @param {number} [timestamp] - (optional) the time when the value was sampled
   */
  update(val: T, timestamp?: number): void {
    this.values.push(val);
  }
  /**
   * Reset the sample by removing all of its items and setting its count to zero.
   */
  clear(): void {
    this.values = [];
    this.count = 0;
  }
  /**
   * Get the number of items in the sample.
   * @return {number} the number of values in the sample.
   */
  size(): number {
    return this.values.length;
  }
  /**
   * Get the items in the sample as an array.
   * @return {Array} the set of values in the sample.
   */
  getValues(): T[] {
    return this.values;
  }
  /**
   * Output the values of this sample to the console.
   */
  print(): void {
    console.log(this.values);
  }
}
