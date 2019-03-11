/**
 * @name ExponentiallyDecayingSample.js
 * @fileoverview Defines the "ExponentiallyDecayingSample" class.
 *
 * @flow
 *
 * @requires Sample
 * @requires binary_heap
 * @exports ExponentiallyDecayingSample
 */

'use strict';

import Sample from './Sample';
import BinaryHeap from './lib/binary_heap';
import type PrioritizedItem from './lib/binary_heap';

/**
 * Take an exponentially decaying sample of size size of all values.
 * This value represents one hour in milliseconds.
 * @constant
 */
const RESCALE_THRESHOLD = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 */
export default class ExponentiallyDecayingSample<T> extends Sample<T> {
  count: number;
  limit: number;
  alpha: number;
  startTime: number;
  nextScaleTime: number;
  values: BinaryHeap<T>;

  /**
   * @param {number} size -
   * @param {number} alpha -
   */
  constructor(size: number, alpha: number) {
    super();
    /** @type {number} */
    this.count = 0;
    /** @type {number} */
    this.limit = size;
    /** @type {number} */
    this.alpha = alpha;
    this.clear();
  }

  /**
   * This is a relatively expensive operation.
   * @return {T[]}
   */
  getValues(): T[] {
    var values = ([]: T[]),
      elt,
      heap = this.values.clone();
    while ((elt = heap.pop())) {
      values.push(elt.val);
    }
    return values;
  }

  /**
   * @return {number}
   */
  size(): number {
    return this.values.size();
  }

  /**
   * @return {BinaryHeap<T>}
   */
  newHeap(): BinaryHeap<T> {
    return new BinaryHeap(obj => obj.priority);
  }

  /**
   * @return {number}
   */
  now(): number {
    return new Date().getTime();
  }

  /**
   * @return {number}
   */
  tick(): number {
    return this.now() / 1000;
  }

  /**
   * @return {void}
   */
  clear(): void {
    /** @type {BinaryHeap<T>} values */
    this.values = this.newHeap();
    this.count = 0;
    /** @type {number} */
    this.startTime = this.tick();
    /** @type {number} */
    this.nextScaleTime = this.now() + RESCALE_THRESHOLD;
  }

  /**
   * @param {T} val - 
   * @param {?number} timestamp - (in milliseconds)
   */
  update(val: T, timestamp?: number): void {
    // Convert timestamp to seconds
    if (timestamp == undefined) {
      timestamp = this.tick();
    } else {
      timestamp = timestamp / 1000;
    }
    var priority = this.weight(timestamp - this.startTime) / Math.random();
    const value = ({val: val, priority: priority}: PrioritizedItem<T>);
    if (this.count < this.limit) {
      this.count += 1;
      this.values.push(value);
    } else {
      var first = this.values.peek();
      if (first.priority < priority) {
        this.values.push(value);
        this.values.pop();
      }
    }

    if (this.now() > this.nextScaleTime) {
      this.rescale(this.now());
    }
  }

  /**
   * @param {number} time
   * @return {number}
   */
  weight(time: number): number {
    return Math.exp(this.alpha * time);
  }

  /**
   * @param {number} now - parameter primarily used for testing rescales
   * @return {void}
   */
  rescale(now: number): void {
    this.nextScaleTime = this.now() + RESCALE_THRESHOLD;
    var oldContent = this.values.content,
      newContent = [],
      oldStartTime = this.startTime;
    this.startTime = (now && now / 1000) || this.tick();
    // Downscale every priority by the same factor. Order is unaffected, which is why we're avoiding the cost of popping.
    for (var i = 0; i < oldContent.length; i++) {
      newContent.push({
        val: oldContent[i].val,
        priority:
          oldContent[i].priority *
          Math.exp(-this.alpha * (this.startTime - oldStartTime)),
      });
    }
    this.values.content = newContent;
  }
}
