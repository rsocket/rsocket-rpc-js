/**
 * @name Timer.js
 * @fileoverview Defines the "Timer" class.
 *
 * @flow
 *
 * @requires BaseMeter
 * @requires RawMeterTag
 * @requires Histogram
 * @requires stats
 * @exports Timer
 */

'use strict';

import BaseMeter from './BaseMeter';
import RawMeterTag from './RawMeterTag';
import {Histogram} from './Histogram';
import {ExponentiallyDecayingSample} from './stats';

/**
 * Basically a timer that tracks the rate of events and histograms the durations.
 * @extends {BaseMeter}
 */
export default class Timer extends BaseMeter {
  histogram: Histogram;

  /**
   * @param {string} name -
   * @param {?string} [description] - (optional)
   * @param {?RawMeterTag[]} [tags] - (optional)
   */
  constructor(name: string, description?: string, tags?: RawMeterTag[]) {
    super(name, description, tags);
    /** @type {Histogram} */
    this.histogram = new Histogram(
      new ExponentiallyDecayingSample(1028, 0.015),
    );
    this.clear();
    this.type = 'timer';
    this.statistic = 'duration';
  }

  /**
   */
  update(duration: number): void {
    this.histogram.update(duration);
    this.mark();
  }

  // delegate these to histogram
  /** delegated to {@link Histogram#clear}
   * @return {void} */
  clear(): void {
    return this.histogram.clear();
  }
  /** delegated to {@link Histogram#totalCount}
   * @return {?number} */
  totalCount(): ?number {
    return this.histogram.count;
  }
  /** delegated to {@link Histogram#min}
   * @return {?number} */
  min(): ?number {
    return this.histogram.min;
  }
  /** delegated to {@link Histogram#max}
   * @return {?number} */
  max(): ?number {
    return this.histogram.max;
  }
  /** delegated to {@link Histogram#mean}
   * @return {?number} */
  mean(): ?number {
    return this.histogram.mean();
  }
  /** delegated to {@link Histogram#stdDev}
   * @return {?number} */
  stdDev(): ?number {
    return this.histogram.stdDev();
  }
  /** delegated to {@link Histogram#percentiles}
   * @param {?number[]} percentiles
   * @return {number[]} */
  percentiles(percentiles?: number[]): Object {
    return this.histogram.percentiles(percentiles);
  }
  /** delegated to {@link Histogram#values}
   * @returnn {any[]} */
  values() {
    return this.histogram.values();
  }

  /**
   * @returns {Object}
   * @property {string} type
   * @property {Object} duration
   * @property {number} count
   * @property {RawMeterTag[]} tags
   * @property {string} name
   */
  toObject() {
    return {
      type: this.type,
      duration: this.histogram.toObject(),
      count: this.count,
      tags: this.tags,
      name: this.name,
    };
  }
}
