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

import type {
  ConnectionStatus,
  DuplexConnection,
  Encodable,
  Payload,
  ReactiveSocket,
  SetupFrame,
  Responder,
} from 'rsocket-types';
import type {PayloadSerializers} from 'rsocket-core/build/RSocketSerialization';

import {Flowable, Single, every} from 'rsocket-flowable';
import invariant from 'fbjs/lib/invariant';

import {CONNECTION_STREAM_ID, FLAGS, FRAME_TYPES} from 'rsocket-core';
import {MAJOR_VERSION, MINOR_VERSION} from 'rsocket-core/build/RSocketVersion';
import {createClientMachine} from 'rsocket-core/build/RSocketMachine';

import type {Marshaller} from './Marshaller';
import {IdentityMarshaller} from './Marshaller';

const MAX_REQUEST_N = 0x7fffffff; // uint31

export type IpcClientConfig<D, M> = {|
  serializers?: PayloadSerializers<D, M>,
  setup: {|
    keepAlive: number,
    lifetime: number,
    metadata?: Encodable,
  |},
  transport: DuplexConnection,
  responder?: Responder<D, M>,
  marshaller?: Marshaller
|};

export default class IpcClient<D, M> {
  _config: IpcClientConfig<D, M>;
  _connection: ?Single<ReactiveSocket<D, M>>;

  constructor(config: IpcClientConfig<D, M>) {
    this._config = config;
    this._connection = null;
  }

  close(): void {
    this._config.transport.close();
  }

  connect(): Single<ReactiveSocket<D, M>> {
    invariant(
      !this._connection,
      'IpcClient: Unexpected call to connect(), already connected.',
    );
    this._connection = new Single(subscriber => {
      const transport = this._config.transport;
      let subscription;
      transport.connectionStatus().subscribe({
        onNext: status => {
          if (status.kind === 'CONNECTED') {
            subscription && subscription.cancel();
            subscriber.onComplete(new IpcSocket(this._config, transport));
          } else if (status.kind === 'ERROR') {
            subscription && subscription.cancel();
            subscriber.onError(status.error);
          } else if (status.kind === 'CLOSED') {
            subscription && subscription.cancel();
            subscriber.onError(new Error('IpcClient: Connection closed.'));
          }
        },
        onSubscribe: _subscription => {
          subscriber.onSubscribe(() => _subscription.cancel());
          subscription = _subscription;
          subscription.request(MAX_REQUEST_N);
        },
      });
      transport.connect();
    });
    return this._connection;
  }
}

/**
 * @private
 */
class IpcSocket<D, M> implements ReactiveSocket<D, M> {
  _machine: ReactiveSocket<D, M>;
  _marshaller: Marshaller;

  constructor(config: IpcClientConfig<D, M>, connection: DuplexConnection) {
    this._marshaller = config.marshaller || IdentityMarshaller;
    this._machine = createClientMachine(
      connection,
      subscriber => connection.receive().subscribe(subscriber),
      config.serializers,
      config.responder,
    );

    // Send SETUP
    connection.sendOne(this._buildSetupFrame(config));

    // Send KEEPALIVE frames
    const {keepAlive} = config.setup;
    const keepAliveFrames = every(keepAlive).map(() => ({
      data: null,
      flags: FLAGS.RESPOND,
      lastReceivedPosition: 0,
      streamId: CONNECTION_STREAM_ID,
      type: FRAME_TYPES.KEEPALIVE,
    }));
    connection.send(keepAliveFrames);
  }

  fireAndForget(payload: Payload<D, M>): void {
    this._machine.fireAndForget(this._marshaller._marshall(payload));
  }

  requestResponse(payload: Payload<D, M>): Single<Payload<D, M>> {
    return this._machine.requestResponse(this._marshaller._marshall(payload)).map(this._marshaller._unmarshall);
  }

  requestStream(payload: Payload<D, M>): Flowable<Payload<D, M>> {
    return this._machine.requestStream(this._marshaller._marshall(payload)).map(this._marshaller._unmarshall);
  }

  requestChannel(payloads: Flowable<Payload<D, M>>): Flowable<Payload<D, M>> {
    return this._machine.requestChannel(payloads.map(this._marshaller._marshall)).map(this._marshaller._unmarshall);
  }

  metadataPush(payload: Payload<D, M>): Single<void> {
    return this._machine.metadataPush(payload);
  }

  close(): void {
    this._machine.close();
  }

  connectionStatus(): Flowable<ConnectionStatus> {
    return this._machine.connectionStatus();
  }

  _buildSetupFrame(config: IpcClientConfig<D, M>): SetupFrame {
    const {keepAlive, lifetime, metadata} = config.setup;

    return {
      flags: FLAGS.METADATA,
      keepAlive,
      lifetime,
      majorVersion: MAJOR_VERSION,
      minorVersion: MINOR_VERSION,
      metadataMimeType: 'application/binary',
      metadata,
      dataMimeType: 'application/binary',
      data: undefined,
      resumeToken: null,
      streamId: CONNECTION_STREAM_ID,
      type: FRAME_TYPES.SETUP,
    };
  }
}
