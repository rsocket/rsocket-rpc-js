/**
 * @name Metadata.js
 * @fileoverview Provides methods for encoding and reading payload metadata.
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
 * @requires NPM:rsocket-types
 * @requires NPM:rsocket-core
 */

'use strict';

/* eslint-disable consistent-return, no-bitwise */

import type {Encodable} from 'rsocket-types';

import {UTF8Encoder, BufferEncoder, createBuffer} from 'rsocket-core';

export const VERSION = 1;

export const VERSION_SIZE = 2;
export const SERVICE_LENGTH_SIZE = 2;
export const METHOD_LENGTH_SIZE = 2;
export const TRACING_LENGTH_SIZE = 2;

/**
 * Use this method to send well-formed call routing metadata with your payloads.
 *
 * @param {string} service - the service name
 * @param {string} method - the method name
 * @param {Encodable} tracing - tracing information
 * @param {Encodable} metadata - arbitrary metadata
 * @return {Buffer} the above fields encoded in a proper fashion
 */
export function encodeMetadata(
  service: string,
  method: string,
  tracing: Encodable,
  metadata: Encodable,
): Buffer {
  const serviceLength = UTF8Encoder.byteLength(service);
  const methodLength = UTF8Encoder.byteLength(method);
  const metadataLength = BufferEncoder.byteLength(metadata);
  // We can't overload the method call directly and the code generator currently only populates
  // the first 3 parameters
  if (undefined === tracing) {
    tracing = createBuffer(0);
  }
  const tracingLength = BufferEncoder.byteLength(tracing);

  const buffer = createBuffer(
    VERSION_SIZE +
      SERVICE_LENGTH_SIZE +
      serviceLength +
      METHOD_LENGTH_SIZE +
      methodLength +
      TRACING_LENGTH_SIZE +
      tracingLength +
      metadataLength,
  );

  let offset = buffer.writeUInt16BE(VERSION, 0);

  offset = buffer.writeUInt16BE(serviceLength, offset);
  offset = UTF8Encoder.encode(service, buffer, offset, offset + serviceLength);

  offset = buffer.writeUInt16BE(methodLength, offset);
  offset = UTF8Encoder.encode(method, buffer, offset, offset + methodLength);

  offset = buffer.writeUInt16BE(tracingLength, offset);
  offset = BufferEncoder.encode(
    tracing,
    buffer,
    offset,
    offset + tracingLength,
  );

  BufferEncoder.encode(metadata, buffer, offset, offset + metadataLength);

  return buffer;
}

/**
 * Get the version number from the metadata.
 *
 * @param {Buffer} buffer the metadata buffer that contains the version number
 * @return {number} the version number
 */
export function getVersion(buffer: Buffer): number {
  return buffer.readUInt16BE(0);
}

/**
 * Get the service name from the metadata.
 *
 * @param {Buffer} buffer the metadata buffer that contains the service name
 * @return {string} the service name
 */
export function getService(buffer: Buffer): string {
  let offset = VERSION_SIZE;

  const serviceLength = buffer.readUInt16BE(offset);
  offset += SERVICE_LENGTH_SIZE;

  return UTF8Encoder.decode(buffer, offset, offset + serviceLength);
}

/**
 * Get the method name from the metadata.
 *
 * @param {Buffer} buffer the metadata buffer that contains the method name
 * @return {string} the method name
 */
export function getMethod(buffer: Buffer): string {
  let offset = VERSION_SIZE;

  const serviceLength = buffer.readUInt16BE(offset);
  offset += SERVICE_LENGTH_SIZE + serviceLength;

  const methodLength = buffer.readUInt16BE(offset);
  offset += METHOD_LENGTH_SIZE;

  return UTF8Encoder.decode(buffer, offset, offset + methodLength);
}

/**
 * Get the tracing information from the metadata.
 *
 * @param {Buffer} buffer the metadata buffer that contains tracing information
 * @return {Buffer} the tracing information
 */
export function getTracing(buffer: Buffer): Buffer {
  let offset = VERSION_SIZE;

  const serviceLength = buffer.readUInt16BE(offset);
  offset += SERVICE_LENGTH_SIZE + serviceLength;

  const methodLength = buffer.readUInt16BE(offset);
  offset += METHOD_LENGTH_SIZE + methodLength;

  const tracingLength = buffer.readUInt16BE(offset);
  offset += TRACING_LENGTH_SIZE;

  return BufferEncoder.decode(buffer, offset, offset + tracingLength);
}

/**
 * Get the metadata field from the metadata.
 *
 * @param {Buffer} buffer the metadata buffer
 * @return {Buffer} the metadata field
 */
export function getMetadata(buffer: Buffer): Buffer {
  let offset = VERSION_SIZE;

  const serviceLength = buffer.readUInt16BE(offset);
  offset += SERVICE_LENGTH_SIZE + serviceLength;

  const methodLength = buffer.readUInt16BE(offset);
  offset += METHOD_LENGTH_SIZE + methodLength;

  const tracingLength = buffer.readUInt16BE(offset);
  offset += TRACING_LENGTH_SIZE + tracingLength;

  return BufferEncoder.decode(buffer, offset, buffer.length);
}
