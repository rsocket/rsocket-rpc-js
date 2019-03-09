/**
 * @name SwitchTransformOperator.js
 * @fileoverview Defines the SwitchTransformOperator class.
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
 * @requires NPM:rsocket-types
 * @requires NPM:rsocket-flowable
 */

import type {
  ISubscriber,
  ISubscription,
  IPartialSubscriber,
  IPublisher,
} from 'rsocket-types';
import {Flowable} from 'rsocket-flowable';

/**
 * The maximum number of items that may be requested.
 *
 * @constant
 * @type {number}
 */
const MAX_REQUEST_N = 0x7fffffff; // uint31

/**
 * @param {ISubscriber} initial -
 * @param {function} transformer -
 */
export default class SwitchTransformOperator<T, R>
  implements ISubscription, ISubscriber<T>, IPublisher<T> {
  _done: boolean;
  _error: Error;
  _canceled: boolean;
  _first: T | any;
  _outer: ISubscriber<R>;
  _inner: ISubscriber<T>;
  _subscription: ISubscription;
  _transformer: (first: T, stream: Flowable<T>) => IPublisher<R>;

  constructor(
    initial: ISubscriber<R>,
    transformer: (first: T, stream: Flowable<T>) => IPublisher<R>,
  ) {
    this._transformer = transformer;
    this._outer = initial;
  }

  /**
   */
  cancel() {
    if (this._canceled) {
      return;
    }

    this._canceled = true;
    this._first = undefined;
    this._subscription.cancel();
  }

  /**
   * @param {IPartialSubscriber} [actual] (optional)
   */
  subscribe(actual?: IPartialSubscriber<T>) {
    if (actual && !this._inner) {
      this._inner = ((actual: any): ISubscriber<T>);
      this._inner.onSubscribe(this);
    } else if (actual) {
      const a = actual;
      if (a.onSubscribe) {
        a.onSubscribe({
          cancel: () => {},
          request: () => {
            if (a.onError) {
              a.onError(
                new Error('SwitchTransform allows only one Subscriber'),
              );
            }
          },
        });
      }
    }
  }

  /**
   * @param {ISubscription} subscription
   */
  onSubscribe(subscription: ISubscription) {
    if (this._subscription) {
      subscription.cancel();
      return;
    }

    this._subscription = subscription;
    this._subscription.request(1);
  }

  /**
   * @param {T} value
   */
  onNext(value: T) {
    if (this._canceled || this._done) {
      return;
    }

    if (!this._inner) {
      try {
        this._first = value;
        const result = this._transformer(
          value,
          new Flowable(s => this.subscribe(s)),
        );
        result.subscribe(this._outer);
      } catch (e) {
        this.onError(e);
      }
      return;
    }

    this._inner.onNext(value);
  }

  /**
   * @param {Error} error
   */
  onError(error: Error) {
    if (this._canceled || this._done) {
      return;
    }

    this._error = error;
    this._done = true;

    if (this._inner) {
      if (!this._first) {
        this._inner.onError(error);
      }
    } else {
      this._outer.onSubscribe({
        cancel: () => {},
        request: () => {
          this._outer.onError(error);
        },
      });
    }
  }

  /**
   */
  onComplete() {
    if (this._done || this._canceled) {
      return;
    }

    this._done = true;

    if (this._inner) {
      if (!this._first) {
        this._inner.onComplete();
      }
    } else {
      this._outer.onSubscribe({
        cancel: () => {},
        request: () => {
          this._outer.onComplete();
        },
      });
    }
  }

  /**
   * @param {number} n
   */
  request(n: number) {
    if (this._first) {
      const f = this._first;
      this._first = undefined;
      this._inner.onNext(f);

      if (this._done) {
        if (this._error) {
          this._inner.onError(this._error);
        } else {
          this._inner.onComplete();
        }
      }

      if (MAX_REQUEST_N <= n) {
        this._subscription.request(MAX_REQUEST_N);
      } else if (--n > 0) {
        this._subscription.request(n);
      }
    } else {
      this._subscription.request(n);
    }
  }

  /**
   * @param {function} fn
   * @returns {IPublisher}
   */
  map<R>(fn: (data: T) => R): IPublisher<R> {
    return new Flowable(subscriber => this.subscribe(subscriber)).map(fn);
  }
}
