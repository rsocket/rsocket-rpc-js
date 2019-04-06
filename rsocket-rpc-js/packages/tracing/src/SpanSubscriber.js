/**
 * @name SpanSubscriber.js
 * @fileoverview Defines the "SpanSubscriber" class.
 * @requires NPM:rsocket-types
 * @requires NPM:opentracing
 * @exports SpanSubscriber
 */

import {ISubscriber, ISubscription} from 'rsocket-types';
import {Tracer, Span, SpanContext, FORMAT_TEXT_MAP} from 'opentracing';

/**
 */
export class SpanSubscriber<T> implements ISubscriber<T>, ISubscription {
  _span: Span;
  _rootSpan: Span;
  _subscriber: ISubscriber;
  _tracer: Tracer;
  _subscription: ISubscription;
  _nextCount: number;
  _requestOnce: boolean;

  /**
   * @param {ISubscriber<T>} subscriber -
   * @param {Tracer} tracer -
   * @param {string} name -
   * @param {?(SpanContext|Span)} [context] -
   * @param {?Object} [metadata] -
   * @param {Object} ...tags -
   */
  constructor(
    subscriber: ISubscriber<T>,
    tracer: Tracer,
    name: string,
    context?: SpanContext | Span,
    metadata?: Object,
    ...tags: Object
  ) {
    /** @type {Tracer} */
    this._tracer = tracer;
    /** @type {ISubscriber} */
    this._subscriber = subscriber;
    this._nextCount = 0;
    this._requestOnce = false;

    let options = {};

    if (context) {
      options.childOf = context;
    }

    if (tags) {
      const finalTags = {};
      tags.forEach(tag => {
        Object.keys(tag).forEach(key => {
          finalTags[key] = tag[key];
        });
      });

      options.tags = finalTags;
    }

    // Not currently supported
    // if (references) {
    //   options.references = references;
    // }
    //

    options.startTime = Date.now() * 1000;

    /** @type {Span} */
    this._span = tracer.startSpan(name, options);
    /** @type {Span} */
    this._rootSpan = this._rootSpan || this._span;

    tracer.inject(
      this._span.context(),
      FORMAT_TEXT_MAP,
      metadata === undefined || metadata === null ? {} : metadata,
    );
  }

  /**
   */
  cleanup() {
    this._span.finish();
  }

  /**
   * @param {?Subscription} subscription
   */
  onSubscribe(subscription?: Subscription) {
    /** @type {ISubscription} */
    this._subscription = subscription;
    this._span.log('onSubscribe', timeInMicros());
    this._subscriber.onSubscribe(this);
  }

  /**
   * @param {number} n
   */
  request(n: number) {
    if (!this._requestOnce) {
      this._requestOnce = true;

      this._span.log('request issued', timeInMicros());
    }

    this._subscription && this._subscription.request(n);
  }

  /**
   */
  cancel() {
    try {
      this._span.log('cancel', timeInMicros());
      this._subscription && this._subscription.cancel();
    } finally {
      this.cleanup();
    }
  }

  /**
   * @param {T} value
   */
  onNext(value: T) {
    this._subscriber.onNext(value);
  }

  /**
   * @param {Error} error
   */
  onError(error: Error) {
    try {
      this._span.log('onError', timeInMicros());
      this._subscriber.onError(error);
    } finally {
      this.cleanup();
    }
  }

  /**
   */
  onComplete() {
    try {
      this._span.log('onComplete', timeInMicros());
      this._subscriber.onComplete();
    } finally {
      this.cleanup();
    }
  }
}

/**
 * Return the current time in microseconds
 *
 * @return {number} The return value of {@link Date#now} converted to microseconds.
 */
function timeInMicros() {
  return Date.now() * 1000 /* microseconds */;
}
