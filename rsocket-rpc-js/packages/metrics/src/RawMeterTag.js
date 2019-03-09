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
 * @param {string} key - 
 * @param {string} value - 
 */
export default class RawMeterTag {
  /**
   * @member {string} key
   */
  key: string;
  /**
   * @member {string} value
   */
  value: string;

  constructor(key: string, value: string) {
    this.key = key;
    this.value = value;
  }
}
