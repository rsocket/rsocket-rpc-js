/**
 * @fileOverview A simple counter object.
 *
 * @flow
 *
 * @exports RawMeterTag
 */

'use strict';

/**
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

  /**
   * @constructs RawMeterTag
   */
  constructor(key: string, value: string) {
    this.key = key;
    this.value = value;
  }
}
