# RSocket JavaScript RPC

<a href='https://travis-ci.org/netifi-proteus/proteus-js'><img src='https://travis-ci.org/netifi-proteus/proteus-js.svg?branch=master'></a>

## Documentation

## Bugs and Feedback

For bugs, questions, and discussions please use the [Github Issues](https://github.com/netifi/rsocket-js-rpc/issues).

## About This Library

RSocket RPC is an abstraction library for any RPC system to work over RSocket. It provides a mechanism to wire in an OpenTracing implementation and is open to extension to provide other facilities wired in for free (e.g. metrics collection).

### Basic Use
The primary entry point for a user is the `RpcClient` (packages/core/src/RpcClient.js). Here is some minimal code to wire up an RpcClient:

```angular2html
const RSocketWebsocketClient = require('rsocket-websocket-client').default
const {BufferEncoders} = require('rsocket-core');

// WebSocket config
const local = 'ws://localhost:8080/';
const keepAlive = 60000 /* 60s in ms */;
const lifetime = 360000 /* 360s in ms */;
const transport = new RSocketWebsocketClient({url:local}, BufferEncoders);

// Create client
const client = new RpcClient({setup:{keepAlive, lifetime}, transport});

// Connect returns Single<ReactiveSocket>, thread it into your service clients
client.connect().subscribe({
    onComplete: rsocket => {
      this.backendServiceClient = new BackendServiceClient(rsocket);
      this.additionalServicesClient = new AdditionalServicesClient(rsocket);
    },
    onError: error => {
      console.error("Failed to connect to local RSocket server.", error);
    }
});
```

In this example, `BackendServiceClient` and `AdditionalServicesClient` would be sending data using the RSocket API:

`fireAndForget(payload: Payload): void`

`requestResponse(payload: Payload): Single<Payload>`

`requestStream(payload: Payload): Flowable<Payload>`

`requestChannel(payloads: Flowable<Payload>): Flowable<Payload>`

The RSocket created by the `RpcClient` wires up those calls to the configured endpoint.

### Frames

The Frames package exports this helper functions to extract useful data from RSocket metadata

`encodeMetadata(service: string, method: string, tracing: Encodable, metadata: Encodable,): Buffer` returns a metadata buffer for use with RSocket RPC calls

`getVersion(metadataBuf: Buffer): number` returns the protocol version as a number 

`getService(metadataBuf: Buffer): string` returns the service name

`getMethod(metadataBuf: Buffer): string` returns the method name 

`getTracing(metadataBuf: Buffer): Buffer` returns the subsection of the Buffer with tracing data

`getMetadata(metadataBuf: Buffer): Buffer` returns the subsection of the Buffer with the additional metadata passed by the caller

### Tracing

Adding tracing is done through the utility functions provided by `Tracing` (packages/tracing/src/Tracing.js). There are two entry methods, `trace` for Clients to use and `traceAsChild` which is assuming a Server context. `trace` acts on maps of key/value pairs whereas `traceAsChild` works on an OpenTracing SpanContext, i.e. assuming a trace context already exists.

These methods may appear awkward to use so included are a couple of examples for a Client and a Server

Here is an example of an `InfoClient` that has a method `getInfo` which streams Info back to the caller

```angular2html
const myInfoClient = function makeClient(rsocket){
  const tracer = new MyOpenTracingTracer();
  // This creates a function from Flowable => Flowable that has closed over our default tracing tags
  // To use it, we need to provide a handle to a map of additional tags (if any) 
  const clientTrace = Tracing.trace(tracer, "MyInfoServiceClient", { "rsocket.service": "io.demo.rsocket.InfoService" }, { "rsocket.rpc.role": "client" });

  const additionalTags = {}; // any additional relevant tags

  const clientObject = {
    getInfo: function makeTracedClientCall(data, metadata){
      // close over the tags map - the default tags from above will be injected
      const traceWrappingFunction = clientTrace(additionalTags);
      // Now we call our wrapping function with the Flowable we want to trace
      traceWrappingFunction(new Flowable(function (subscriber) {
        // This looks complicated but it's just threading the subscriber of the Client call through to the RSocket

        // Serialize our tracing data for consumption on the Server side
        var tracingMetadata = rsocket_rpc_tracing.mapToBuffer(map);

        // Construct our RSocket metadata from the service id, method name, tracing data,
        // and additional metadata specific to this call (if any)
        var metadataBuf = Frames.encodeMetadata('io.demo.rsocket.InfoService', 'InfoService', tracingMetadata, metadata);

        // Make the remote call, wiring in the subscriber
        rsocket.requestStream({
          data,
          metadata: metadataBuf
        }).subscribe(subscriber);
      }));
    } 
  };
  
  return clientObject;
}();
 
```

Calling `client.getInfo` will make a traced request to the server which will stream back Info and its implementation could look like this

```angular2html

const myInfoServer = function(){
  // Spin up our OpenTracing implementation
  const tracer = new MyOpenTracingTracer();
  // Capturing function that wires in trace data for each request with default info for our service
  // The type for this function is SpanContext => Flowable => Flowable
  const serverTrace = Tracing.traceAsChild(tracer, "InfoService", {"rsocket.service": "io.demo.rsocket.InfoService"}, {"rsocket.rpc.role": "server"});

  const serverObject = {
    fireAndForget: ...,
    requestResponse: ...,
    requestStream: function requestStream(payload) {
      try {
        // A typical implementation pattern is to route on the "method" in the metadata
        // however, this is not required, just a convenient way to dispatch
        if (payload.metadata == null) {
          return Flowable.error(new Error('metadata is empty'));
        }
        var method = Frames.getMethod(payload.metadata);

        // Establish the existing spanContext passed from the client
        var spanContext = Tracing.deserializeTraceData(tracer, payload.metadata);
        // and create the trace wrapping function, through which we pass our server handling
        // traceWrappingFunction has type (Flowable => Flowable)
        const traceWrappingFunction = serverTrace(spanContext);

        switch (method) {
          case 'Brokers':
            // 
            return traceWrappingFunction(
              // Business logic, returns a Flowable<Payload>
              DO_WORK(payload.data, payload.metadata)
            );
          // Ultimately returning a Flowable that includes trace data
          default:
            return Flowable.error(new Error('unknown method'));
        }
      } catch (error) {
        return Flowable.error(error);
      }
    },
    requestChannel: ...,
    metadataPush: ...
  };

  return serverObject;
}();
```



## License
Copyright 2017 Netifi Inc.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
