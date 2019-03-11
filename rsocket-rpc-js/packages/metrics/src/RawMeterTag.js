/**
 * @name RawMeterTag.js
 * @fileoverview A simple counter object.
 *
 * @flow
 *
 * @exports RawMeterTag
 */

'use strict';

/**
 */
export default class RawMeterTag {
  key: string;
  value: string;

  /**
   * @param {string} key -
   * @param {string} value -
   */
  constructor(key: string, value: string) {
    /** @type {string} */
    this.key = key;
    /** @type {string} */
    this.value = value;
  }
}
