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
 *
 * @flow
 */

'use strict';

import {ISubscriber} from 'rsocket-types';
import {Flowable} from 'rsocket-flowable';
import {
  Meter,
  MeterId,
  MeterMeasurement,
  MetricsSnapshot,
  MeterStatistic,
  MeterType,
  MeterTag,
  Skew,
} from './proto/metrics_pb';
import {MetricsSnapshotHandlerClient} from './proto/metrics_rsocket_pb';
import RawMeterTag from './RawMeterTag';
import Timer from './Timer';
import {IMeterRegistry} from './IMeterRegistry';
import type {IMeter} from './IMeter';

export default class MetricsExporter {
  handler: MetricsSnapshotHandlerClient;
  registry: IMeterRegistry;
  exportPeriodSeconds: number;
  batchSize: number;
  intervalHandle: any;
  remoteSubscriber: ?ISubscriber<MetricsSnapshot>;
  remoteCancel: () => void;

  constructor(
    handler: MetricsSnapshotHandlerClient,
    registry: IMeterRegistry,
    exportPeriodSeconds: number,
    batchSize: number,
  ) {
    this.handler = handler;
    this.registry = registry;
    this.exportPeriodSeconds = exportPeriodSeconds;
    this.batchSize = batchSize; // TODO: use this to window the snapshots
  }

  start() {
    //Not re-entrant since we rely on the periodic event of the interval timer
    if (this.intervalHandle) {
      throw new Error('A metrics snapshot stream is already subscribed');
    }

    this.handler
      .streamMetrics(getMetricsSnapshotStream(this), Buffer.alloc(0))
      .subscribe({
        onNext: skew => recordClockSkew(skew),
        onComplete: () => restart(this),
        onError: error => {
          console.log('MetricsExporter error:' + error);
          restart(this);
        },
        onSubscribe: subscription => {
          this.remoteCancel = subscription.cancel;
          subscription.request(2147483647); // FaceBook thing - their Flowable only allows this
        },
      });
  }

  stop() {
    if (this.remoteCancel) {
      this.remoteCancel();
    }

    if (this.remoteSubscriber) {
      this.remoteSubscriber.onComplete();
      this.remoteSubscriber = null;
    }

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }
}

function restart(exporter: MetricsExporter) {
  exporter.stop();
  exporter.start();
}

function getMetricsSnapshotStream(
  exporter: MetricsExporter,
): Flowable<MetricsSnapshot> {
  return new Flowable(subscriber => {
    if (exporter.intervalHandle) {
      subscriber.onError(
        new Error('A metrics snapshot stream is already subscribed'),
      );
      return;
    }

    // Retain handle to subscriber so that we can complete on manual stop
    exporter.remoteSubscriber = subscriber;

    let pending = 0;
    console.log(
      'Setting interval for ' +
        exporter.exportPeriodSeconds * 1000 +
        ' milliseconds',
    );
    exporter.intervalHandle = setInterval(() => {
      if (pending > 0) {
        const allMeters = Array.prototype.concat.apply(
          [],
          exporter.registry.meters().map(convert),
        );
        const meterSnapshot = allMeters.reduce((snapshot, meter) => {
          snapshot.addMeters(meter);
          return snapshot;
        }, new MetricsSnapshot());

        subscriber.onNext(meterSnapshot);
        pending--;
      }
    }, exporter.exportPeriodSeconds * 1000);

    subscriber.onSubscribe({
      cancel: () => {
        // They won't care about the "complete" in this case, remove reference
        exporter.remoteSubscriber = null;
        exporter.stop();
      },
      request: n => {
        pending += n;
      },
    });
  });
}

function convert(meter: IMeter): Meter[] {
  const meterType = meterTypeLookup(meter.type);
  switch (meterType) {
    case MeterType.TIMER:
      return meter.convert(convertTimer);
    case MeterType.COUNTER:
    case MeterType.GAUGE:
    case MeterType.LONG_TASK_TIMER:
    case MeterType.DISTRIBUTION_SUMMARY:
    case MeterType.OTHER:
      return meter.convert(basicConverter);
    default:
      throw new Error('unsupported type ' + meterType);
  }
}

function meterTypeLookup(meterType: string): MeterType {
  switch (meterType) {
    case 'gauge':
      return MeterType.GAUGE;
    case 'timer':
      return MeterType.TIMER;
    case 'counter':
      return MeterType.COUNTER;
    case 'longTaskTimer':
      return MeterType.LONG_TASK_TIMER;
    case 'distributionSummary':
      return MeterType.DISTRIBUTION_SUMMARY;
    case 'other':
      return MeterType.OTHER;
    default:
      throw new Error('unknown type ' + meterType);
  }
}

