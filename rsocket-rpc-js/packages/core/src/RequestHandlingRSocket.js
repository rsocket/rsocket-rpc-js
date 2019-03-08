/**
 * @fileOverview Defines the {@link RequestHandlingRSocket} class.
 * @copyright Copyright (c) 2017-present, Netifi Inc.
 * @license Apache-2.0
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
 *
 * @requires NPM:rsocket-types
 * @requires NPM:rsocket-flowable
 * @requires NPM:rsocket-rps-frames
 * @requires SwitchTransformOperator
 * @exports RequestHandlingRSocket
 */

import type {Responder, Payload} from 'rsocket-types';

import {Flowable, Single} from 'rsocket-flowable';

import {getService} from 'rsocket-rpc-frames';
import SwitchTransformOperator from './SwitchTransformOperator';

/**
 */
export default class RequestHandlingRSocket
  implements Responder<Buffer, Buffer> {
  _registeredServices: Map<string, Responder<Buffer, Buffer>>;

  /**
   * @constructs RequestHandlingRSocket
   */
  constructor() {
    this._registeredServices = new Map();
  }

  /**
   *
   * @param {string} service
   * @param {Responder} handler
   */
  addService(service: string, handler: Responder<Buffer, Buffer>) {
    this._registeredServices.set(service, handler);
  }

  /**
   *
   * @param {Payload} payload the request payload
   * @throws {Error} if there is no registered service
   * @throws {Error} if the request payload metadata is null
   */
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

  /**
   *
   * @param {Payload} payload the request payload
   * @returns {Single} a Single that emits the response payload
   */
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

  /**
   *
   * @param {Payload} payload the request payload
   * @returns {Flowable} a Flowable that emits the response payloads
   */
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

  /**
   *
   * @param {Flowable} payloads the request payloads
   * @returns {Flowable} a Flowable that emits the response payloads
   */
  requestChannel(
    payloads: Flowable<Payload<Buffer, Buffer>>,
  ): Flowable<Payload<Buffer, Buffer>> {
    return new Flowable(s => payloads.subscribe(s)).lift(
      s =>
        new SwitchTransformOperator(s, (payload, flowable) => {
          if (payload.metadata === undefined || payload.metadata === null) {
            return Flowable.error(new Error('metadata is empty'));
          } else {
            const service = getService(payload.metadata);
            const handler = this._registeredServices.get(service);
            if (handler === undefined || handler === null) {
              return Flowable.error(
                new Error('can not find service ' + service),
              );
            } else {
              return handler.requestChannel(flowable);
            }
          }
        }),
    );
  }

  /**
   * This function is not implemented in this class.
   *
   * @param {Payload}
   * @returns {Single} a Single that signals an error and terminates
   */
  metadataPush(payload: Payload<Buffer, Buffer>): Single<void> {
    return Single.error(new Error('metadataPush() is not implemented'));
  }
}
