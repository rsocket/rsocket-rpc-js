# RSocket JavaScript RPC

<a href='https://travis-ci.org/rsocket/rsocket-rpc-js'><img src='https://travis-ci.org/rsocket/rsocket-rpc-js.svg?branch=master'></a>

## Documentation

### Core

The primary class/entry point for the core package is the RpcClient. The client encapsulates the RSocket methods of `fireAndForget`, `requestResponse`, `requestStream`, and `requestChannel` and merges them with a bidirectional connection, allowing seamless use of RSocket for RPC.

The input config has this flow-type signature

```angular2html
ClientConfig<D, M> = {|
  serializers?: PayloadSerializers<D, M>,
  setup: {|
    keepAlive: number,
    lifetime: number,
    metadata?: Encodable,
  |},
  transport: DuplexConnection,
  responder?: Responder<D, M>,
|}
```

Serializers and responder are optional. If the client doesn't intend to receive traffic, there is no need to add a responder. Responder is a type alias for the RSocket API.

The transport can be any implementation of a DuplexConnection, a common one being WebSockets.

RpcClient's `connect(): Single<ReactiveSocket<D, M>>` method starts the asynchronous process of obtaining a handle to an open RSocket connection and moving through additional business logic.

Here is an example instantiation of an RpcClient

```angular2html
  const local = 'ws://localhost:8088/';
  const keepAlive = 60000 /* 60s in ms */;
  const lifetime = 360000 /* 360s in ms */;
  const transport = new RSocketWebsocketClient({url:local}, BufferEncoders);
  const client = new RpcClient({setup:{keepAlive, lifetime}, transport});
  client.connect().subscribe({
    onComplete: rsocket => {
      console.info("Success! We have a handle to an RSocket connection");
    },
    onError: error => {
      console.error("Failed to connect to local RSocket server.", error);
    }
  });
```

### Frames

The Frames package provides methods for encoding and reading Payload metadata

```angular2html
encodeMetadata(
  service: string,
  method: string,
  tracing: Encodable,
  metadata: Encodable,
): Buffer
```

Clients are encouraged to use the `encodeMetadata` method to send well defined call-routing metadata with their Payloads. On the receiving end, the call router can use the other helper methods to route the call and capture/propagate tracing information.

```angular2html
getVersion(buffer: Buffer): number
```

```
getService(buffer: Buffer): string
```

```
getMethod(buffer: Buffer): string
```

```
getTracing(buffer: Buffer): Buffer
```

### Tracing

RSocket RPC provides helpers to inject Open Tracing implementations via helper methods.

```
trace<T>(
  tracer?: Tracer,
  name?: String,
  ...tags: Object
): Object => (Flowable<T>) => Flowable<T>
```

Trace takes an Open Tracing `Tracer`, an operation name, and optional tags. The result is a function that allows propagation of a SpanContext map through a Flowable. One can pass a collection of tags in the form of a map/Object and have it woven through a Flowable => Flowable function. Here's an example

```angular2html
const traceCapture = trace(myTracer, "myOperation", {tag1: "value"}, {tag2: "another value"});

... more code ...

const subscriberTransformer = traceCapture({additionalTag1: 1, additionalTag2: "two"});

subscriberTransformer(rsocket.requestStream(serviceRequest))
.subscribe({
    ...
});
```

This wraps our default tags `tag1` and `tag2`, further picks up `additonalTag1` and `additionalTag2` as we progress through our business logic.

We then pass that the resulting `Flowable` from doing a `requestStream` and the Tracer will capture tracing events from the Stream.


```
traceAsChild<T>(
  tracer?: Tracer,
  name?: String,
  ...tags: Object
): SpanContext => (Flowable<T>) => Flowable<T>
```

This method is the same as above except intended to be used on the server side where a SpanContext has been passed from a client. The helper method below to `deserializeTraceData` should be used on the Payload metadata to extract the starter SpanContext

```angular2html
const traceCapture = traceAsChild(myTracer, "myServerOperation", {serverTag1: "value"}, {serverTag2: "another value"});

const subscriberTransformer = traceCapture(deserializeTraceData(myTracer, requestMetadata));

return subscriberTransformer(serviceImpl.requestStream(serviceRequest));
```

Below are equivalent methods for `Single` types, meaning really `requestReply`.

```
traceSingle<T>(
  tracer?: Tracer,
  name?: String,
  ...tags: Object
): Object => (Single<T>) => Single<T> 
```

```angular2html
traceSingleAsChild<T>(
  tracer?: Tracer,
  name?: String,
  ...tags: Object
): SpanContext => (Single<T>) => Single<T>
```

These last three are helper methods to make it easier to propagate tracing context.

```angular2html
deserializeTraceData(tracer, metadata) : SpanContext
```
 
```
mapToBuffer(map: Object): Buffer 
```
  
```
bufferToMap(buffer: Buffer): Object
```


### Metrics

#### Protobuf File

