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
