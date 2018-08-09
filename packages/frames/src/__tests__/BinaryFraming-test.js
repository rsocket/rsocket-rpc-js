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
 */

import {expect} from 'chai';
import {describe, it} from 'mocha';

import {encodeFrame, decodeFrame} from '../BinaryFraming';
import {FrameTypes} from '../Frame';

describe('BROKER_SETUP', () => {
  it('serializes BROKER_SETUP frames', () => {
    const brokerId = 'brokerId';
    const clusterId = 'clusterId';
    const accessKey = Number.MAX_SAFE_INTEGER;
    const accessToken = Buffer.from([0x0a, 0x0b, 0x0c]);
    const input = {
      type: FrameTypes.BROKER_SETUP,
      brokerId,
      clusterId,
      accessKey,
      accessToken,
    };

    const buffer = encodeFrame(input);
    const frame = decodeFrame(buffer);

    expect(input.type).to.equal(frame.type);
    expect(input.brokerId).to.equal(frame.brokerId);
    expect(input.clusterId).to.equal(frame.clusterId);
    expect(input.accessKey).to.equal(frame.accessKey);
    expect(input.accessToken).to.deep.equal(frame.accessToken);
  });
});

describe('DESTINATION_SETUP', () => {
  it('serializes DESTINATION_SETUP frames', () => {
    const destination = 'destination';
    const group = 'group';
    const accessKey = Number.MAX_SAFE_INTEGER;
    const accessToken = Buffer.from([0x0a, 0x0b, 0x0c]);
    const input = {
      type: FrameTypes.DESTINATION_SETUP,
      destination,
      group,
      accessKey,
      accessToken,
    };

    const buffer = encodeFrame(input);
    const frame = decodeFrame(buffer);

    expect(input.type).to.equal(frame.type);
    expect(input.destination).to.equal(frame.destination);
    expect(input.group).to.equal(frame.group);
    expect(input.accessKey).to.equal(frame.accessKey);
    expect(input.accessToken).to.deep.equal(frame.accessToken);
  });
});

describe('DESTINATION', () => {
  it('serializes DESTINATION frames', () => {
    const fromDestination = 'fromDestination';
    const fromGroup = 'fromGroup';
    const toDestination = 'toDestination';
    const toGroup = 'toGroup';
    const metadata = Buffer.from([0x0a, 0x0b, 0x0c]);
    const input = {
      type: FrameTypes.DESTINATION,
      fromDestination,
      fromGroup,
      toDestination,
      toGroup,
      metadata,
    };

    const buffer = encodeFrame(input);
    const frame = decodeFrame(buffer);

    expect(input.type).to.equal(frame.type);
    expect(input.fromDestination).to.equal(frame.fromDestination);
    expect(input.fromGroup).to.equal(frame.fromGroup);
    expect(input.toDestination).to.equal(frame.toDestination);
    expect(input.toGroup).to.equal(frame.toGroup);
    expect(input.metadata).to.deep.equal(frame.metadata);
  });
});

describe('GROUP', () => {
  it('serializes GROUP frames', () => {
    const fromDestination = 'fromDestination';
    const fromGroup = 'fromGroup';
    const toGroup = 'toGroup';
    const metadata = Buffer.from([0x0a, 0x0b, 0x0c]);
    const input = {
      type: FrameTypes.GROUP,
      fromDestination,
      fromGroup,
      toGroup,
      metadata,
    };

    const buffer = encodeFrame(input);
    const frame = decodeFrame(buffer);

    expect(input.type).to.equal(frame.type);
    expect(input.fromDestination).to.equal(frame.fromDestination);
    expect(input.fromGroup).to.equal(frame.fromGroup);
    expect(input.toGroup).to.equal(frame.toGroup);
    expect(input.metadata).to.deep.equal(frame.metadata);
  });
});

describe('BROADCAST', () => {
  it('serializes BROADCAST frames', () => {
    const fromDestination = 'fromDestination';
    const fromGroup = 'fromGroup';
    const toGroup = 'toGroup';
    const metadata = Buffer.from([0x0a, 0x0b, 0x0c]);
    const input = {
      type: FrameTypes.BROADCAST,
      fromDestination,
      fromGroup,
      toGroup,
      metadata,
    };

    const buffer = encodeFrame(input);
    const frame = decodeFrame(buffer);

    expect(input.type).to.equal(frame.type);
    expect(input.fromDestination).to.equal(frame.fromDestination);
    expect(input.fromGroup).to.equal(frame.fromGroup);
    expect(input.toGroup).to.equal(frame.toGroup);
    expect(input.metadata).to.deep.equal(frame.metadata);
  });
});

describe('SHARD', () => {
  it('serializes SHARD frames', () => {
    const fromDestination = 'fromDestination';
    const fromGroup = 'fromGroup';
    const toGroup = 'toGroup';
    const shardKey = Buffer.from([0x0a, 0x0b, 0x0c]);
    const metadata = Buffer.from([0x0d, 0x0e, 0x0f]);
    const input = {
      type: FrameTypes.SHARD,
      fromDestination,
      fromGroup,
      toGroup,
      shardKey,
      metadata,
    };

    const buffer = encodeFrame(input);
    const frame = decodeFrame(buffer);

    expect(input.type).to.equal(frame.type);
    expect(input.fromDestination).to.equal(frame.fromDestination);
    expect(input.fromGroup).to.equal(frame.fromGroup);
    expect(input.toGroup).to.equal(frame.toGroup);
    expect(input.shardKey).to.deep.equal(frame.shardKey);
    expect(input.metadata).to.deep.equal(frame.metadata);
  });
});
