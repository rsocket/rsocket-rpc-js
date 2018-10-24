/**
 * Copyright (c) 2017-present, Netifi Inc.
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
 */

import type {
  ISubscriber,
  ISubscription,
  IPartialSubscriber,
  IPublisher,
} from 'rsocket-types';
import {Flowable} from 'rsocket-flowable';

const MAX_REQUEST_N = 0x7fffffff; // uint31

export default class SwitchTransformOperator<T, R>
  implements ISubscription, ISubscriber<T>, IPublisher<T> {
  _once: boolean;
  _canceled: boolean;
  _first: T | any;
  _initial: ISubscriber<R>;
  _actual: ISubscriber<T>;
  _subscription: ISubscription;
  _transformer: (first: T, stream: Flowable<T>) => IPublisher<R>;

  constructor(
    initial: ISubscriber<R>,
    transformer: (first: T, stream: Flowable<T>) => IPublisher<R>,
  ) {
    this._transformer = transformer;
    this._initial = initial;
  }

  onComplete() {
    this._actual.onComplete();
  }

  onError(error: Error) {
    if (this._canceled) {
      return;
    }

    if (this._once) {
      this._actual.onError(error);
    } else {
      this._initial.onSubscribe({
        cancel: () => {},
        request: () => {
          this._initial.onError(error);
        },
      });
    }
  }

  onNext(value: T) {
    if (this._canceled) {
      return;
    }

    if (!this._once) {
      this._once = true;
      this._first = value;
      try {
        const result = this._transformer(
          value,
          new Flowable(s => this.subscribe(s)),
        );
        result.subscribe(this._initial);
      } catch (e) {
        this.onError(e);
      }
      return;
    }

    this._actual.onNext(value);
  }

  onSubscribe(subscription: ISubscription) {
    this._subscription = subscription;
  }

  request(n: number) {
    if (this._first) {
      const f = this._first;
      this._first = undefined;
      this._actual.onNext(f);

      if (MAX_REQUEST_N <= n) {
        this._subscription.request(MAX_REQUEST_N);
      } else if (--n > 0) {
        this._subscription.request(n);
      }
    } else {
      this._subscription.request(n);
    }
  }

  cancel() {
    this._canceled = true;
    this._first = undefined;
  }

  subscribe(actual?: IPartialSubscriber<T>) {
    if (actual && !this._actual) {
      this._actual = ((actual: any): ISubscriber<T>);
      this._actual.onSubscribe(this);
    } else if (actual) {
      if (actual.onError) {
        actual.onError(new Error('SwitchTransform allows only one Subscriber'));
      }
    }
  }

  map<R>(fn: (data: T) => R): IPublisher<R> {
    return new Flowable(subscriber => this.subscribe(subscriber)).map(fn);
  }
}
