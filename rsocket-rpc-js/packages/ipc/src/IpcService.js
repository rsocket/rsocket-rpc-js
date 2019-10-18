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

import type {Marshaller} from './Marshaller';

import type {
  ConnectionStatus,
  DuplexConnection,
  Encodable,
  Payload,
  ReactiveSocket,
  SetupFrame,
  Responder,
  PartialResponder
} from 'rsocket-types';

/**
 * IpcService wraps a Responder in order to manage marshalling and unmarshalling of payload data
 */
export default class IPCRSocketService implements Responder<D, M> {
  _service: string;
  _marshaller: Marshaller;
  _responder: PartialResponder<D, M>;

  constructor(service: string, marshaller: Marshaller, responder: Responder<D, M>) {
    this._service = service;
    this._marshaller = marshaller;
    this._responder = responder;
  }

  fireAndForget(payload: Payload<D, M>): void {
    if (!typeof this._responder.fireAndForget === 'function') {
      throw new Error('No fireAndForget method implemented on the Responder.');
    }
    this._responder.fireAndForget(this._marshaller.unmarshall(payload));
  }

  requestResponse(payload: Payload<D, M>): Single<Payload<D, M>> {
    if (!typeof this._responder.requestResponse === 'function') {
      throw new Error('No requestResponse method implemented on the Responder.');
    }
    return this._responder.requestResponse(this._marshaller.unmarshall(payload));
  }

  requestStream(payload: Payload<D, M>): Flowable<Payload<D, M>> {
    if (!typeof this._responder.requestStream === 'function') {
      throw new Error('No requestStream method implemented on the Responder.');
    }
    return this._responder.requestStream(this._marshaller.unmarshall(payload));
  }

  requestChannel(payloads: Flowable<Payload<D, M>>) {
    if (!typeof this._responder.requestChannel === 'function') {
      throw new Error('No requestChannel method implemented on the Responder.');
    }
    return this._responder.requestChannel(payloads.map(this._marshaller.unmarshall));
  }

  metadataPush(payload: Payload<D, M>): Single<Payload<D, M>> {
    if (!typeof this._responder.metadataPush === 'function') {
      throw new Error('No metadataPush method implemented on the Responder.');
    }
    return this._responder.metadataPush(this._marshaller.unmarshall(payload));
  }
}
