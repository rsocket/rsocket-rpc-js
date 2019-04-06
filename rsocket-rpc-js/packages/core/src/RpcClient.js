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
 * @external
 * @see https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-types/src/ReactiveSocketTypes.js
 * @typedef {(string|Buffer|Uint8Array)} Encodable
 */
/**
 * @example <caption>The methods of the Responder interface:</caption>
 * fireAndForget(payload: Payload<D, M>): void
 * requestResponse(payload: Payload<D, M>): Single<Payload<D, M>>
 * requestStream(payload: Payload<D, M>): Flowable<Payload<D, M>>
 * requestChannel(payloads: Flowable<Payload<D, M>>): Flowable<Payload<D, M>>
 * metadataPush(payload: Payload<D, M>): Single<void>
 * @external
 * @see https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-types/src/ReactiveSocketTypes.js
 * @typedef {interface} Responder
 * @property {function} fireAndForget
 * @property {function} requestResponse
 * @property {function} requestStream
 * @property {function} requestChannel
 * @property {function} metadataPush
 */
/**
 * A contract that provides different interaction models according to the
 * ReactiveSocket protocol. This interface extends the {@link Responder}
 * interface by adding the {@link ReactiveSocket#close} and
 * {@link ReactiveSocket#connectionStatus} methods.
 * @extends {Responder}
 * @external
 * @see https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-types/src/ReactiveSocketTypes.js
 * @see https://github.com/ReactiveSocket/reactivesocket/blob/master/Protocol.md
 * @typedef {interface} ReactiveSocket
 * @property {function} fireAndForget
 * @property {function} requestResponse
 * @property {function} requestStream
 * @property {function} requestChannel
 * @property {function} metadataPush
 * @property {function} close
 * @property {function} connectionStatus
 */
/**
 * Represents a network connection with input/output used by a
 * {@link ReactiveSocket} to send/receive data.
 * @external
 * @see https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-types/src/ReactiveSocketTypes.js
 * @typedef {interface} DuplexConnection
 * @property {function} sendOne
 * @property {function} send
 * @property {function} receive
 * @property {function} close
 * @property {function} connect
 * @property {function} connectionStatus
 */
/**
 * A single unit of data exchanged between the peers of a
 * {@link ReactiveSocket}. A object of this type consists of two members:
 * {@link Payload#data} and {@link Payload#metadata}.
 * @external
 * @see https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-types/src/ReactiveSocketTypes.js
 * @typedef {Object} Payload
 * @property {Serializer} data
 * @property {Serializer} metadata
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
/**
 * @external
 * @see https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-core/src/RSocketSerialization.js
 * @typedef {Object} Serializer
 * @desc A Serializer transforms data between the application encoding used in
 * Payloads and the Encodable type accepted by the transport client.
 * @property {function} deserialize a function that takes an {@link Encodable} and returns the expected data or metadata object
 * @property {function} serialize a funciton that takes a data or metadata object and returns a corresponding {@link Encodable}
 */
/**
 * @external
 * @see https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-core/src/RSocketSerialization.js
 * @typedef {Object} PayloadSerializers
 * @property {Serializer} data
 * @property {Serializer} metadata
 */
import type {PayloadSerializers} from 'rsocket-core/build/RSocketSerialization';

/**
 * @external
 * @see https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-flowable/src/Flowable.js
 * @typedef {Object} Flowable
 * @property {function} just
 * @property {function} error
 * @property {function} never
 * @property {function} subscribe
 * @property {function} lift
 * @property {function} map
 * @property {function} take
 */
/**
 * @external
 * @see https://github.com/rsocket/rsocket-js/blob/master/packages/rsocket-flowable/src/Single.js
 * @typedef {Object} Single
 * @property {function} of
 * @property {function} error
 * @property {function} subscribe
 * @property {function} flatMap
 * @property {function} map
 * @property {function} then
 */
import {Flowable, Single, every} from 'rsocket-flowable';
import invariant from 'fbjs/lib/invariant';

import {CONNECTION_STREAM_ID, FLAGS, FRAME_TYPES} from 'rsocket-core';
import {MAJOR_VERSION, MINOR_VERSION} from 'rsocket-core/build/RSocketVersion';
import {createClientMachine} from 'rsocket-core/build/RSocketMachine';

/**
 * @typedef {Object} Setup
 * @property {number} keepAlive The number of milliseconds between keepalive messages you will send to the service
 * @property {number} lifetime The number of milliseconds to wait after the last keepalive message from the service before you consider the connection timed out.
 * @property {?Encodable} [metadata] Data you would like to send to the service at connection-time (this can be any arbitrary data the service expects, for example, authentication credentials).
 */
/**
 * @typedef {Object} ClientConfig
 * @property {PayloadSerializers} [serializers] A serializer transforms data between the application encoding used in payloads and the encodable type accepted by the transport client. You typically will not need to implement your own serializer and deserializer, but if you do, you should pass your implementations to the RPC Client when you construct it.
 * @property {Setup} setup Configure the keepalive process and any metadata you would like to accompany the connection.
 * @property {DuplexConnection} transport Indicate which variety of duplex transport you are using, for example WebSocket or TCP. There are {@link RSocketWebsocketClient} and {@link RSocketTcpClient} classes that implement the required {@link DuplexConnection} interface for this component.
 * @property {Responder} [responder] An object that implements the five methods of the {@link Responder} interface, corresponding to the various RSocket interaction models. If the client doesn't intend to receive traffic, there is no need to add a responder. ({@link Responder} is a type alias for the RSocket API.)
 */
export type ClientConfig<D, M> = {|
  serializers?: PayloadSerializers<D, M>,
  setup: {|
    keepAlive: number,
    lifetime: number,
    metadata?: Encodable,
  |},
  transport: DuplexConnection,
  responder?: Responder<D, M>,
|};

/**
 * The primary class/entry point for the core package is the {@link RpcClient}.
 * The client encapsulates the RSocket methods of fireAndForget,
 * requestResponse, requestStream, and requestChannel and merges them with a
 * bidirectional connection, allowing seamless use of RSocket for RPC.
 */
export default class RpcClient<D, M> {
  _config: ClientConfig<D, M>;
  _connection: ?Single<ReactiveSocket<D, M>>;

  /**
   * @param {ClientConfig<D,M>} config -
   */
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
   * Returns a {@link Single}, which, when you subscribe to it, initiates the
   * connection and emits a {@link ReactiveSocket} object that defines the
   * connection.
   * @example <caption>Here is an example instantiation of an RpcClient:</caption>
   * const local = 'ws://localhost:8088/';
   * const keepAlive = 60000; // 60s in ms
   * const lifetime = 360000; // 360s in ms
   * const transport = new RSocketWebsocketClient({url:local}, BufferEncoders);
   * const client = new RpcClient({setup:{keepAlive, lifetime}, transport});
   * client.connect().subscribe({
   *   onComplete: rsocket => {
   *     console.info("Success! We have a handle to an RSocket connection");
   *   },
   *   onError: error => {
   *     console.error("Failed to connect to local RSocket server.", error);
   *   }
   * });
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
