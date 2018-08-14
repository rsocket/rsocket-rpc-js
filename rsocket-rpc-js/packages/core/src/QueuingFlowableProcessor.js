import type {
  IPublisher,
  ISubscriber,
  IPartialSubscriber,
  ISubscription,
} from 'rsocket-types';

const MAX_REQUEST_N = 0x7fffffff; // uint31

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

  subscribe(s: Subscriber<T>) {
    if (!this._once) {
      this._once = true;
      this._actual = s;
      s.onSubscribe(this);
    } else {
      throw new Error('Only one Subscriber allowed');
    }
  }

  onSubscribe(s: ISubscription) {
    if (this._done) {
      s.cancel();
    } else {
      s.request(this._capacity || MAX_REQUEST_N);
    }
  }

  onNext(t: T) {
    if (t === null) {
      throw new Error('t is null');
    }
    if (!this._capacity || this._queue.length < this._capacity) {
      this._queue.push(t);
    }
    this.drain();
  }

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

  request(n: number) {
    if (n > 0) {
      this._requested += n;
      this.drain();
    } else {
      throw new Error('Invalid N for request, must be > 0: ' + n);
    }
  }

  cancel() {
    this._cancelled = true;
    if (this._wip++ === 0) {
      this._actual = null;
      this._queue = [];
    }
  }

  map(transformer) {
    this._transformers.push(transformer);
    return this;
  }

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
