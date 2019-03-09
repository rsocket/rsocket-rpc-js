/**
 * @name Metrics.js
 * @fileoverview Defines the "Metrics" class
 * @copyright Copyright (c) 2017-present, Netifi Inc.
 * @license Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @flow
 *
 * @requires Counter
 * @requires Timer
 * @requires IMeterRegistry
 * @requires RawMeterTag
 * @requires MetricsSingleSubscriber
 * @requires MetricsSubscriber
 * @requires NPM:rsocket-flowable
 * @exports Metrics
 */

'use strict';

import Counter from './Counter';
import Timer from './Timer';
import {IMeterRegistry} from './IMeterRegistry';
import RawMeterTag from './RawMeterTag';
import embedMetricsSingleSubscriber from './MetricsSingleSubscriber';
import MetricsSubscriber from './MetricsSubscriber';
import {Flowable, Single} from 'rsocket-flowable';

/**
 */
export default class Metrics {
  constructor() {}

  /**
   */
  static timed<T>(
    registry?: IMeterRegistry,
    name: string,
    ...tags: Object[]
  ): (Flowable<T>) => Flowable<T> {
    //Registry is optional - if not provided, return identity function
    if (!registry) {
      return any => any;
    }

    const convertedTags = [];
    if (tags) {
      tags.forEach(tag => {
        Object.keys(tag).forEach(key => {
          convertedTags.push(new RawMeterTag(key, tag[key]));
        });
      });
    }

    const next = new Counter(
      name + '.request',
      'onNext calls',
      'integer',
      [new RawMeterTag('status', 'next')].concat(convertedTags),
    );
    const complete = new Counter(
      name + '.request',
      'onComplete calls',
      'integer',
      [new RawMeterTag('status', 'complete')].concat(convertedTags),
    );
    const error = new Counter(
      name + '.request',
      'onError calls',
      'integer',
      [new RawMeterTag('status', 'error')].concat(convertedTags),
    );
    const cancelled = new Counter(
      name + '.request',
      'cancel calls',
      'integer',
      [new RawMeterTag('status', 'cancelled')].concat(convertedTags),
    );
    const timer = new Timer(name + '.latency', undefined, convertedTags);

    registry.registerMeters([next, complete, error, cancelled, timer]);

    return (flowable: Flowable<T>) =>
      flowable.lift(
        subscriber =>
          new MetricsSubscriber(
            subscriber,
            next,
            complete,
            error,
            cancelled,
            timer,
          ),
      );
  }

  /**
   */
  static timedSingle<T>(
    registry?: IMeterRegistry,
    name: string,
    ...tags: Object[]
  ): (Single<T>) => Single<T> {
    //Registry is optional - if not provided, return identity function
    if (!registry) {
      return any => any;
    }

    const convertedTags = [];
    if (tags) {
      tags.forEach(tag => {
        Object.keys(tag).forEach(key => {
          convertedTags.push(new RawMeterTag(key, tag[key]));
        });
      });
    }

    const next = new Counter(
      name + '.request',
      'onNext calls',
      'integer',
      [new RawMeterTag('status', 'next')].concat(convertedTags),
    );
    const complete = new Counter(
      name + '.request',
      'onComplete calls',
      'integer',
      [new RawMeterTag('status', 'complete')].concat(convertedTags),
    );
    const error = new Counter(
      name + '.request',
      'onError calls',
      'integer',
      [new RawMeterTag('status', 'error')].concat(convertedTags),
    );
    const cancelled = new Counter(
      name + '.request',
      'cancel calls',
      'integer',
      [new RawMeterTag('status', 'cancelled')].concat(convertedTags),
    );
    const timer = new Timer(name + '.latency', undefined, convertedTags);

    registry.registerMeters([next, complete, error, cancelled, timer]);

    return (single: Single<T>) =>
      embedMetricsSingleSubscriber(
        single,
        next,
        complete,
        error,
        cancelled,
        timer,
      );
  }
}
