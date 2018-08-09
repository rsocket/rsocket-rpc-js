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

import type {Frame} from './Types.js';

/**
 * Protocol Version
 */
export const MAJOR_VERSION = 0;
export const MINOR_VERSION = 1;

export const MAJOR_VERSION_SIZE = 2;
export const MINOR_VERSION_SIZE = 2;
export const FRAME_TYPE_SIZE = 2;

export const FRAME_HEADER_SIZE =
  MAJOR_VERSION_SIZE + MINOR_VERSION_SIZE + FRAME_TYPE_SIZE;

export function encodeFrameHeader(buffer: Buffer, frame: Frame) {
  let offset = buffer.writeUInt16BE(frame.majorVersion || MAJOR_VERSION, 0);
  offset = buffer.writeUInt16BE(frame.minorVersion || MINOR_VERSION, offset);
  return buffer.writeUInt16BE(frame.type, offset);
}

export function getMajorVersion(buffer: Buffer): number {
  return buffer.readUInt16BE(0);
}

export function getMinorVersion(buffer: Buffer): number {
  return buffer.readUInt16BE(MAJOR_VERSION_SIZE);
}

export function getFrameType(buffer: Buffer): number {
  return buffer.readUInt16BE(MAJOR_VERSION_SIZE + MINOR_VERSION_SIZE);
}
