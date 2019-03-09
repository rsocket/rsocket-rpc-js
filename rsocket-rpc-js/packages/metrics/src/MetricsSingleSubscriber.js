/**
 * @name MetricsSingleSubscriber.js
 * @fileoverview Defines the MetricsSingleSubscriber class.
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
 * @requires Counter
 * @requires Timer
 * @requires NPM:rsocket-flowable
 * @exports embedMetricsSingleSubscriber
 */

'use strict';

import Counter from './Counter';
import Timer from './Timer';
import {Single} from 'rsocket-flowable';
import type {IFutureSubscriber} from 'rsocket-flowable/build/Single';

/**
 */
export default function embedMetricsSingleSubscriber<T>(
  single: Single<T>,
  next: Counter,
  complete: Counter,
  error: Counter,
  cancelled: Counter,
  timer: Timer,
): Single<T> {
  return new Single(subscriber => {
    const metricsSubscriber = new MetricsSingleSubscriber(
      subscriber,
      next,
      complete,
      error,
      cancelled,
      timer,
    );
    single.subscribe(metricsSubscriber);
  });
}

/**
 * @param {IFutureSubscriber<T>} actual -
 * @param {Counter} next -
 * @param {Counter} complete -
 * @param {Counter} error -
 * @param {Counter} cancelled -
 * @param {Timer} timer -
 */
class MetricsSingleSubscriber<T> implements IFutureSubscriber<T> {
  _source: IFutureSubscriber<T>;
  _next: Counter;
  _complete: Counter;
  _error: Counter;
  _cancelled: Counter;
  _timer: Timer;

  _cancel: () => void;
  _start: number;

  constructor(
    actual: IFutureSubscriber<T>,
    next: Counter,
    complete: Counter,
    error: Counter,
    cancelled: Counter,
    timer: Timer,
  ) {
    this._source = actual;
    this._next = next;
    this._complete = complete;
    this._error = error;
    this._cancelled = cancelled;
    this._timer = timer;
  }

  /**
   */
  onSubscribe(cancel: () => void): void {
    this._cancel = cancel;
    this._start = new Date().getTime();

    this._source.onSubscribe(() => this.cancel());
  }

  /**
   */
  onError(t: Error): void {
    this._error.inc();
    this._timer.update(new Date().getTime() - this._start);

    this._source.onError(t);
  }

  /**
   */
  onComplete(t: T): void {
    this._next.inc();
    this._complete.inc();
    this._timer.update(new Date().getTime() - this._start);
    this._source.onComplete(t);
  }

  /**
   */
  cancel(): void {
    this._cancelled.inc();
    this._timer.update(new Date().getTime() - this._start);
    this._cancel && this._cancel();
  }
}
