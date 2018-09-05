/**
 *  A simple counter object
 *
 *  @flow
 */

'use strict';

import BaseMeter from './BaseMeter';
import RawMeterTag from './RawMeterTag';

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

  inc(val: ?number): void {
    this.mark(val);
  }

  dec(val: ?number): void {
    if (!val) {
      val = 1;
    }
    this.mark(-1 * val);
  }

  clear(): void {
    this.count = 0;
  }
}
