/**
 * @name MetricsSubscriber.js
 * @fileoverview Defines the "MetricsSubscriber" class.
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
 * @requires NPM:rsocket-types
 * @requires Counter
 * @requires Timer
 * @exports MetricsSubscriber
 */

'use strict';

import {ISubscription, ISubscriber} from 'rsocket-types';
import Counter from './Counter';
import Timer from './Timer';

/**
 * @param {ISubscriber<T>} actual -
 * @param {Counter} next -
 * @param {Counter} complete -
 * @param {Counter} error -
 * @param {Counter} cancelled -
 * @param {Timer} timer -
 */
export default class MetricsSubscriber<T>
  implements ISubscription, ISubscriber<T> {
  _source: ISubscriber<T>;
  _next: Counter;
  _complete: Counter;
  _error: Counter;
  _cancelled: Counter;
  _timer: Timer;

  _subscription: ISubscription;
  _start: number;

  constructor(
    actual: ISubscriber<T>,
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
  onSubscribe(s: ISubscription) {
    this._subscription = s;
    this._start = new Date().getTime();

    this._source.onSubscribe(this);
  }

  /**
   */
  onNext(t: T) {
    this._next.inc();
    this._source.onNext(t);
  }

  /**
   */
  onError(t: Error) {
    this._error.inc();
    this._timer.update(new Date().getTime() - this._start);

    this._source.onError(t);
  }

  /**
   */
  onComplete() {
    this._complete.inc();
    this._timer.update(new Date().getTime() - this._start);
    this._source.onComplete();
  }

  /**
   */
  request(n: number) {
    this._subscription && this._subscription.request(n);
  }

  /**
   */
  cancel() {
    this._cancelled.inc();
    this._timer.update(new Date().getTime() - this._start);
    this._subscription && this._subscription.cancel();
  }
}
