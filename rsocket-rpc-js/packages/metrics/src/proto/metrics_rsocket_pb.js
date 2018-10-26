// GENERATED CODE -- DO NOT EDIT!

'use strict';
var rsocket_rpc_frames = require('rsocket-rpc-frames');
var rsocket_rpc_core = require('rsocket-rpc-core');
var rsocket_rpc_tracing = require('rsocket-rpc-tracing');
var rsocket_rpc_metrics = require('rsocket-rpc-metrics').Metrics;
var rsocket_flowable = require('rsocket-flowable');
var proto_metrics_pb = require('../proto/metrics_pb.js');

var MetricsSnapshotHandlerClient = function () {
  function MetricsSnapshotHandlerClient(rs, tracer, meterRegistry) {
    this._rs = rs;
    this._tracer = tracer;
    this.streamMetricsTrace = rsocket_rpc_tracing.trace(tracer, "MetricsSnapshotHandler", {"rsocket.rpc.service": "io.rsocket.rpc.metrics.om.MetricsSnapshotHandler"}, {"method": "streamMetrics"}, {"rsocket.rpc.role": "client"});
    this.streamMetricsMetrics = rsocket_rpc_metrics.timed(meterRegistry, "MetricsSnapshotHandler", {"service": "io.rsocket.rpc.metrics.om.MetricsSnapshotHandler"}, {"method": "streamMetrics"}, {"role": "client"});
  }
  MetricsSnapshotHandlerClient.prototype.streamMetrics = function streamMetrics(messages, metadata) {
    const map = {};
    return this.streamMetricsMetrics(
      this.streamMetricsTrace(map)(new rsocket_flowable.Flowable(subscriber => {
        var dataBuf;
        var tracingMetadata = rsocket_rpc_tracing.mapToBuffer(map);
        var metadataBuf ;
          this._rs.requestChannel(messages.map(function (message) {
            dataBuf = Buffer.from(message.serializeBinary());
            metadataBuf = rsocket_rpc_frames.encodeMetadata('io.rsocket.rpc.metrics.om.MetricsSnapshotHandler', 'StreamMetrics', tracingMetadata, metadata || Buffer.alloc(0));
            return {
              data: dataBuf,
              metadata: metadataBuf
            };
          })).map(function (payload) {
            //TODO: resolve either 'https://github.com/rsocket/rsocket-js/issues/19' or 'https://github.com/google/protobuf/issues/1319'
            var binary = !payload.data || payload.data.constructor === Buffer || payload.data.constructor === Uint8Array ? payload.data : new Uint8Array(payload.data);
            return proto_metrics_pb.Skew.deserializeBinary(binary);
          }).subscribe(subscriber);
        })
      )
    );
  };
  return MetricsSnapshotHandlerClient;
}();

exports.MetricsSnapshotHandlerClient = MetricsSnapshotHandlerClient;

var MetricsSnapshotHandlerServer = function () {
  function MetricsSnapshotHandlerServer(service, tracer, meterRegistry) {
    this._service = service;
    this._tracer = tracer;
    this.streamMetricsTrace = rsocket_rpc_tracing.traceAsChild(tracer, "MetricsSnapshotHandler", {"rsocket.rpc.service": "io.rsocket.rpc.metrics.om.MetricsSnapshotHandler"}, {"method": "streamMetrics"}, {"rsocket.rpc.role": "server"});
    this.streamMetricsMetrics = rsocket_rpc_metrics.timed(meterRegistry, "MetricsSnapshotHandler", {"service": "io.rsocket.rpc.metrics.om.MetricsSnapshotHandler"}, {"method": "streamMetrics"}, {"role": "server"});
    this._channelSwitch = (payload, restOfMessages) => {
      if (payload.metadata == null) {
        return rsocket_flowable.Flowable.error(new Error('metadata is empty'));
      }
      var method = rsocket_rpc_frames.getMethod(payload.metadata);
      var spanContext = rsocket_rpc_tracing.deserializeTraceData(this._tracer, payload.metadata);
      let deserializedMessages;
      switch(method){
        case 'StreamMetrics':
          deserializedMessages = restOfMessages.map(payload => {
            var binary = !payload.data || payload.data.constructor === Buffer || payload.data.constructor === Uint8Array ? payload.data : new Uint8Array(payload.data);
            return proto_metrics_pb.MetricsSnapshot.deserializeBinary(binary);
          });
          return this.streamMetricsMetrics(
            this.streamMetricsTrace(spanContext)(
              this._service
                .streamMetrics(deserializedMessages, payload.metadata)
                .map(function (message) {
                  return {
                    data: Buffer.from(message.serializeBinary()),
                    metadata: Buffer.alloc(0)
                  }
                })
              )
            );
        default:
          return rsocket_flowable.Flowable.error(new Error('unknown method'));
      }
    };
  }
  MetricsSnapshotHandlerServer.prototype.fireAndForget = function fireAndForget(payload) {
    throw new Error('fireAndForget() is not implemented');
  };
  MetricsSnapshotHandlerServer.prototype.requestResponse = function requestResponse(payload) {
    return rsocket_flowable.Single.error(new Error('requestResponse() is not implemented'));
  };
  MetricsSnapshotHandlerServer.prototype.requestStream = function requestStream(payload) {
    return rsocket_flowable.Flowable.error(new Error('requestStream() is not implemented'));
  };
  MetricsSnapshotHandlerServer.prototype.requestChannel = function requestChannel(payloads) {
    return new rsocket_flowable.Flowable(s => payloads.subscribe(s)).lift(s =>
      new rsocket_rpc_core.SwitchTransformOperator(s, (payload, flowable) => this._channelSwitch(payload, flowable)),
    );
  };
  MetricsSnapshotHandlerServer.prototype.metadataPush = function metadataPush(payload) {
    return rsocket_flowable.Single.error(new Error('metadataPush() is not implemented'));
  };
  return MetricsSnapshotHandlerServer;
}();

exports.MetricsSnapshotHandlerServer = MetricsSnapshotHandlerServer;

