/**
 * fileOverview Defines the "SpanSingleSubscriber" class.
 * @requires NPM:rsocket-flowable
 * @requires NPM:opentracing
 * @exports createSpanSingle
 */
import {Single, IFutureSubscriber} from 'rsocket-flowable/build/Single';
import {Tracer, Span, SpanContext, FORMAT_TEXT_MAP} from 'opentracing';

/**
 * @return {Single}
 */
export function createSpanSingle(
  single: Single<T>,
  tracer: Tracer,
  name: string,
  context?: SpanContext | Span,
  metadata?: Object,
  ...tags: Object
) {
  return new Single(subscriber => {
    const spanSubscriber = new SpanSingleSubscriber(
      subscriber,
      tracer,
      name,
      context,
      metadata,
      ...tags,
    );
    single.subscribe(spanSubscriber);
  });
}

/**
 */
class SpanSingleSubscriber implements IFutureSubscriber<T> {
  _span: Span;
  _subscriber: IFutureSubscriber<T>;
  _tracer: Tracer;
  _cancel: () => void;

  /**
   * @constructs SpanSingleSubscriber
   */
  constructor(
    subscriber: IFutureSubscriber<T>,
    tracer: Tracer,
    name: string,
    context?: SpanContext | Span,
    metadata?: Object,
    ...tags: Object
  ) {
    this._subscriber = subscriber;

    this._tracer = tracer;

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

    //Not supported at this time.
    // if (references) {
    //   options.references = references;
    // }
    //
    options.startTime = Date.now() * 1000;

    this._span = this._tracer.startSpan(name, options);

    this._tracer.inject(
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
   */
  onSubscribe(cancel?: () => void) {
    this._cancel = cancel;
    this._span.log('onSubscribe', timeInMicros());
    this._subscriber.onSubscribe(() => {
      this.cancel();
    });
  }

  /**
   */
  cancel() {
    try {
      this._span.log('cancel', timeInMicros());
      this._cancel && this._cancel();
    } finally {
      this.cleanup();
    }
  }

  /**
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
  onComplete(value: T) {
    try {
      this._span.log('onComplete', timeInMicros());
      this._subscriber.onComplete(value);
    } finally {
      this.cleanup();
    }
  }
}

/**
 * Return the current time in microseconds.
 *
 * @return {number} <tt>Date.now()</tt> converted into microseconds
 */
function timeInMicros() {
  return Date.now() * 1000 /*microseconds*/;
}
