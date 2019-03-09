/**
 * @name Metadata-test.js
 */
import {expect} from 'chai';
import {describe, it} from 'mocha';

import {
  encodeMetadata,
  getService,
  getMethod,
  getTracing,
  getMetadata,
} from '../Metadata';

/**
 * @param {number} min - the fewest number of bytes in the array
 * @param {number} max - the array must be smaller than this number in size
 * @return {number[]} an array of between <tt>min</tt> and <tt>max−1</tt>
 * numbers, each of which is in the range [0,256)
 */
function randomBytes(min, max) {
  let size = Math.floor(Math.random() * (max - min)) + min;
  return new Array(size).map(() => {
    return randomByte();
  });
}

/**
 * @return {number} a pseudo-random number between [0,256)
 */
function randomByte() {
  return Math.floor(Math.random() * 256);
}

describe('METADATA', () => {
  it('serializes/deserializes metadata NO TRACING', () => {
    const service = 'service';
    const method = 'foo';
    const metadata = Buffer.from(randomBytes(5, 20));

    const encoded = encodeMetadata(service, method, undefined, metadata);

    expect(service).to.equal(getService(encoded));
    expect(method).to.equal(getMethod(encoded));
    expect(getTracing(encoded)).to.deep.equal(Buffer.from([]));
    expect(metadata).to.deep.equal(getMetadata(encoded));
  });

  it('serializes/deserializes metadata WITH TRACING', () => {
    const service = 'service';
    const method = 'foo';
    const tracing = Buffer.from(randomBytes(5, 20));
    const metadata = Buffer.from(randomBytes(5, 20));

    const encoded = encodeMetadata(service, method, tracing, metadata);

    expect(service).to.equal(getService(encoded));
    expect(method).to.equal(getMethod(encoded));
    expect(tracing).to.deep.equal(getTracing(encoded));
    expect(metadata).to.deep.equal(getMetadata(encoded));
  });
});
