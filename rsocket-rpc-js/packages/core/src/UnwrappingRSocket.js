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

import {FrameTypes, getFrameTypeName, decodeFrame} from 'rsocket-rpc-frames';

export default class UnwrappingRSocket implements Responder<Buffer, Buffer> {
  _source: Responder<Buffer, Buffer>;

  constructor(source: Responder<Buffer, Buffer>) {
    this._source = source;
  }

  _unwrap(payload: Payload<Buffer, Buffer>): Payload<Buffer, Buffer> {
    if (payload.metadata == null) {
      throw new Error('metadata is empty');
    }

    const frame = decodeFrame(payload.metadata);
    switch (frame.type) {
      case FrameTypes.DESTINATION:
      case FrameTypes.GROUP:
      case FrameTypes.BROADCAST:
      case FrameTypes.SHARD:
        return {
          metadata: frame.metadata,
          data: payload.data,
        };

      default:
        throw new Error('unknown frame type ' + getFrameTypeName(frame.type));
    }
  }

  fireAndForget(payload: Payload<Buffer, Buffer>): void {
    this._source.fireAndForget(this._unwrap(payload));
  }

  requestResponse(
    payload: Payload<Buffer, Buffer>,
  ): Single<Payload<Buffer, Buffer>> {
    try {
      return this._source.requestResponse(this._unwrap(payload));
    } catch (error) {
      return Single.error(error);
    }
  }

  requestStream(
    payload: Payload<Buffer, Buffer>,
  ): Flowable<Payload<Buffer, Buffer>> {
    try {
      return this._source.requestStream(this._unwrap(payload));
    } catch (error) {
      return Flowable.error(error);
    }
  }

  requestChannel(
    payloads: Flowable<Payload<Buffer, Buffer>>,
  ): Flowable<Payload<Buffer, Buffer>> {
    return this._source.requestChannel(
      payloads.map(payload => this._unwrap(payload)),
    );
  }

  metadataPush(payload: Payload<Buffer, Buffer>): Single<void> {
    try {
      return this._source.metadataPush(this._unwrap(payload));
    } catch (error) {
      return Single.error(error);
    }
  }
}
