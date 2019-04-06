/**
 * @name QueuingFlowableProcessor.js
 * @fileoverview Defines the {@link QueuingFlowableProcessor} class.
 *
 * @requires NPM:rsocket-types
 * @exports QueuingFlowableProcessor
 */

/**
 * An asynchronous, pull-based stream of values. Call the
 * {@link IPublisher#subscribe} method to generate a call to the subscriber's
 * {@link onSubscribe} method with a {@link Subscription} object that has two
 * methods: {@link Subscription#cancel} and {@link Subscription#request}.
 *
 * @see https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-types/src/ReactiveStreamTypes.js
 * @interface IPublisher
 */
/**
 * A version of the {@link ISubscriber} interface in which the methods are
 * optional, so that you may elect to only implement a subset of them.
 *
 * @see https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-types/src/ReactiveStreamTypes.js
 * @interface IPartialSubscriber
 */
/**
 * A handler for values provided by a Publisher.
 * @see https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-types/src/ReactiveStreamTypes.js
 * @interface ISubscriber
 */
/**
 * An underlying source of values for a Publisher.
 * @see https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-types/src/ReactiveStreamTypes.js
 * @interface ISubscription
 */
import type {
  IPublisher,
  ISubscriber,
  IPartialSubscriber,
  ISubscription,
} from 'rsocket-types';

/**
 * MAX_REQUEST_N (from QueuingFlowableProcessor.js). If no {@link capacity} is
 * passed to the {@link QueuingFlowableProcessor#constructor}, this value will
 * be used as the capacity (the maximum number of items in the backlog queue).
 * This effectively signals that you want an unlimited number of items from the
 * source Flowable.
 *
 * @constant
 * @type {number}
 */
const MAX_REQUEST_N = 0x7fffffff; // uint31

/**
 * A {@link QueuingFlowableProcessor} is an intermediary between a Flowable
 * producer and a subscriber. To the producer, it behaves as a greedy subscriber
 * (that is, one that {@link request}s a large number of emissions immediately).
 * To the subscriber, it behaves as a {@link Flowable}.
 *
 * This allows the producer to generate and emit items at its own fast pace, while
 * the end subscriber requests them at its own slow pace. In between, the
 * {@link QueuingFlowableProcessor} queues up the backlog of items.
 */
