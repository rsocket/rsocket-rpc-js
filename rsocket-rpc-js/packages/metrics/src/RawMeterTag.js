/**
 *  A simple counter object
 *
 *  @flow
 */

'use strict';

export default class RawMeterTag {
  key: string;
  value: string;

  constructor(key: string, value: string) {
    this.key = key;
    this.value = value;
  }
}
