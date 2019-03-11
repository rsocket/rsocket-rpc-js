import {expect} from 'chai';
import {describe, it} from 'mocha';

import {mapToBuffer, bufferToMap} from '../Tracing';

function generateMap() {
  const size = Math.floor(Math.random() * 100) + 20;
  const map = {};
  for (var i = 0; i < size; i++) {
    const key = generateString(5, 20);
    const value = generateString(10, 50);
    map[key] = value;
  }
  return map;
}

function generateString(min, max) {
  const size = Math.floor(Math.random() * max) + min;
  let nextWord = '';
  for (var j = 0; j < size; j++) {
    nextWord += generateChar();
  }
  return nextWord;
}

const chars = 'abcdefghijklmnopqrstuvwxyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const generateChar = () => chars[Math.floor(Math.random() * chars.length)];

/**
 * @test {Tracing}
 */
describe('TRACING HELPERS', () => {
  it('serializes and deserializes an arbitrary map', () => {
    for (var i = 0; i < 1000; i++) {
      const baseMap = generateMap();
      const buf = mapToBuffer(baseMap);
      const newBuf = Buffer.from(buf);
      const testMap = bufferToMap(newBuf);
      expect(testMap).to.deep.equal(baseMap);
    }
  });
});