function statisticTypeLookup(statistic: string): MeterStatistic {
  switch (statistic) {
    case 'max':
      return MeterStatistic.MAX;
    case 'count':
      return MeterStatistic.COUNT;
    case 'total':
      return MeterStatistic.TOTAL;
    case 'value':
      return MeterStatistic.VALUE;
    case 'unknown':
      return MeterStatistic.UNKNOWN;
    case 'duration':
      return MeterStatistic.DURATION;
    case 'totalTime':
      return MeterStatistic.TOTAL_TIME;
    case 'activeTasks':
      return MeterStatistic.ACTIVE_TASKS;
    default:
      throw new Error('unknown type ' + statistic);
  }
}

function convertTimer(imeter: IMeter): Meter[] {
  if (!(imeter instanceof Timer)) {
    throw new Error('Meter is not an instance of Timer');
  }

  const timer = (imeter: Timer);
  const meters = [];
  const name = timer.name;
  const tags = convertTags(timer.tags);

  //Add meters for percentiles of interest
  const valuesSnapshot = timer.percentiles();
  Object.keys(valuesSnapshot).forEach(percentile => {
    const value = toNanoseconds(valuesSnapshot[percentile]);
    // Make sure we're dealing with a real value before pushing
    if (!isNaN(value)) {
      const meter = new Meter();

      const percentileTag = new MeterTag();
      percentileTag.setKey('percentile');
      percentileTag.setValue(percentile);

      const meterId = new MeterId();
      meterId.setName(name);
      tags.forEach(tag => meterId.addTag(tag));
      meterId.addTag(percentileTag);
      meterId.setType(MeterType.TIMER);
      meterId.setDescription(timer.description);
      meterId.setBaseunit('nanoseconds');

      meter.setId(meterId);

      const measure = new MeterMeasurement();
      measure.setValue(value);
      measure.setStatistic(statisticTypeLookup(timer.statistic));

      meter.addMeasure(measure);

      meters.push(meter);
    }
  });

  //add a meter for total count and max time
  const histMeter = new Meter();

  const meterId = new MeterId();
  meterId.setName(name);
  tags.forEach(tag => meterId.addTag(tag));
  meterId.setType(MeterType.TIMER);
  meterId.setDescription(timer.description);
  meterId.setBaseunit('nanoseconds');

  const totalCount = new MeterMeasurement();
  totalCount.setValue(timer.totalCount());
  totalCount.setStatistic(MeterStatistic.COUNT);
  histMeter.addMeasure(totalCount);

  const maxTime = new MeterMeasurement();
  maxTime.setValue(timer.max());
  maxTime.setStatistic(MeterStatistic.MAX);
  histMeter.addMeasure(maxTime);

  histMeter.setId(meterId);

  meters.push(histMeter);

  return meters;
}

function basicConverter(imeter: IMeter): Meter[] {
  const meters = [];
  const name = imeter.name;
  const tags = convertTags(imeter.tags);

  //Add meters for different windowed EWMAs
  const valuesSnapshot = imeter.rates();
  Object.keys(valuesSnapshot).forEach(rate => {
    const meter = new Meter();

    const value = valuesSnapshot[rate];
    const ewmaTag = new MeterTag();
    ewmaTag.setKey('moving-average-minutes');
    ewmaTag.setValue(rate);

    const meterId = new MeterId();
    meterId.setName(name);
    tags.forEach(tag => meterId.addTag(tag));
    meterId.addTag(ewmaTag);
    meterId.setType(meterTypeLookup(imeter.type));
    meterId.setDescription(imeter.description);
    meterId.setBaseunit(imeter.units);

    meter.setId(meterId);

    const measure = new MeterMeasurement();
    measure.setValue(value);
    measure.setStatistic(statisticTypeLookup(imeter.statistic));

    meter.addMeasure(measure);

    meters.push(meter);
  });

  return meters;
}

function convertTags(tags: RawMeterTag[]): MeterTag[] {
  return (tags || []).map(tag => {
    const finalTag = new MeterTag();
    finalTag.setKey(tag.key);
    finalTag.setValue(tag.value);
    return finalTag;
  });
}

//Not safe for timestamps, just time measurements
function toNanoseconds(milliseconds: number) {
  return milliseconds * 1000 * 1000;
}

function recordClockSkew(skew: Skew): void {
  // TODO: do something with this?
  return;
}
