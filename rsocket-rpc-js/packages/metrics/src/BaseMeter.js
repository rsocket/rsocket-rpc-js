/**
 * @flow
 */

'use strict';

import type {IMeter} from './IMeter';
import {Meter} from './proto/metrics_pb';
import RawMeterTag from './RawMeterTag';
import {EWMA} from './stats';

/* JavaScript uses double-precision FP for all numeric types.
 * Perhaps someday we'll have native 64-bit integers that can safely be
 * transported via JSON without additional code, but not today. */
const MAX_COUNTER_VALUE = Math.pow(2, 32); // 4294967296

export default class BaseMeter implements IMeter {
  m1Rate: EWMA;
  m5Rate: EWMA;
  m15Rate: EWMA;
  count: number;
  tags: RawMeterTag[];
  startTime: number;
  type: string;
  name: string;
  description: ?string;
  statistic: string;
  units: string;

  constructor(name: string, description?: string, tags?: RawMeterTag[]) {
    this.m1Rate = EWMA.createM1EWMA();
    this.m5Rate = EWMA.createM5EWMA();
    this.m15Rate = EWMA.createM15EWMA();
    this.count = 0;
    this.tags = tags || [];
    this.startTime = new Date().getTime();
    this.type = 'meter';
    this.name = name;
    this.description = description;
    this.statistic = 'unknown';
  }

  convert(converter: IMeter => Meter[]): Meter[] {
    return converter(this);
  }

  // Mark the occurence of n events
  mark(n: ?number): number {
    if (!n) {
      n = 1;
    }
    this.count += n;

    //Check for wrap around
    if (this.count > MAX_COUNTER_VALUE) {
      this.count -= MAX_COUNTER_VALUE + 1;
    }

    //Check for negative count (e.g. from a decrement)
    if (this.count < 0) {
      this.count = 0;
    }

    this.m1Rate.update(n);
    this.m5Rate.update(n);
    this.m15Rate.update(n);

    return n;
  }

  rates() {
    return {
      '1': this.oneMinuteRate(),
      '5': this.fiveMinuteRate(),
      '15': this.fifteenMinuteRate(),
      mean: this.meanRate(),
    };
  }

  // Rates are per second
  fifteenMinuteRate() {
    return this.m15Rate.rate();
  }

  fiveMinuteRate() {
    return this.m5Rate.rate();
  }

  oneMinuteRate() {
    return this.m1Rate.rate();
  }

  meanRate() {
    return (this.count / (new Date().getTime() - this.startTime)) * 1000;
  }

  tick() {
    this.m1Rate.tick();
    this.m5Rate.tick();
    this.m15Rate.tick();
  }

  toObject() {
    return {
      type: this.type,
      count: this.count,
      tags: this.tags,
      name: this.name,
    };
  }
}
