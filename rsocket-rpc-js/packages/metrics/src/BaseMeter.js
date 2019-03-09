/**
 * @name BaseMeter.js
 * @fileoverview Defines the "BaseMeter" class.
 *
 * @flow
 *
 * @requires IMeter
 * @requires metrics_pb
 * @requires RawMeterTag
 * @requires stats
 * @exports BaseMeter
 */

'use strict';

import type {IMeter} from './IMeter';
import {Meter} from './proto/metrics_pb';
import RawMeterTag from './RawMeterTag';
import {EWMA} from './stats';

/**
 * MAX_COUNTER_VALUE. 4294967296.
 *
 * JavaScript uses double-precision FP for all numeric types.
 * Perhaps someday we'll have native 64-bit integers that can safely be
 * transported via JSON without additional code, but not today.
 *
 * @constant
 */
const MAX_COUNTER_VALUE = Math.pow(2, 32); // 4294967296

/**
 * @param {string} name -
 * @param {string} description - (optional)
 * @param {RawMeterTag[]} tags - (optional)
 */
export default class BaseMeter implements IMeter {
  /** one-minute per-second rate
   * @member {EWMA} m1Rate */
  m1Rate: EWMA;
  /** five-minute per-second rate
   * @member {EWMA} m5Rate */
  m5Rate: EWMA;
  /** fifteen-minute per-second rate
   * @member {EWMA} m15Rate */
  m15Rate: EWMA;
  /** @member {number} count */
  count: number;
  /** @member {RawMeterTag[]} tags */
  tags: RawMeterTag[];
  /** @member {number} startTime */
  startTime: number;
  /** @member {string} type */
  type: string;
  /** @member {string} name */
  name: string;
  /** (optional)
   * @member {string} description */
  description: ?string;
  /** @member {string} statistic */
  statistic: string;
  /** @member {string} units */
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

  /**
   * @param {function} converter -
   * @return
   */
  convert(converter: IMeter => Meter[]): Meter[] {
    return converter(this);
  }

  /**
   * Mark the occurence of n events
   *
   * @param {number} n - (optional; default=1) the number of events to mark the occurence of
   * @return {number} the number of events marked
   */
  mark(n: ?number): number {
    if (!n) {
      n = 1;
    }
    this.count += n;

    // Check for wrap around
    if (this.count > MAX_COUNTER_VALUE) {
      this.count -= MAX_COUNTER_VALUE + 1;
    }

    // Check for negative count (e.g. from a decrement)
    if (this.count < 0) {
      this.count = 0;
    }

    this.m1Rate.update(n);
    this.m5Rate.update(n);
    this.m15Rate.update(n);

    return n;
  }

  /**
   * Return an object containing the rate values.
   *
   * @return {Object} an object containing the one-, five-, and fifteen-minute per-second rates, and the over-all mean per-second rate.
   */
  rates() {
    return {
      '1': this.oneMinuteRate(),
      '5': this.fiveMinuteRate(),
      '15': this.fifteenMinuteRate(),
      mean: this.meanRate(),
    };
  }

  /**
   * Return the fifteen-minute per-second rate.
   * @return {number} the rate
   */
  fifteenMinuteRate() {
    return this.m15Rate.rate();
  }

  /**
   * Return the five-minute per-second rate.
   * @return {number} the rate
   */
  fiveMinuteRate() {
    return this.m5Rate.rate();
  }

  /**
   * Return the one-minute per-second rate.
   * @return {number} the rate
   */
  oneMinuteRate() {
    return this.m1Rate.rate();
  }

  /**
   * Return the per-second rate over the complete lifetime of the meter.
   * @return {number} the rate
   */
  meanRate() {
    return (this.count / (new Date().getTime() - this.startTime)) * 1000;
  }

  /**
   * Tick the one-, five-, and fifteen-minute rates.
   */
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