Unlike the other packages, Metrics is much more sensitive to interoperability and/or doesn't have an open standard like Open Tracing on which to hang its hat. As such, we include a protobuf file that defines the structure of metrics data and required services. This is found in `metrics/idl/proto/metrics.proto`

To build the relevant types from source, run `yarn install && yarn protoc`

#### Basic Use
The Metrics package exports a few helper methods that will wrap timing metrics automatically around streams.

```
 timed<T>(
    registry?: IMeterRegistry,
    name: string,
    ...tags: Object[]
  ): (Flowable<T>) => Flowable<T>
``` 

```angular2html
 timedSingle<T>(
    registry?: IMeterRegistry,
    name: string,
    ...tags: Object[]
  ): (Single<T>) => Single<T>
``` 

Similar to the Tracing package, these functions return a wrapping function, through which a user weaves their RSocket calls

```angular2html
  const metricsWrapper = timed(myMeterRegistry, "my.function.name", {tag1: "tag"}, {anotherTag: "again"});
  const responseStream = rsocket.requestStream(requestPayload);
  metricsWrapper(responseStream).subscribe(...);
```

```angular2html
  const metricsWrapper = timedSingle(myMeterRegistry, "my.function.name", {tag1: "tag"}, {anotherTag: "again"});
  const responseFuture = rsocket.requestResponse(requestPayload);
  metricsWrapper(responseFuture).subscribe(...);
```

Both functions take a IMeterRegistry which has flow-type

```angular2html
interface IMeterRegistry {
  registerMeter(meter: IMeter): void;
  registerMeters(meters: IMeter[]): void;
  meters(): IMeter[];
}
```

This essentially represents any container class that can store handles to Meters and deliver them as a collection. The Package includes a default implementation in `SimpleMeterRegistry`.


#### Meters

The Metrics package provides 2 implementations of IMeter: `Counter` and `Timer`. They both implement this interface:

```angular2html
interface IMeter {
  name: string;
  description: ?string;
  statistic: string;
  type: string;
  tags: RawMeterTag[];
  units?: string;
  rates(): Object;
  convert(converter: (IMeter) => Meter[]): Meter[];
}
```

The `timed` helper methods automatically wrap timing and counting metrics around significant `Flowable` and `Single` events. Additional metrics may be added ad hoc and registered with the IMeterRegistry.

#### Exporting Metrics

Should the user also have an RSocket based Metrics sink, we provide an RSocket native metrics source in `MetricsExporter`.

The `MetricsExporter` constructor has these inputs

```angular2html
MetricsExporter{
 
  constructor(
    handler: MetricsSnapshotHandlerClient,
    registry: IMeterRegistry,
    exportPeriodSeconds: number,
    batchSize: number,
  ),
  
  start(), // Open channel and begin sending metrics
  
  stop() // Stop sending metrics
  
}
``` 

The `MetricsSnapshotHandlerClient` is defined in the metrics protobuf file. It has one method of note

```
rpc StreamMetrics (stream MetricsSnapshot) returns (stream Skew)
``` 

Meaning we open a channel and push `MetricsSnapshot`s and receive time `Skew`s from the server as it notices our clocks are out of sync. The `MetricsExporter` takes this as a metrics sink, the `IMeterRegistry` as the metrics source, and the windowing parameters in the time period or batch size.

### Tying It All Together

Assume we have an RSocket server that supports WebSockets on `localhost`. We have an RSocket-based service client called MyServiceClient. We want to capture tracing and metrics data. In real code, we would likely encapsulate that within the MyServiceClient, but for demonstration purposes we will make everything very explicit.

