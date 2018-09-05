// GENERATED CODE -- DO NOT EDIT!

'use strict';
var rsocket_rpc_frames = require('rsocket-rpc-frames');
var rsocket_rpc_core = require('rsocket-rpc-core');
var rsocket_rpc_tracing = require('rsocket-rpc-tracing');
var rsocket_flowable = require('rsocket-flowable');
var proto_metrics_pb = require('../proto/metrics_pb.js');

var MetricsSnapshotHandlerClient = function () {
  function MetricsSnapshotHandlerClient(rs, tracer) {
    this._rs = rs;
    this._tracer = tracer;
    this.streamMetricsTrace = rsocket_rpc_tracing.trace(tracer, "MetricsSnapshotHandler.streamMetrics", {"rsocket.service": "io.rsocket.rpc.metrics.om.MetricsSnapshotHandler"}, {"rsocket.rpc.role": "client"});
  }
  MetricsSnapshotHandlerClient.prototype.streamMetrics = function streamMetrics(messages, metadata) {
    const map = {};
    return this.streamMetricsTrace(map)(new rsocket_flowable.Flowable(subscriber => {
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
          var binary = payload.data.constructor === Buffer || payload.data.constructor === Uint8Array ? payload.data : new Uint8Array(payload.data);
          return proto_metrics_pb.Skew.deserializeBinary(binary);
        }).subscribe(subscriber);
      })
    );
  };
  return MetricsSnapshotHandlerClient;
}();

exports.MetricsSnapshotHandlerClient = MetricsSnapshotHandlerClient;

var MetricsSnapshotHandlerServer = function () {
  function MetricsSnapshotHandlerServer(service, tracer) {
    this._service = service;
    this._tracer = tracer;
    this.streamMetricsTrace = rsocket_rpc_tracing.traceAsChild(tracer, "MetricsSnapshotHandler.streamMetrics", {"rsocket.service": "io.rsocket.rpc.metrics.om.MetricsSnapshotHandler"}, {"rsocket.rpc.role": "server"});
    this._channelSwitch = (payload, restOfMessages) => {
      if (payload.metadata == null) {
        return rsocket_flowable.Flowable.error(new Error('metadata is empty'));
      }
      var method = rsocket_rpc_frames.getMethod(payload.metadata);
      var spanContext = rsocket_rpc_tracing.deserializeTraceData(this._tracer, payload.metadata);
      let deserializedMessages;
      switch(method){
        case 'StreamMetrics':
          deserializedMessages = restOfMessages.map(message => proto_metrics_pb.MetricsSnapshot.deserializeBinary(message));
          return this.streamMetricsTrace(spanContext)(
            this._service
              .streamMetrics(deserializedMessages, payload.metadata)
              .map(function (message) {
                return {
                  data: Buffer.from(message.serializeBinary()),
                  metadata: Buffer.alloc(0)
                }
              })
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
    let once = false;
    return new rsocket_flowable.Flowable(subscriber => {
      const payloadProxy = new rsocket_rpc_core.QueuingFlowableProcessor();
      payloads.subscribe({
        onNext: payload => {
          if(!once){
            once = true;
            try{
              let result = this._channelSwitch(payload, payloadProxy);
              result.subscribe(subscriber);
            } catch (error){
              subscriber.onError(error);
            }
          }
          payloadProxy.onNext(payload.data);
        },
        onError: error => {
          payloadProxy.onError(error);
        },
        onComplete: () => {
          payloadProxy.onComplete();
        },
        onSubscribe: subscription => {
          payloadProxy.onSubscribe(subscription);
        }
        });
      });
    };
    MetricsSnapshotHandlerServer.prototype.metadataPush = function metadataPush(payload) {
      return rsocket_flowable.Single.error(new Error('metadataPush() is not implemented'));
    };
    return MetricsSnapshotHandlerServer;
  }();

  exports.MetricsSnapshotHandlerServer = MetricsSnapshotHandlerServer;

