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
import {trace, traceSingle, mapToBuffer} from 'rsocket-rpc-tracing';
import { Tracer } from 'opentracing';
import {Metrics} from 'rsocket-rpc-metrics';
import {
  trace, traceSingle
} from 'rsocket-rpc-tracing';
import {encodeMetadata} from 'rsocket-rpc-frames';
import type {Marshaller} from './Marshaller';
import {IdentityMarshaller} from './Marshaller';
import { SpanSubscriber } from '../../tracing/src/SpanSubscriber';

const MAX_REQUEST_N = 0x7fffffff; // uint31

export default class IPCRSocketClient {
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

  _getTracingWrapper(stream: boolean, method: string): func {
    if (stream) {
      return trace(this._tracer, this._service, {'rsocket.service': this._service}, {'rsocket.rpc.role': 'client'}, {'rsocket.rpc.version': ''}, {'method': method});
    }
    return traceSingle(this._tracer, this._service, {'rsocket.service': this._service}, {'rsocket.rpc.role': 'client'}, {'rsocket.rpc.version': ''}, {'method': method});
  }

  _getMetricsWrapper(stream: boolean, method: string): func {
    if (stream) {
      return Metrics.timed(this._meterRegistry, this._service, {'service': this._service}, {'role': 'client'}, {'method': method});
    }
    return Metrics.timedSingle(this._meterRegistry, this._service, {'service': this._service}, {'role': 'client'}, {'method': method});
  }

  fireAndForget(method: string, payload: Payload<D, M>): void {
    const tracingMap = {};
    this._getMetricsWrapper(false, method)(
      new Single(subscriber => {
        this._getTracingWrapper(false, method)(tracingMap)(
          new Single(innerSub => {
            const data = this._marshaller._marshall(payload.data);
            const tracingMetadata = mapToBuffer(tracingMap);
            const metadata = encodeMetadata(this._service, method, tracingMetadata, payload.metadata || Buffer.alloc(0));
            this._socket.fireAndForget({ data, metadata });
            innerSub.onSubscribe();
            innerSub.onComplete();
          })
        ).subscribe({ onSubscribe: () => { subscriber.onSubscribe(); }, onComplete: () => { subscriber.onComplete(); } });
      })
    ).subscribe();
  }

  requestResponse(method: string, payload: Payload<D, M>): Single<Payload<D, M>> {
    const tracingMap = {};
    return this._getMetricsWrapper(false, method)(
      this._getTracingWrapper(false, method)(tracingMap)(
          new Single(subscriber => {
            const data = this._marshaller._marshall(payload.data);
            const tracingMetadata = mapToBuffer(tracingMap);
            const metadata = encodeMetadata(this._service, method, tracingMetadata, payload.metadata || Buffer.alloc(0));
            this._socket.requestResponse({ data, metadata })
              .map(response => {
                return this._marshaller._unmarshall(response.data);
              })
              .subscribe(subscriber);
        })
      })
    );
  }

  requestStream(method: string, payload: Payload<D, M>): Flowable<Payload<D, M>> {
    const tracingMap = {};
    return this._getMetricsWrapper(true, method)(
      this._getTracingWrapper(true, method)(tracingMap)(
        new Flowable(subscriber => {
          const data = this._marshaller._marshall(payload.data);
          const tracingMetadata = mapToBuffer(tracingMap);
          const metadata = encodeMetadata(this._service, method, tracingMetadata, payload.metadata || Buffer.alloc(0));
          this._socket.requestStream({ data, metadata })
            .map(response => {
              return this._marshaller._unmarshall(response.data);
            })
            .subscribe(subscriber);
        })
      )
    );
  }

  requestChannel(method: string, payloads: Flowable<Payload<D, M>>): Flowable<Payload<D, M>> {
    const tracingMap = {};
    return this._getMetricsWrapper(true, method)(
      this._getTracingWrapper(true, method)(tracingMap)(
        new Flowable(subscriber => {
          this._socket.requestChannel(payloads.map(payload => {
            const data = this._marshaller._marshall(payload.data);
            const tracingMetadata = mapToBuffer(tracingMap);
            const metadata = encodeMetadata(this._service, method, tracingMetadata, payload.metadata || Buffer.alloc(0));
            return { data, metadata };
          }))
            .map(response => {
              return this._marshaller._unmarshall(response.data);
            })
            .subscribe(subscriber);
        })
      )
    );
  }
}
