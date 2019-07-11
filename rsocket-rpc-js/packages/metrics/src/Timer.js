/**
 * @flow
 */

'use strict';

import BaseMeter from './BaseMeter';
import RawMeterTag from './RawMeterTag';
import {Histogram} from './Histogram';
import {ExponentiallyDecayingSample} from './stats';

/*
 *  Basically a timer tracks the rate of events and histograms the durations
 */
export default class Timer extends BaseMeter {
  histogram: Histogram;

  constructor(name: string, description?: string, tags?: RawMeterTag[]) {
    super(name, description, tags);
    this.histogram = new Histogram(
      new ExponentiallyDecayingSample(1028, 0.015),
    );
    this.clear();
    this.type = 'timer';
    this.statistic = 'duration';
  }

  update(duration: number): void {
    this.histogram.update(duration);
    this.mark();
  }

  // delegate these to histogram
  clear(): void {
    return this.histogram.clear();
  }
  totalCount(): ?number {
    return this.histogram.count;
  }
  min(): ?number {
    return this.histogram.min;
  }
  max(): ?number {
    return this.histogram.max;
  }
  mean(): ?number {
    return this.histogram.mean();
  }
  stdDev(): ?number {
    return this.histogram.stdDev();
  }
  percentiles(percentiles?: number[]): Object {
    return this.histogram.percentiles(percentiles);
  }
  values() {
    return this.histogram.values();
  }

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