```angular2html
const {RequestHandlingRSocket,
       RpcClient} = require('rsocket-rpc-core');
const Tracing = require('rsocket-rpc-tracing');
const {Metrics,
       SimpleMeterRegistry, 
       MetricsExporter, 
       MetricsSnapshotHandlerClient} = require('rsocket-rpc-metrics');

// Create our Open Tracing tracer for use later
const myTracer = new MyCompliantTracer();

// Connection info for our RSocket Client
const local = 'ws://localhost:8088/';
const keepAlive = 60000 /* 60s in ms */;
const lifetime = 360000 /* 360s in ms */;
const transport = new RSocketWebsocketClient({url:local}, BufferEncoders);
const responder = new RequestHandlingRSocket(); // Will address this at the end
const rsocketClient = new RpcClient({setup:{keepAlive, lifetime}, transport, responder});

// We need a few references declared ahead of an rsocket being available 
const meters = new SimpleMeterRegistry();
let snapshotClient = null; // Will initialize shortly
let metricsExporter = null; // Will initialize shortly

let myServiceClient = null; // Will initialize shortly

rsocketClient.connect().subscribe({
    onComplete: rsocket => {
      myServiceClient = new MyServiceClient(rsocket);
      
      snapshotClient = new MetricsSnapshotHandlerClient(rsocket);
      metricsExporter = new MetricsExporter(snapshotClient, meters, 60 /*seconds*/, 1024 /*metrics count*/);
      metricsExporter.start();
    },
    onError: error => {
      console.error("Failed to connect to local RSocket server.", error);
    }
});


... Later in our business logic ...

// Set up our traced, metrics-captured calls
const streamMetricsWrapper = Metrics.timed(meters, "myService.dataStream", {timezone: "GMT-7"});
const requestResponseMetricsWrapper = Metrics.timedSingle(meters, "myService.fetchDatum", {timezone: "GMT-7"});

const streamTracing = Tracing.trace(myTracer, "myService.dataStream", {clientType: "Chrome Browser"});
const requestResponseTracing = Tracing.trace.Single(myTracer, "myService.fetchDatum", {clientType: "Chrome Browser"});

... Later still, our User does something of interest ...


const tracingTags = {uiContextId: 12345, focusedItem: 9876};

const tracedTimedRequestResponse = requestResponseTracing(tracingTags) // We've closed over the tracing tags, now Single => Single
(requestResponseMetricsWrapper( //This wrapper's signature is Single => Single
        myServiceClient.fetchDatum(new DatumRequest()) // This method returns a Single
    ) // We've now wrapped the original call in metrics
); // We've now wrapped the metrics-captured call in tracing

tracedTimedRequestResponse.subscribe({
    // Issues the request and do our business logic onComplete
});

// And we would do the same for a streaming method

const tracedTimedStream = streamTracing(tracingTags) // We've closed over the tracing tags, now Flowable => Flowable
(streamMetricsWrapper( //This wrapper's signature is Flowable => Flowable
        myServiceClient.dataStream(new StreamRequest()) // This method returns a Flowable
    ) // We've now wrapped the original call in metrics
); // We've now wrapped the metrics-captured call in tracing

tracedTimedStream.subscribe({
    // Issues the request and do our business logic onNext/onComplete
});

```

#### Wiring up the Responder

At the beginning, we added a canned Responder class from the Core package, `RequestHandlingRSocket`. It takes for granted that callers are using the Metadata helpers to package metadata about the service calls in question.

Its relevant method is

```angular2html
addService(service: string, handler: Responder<Buffer, Buffer>)
```

Aside from this, it implements (and delegates) the RSocket methods to handling services. Responder is an alias for this that implies that it will have those methods invoked by a remote caller rather than act as a local caller to a remote callee.

In our example, let's add a responder to our client that provides a method for a remote caller to inject config updates.

```angular2html

const configUpdater = {
    fireAndForget: function(){
        //Not supported but has no expected return
    },
    requestStream: function(payload){
        return Flowable.error("requestStream is not supported");
    },
    requestChannel: function(payloads){
        return Flowable.error("requestStream is not supported");
    },
    requestResponse: function(payload){
        const newConfig = deserializeConfig(payload.data);
        // apply new config;
        return Single.of("OK");
    }
}

responder.addService("example.rsocket.configUpdater", configUpdater);
```

And now our RpcClient will also respond to requests from the server to update its configuration that are directed to the service "example.rsocket.configUpdater".

We can also add tracing and metrics here though again, in Production code this would all be encapsulated in service/client implementations but for demo purposes we're doing it inline and explicitly.

```angular2html
const serviceMetricsWrapper = Metrics.timedSingle(meters, "myClient.updateConfig", {timezone: "GMT-7"});

const serviceTracing = Tracing.traceSingleAsChild(myTracer, "myClient.updateConfig", {clientType: "Chrome Browser"});

const configUpdater = {
    fireAndForget: function(){
        //Not supported but has no expected return
    },
    requestStream: function(payload){
        return Flowable.error("requestStream is not supported");
    },
    requestChannel: function(payloads){
        return Flowable.error("requestStream is not supported");
    },
    requestResponse: function(payload){
        const spanContext = Tracing.deserializeTraceData(myTracer, payload.metadata);
        return serviceTracing(spanContext) // We've closed over the tracing span context, now Single => Single
        (serviceMetricsWrapper( //This wrapper's signature is Single => Single
                new Single(subscriber => {
                    subscriber.onSubscribe();
                    const newConfig = deserializeConfig(payload.data);                    
                    // apply new config;
                    subscriber.onComplete("OK");
                })
            ) // We've now wrapped the original call in metrics
        );
    }
}
```

Let's break this down because it's hard to follow at first.

* We are extracting the span context from the caller, if any, with the `deserializeTraceData` method
* We feed this into the `traceSingleAsChild` method which captures the span context and will weave it through a `Single` (its signature is Single => Single)
* We further use the Metrics wrapping method `timedSingle` to weave timing and count metrics through a `Single` (signature also Single => Single))
* And finally, we create a new Single inline that has the same logic as before, only it waits for a subscriber (meaning call to `subscribe`) to do anything so that we can start our metrics timing and trace on-demand from the caller.

And with that, we have an RpcClient that can make and serve instrumented calls over the same RSocket.

## Bugs and Feedback

For bugs, questions, and discussions please use the [Github Issues](https://github.com/netifi/rsocket-rpc/issues).

## License
Copyright 2017 Netifi Inc.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