export default class QueuingFlowableProcessor<T>
  implements IPublisher, ISubscriber, ISubscription {
  _once: boolean;
  _actual: Subscriber<T>;
  _requested: number;
  _capacity: number;
  _queue: T[];
  _wip: number;
  _cancelled: boolean;
  _done: boolean;
  _error: ?Error;

  /**
   * @param {?number} [capacity] - the maximum size of the backlog queue of
   * items this {@link QueuingFlowableProcessor} will maintain (default =
   * {@link MAX_REQUEST_N}). If this queue size is exceeded, the
   * {@link QueuingFlowableProcessor} will begin to drop incoming items from the
   * producer.
   */
  constructor(capacity?: number) {
    this._once = false;
    this._requested = 0;
    /** @type {Subscriber<T>} */
    this._actual = null;
    /** @type {?Error} */
    this._error = null;
    this._done = false;
    this._wip = 0;
    this._cancelled = false;
    /** @type {number} */
    this._capacity = capacity;
    /** @type {T[]} */
    this._queue = [];
    /** @type {function[]} */
    this._transformers = [];
  }

  /**
   * The subscriber to this {@link QueuingFlowableProcessor} subscribes by calling
   * this method.
   *
   * @param {Subscriber<T>} s - an object that implements the Subscriber methods
   *   this {@link QueuingFlowableProcessor} will call to pass along messages
   *   from the Flowable producer.
   * @throws {Error} if a Subscriber is already subscribed to this
   *   {@link QueuingFlowableProcessor}
   */
  subscribe(s: Subscriber<T>) {
    if (!this._once) {
      this._once = true;
      this._actual = s;
      s.onSubscribe(this);
    } else {
      throw new Error('Only one Subscriber allowed');
    }
  }

  /**
   * When the {@link QueuingFlowableProcessor} gets an {@link onSubscribe} call
   * from the {@link Flowable} producer, it requests that the {@link Flowable}
   * begin sending it items: either {@link capacity} items, if the capacity was
   * set during the call to {@link QueuingFlowableProcessor#constructor}, or
   * {@link MAX_REQUEST_N} items (effectively unlimited).
   *
   * @param {ISubscription} s - the subscription from the source {@link Flowable}
   */
  onSubscribe(s: ISubscription) {
    if (this._done) {
      s.cancel();
    } else {
      s.request(this._capacity || MAX_REQUEST_N);
    }
  }

  /**
   * The {@link Flowable} producer calls this method to add an item to the queue
   * of this {@link QueuingFlowableProcessor} for later emission to its
   * subscriber.
   *
   * @param {T} t - the item to add
   * @throws {Error} if {@link t} is null. Flowables are not permitted to emit
   *   null values.
   */
  onNext(t: T) {
    if (t === null) {
      throw new Error('t is null');
    }
    if (!this._capacity || this._queue.length < this._capacity) {
      this._queue.push(t);
    }
    this.drain();
  }

  /**
   * The {@link Flowable} producer calls this method to signal to this
   * {@link QueuingFlowableProcessor} that the producer has encountered an error.
   * The {@link QueuingFlowableProcessor} will pass this error on to its
   * subscriber after it has finished sending the remaining items in its queue.
   *
   * @param {Error} t - the specific error
   */
  onError(t: Error) {
    if (t === null) {
      throw new Error('t is null');
    }
    this._error = t;
    this._done = true;
    this.drain();
  }

  /**
   * The {@link Flowable} producer calls this method to signal to this
   * {@link QueuingFlowableProcessor} that the producer has finished emitting
   * items. The {@link QueuingFlowableProcessor} will pass this message on to its
   * subscriber after it has finished sending the remaining items in its queue.
   */
  onComplete() {
    this._done = true;
    this.drain();
  }

  /**
   * The subscriber to this {@link QueuingFlowableProcessor} calls this method to
   * request a certain number of additional items.
   *
   * @example <caption>Note that requests are additive:</caption>
   * // this is equivalent to request(5):
   * myQFP.request(2);
   * myQFP.request(3);
   *
   * @param {number} n - the number of items to request
   * @throws {Error} if {@link n} is zero or negative
   */
  request(n: number) {
    if (n > 0) {
      this._requested += n;
      this.drain();
    } else {
      throw new Error('Invalid N for request, must be > 0: ' + n);
    }
  }

  /**
   * The subscriber to this {@link QueuingFlowableProcessor} calls this method to
   * indicate that it wants no more items and that the
   * {@link QueuingFlowableProcessor} can stop work and empty its queue.
   */
  cancel() {
    this._cancelled = true;
    if (this._wip++ === 0) {
      this._actual = null;
      this._queue = [];
    }
  }

  /**
   * Add a mapping function that modifies each emission from the {@link Flowable}
   * producer before emitting it from the {@link QueuingFlowableProcessor}. Note
   * that you can call this multiple times to add multiple mapping functions,
   * each of which will operate on the outputs of its predecessor.
   *
   * @param {function} transformer - a transformation function that accepts an
   *   item emitted by the {@link Flowable} producer and returns an item
   *   expected by the subscriber or by the next transformer
   * @return {QueuingFlowableProcessor} this same processor, modified with the
   *   transformation function
   */
  map(transformer) {
    this._transformers.push(transformer);
    return this;
  }

  /**
   * Drain the existing queue of items that are ready for emission by the
   * {@link QueuingFlowableProcessor} by emitting them to its subscriber. This
   * is typically called implicitly by other methods of the
   * {@link QueuingFlowableProcessor}, not explicitly by the producer or
   * subscriber.
   */
  drain() {
    if (this._actual == null) {
      return;
    }
    if (this._wip++ !== 0) {
      return;
    }

    const missed = 1;

    for (;;) {
      const r = this._requested;
      let e = 0;

      while (e !== r) {
        if (this._cancelled) {
          this._actual = null;
          this._queue = [];
          return;
        }

        const d = this._done;
        const v = this._queue.shift();
        const empty = v == null;

        if (d && empty) {
          if (this._actual != null) {
            const ex = this._error;
            if (ex != null) {
              this._actual.onError(ex);
            } else {
              this._actual.onComplete();
            }
            this._actual = null;
          }
          return;
        }

        if (empty) {
          break;
        }

        if (this._actual != null) {
          const transformedV = this._transformers.reduce(
            (interim, xform) => xform(interim),
            v,
          );
          this._actual.onNext(transformedV);
        }

        e++;
      }

      if (e == r) {
        if (this._cancelled) {
          this._actual = null;
          this._queue = [];
          return;
        }
        const d = this._done;
        const empty = this._queue.length === 0;

        if (d && empty) {
          if (this._actual != null) {
            const ex = this._error;
            if (ex != null) {
              this._actual.onError(ex);
            } else {
              this._actual.onComplete();
            }
            this._actual = null;
          }
          return;
        }
      }

      if (e != 0) {
        this._requested -= e;
      }

      const m = this._wip - missed;
      this._wip = m;
      if (m == 0) {
        break;
      }
    }
  }
}
