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

'use strict';

/* eslint-disable consistent-return, no-bitwise */

import type {BrokerSetupFrame} from './Types';

import {FrameTypes} from './Frame';

import {FRAME_HEADER_SIZE, encodeFrameHeader} from './FrameHeaderFlyweight';

import {UTF8Encoder, BufferEncoder, createBuffer} from 'rsocket-core';

import {
  readUInt64BE,
  writeUInt64BE,
} from 'rsocket-core/build/RSocketBufferUtils';

const BROKER_ID_LENGTH_SIZE = 4;
const CLUSTER_ID_LENGTH_SIZE = 4;
const ACCESS_KEY_SIZE = 8;
const ACCESS_TOKEN_LENGTH_SIZE = 4;

export function encodeBrokerSetupFrame(frame: BrokerSetupFrame): Buffer {
  const brokerIdLength = UTF8Encoder.byteLength(frame.brokerId);
  const clusterIdLength = UTF8Encoder.byteLength(frame.clusterId);
  const accessTokenLength = BufferEncoder.byteLength(frame.accessToken);

  const buffer = createBuffer(
    FRAME_HEADER_SIZE +
      BROKER_ID_LENGTH_SIZE +
      brokerIdLength +
      CLUSTER_ID_LENGTH_SIZE +
      clusterIdLength +
      ACCESS_KEY_SIZE +
      ACCESS_TOKEN_LENGTH_SIZE +
      accessTokenLength,
  );

  let offset = encodeFrameHeader(buffer, frame);

  offset = buffer.writeUInt32BE(brokerIdLength, offset);
  offset = UTF8Encoder.encode(
    frame.brokerId,
    buffer,
    offset,
    offset + brokerIdLength,
  );

  offset = buffer.writeUInt32BE(clusterIdLength, offset);
  offset = UTF8Encoder.encode(
    frame.clusterId,
    buffer,
    offset,
    offset + clusterIdLength,
  );

  offset = writeUInt64BE(buffer, frame.accessKey, offset);
  offset = buffer.writeUInt32BE(accessTokenLength, offset);
  BufferEncoder.encode(
    frame.accessToken,
    buffer,
    offset,
    offset + accessTokenLength,
  );

  return buffer;
}

export function decodeBrokerSetupFrame(
  buffer: Buffer,
  majorVersion: number,
  minorVersion: number,
): BrokerSetupFrame {
  let offset = FRAME_HEADER_SIZE;

  const brokerIdLength = buffer.readUInt32BE(offset);
  offset += BROKER_ID_LENGTH_SIZE;

  const brokerId = UTF8Encoder.decode(buffer, offset, offset + brokerIdLength);
  offset += brokerIdLength;

  const clusterIdLength = buffer.readUInt32BE(offset);
  offset += CLUSTER_ID_LENGTH_SIZE;

  const clusterId = UTF8Encoder.decode(
    buffer,
    offset,
    offset + clusterIdLength,
  );
  offset += clusterIdLength;

  const accessKey = readUInt64BE(buffer, offset);
  offset += ACCESS_KEY_SIZE;

  const accessTokenLength = buffer.readUInt32BE(offset);
  offset += ACCESS_TOKEN_LENGTH_SIZE;

  const accessToken = BufferEncoder.decode(
    buffer,
    offset,
    offset + accessTokenLength,
  );

  return {
    type: FrameTypes.BROKER_SETUP,
    majorVersion,
    minorVersion,
    brokerId,
    clusterId,
    accessKey,
    accessToken,
  };
}
