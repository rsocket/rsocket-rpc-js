/**
 * @name QueuingFlowableProcessor.js
 * @fileoverview Defines the {@link QueuingFlowableProcessor} class.
 *
 * @requires NPM:rsocket-types
 * @exports QueuingFlowableProcessor
 */

/**
 * An asynchronous, pull-based stream of values. Call the <tt>subscribe()</tt>
 * method to generate a call to the subscriber's <tt>onSubscribe()</tt> method
 * with a Subscription object that has two methods: <tt>cancel()</tt> and
 * <tt>request(n)</tt>.
 *
 * @see {@link https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-types/src/ReactiveStreamTypes.js}
 * @interface IPublisher
 */
/**
 * A version of the {@link ISubscriber} interface in which the methods are
 * optional, so that you may elect to only implement a subset of them.
 *
 * @see {@link https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-types/src/ReactiveStreamTypes.js}
 * @interface IPartialSubscriber
/**
 * A handler for values provided by a Publisher.
 * @see {@link https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-types/src/ReactiveStreamTypes.js}
 * @interface ISubscriber
 */
/**
 * An underlying source of values for a Publisher.
 * @see {@link https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-types/src/ReactiveStreamTypes.js}
 * @interface ISubscription
 */
import type {
  IPublisher,
  ISubscriber,
  IPartialSubscriber,
  ISubscription,
} from 'rsocket-types';

/**
 * MAX_REQUEST_N (from QueuingFlowableProcessor.js). If no <tt>capacity</tt> is
 * passed to the {@link QueuingFlowableProcessor#constructor}, this value will
 * be used as the capacity (the maximum number of items to request from the
 * source Flowable). This effectively signals that you want an unlimited number
 * of values from the source Flowable.
 *
 * @constant
 * @type {number}
 */
const MAX_REQUEST_N = 0x7fffffff; // uint31

/**
 * @param {number} [capacity] - (optional) the maximum number of items to request from the source Flowable (default = {@link MAX_REQUEST_N})
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

  constructor(capacity?: number) {
    this._once = false;
    this._requested = 0;
    this._actual = null;
    this._error = null;
    this._done = false;
    this._wip = 0;
    this._cancelled = false;
    this._capacity = capacity;
    this._queue = [];
    this._transformers = [];
  }

  /**
   * Subscribe to this {@link QueuingFlowableProcessor}.
   *
   * @param {Subscriber<T>} s
   * @throws {Error} if a Subscriber is already subscribed to this
   *   QueuingFlowableProcessor
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
   * When the {@link QueuingFlowableProcessor} gets an <tt>onSubscribe</tt> call
   * from the source Flowable, it requests that the Flowable begin sending it
   * items: either <tt>capacity</tt> items, if the capacity was set during the
   * call to {@link QueuingFlowableProcessor#constructor}, or
   * {@link MAX_REQUEST_N} items (effectively unlimited).
   *
   * @param {ISubscription} s the subscription from the source Flowable
   */
  onSubscribe(s: ISubscription) {
    if (this._done) {
      s.cancel();
    } else {
      s.request(this._capacity || MAX_REQUEST_N);
    }
  }

  /**
   * @param {T} t
   * @throws {Error} if <tt>t</tt> is <tt>null</tt>. Flowables are not permitted
   *   to emit null values.
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
   * @param {Error} t
   */
  onError(t: Error) {
    if (t === null) {
      throw new Error('t is null');
    }
    this._error = t;
    this._done = true;
    this.drain();
  }

  onComplete() {
    this._done = true;
    this.drain();
  }

  /**
   * Request a certain number of additional items from this
   * {@link QueuingFlowableProcessor}. Note that requests are additive;
   * <tt>request(2); request(3);</tt> is equivalent to <tt>request(5);</tt>
   *
   * @param {number} n the number of items to request
   * @throws {Error} if <tt>n</tt> is zero or negative
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
   * Call this to indicate that you want no more items from this
   * {@link QueuingFlowableProcessor} and that it can stop work and release
   * its resources.
   */
  cancel() {
    this._cancelled = true;
    if (this._wip++ === 0) {
      this._actual = null;
      this._queue = [];
    }
  }

  /**
   * Add a mapping function that accepts an item from the source Flowable and
   * modifies it before it is to be emitted from the
   * {@link QueuingFlowableProcessor}. Note that you can call this multiple
   * times to add multiple mapping functions, each of which will operate on the
   * outputs of its predecessor.
   *
   * @param {function} transformer a transformation function
   */
  map(transformer) {
    this._transformers.push(transformer);
    return this;
  }

  /**
   * Drain the existing queue of items that are ready for emission by the
   * {@link QueuingFlowableProcessor} by emitting them.
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
