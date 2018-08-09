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

import type {GroupFrame} from './Types';

import {FrameTypes} from './Frame';

import {FRAME_HEADER_SIZE, encodeFrameHeader} from './FrameHeaderFlyweight';

import {UTF8Encoder, BufferEncoder, createBuffer} from 'rsocket-core';

const FROM_DESTINATION_LENGTH_SIZE = 4;
const FROM_GROUP_LENGTH_SIZE = 4;
const TO_GROUP_LENGTH_SIZE = 4;

export function encodeGroupFrame(frame: GroupFrame): Buffer {
  const fromDestinationLength = UTF8Encoder.byteLength(frame.fromDestination);
  const fromGroupLength = UTF8Encoder.byteLength(frame.fromGroup);
  const toGroupLength = UTF8Encoder.byteLength(frame.toGroup);
  const metadataLength = BufferEncoder.byteLength(frame.metadata);

  const buffer = createBuffer(
    FRAME_HEADER_SIZE +
      FROM_DESTINATION_LENGTH_SIZE +
      fromDestinationLength +
      FROM_GROUP_LENGTH_SIZE +
      fromGroupLength +
      TO_GROUP_LENGTH_SIZE +
      toGroupLength +
      metadataLength,
  );

  let offset = encodeFrameHeader(buffer, frame);

  offset = buffer.writeUInt32BE(fromDestinationLength, offset);
  offset = UTF8Encoder.encode(
    frame.fromDestination,
    buffer,
    offset,
    offset + fromDestinationLength,
  );

  offset = buffer.writeUInt32BE(fromGroupLength, offset);
  offset = UTF8Encoder.encode(
    frame.fromGroup,
    buffer,
    offset,
    offset + fromGroupLength,
  );

  offset = buffer.writeUInt32BE(toGroupLength, offset);
  offset = UTF8Encoder.encode(
    frame.toGroup,
    buffer,
    offset,
    offset + toGroupLength,
  );

  BufferEncoder.encode(frame.metadata, buffer, offset, offset + metadataLength);

  return buffer;
}

export function decodeGroupFrame(
  buffer: Buffer,
  majorVersion: number,
  minorVersion: number,
): GroupFrame {
  let offset = FRAME_HEADER_SIZE;

  const fromDestinationLength = buffer.readUInt32BE(offset);
  offset += FROM_DESTINATION_LENGTH_SIZE;

  const fromDestination = UTF8Encoder.decode(
    buffer,
    offset,
    offset + fromDestinationLength,
  );
  offset += fromDestinationLength;

  const fromGroupLength = buffer.readUInt32BE(offset);
  offset += FROM_GROUP_LENGTH_SIZE;

  const fromGroup = UTF8Encoder.decode(
    buffer,
    offset,
    offset + fromGroupLength,
  );
  offset += fromGroupLength;

  const toGroupLength = buffer.readUInt32BE(offset);
  offset += TO_GROUP_LENGTH_SIZE;

  const toGroup = UTF8Encoder.decode(buffer, offset, offset + toGroupLength);
  offset += toGroupLength;

  const metadata = BufferEncoder.decode(buffer, offset, buffer.length);

  return {
    type: FrameTypes.GROUP,
    majorVersion,
    minorVersion,
    fromDestination,
    fromGroup,
    toGroup,
    metadata,
  };
}
