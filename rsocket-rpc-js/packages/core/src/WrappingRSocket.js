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

import type {ReactiveSocket, Payload, ConnectionStatus} from 'rsocket-types';

import {Flowable, Single} from 'rsocket-flowable';

import {FrameTypes, encodeFrame} from 'rsocket-rpc-frames';

export default class WrappingRSocket implements ReactiveSocket<Buffer, Buffer> {
  _transformer: (Payload<Buffer, Buffer>) => Payload<Buffer, Buffer>;
  _source: ReactiveSocket<Buffer, Buffer>;

  constructor(
    transformer: (Payload<Buffer, Buffer>) => Payload<Buffer, Buffer>,
    source: ReactiveSocket<Buffer, Buffer>,
  ) {
    this._transformer = transformer;
    this._source = source;
  }

  static group(
    fromGroup: string,
    fromDestination: string,
    toGroup: string,
    source: ReactiveSocket<Buffer, Buffer>,
  ): ReactiveSocket<Buffer, Buffer> {
    return new WrappingRSocket(payload => {
      const metadata = encodeFrame({
        type: FrameTypes.GROUP,
        majorVersion: null,
        minorVersion: null,
        fromGroup,
        fromDestination,
        toGroup,
        metadata: payload.metadata || Buffer.alloc(0),
      });
      return {
        data: payload.data,
        metadata,
      };
    }, source);
  }

  static destination(
    fromGroup: string,
    fromDestination: string,
    toGroup: string,
    toDestination: string,
    source: ReactiveSocket<Buffer, Buffer>,
  ): ReactiveSocket<Buffer, Buffer> {
    return new WrappingRSocket(payload => {
      const metadata = encodeFrame({
        type: FrameTypes.DESTINATION,
        majorVersion: null,
        minorVersion: null,
        fromGroup,
        fromDestination,
        toGroup,
        toDestination,
        metadata: payload.metadata || Buffer.alloc(0),
      });
      return {
        data: payload.data,
        metadata,
      };
    }, source);
  }

  fireAndForget(payload: Payload<Buffer, Buffer>): void {
    this._source.fireAndForget(this._transformer(payload));
  }

  requestResponse(
    payload: Payload<Buffer, Buffer>,
  ): Single<Payload<Buffer, Buffer>> {
    try {
      return this._source.requestResponse(this._transformer(payload));
    } catch (error) {
      return Single.error(error);
    }
  }

  requestStream(
    payload: Payload<Buffer, Buffer>,
  ): Flowable<Payload<Buffer, Buffer>> {
    try {
      return this._source.requestStream(this._transformer(payload));
    } catch (error) {
      return Flowable.error(error);
    }
  }

  requestChannel(
    payloads: Flowable<Payload<Buffer, Buffer>>,
  ): Flowable<Payload<Buffer, Buffer>> {
    return this._source.requestChannel(
      payloads.map(payload => this._transformer(payload)),
    );
  }

  metadataPush(payload: Payload<Buffer, Buffer>): Single<void> {
    try {
      return this._source.metadataPush(this._transformer(payload));
    } catch (error) {
      return Single.error(error);
    }
  }

  close(): void {
    this._source.close();
  }

  connectionStatus(): Flowable<ConnectionStatus> {
    return this._source.connectionStatus();
  }
}
