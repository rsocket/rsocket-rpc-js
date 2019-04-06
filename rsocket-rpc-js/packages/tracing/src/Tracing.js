/**
 * @name Tracing.js
 * @fileoverview Tracing functionality.
 * @requires NPM:rsocket-core
 * @requires NPM:rsocket-types
 * @requires NPM:rsocket-flowable
 * @requires NPM:opentracing
 * @requires NPM:rsocket-rpc-frames
 * @requires SpanSubscriber
 * @requires SpanSingle
 * @exports deserializeTraceData
 * @exports mapToBuffer
 * @exports bufferToMap
 * @exports trace
 * @exports traceAsChild
 * @exports traceSingle
 * @exports traceSingleAsChild
 */

import {UTF8Encoder, BufferEncoder, createBuffer} from 'rsocket-core';
import {ISubscriber} from 'rsocket-types';
import {Flowable, Single} from 'rsocket-flowable';

import {SpanSubscriber} from './SpanSubscriber';
import {createSpanSingle} from './SpanSingle';
import {SpanContext, Tracer, FORMAT_TEXT_MAP} from 'opentracing';

import {getTracing} from 'rsocket-rpc-frames';

/**
 * @param {?Tracer} tracer - an OpenTracing {@link Tracer}
 * @param {Buffer} metadata -
 * @returns {?SpanContext} or null if the tracer is null or there is no tracing data
 * @see https://opentracing.io/
 * @see https://opentracing-javascript.surge.sh/classes/tracer.html
 */
export function deserializeTraceData(tracer, metadata) {
  if (!tracer) {
    return null;
  }

  const tracingData = getTracing(metadata);

  if (BufferEncoder.byteLength(tracingData) <= 0) {
    return null;
  }

  return tracer.extract(FORMAT_TEXT_MAP, bufferToMap(tracingData));
}

/**
 * @param {?Object} map -
 * @returns {Buffer}
 */
export function mapToBuffer(map: Object): Buffer {
  if (!map || Object.keys(map).length <= 0) {
    return createBuffer(0);
  }

  const aggregatedTags = Object.keys(map).reduce(
    (aggregate, key) => {
      const val = map[key];
      const keyLen = UTF8Encoder.byteLength(key);
      const keyBuf = createBuffer(keyLen);
      UTF8Encoder.encode(key, keyBuf, 0, keyLen);

      const valLen = UTF8Encoder.byteLength(val);
      const valBuf = createBuffer(valLen);
      UTF8Encoder.encode(val, valBuf, 0, valLen);

      const newEntries = aggregate.entries;
      newEntries.push({keyLen, keyBuf, valLen, valBuf});

      return {
        // 4 for the sizes plus the actual key and actual value
        totalSize: aggregate.totalSize + 4 + keyLen + valLen,
        entries: newEntries,
      };
    },
    {totalSize: 0, entries: []},
  );

  let offset = 0;
  const resultBuf = createBuffer(aggregatedTags.totalSize);
  aggregatedTags.entries.forEach(entry => {
    resultBuf.writeUInt16BE(entry.keyLen, offset);
    offset += 2; // 2 bytes for key length

    BufferEncoder.encode(
      entry.keyBuf,
      resultBuf,
      offset,
      offset + entry.keyLen,
    );
    offset += entry.keyLen;

    resultBuf.writeUInt16BE(entry.valLen, offset);
    offset += 2;

    BufferEncoder.encode(
      entry.valBuf,
      resultBuf,
      offset,
      offset + entry.valLen,
    );
    offset += entry.valLen;
  });

  return resultBuf;
}

/**
 * @param {!Buffer} buffer -
 * @returns {Object}
 */
export function bufferToMap(buffer: Buffer): Object {
  const result = {};

  let offset = 0;
  while (offset < buffer.length) {
    let keyLen = buffer.readUInt16BE(offset);
    offset += 2;

    let key = UTF8Encoder.decode(buffer, offset, offset + keyLen);
    offset += keyLen;

    let valLen = buffer.readUInt16BE(offset);
    offset += 2;

    let value = UTF8Encoder.decode(buffer, offset, offset + valLen);
    offset += valLen;

    result[key] = value;
  }

  return result;
}

/**
 * Allows propagation of a {@link SpanContext} map through a {@link Flowable}.
 *
 * @example <caption>Wraps default tags "tag1" and "tag2" and picks up "additionalTag1" and "additionalTag2":</caption>
 * const traceCapture = trace(myTracer, "myOperation", {tag1: "value"}, {tag2: "another value"});
 *
 * ... more code ...
 *
 * const subscriberTransformer = traceCapture({additionalTag1: 1, additionalTag2: "two"});
 *
 * subscriberTransformer(rsocket.requestStream(serviceRequest))
 * .subscribe({ ... });
 *
 * @param {?Tracer} tracer - an OpenTracing {@link Tracer}
 * @param {?String} name - an operation name
 * @param {Object} tags - You can pass a collection of tags in the form of a map/Object and have it woven through a Flowable=>Flowable function.
 * @returns {function}
 * @see https://opentracing-javascript.surge.sh/classes/spancontext.html
 * @see https://opentracing.io/
 * @see https://opentracing-javascript.surge.sh/classes/tracer.html
 */
