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

import type {Responder, Payload} from 'rsocket-types';

import {Flowable, Single} from 'rsocket-flowable';

import {getService} from 'rsocket-rpc-frames';

export default class RequestHandlingRSocket
  implements Responder<Buffer, Buffer> {
  _registeredServices: Map<string, Responder<Buffer, Buffer>>;

  constructor() {
    this._registeredServices = new Map();
  }

  addService(service: string, handler: Responder<Buffer, Buffer>) {
    this._registeredServices.set(service, handler);
  }

  fireAndForget(payload: Payload<Buffer, Buffer>): void {
    if (payload.metadata == null) {
      throw new Error('metadata is empty');
    }

    const service = getService(payload.metadata);
    const handler = this._registeredServices.get(service);

    if (handler == null) {
      throw new Error('can not find service ' + service);
    }

    handler.fireAndForget(payload);
  }

  requestResponse(
    payload: Payload<Buffer, Buffer>,
  ): Single<Payload<Buffer, Buffer>> {
    try {
      if (payload.metadata == null) {
        return Single.error(new Error('metadata is empty'));
      }

      const service = getService(payload.metadata);
      const handler = this._registeredServices.get(service);

      if (handler == null) {
        return Single.error(new Error('can not find service ' + service));
      }

      return handler.requestResponse(payload);
    } catch (error) {
      return Single.error(error);
    }
  }

  requestStream(
    payload: Payload<Buffer, Buffer>,
  ): Flowable<Payload<Buffer, Buffer>> {
    try {
      if (payload.metadata == null) {
        return Flowable.error(new Error('metadata is empty'));
      }

      const service = getService(payload.metadata);
      const handler = this._registeredServices.get(service);

      if (handler == null) {
        return Flowable.error(new Error('can not find service ' + service));
      }

      return handler.requestStream(payload);
    } catch (error) {
      return Flowable.error(error);
    }
  }

  requestChannel(
    payloads: Flowable<Payload<Buffer, Buffer>>,
  ): Flowable<Payload<Buffer, Buffer>> {
    return Flowable.error(new Error('requestChannel() is not implemented'));
  }

  metadataPush(payload: Payload<Buffer, Buffer>): Single<void> {
    return Single.error(new Error('metadataPush() is not implemented'));
  }
}
