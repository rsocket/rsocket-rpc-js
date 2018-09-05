/**
 * @flow
 */

'use strict';

import {ISample} from './ISample';

export default class Sample<T> implements ISample<T> {
  values: T[];
  count: number;

  constructor() {
    this.values = [];
    this.count = 0;
  }

  init(): void {
    this.clear();
  }
  update(val: T, timestamp?: number): void {
    this.values.push(val);
  }
  clear(): void {
    this.values = [];
    this.count = 0;
  }
  size(): number {
    return this.values.length;
  }
  getValues(): T[] {
    return this.values;
  }
  print(): void {
    console.log(this.values);
  }
}
