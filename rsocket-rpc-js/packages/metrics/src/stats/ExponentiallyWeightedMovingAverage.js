/**
 * @name ExponentiallyWeightedMovingAverage.js
 * @fileoverview Exponentially weighted moving average.
 *
 * @flow
 * @exports EWMA
 */

'use strict';

/**
 * @constant
 */
const M1_ALPHA = 1 - Math.exp(-5 / 60);
/**
 * @constant
 */
const M5_ALPHA = 1 - Math.exp(-5 / 60 / 5);
/**
 * @constant
 */
const M15_ALPHA = 1 - Math.exp(-5 / 60 / 15);

/**
 */
export default class EWMA {
  alpha: number;
  interval: number;
  initialized: boolean;
  currentRate: number;
  uncounted: number;
  tickInterval: any;

  /**
   * @param {number} alpha -
   * @param {number} interval - time in milliseconds
   */
  constructor(alpha: number, interval: number) {
    /** @type {number} */
    this.alpha = alpha;
    /** @type {number} */
    this.interval = interval || 5000;
    /** @type {boolean} */
    this.initialized = false;
    /** @type {number} */
    this.currentRate = 0.0;
    /** @type {number} */
    this.uncounted = 0;
    if (interval) {
      /** @type {any} */
      this.tickInterval = setInterval(() => {
        this.tick();
      }, interval);

      // $FlowFixMe
      if (this.tickInterval.unref) {
        // checking in Node context
        // Don't keep the process open if this is the last thing in the event loop.
        this.tickInterval.unref();
      }
    }
  }

  /**
   * @returns {EWMA}
   */
  static createM1EWMA(): EWMA {
    return new EWMA(M1_ALPHA, 5000);
  }
  /**
   * @returns {EWMA}
   */
  static createM5EWMA(): EWMA {
    return new EWMA(M5_ALPHA, 5000);
  }
  /**
   * @returns {EWMA}
   */
  static createM15EWMA(): EWMA {
    return new EWMA(M15_ALPHA, 5000);
  }

  /**
   * @param {number} n -
   * @returns {void}
   */
  update(n: number): void {
    this.uncounted += n || 1;
  }

  /**
   * Update our rate measurements every interval.
   * @returns {void}
   */
  tick(): void {
    var instantRate = this.uncounted / this.interval;
    this.uncounted = 0;

    if (this.initialized) {
      this.currentRate += this.alpha * (instantRate - this.currentRate);
    } else {
      this.currentRate = instantRate;
      this.initialized = true;
    }
  }

  /**
   * Return the rate per second.
   * @returns {number}
   */
  rate(): number {
    return this.currentRate * 1000;
  }

  /**
   * @returns {void}
   */
  stop(): void {
    clearInterval(this.tickInterval);
  }
}
