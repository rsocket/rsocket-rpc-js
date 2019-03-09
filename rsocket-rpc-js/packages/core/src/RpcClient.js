/**
 * @name RpcClient.js
 * @fileoverview Defines the {@link RpcClient} class and {@link ClientConfig} object.
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
 * @requires NPM:rsocket-core
 * @requires NPM:rsocket-flowable
 * @requires NPM:rsocket-types
 * @exports ClientConfig
 * @exports RpcClient
 */

'use strict';

/**
 * @typedef {(string|Buffer|Uint8Array)} Encodable
 */
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

/**
 * @typedef {Object} ClientConfig
 * @property {PayloadSerializers} [serializers] (optional) A serializer transforms data between the application encoding used in payloads and the encodable type accepted by the transport client. You typically will not need to implement your own serializer and deserializer, but if you do, you should pass your implementations to the RPC Client when you construct it.
 * @property {Setup} setup Configure the keepalive process and any metadata you would like to accompany the connection.
 * @property {DuplexConnection} transport Indicate which variety of duplex transport you are using, for example WebSocket or TCP. There are RSocketWebsocketClient and RSocketTcpClient classes that implement the required DuplexConnection interface for this component.
 * @property {Responder} [responder] (optional)
 */
export type ClientConfig<D, M> = {|
  serializers?: PayloadSerializers<D, M>,
  /**
   * @typedef {Object} Setup
   * @property {number} keepAlive The number of milliseconds between keepalive messages you will send to the service
   * @property {number} lifetime The number of milliseconds to wait after the last keepalive message from the service before you consider the connection timed out.
   * @property {Encodable} [metadata] (optional) Data you would like to send to the service at connection-time (this can be any arbitrary data the service expects, for example, authentication credentials).
   */
  setup: {|
    keepAlive: number,
    lifetime: number,
    metadata?: Encodable,
  |},
  transport: DuplexConnection,
  responder?: Responder<D, M>,
|};

/**
 * @param {ClientConfig<D,M>} config -
 */
export default class RpcClient<D, M> {
  _config: ClientConfig<D, M>;
  _connection: ?Single<ReactiveSocket<D, M>>;

  constructor(config: ClientConfig<D, M>) {
    this._config = config;
    this._connection = null;
  }

  /**
   * Close the RPC Client connection.
   */
  close(): void {
    this._config.transport.close();
  }

  /**
   * Returns a <tt>Single</tt>, which, when you subscribe to it, initiates the
   * connection and emits a <tt>ReactiveSocket</tt> object that defines the
   * connection.
   *
   * @returns {Single<ReactiveSocket<D,M>>}
   * @throws {Error} if the RpcClient is already connected
   */
  connect(): Single<ReactiveSocket<D, M>> {
    invariant(
      !this._connection,
      'RpcClient: Unexpected call to connect(), already connected.',
    );
    this._connection = new Single(subscriber => {
      const transport = this._config.transport;
      let subscription;
      transport.connectionStatus().subscribe({
        onNext: status => {
          if (status.kind === 'CONNECTED') {
            subscription && subscription.cancel();
            subscriber.onComplete(new RpcSocket(this._config, transport));
          } else if (status.kind === 'ERROR') {
            subscription && subscription.cancel();
            subscriber.onError(status.error);
          } else if (status.kind === 'CLOSED') {
            subscription && subscription.cancel();
            subscriber.onError(new Error('RpcClient: Connection closed.'));
          }
        },
        onSubscribe: _subscription => {
          subscriber.onSubscribe(() => _subscription.cancel());
          subscription = _subscription;
          subscription.request(Number.MAX_SAFE_INTEGER);
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
class RpcSocket<D, M> implements ReactiveSocket<D, M> {
  _machine: ReactiveSocket<D, M>;

  constructor(config: ClientConfig<D, M>, connection: DuplexConnection) {
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
    this._machine.fireAndForget(payload);
  }

  requestResponse(payload: Payload<D, M>): Single<Payload<D, M>> {
    return this._machine.requestResponse(payload);
  }

  requestStream(payload: Payload<D, M>): Flowable<Payload<D, M>> {
    return this._machine.requestStream(payload);
  }

  requestChannel(payloads: Flowable<Payload<D, M>>): Flowable<Payload<D, M>> {
    return this._machine.requestChannel(payloads);
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

  _buildSetupFrame(config: ClientConfig<D, M>): SetupFrame {
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
