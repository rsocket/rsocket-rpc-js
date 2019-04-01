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
 * @name MAX_COUNTER_VALUE
 * @summary 4294967296
 *
 * @desc JavaScript uses double-precision FP for all numeric types.
 * Perhaps someday we'll have native 64-bit integers that can safely be
 * transported via JSON without additional code, but not today.
 *
 * @constant
 */
const MAX_COUNTER_VALUE = Math.pow(2, 32); // 4294967296

/**
 */
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

  /**
   * @param {string} name -
   * @param {?string} description -
   * @param {?RawMeterTag[]} tags -
   */
  constructor(name: string, description?: string, tags?: RawMeterTag[]) {
    /** @type {EWMA} */
    this.m1Rate = EWMA.createM1EWMA();
    /** @type {EWMA} */
    this.m5Rate = EWMA.createM5EWMA();
    /** @type {EWMA} */
    this.m15Rate = EWMA.createM15EWMA();
    /** @type {number} */
    this.count = 0;
    /** @type {?RawMeterTag[]} */
    this.tags = tags || [];
    /** @type {number} */
    this.startTime = new Date().getTime();
    /** @type {string} */
    this.type = 'meter';
    /** @type {string} */
    this.name = name;
    /** @type {?string} */
    this.description = description;
    /** @type {string} */
    this.statistic = 'unknown';
  }

  /**
   * @param {function} converter -
   * @return {Meter[]}
   */
  convert(converter: IMeter => Meter[]): Meter[] {
    return converter(this);
  }

  /**
   * Mark the occurence of n events
   *
   * @param {?number} [n=1] - the number of events to mark the occurence of
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
   * @return {Object}
   * @property {number} '1' the one-minute rate
   * @property {number} '5' the five-minute rate
   * @property {number} '15' the fifteen-minute rate
   * @property {number} mean the over-all mean per-second rate
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

  /** @return {Object}
   * @property {string} type
   * @property {number} count
   * @property {RawMeterTag[]} tags
   * @property {string} name */
  toObject() {
    return {
      type: this.type,
      count: this.count,
      tags: this.tags,
      name: this.name,
    };
  }
}
