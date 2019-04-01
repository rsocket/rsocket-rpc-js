/**
 * @name Histogram.js
 * @fileoverview Defines the Histogram class.
 *
 * @flow
 *
 * @requires stats
 */

'use strict';

import {
  ExponentiallyDecayingSample,
  UniformSample,
  ISample,
  Sample,
} from './stats';

/**
 * The default set of percentiles to use in the Histogram.
 */
export const DEFAULT_PERCENTILES = [
  0.001,
  0.01,
  0.05,
  0.1,
  0.25,
  0.5,
  0.75,
  0.9,
  0.95,
  0.98,
  0.99,
  0.999,
];

/**
 * A histogram tracks the distribution of items, given a sample type.
 */
export class Histogram {
  sample: ISample;
  min: ?number;
  max: ?number;
  sum: ?number;
  varianceM: ?number;
  varianceS: ?number;
  count: ?number;
  type: string;

  /**
   * @param {ISample} sample -
   */
  constructor(sample: ISample) {
    /** @type {ISample} */
    this.sample = sample || new ExponentiallyDecayingSample(1028, 0.015);
    /** @type {?number} */
    this.min = null;
    /** @type {?number} */
    this.max = null;
    /** @type {?number} */
    this.sum = null;
    // These are for the Welford algorithm for calculating running variance
    // without floating-point doom.
    /** @type {?number} */
    this.varianceM = null;
    /** @type {?number} */
    this.varianceS = null;
    /** @type {?number} */
    this.count = 0;
    /** @type {string} */
    this.type = 'histogram';
  }

  /**
   * Create an exponentially decaying histogram.
   *
   * @param {number} [size=1028]
   * @param {number} [alpha=0.015]
   * @return {Histogram}
   */
  static createExponentialDecayHistogram(
    size: number,
    alpha: number,
  ): Histogram {
    return new Histogram(
      new ExponentiallyDecayingSample(size || 1028, alpha || 0.015),
    );
  }

  /**
   * Create a uniformly-sampled histogram.
   *
   * @param {number} [size=1028]
   * @return {Histogram}
   */
  static createUniformHistogram(size: number): Histogram {
    return new Histogram(new UniformSample(size || 1028));
  }

  /**
   * Return the histogram to its default values.
   */
  clear /* = function*/(): void {
    this.sample.clear();
    this.min = null;
    this.max = null;
    this.sum = null;
    this.varianceM = null;
    this.varianceS = null;
    this.count = 0;
  }

  /**
   * timestamp param primarily used for testing
   *
   * @function
   * @param {number} val
   * @param {?number} [timestamp]
   */
  update /* = function*/(val: number, timestamp?: number): void {
    this.count++;
    this.sample.update(val, timestamp);
    if (this.max === null) {
      this.max = val;
    } else {
      this.max = val > this.max ? val : this.max;
    }
    if (this.min === null) {
      this.min = val;
    } else {
      this.min = val < this.min ? val : this.min;
    }
    this.sum = this.sum === null ? val : this.sum + val;
    this.updateVariance(val);
  }

  /**
   * Set the value of the Welford algorithm variance.
   *
   * @function
   * @param {number} val
   */
  updateVariance /* = function*/(val: number): void {
    var oldVM = this.varianceM,
      oldVS = this.varianceS;
    if (this.count == 1) {
      this.varianceM = val;
    } else {
      this.varianceM = oldVM + (val - oldVM) / this.count;
      this.varianceS = oldVS + (val - oldVM) * (val - this.varianceM);
    }
  }

  /**
   * Get the values for a set of percentiles.
   *
   * @function
   * @param {?number[]} [percentiles] An array of percentiles, expressed as decimals between zero and one. For example, [0.5, 0.75, 0.9, 0.99]. Default is {@link DEFAULT_PERCENTILES}.
   * @return {number[]} the values for each percentile level
   */
  percentiles /* = function*/(percentiles?: number[]): Object {
    if (!percentiles) {
      percentiles = DEFAULT_PERCENTILES;
    }
    var values = this.sample
        .getValues()
        .map(function(v) {
          return parseFloat(v);
        })
        .sort(function(a, b) {
          return a - b;
        }),
      scores = {},
      percentile,
      pos,
      lower,
      upper;
    for (var i = 0; i < percentiles.length; i++) {
      pos = percentiles[i] * (values.length + 1);
      percentile = percentiles[i];
      if (pos < 1) {
        scores[percentile] = values[0];
      } else if (pos >= values.length) {
        scores[percentile] = values[values.length - 1];
      } else {
        lower = values[Math.floor(pos) - 1];
        upper = values[Math.ceil(pos) - 1];
        scores[percentile] = lower + (pos - Math.floor(pos)) * (upper - lower);
      }
    }
    return scores;
  }

  /**
   * Return the average variance using the Welford algorithm.
   *
   * @function
   * @return {?number} the average variance, or null if this is undefined because the count is zero.
   * @throws {Error} a divide by zero error if this.count==1
   */
  variance /* = function*/(): ?number {
    return this.count < 1 ? null : this.varianceS / (this.count - 1);
  }

  /**
   * Return the sum of squares of differences from the current mean.
   *
   * @function
   * @return {?number} the sum of squares of differences from the current mean, or null if this is undefined because the count is zero.
   */
  mean /* = function*/(): ?number {
    return this.count == 0 ? null : this.varianceM;
  }

  /**
   * Return the standard deviation, the square root of the average variance.
   *
   * @function
   * @return {?number} the standard deviation, or null if this is undefined because the count is zero.
   */
  stdDev /* = function*/(): ?number {
    return this.count < 1 ? null : Math.sqrt(this.variance());
  }

  /**
   * Return the set of values in the sample.
   *
   * @function
   * @return {any[]} an array of the values in the sample
   */
  values /* = function*/(): any[] {
    return this.sample.getValues();
  }

  /**
   * @function
   * @return {Object}
   * @property {string} type "histogram"
   * @property {number} min
   * @property {number} max
   * @property {number} sum
   * @property {number} variance
   * @property {number} mean
   * @property {number} stdDev
   * @property {number} count
   * @property {number} median
   * @property {number} p75
   * @property {number} p95
   * @property {number} p99
   * @property {number} p999
   */
  toObject /* = function*/(): Object {
    var percentiles = this.percentiles();
    return {
      type: 'histogram',
      min: this.min,
      max: this.max,
      sum: this.sum,
      variance: this.variance(),
      mean: this.mean(),
      std_dev: this.stdDev(),
      count: this.count,
      median: percentiles[0.5],
      p75: percentiles[0.75],
      p95: percentiles[0.95],
      p99: percentiles[0.99],
      p999: percentiles[0.999],
    };
  }
}
