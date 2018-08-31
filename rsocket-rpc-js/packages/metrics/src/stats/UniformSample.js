/**
 * @flow
 */

'use strict';

import Sample from './Sample';

/*
 *  Take a uniform sample of size size for all values
 */
export default class UniformSample<T> extends Sample<T> {
  limit: number;
  count: number;

  constructor(size: number) {
    super();
    this.limit = size;
    this.count = 0;
    this.init();
  }

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