export function trace<T>(
  tracer?: Tracer,
  name?: String,
  ...tags: Object
): Object => (Flowable<T>) => Flowable<T> {
  if (tracer && name) {
    return (metadata: Object) => {
      return (flowable: Flowable<T>) => {
        return flowable.lift((subscriber: ISubscriber<T>) => {
          return new SpanSubscriber(
            subscriber,
            tracer,
            name,
            null,
            metadata,
            ...tags,
          );
        });
      };
    };
  } else {
    return (map: Object) => (publisher: Flowable<T>) => publisher;
  }
}

/**
 * Similar to {@link trace}, except meant to be used on the server side where a
 * {@link SpanContext} has been passed from a client.
 * @example
 * const traceCapture = traceAsChild(myTracer, "myServerOperation", {serverTag1: "value"}, {serverTag2: "another value"});
 * const subscriberTransformer = traceCapture(deserializeTraceData(myTracer, requestMetadata));
 * return subscriberTransformer(serviceImpl.requestStream(serviceRequest));
 * @param {?Tracer} tracer - an OpenTracing {@link Tracer}
 * @param {?String} name - an operation name
 * @param {Object} tags - You can pass a collection of tags in the form of a map/Object and have it woven through a Flowable=>Flowable function.
 * @returns {function}
 * @see https://opentracing-javascript.surge.sh/classes/spancontext.html
 * @see https://opentracing.io/
 * @see https://opentracing-javascript.surge.sh/classes/tracer.html
 */
export function traceAsChild<T>(
  tracer?: Tracer,
  name?: String,
  ...tags: Object
): SpanContext => (Flowable<T>) => Flowable<T> {
  if (tracer && name) {
    return (context: SpanContext) => {
      return (flowable: Flowable<T>) => {
        return flowable.lift((subscriber: ISubscriber<T>) => {
          return new SpanSubscriber(
            subscriber,
            tracer,
            name,
            context,
            null,
            ...tags,
          );
        });
      };
    };
  } else {
    return (context: SpanContext) => (publisher: Flowable<T>) => publisher;
  }
}

/**
 * Allows propagation of a {@link SpanContext} map through a Flowable.
 *
 * @example <caption>Wraps default tags "tag1" and "tag2" and picks up "additionalTag1" and "additionalTag2":</caption>
 * const traceCapture = trace(myTracer, "myOperation", {tag1: "value"}, {tag2: "another value"});
 *
 * ... more code ...
 *
 * const subscriberTransformer = traceCapture({additionalTag1: 1, additionalTag2: "two"});
 *
 * subscriberTransformer(rsocket.requestStream(serviceRequest))
 * .subscribe({ ... });
 *
 * @param {?Tracer} tracer - an OpenTracing {@link Tracer}
 * @param {?String} name - an operation name
 * @param {Object} tags - You can pass a collection of tags in the form of a map/Object and have it woven through a Single=>Single function.
 * @returns {function}
 * @see https://opentracing-javascript.surge.sh/classes/spancontext.html
 * @see https://opentracing.io/
 * @see https://opentracing-javascript.surge.sh/classes/tracer.html
 */
export function traceSingle<T>(
  tracer?: Tracer,
  name?: String,
  ...tags: Object
): Object => (Single<T>) => Single<T> {
  if (tracer && name) {
    return (metadata: Object) => {
      return (single: Single<T>) => {
        return createSpanSingle(single, tracer, name, null, metadata, ...tags);
      };
    };
  } else {
    return (map: Object) => (single: Single<T>) => single;
  }
}

/**
 * Similar to {@link traceSingle}, except meant to be used on the server side
 * where a {@link SpanContext} has been passed from a client.
 * @example
 * const traceCapture = traceAsChild(myTracer, "myServerOperation", {serverTag1: "value"}, {serverTag2: "another value"});
 * const subscriberTransformer = traceCapture(deserializeTraceData(myTracer, requestMetadata));
 * return subscriberTransformer(serviceImpl.requestStream(serviceRequest));
 * @param {?Tracer} tracer - an OpenTracing {@link Tracer}
 * @param {?String} name - an operation name
 * @param {Object} tags - You can pass a collection of tags in the form of a map/Object and have it woven through a Single=>Single function.
 * @returns {function}
 * @see https://opentracing-javascript.surge.sh/classes/spancontext.html
 * @see https://opentracing.io/
 * @see https://opentracing-javascript.surge.sh/classes/tracer.html
 */
export function traceSingleAsChild<T>(
  tracer?: Tracer,
  name?: String,
  ...tags: Object
): SpanContext => (Single<T>) => Single<T> {
  if (tracer && name) {
    return (context: SpanContext) => {
      return (single: Single<T>) => {
        return createSpanSingle(single, tracer, name, context, null, ...tags);
      };
    };
  } else {
    return (context: SpanContext) => (single: Single<T>) => single;
  }
}
