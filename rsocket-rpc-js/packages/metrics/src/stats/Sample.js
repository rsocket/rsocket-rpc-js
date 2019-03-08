/**
 * @fileOverview Defines the "Sample" class.
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

  /**
   * @constructs Sample
   */
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
   * Add a value to the sample.
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
   * @return {number} the number of values in the sample.
   */
  size(): number {
    return this.values.length;
  }
  /**
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
