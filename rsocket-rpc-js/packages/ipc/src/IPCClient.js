/**
 * Copyright (c) 2019-present, Netifi Inc.
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

'use strict';

import invariant from 'fbjs/lib/invariant';

import {Flowable, Single} from 'rsocket-flowable';
import type {
  ConnectionStatus,
  DuplexConnection,
  Encodable,
  Payload,
  ReactiveSocket,
  SetupFrame,
  Responder,
} from 'rsocket-types';
import {trace, traceSingle} from 'rsocket-rpc-tracing';
import { Tracer } from 'opentracing';
import {Metrics} from 'rsocket-rpc-metrics';
import {
  trace, traceSingle
} from 'rsocket-rpc-tracing';
import type {Marshaller} from './Marshaller';
import {IdentityMarshaller} from './Marshaller';
import { SpanSubscriber } from '../../tracing/src/SpanSubscriber';

const MAX_REQUEST_N = 0x7fffffff; // uint31

export default class IPCRSocketClient implements Responder<D, M>{
  _service: string;
  _socket: ReactiveSocket<D, M>;
  _marshaller: Marshaller;
  _meterRegistry?: IMeterRegistry;
  _tracer? Tracer;

  constructor(service: string, socket: ReactiveSocket<D, M>, marshaller?: Marshaller, meterRegistry?: IMeterRegistry, tracer?: Tracer) {

    this._service = service;
    this._socket = socket;
    this._marshaller = marshaller || IdentityMarshaller;
    this._meterRegistry = meterRegistry;
    this._tracer = tracer;
  }

  // TODO: sort out tag situation

  _getTracingWrapper(stream: boolean, ...tags: Object): func {
    if (stream) {
      return trace(this._tracer, this._service, ...tags);
    }
    return traceSingle(this._tracer, this._service, ...tags);
  }

  _getMetricsWrapper(stream: boolean, ...tags: Object): func {
    if (stream) {
      return Metrics.timed(this._meterRegistry, this._service, ...tags);
    }
    return Metrics.timedSingle(this._meterRegistry, this._service, ...tags);
  }

  fireAndForget(payload: Payload<D, M>, ...tags: Object): void {
    const tagMap = {};
    this._getMetricsWrapper(false, ...tags)(
      new Single(subscriber => {
        this._getTracingWrapper(false, ...tags)(tagMap)(
          new Single(innerSub => {
            this._socket.fireAndForget(this._marshaller._marshall(payload));
            innerSub.onSubscribe();
            innerSub.onComplete();
          })
        ).subscribe({ onSubscribe: () => { subscriber.onSubscribe(); }, onComplete: () => { subscriber.onComplete(); } });
      })
    ).subscribe();
  }

  requestResponse(payload: Payload<D, M>, ...tags: Object): Single<Payload<D, M>> {
    const tagMap = {};
    return this._getMetricsWrapper(false, ...tags)(
      this._getTracingWrapper(false, ...tags)(tagMap)(
          new Single(subscriber => {
            this._socket.requestResponse(this._marshaller._marshall(payload))
              .map(this._marshaller._unmarshall)
              .subscribe(subscriber);
        })
      })
    );
  }

  requestStream(payload: Payload<D, M>, ...tags: Object): Flowable<Payload<D, M>> {
    const tagMap = {};
    return this._getMetricsWrapper(true, ...tags)(
      this._getTracingWrapper(true, ...tags)(tagMap)(
        new Flowable(subscriber => {
          this._socket.requestStream(this._marshaller._marshall(payload))
          .map(this._marshaller._unmarshall)
          .subscribe(subscriber);
        })
      )
    );
  }

  requestChannel(payloads: Flowable<Payload<D, M>>): Flowable<Payload<D, M>> {
    const tagMap = {};
    return this._getMetricsWrapper(true, ...tags)(
      this._getTracingWrapper(true, ...tags)(tagMap)(
        new Flowable(subscriber => {
          this._socket.requestChannel(payloads.map(this._marshaller._marshall))
            .map(this._marshaller._unmarshall)
            .subscribe(subscriber);
        })
      )
    );
  }
}
