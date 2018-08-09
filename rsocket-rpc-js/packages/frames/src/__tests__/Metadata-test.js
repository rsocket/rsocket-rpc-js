import {expect} from 'chai';
import {describe, it} from 'mocha';

import {
  encodeMetadata,
  getService,
  getMethod,
  getTracing,
  getMetadata,
} from '../Metadata';

function randomBytes(min, max) {
  let size = Math.floor(Math.random() * (max - min)) + min;
  return new Array(size).map(() => {
    return randomByte();
  });
}

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
