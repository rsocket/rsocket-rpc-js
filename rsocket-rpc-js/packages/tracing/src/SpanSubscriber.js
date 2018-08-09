import {ISubscriber, ISubscription} from 'rsocket-types';
import {Tracer, Span, SpanContext, FORMAT_TEXT_MAP} from 'opentracing';

export class SpanSubscriber<T> implements ISubscriber<T>, ISubscription {
  _span: Span;
  _rootSpan: Span;
  _subscriber: ISubscriber;
  _tracer: Tracer;
  _subscription: ISubscription;
  _nextCount: number;
  _requestOnce: boolean;

  constructor(
    subscriber: ISubscriber<T>,
    tracer: Tracer,
    name: string,
    context?: SpanContext | Span,
    metadata?: Object,
    ...tags: Object
  ) {
    this._tracer = tracer;
    this._subscriber = subscriber;
    this._nextCount = 0;
    this._requestOnce = false;

    let options = {};

    if (context) {
      options.childOf = context;
    }

    if (tags) {
      const finalTags = {};
      tags.forEach(tagArr => {
        tagArr.forEach(tag => {
          Object.keys(tag).forEach(key => {
            finalTags[key] = tag[key];
          });
        });
      });
      options.tags = finalTags;
    }

    //Not currently supported
    // if (references) {
    //   options.references = references;
    // }
    //

    options.startTime = Date.now() * 1000;

    this._span = tracer.startSpan(name, options);
    this._rootSpan = this._rootSpan || this._span;

    tracer.inject(
      this._span.context(),
      FORMAT_TEXT_MAP,
      metadata === undefined || metadata === null ? {} : metadata,
    );
  }

  cleanup() {
    this._span.finish();
  }

  onSubscribe(subscription?: Subscription) {
    this._subscription = subscription;
    this._span.log('onSubscribe', timeInMicros());
    this._subscriber.onSubscribe(this);
  }

  request(n: number) {
    if (!this._requestOnce) {
      this._requestOnce = true;

      this._span.log('request issued', timeInMicros());
    }

    this._subscription && this._subscription.request(n);
  }

  cancel() {
    try {
      this._span.log('cancel', timeInMicros());
      this._subscription && this._subscription.cancel();
    } finally {
      this.cleanup();
    }
  }

  onNext(value: T) {
    this._subscriber.onNext(value);
  }

  onError(error: Error) {
    try {
      this._span.log('onError', timeInMicros());
      this._subscriber.onError(error);
    } finally {
      this.cleanup();
    }
  }

  onComplete() {
    try {
      this._span.log('onComplete', timeInMicros());
      this._subscriber.onComplete();
    } finally {
      this.cleanup();
    }
  }
}

function timeInMicros() {
  return Date.now() * 1000 /*microseconds*/;
}
