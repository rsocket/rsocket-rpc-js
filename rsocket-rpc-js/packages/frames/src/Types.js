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

export type Frame =
  | BrokerSetupFrame
  | DestinationSetupFrame
  | DestinationFrame
  | GroupFrame
  | BroadcastFrame
  | ShardFrame;

// prettier-ignore
export type BrokerSetupFrame = {|
  type: 0x01,
  majorVersion: ?number,
  minorVersion: ?number,
  brokerId: string,
  clusterId: string,
  accessKey: number,
  accessToken: Buffer
|};

// prettier-ignore
export type DestinationSetupFrame = {|
  type: 0x02,
  majorVersion: ?number,
  minorVersion: ?number,
  destination: string,
  group: string,
  accessKey: number,
  accessToken: Buffer
|};

// prettier-ignore
export type DestinationFrame = {|
  type: 0x03,
  majorVersion: ?number,
  minorVersion: ?number,
  fromDestination: string,
  fromGroup: string,
  toDestination: string,
  toGroup: string,
  metadata: Buffer,
|};

// prettier-ignore
export type GroupFrame = {|
  type: 0x04,
  majorVersion: ?number,
  minorVersion: ?number,
  fromDestination: string,
  fromGroup: string,
  toGroup: string,
  metadata: Buffer,
|};

// prettier-ignore
export type BroadcastFrame = {|
  type: 0x05,
  majorVersion: ?number,
  minorVersion: ?number,
  fromDestination: string,
  fromGroup: string,
  toGroup: string,
  metadata: Buffer,
|};

// prettier-ignore
export type ShardFrame = {|
  type: 0x06,
  majorVersion: ?number,
  minorVersion: ?number,
  fromDestination: string,
  fromGroup: string,
  toGroup: string,
  shardKey: Buffer,
  metadata: Buffer,
|};
