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

import type {Frame} from './Types';

import {FrameTypes, getFrameTypeName} from './Frame';

import {
  getMajorVersion,
  getMinorVersion,
  getFrameType,
} from './FrameHeaderFlyweight';

import {
  encodeBrokerSetupFrame,
  decodeBrokerSetupFrame,
} from './BrokerSetupFlyweight';

import {
  encodeDestinationSetupFrame,
  decodeDestinationSetupFrame,
} from './DestinationSetupFlyweight';

import {
  encodeDestinationFrame,
  decodeDestinationFrame,
} from './DestinationFlyweight';

import {encodeGroupFrame, decodeGroupFrame} from './GroupFlyweight';

import {encodeBroadcastFrame, decodeBroadcastFrame} from './BroadcastFlyweight';

import {encodeShardFrame, decodeShardFrame} from './ShardFlyweight';

import invariant from 'fbjs/lib/invariant';

/**
 * Convert the frame to a (binary) buffer.
 */
export function encodeFrame(frame: Frame): Buffer {
  switch (frame.type) {
    case FrameTypes.BROKER_SETUP:
      return encodeBrokerSetupFrame(frame);
    case FrameTypes.DESTINATION_SETUP:
      return encodeDestinationSetupFrame(frame);
    case FrameTypes.DESTINATION:
      return encodeDestinationFrame(frame);
    case FrameTypes.GROUP:
      return encodeGroupFrame(frame);
    case FrameTypes.BROADCAST:
      return encodeBroadcastFrame(frame);
    case FrameTypes.SHARD:
      return encodeShardFrame(frame);
    default:
      invariant(
        false,
        'ProteusBinaryFraming: Unsupported frame type `%s`.',
        getFrameTypeName(frame.type),
      );
  }
}

/**
 * Read a frame from the buffer.
 */
export function decodeFrame(buffer: Buffer): Frame {
  const majorVersion = getMajorVersion(buffer);
  const minorVersion = getMinorVersion(buffer);
  const type = getFrameType(buffer);

  switch (type) {
    case FrameTypes.BROKER_SETUP:
      return decodeBrokerSetupFrame(buffer, majorVersion, minorVersion);
    case FrameTypes.DESTINATION_SETUP:
      return decodeDestinationSetupFrame(buffer, majorVersion, minorVersion);
    case FrameTypes.DESTINATION:
      return decodeDestinationFrame(buffer, majorVersion, minorVersion);
    case FrameTypes.GROUP:
      return decodeGroupFrame(buffer, majorVersion, minorVersion);
    case FrameTypes.BROADCAST:
      return decodeBroadcastFrame(buffer, majorVersion, minorVersion);
    case FrameTypes.SHARD:
      return decodeShardFrame(buffer, majorVersion, minorVersion);
    default:
      invariant(
        false,
        'ProteusBinaryFraming: Unsupported frame type `%s`.',
        getFrameTypeName(type),
      );
  }
}
