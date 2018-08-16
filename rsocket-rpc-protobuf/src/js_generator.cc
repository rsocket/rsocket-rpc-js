/*
 *
 * Copyright (c) 2017-present, Netifi Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

#include <map>

#include "js_generator_helpers.h"
#include "proteus/core.pb.h"
#include <google/protobuf/io/printer.h>
#include <google/protobuf/io/zero_copy_stream_impl_lite.h>

using google::protobuf::Descriptor;
using google::protobuf::FileDescriptor;
using google::protobuf::MethodDescriptor;
using google::protobuf::ServiceDescriptor;
using google::protobuf::io::Printer;
using google::protobuf::io::StringOutputStream;
using io::netifi::proteus::ProteusOptions;

namespace rsocket_rpc_js_generator {
namespace {

// Returns the alias we assign to the module of the given .proto filename
// when importing. Copied entirely from
// github:google/protobuf/src/google/protobuf/compiler/js/js_generator.cc#L154
string ModuleAlias(const string filename) {
  // This scheme could technically cause problems if a file includes any 2 of:
  //   foo/bar_baz.proto
  //   foo_bar_baz.proto
  //   foo_bar/baz.proto
  //
  // We'll worry about this problem if/when we actually see it.  This name isn't
  // exposed to users so we can change it later if we need to.
  string basename = StripProto(filename);
  basename = StringReplace(basename, "-", "$");
  basename = StringReplace(basename, "/", "_");
  basename = StringReplace(basename, ".", "_");
  return basename + "_pb";
}

// Given a filename like foo/bar/baz.proto, returns the corresponding JavaScript
// message file foo/bar/baz.js
string GetJSMessageFilename(const string& filename) {
  string name = filename;
  return StripProto(name) + "_pb.js";
}

// Given a filename like foo/bar/baz.proto, returns the root directory
// path ../../
string GetRootPath(const string& from_filename,
                         const string& to_filename) {
  if (to_filename.find("google/protobuf") == 0) {
    // Well-known types (.proto files in the google/protobuf directory) are
    // assumed to come from the 'google-protobuf' npm package.  We may want to
    // generalize this exception later by letting others put generated code in
    // their own npm packages.
    return "google-protobuf/";
  }
  size_t slashes = std::count(from_filename.begin(), from_filename.end(), '/');
  if (slashes == 0) {
    return "./";
  }
  string result = "";
  for (size_t i = 0; i < slashes; i++) {
    result += "../";
  }
  return result;
}

// Return the relative path to load to_file from the directory containing
// from_file, assuming that both paths are relative to the same directory
string GetRelativePath(const string& from_file,
                             const string& to_file) {
  return GetRootPath(from_file, to_file) + to_file;
}

/* Finds all message types used in all services in the file, and returns them
 * as a map of fully qualified message type name to message descriptor */
std::map<string, const Descriptor*> GetAllMessages(
    const FileDescriptor* file) {
  std::map<string, const Descriptor*> message_types;
  for (int service_num = 0; service_num < file->service_count();
       service_num++) {
    const ServiceDescriptor* service = file->service(service_num);
    for (int method_num = 0; method_num < service->method_count();
         method_num++) {
      const MethodDescriptor* method = service->method(method_num);
      const Descriptor* input_type = method->input_type();
      const Descriptor* output_type = method->output_type();
      message_types[input_type->full_name()] = input_type;
      message_types[output_type->full_name()] = output_type;
    }
  }
  return message_types;
}

string NodeObjectPath(const Descriptor* descriptor) {
  string module_alias = ModuleAlias(descriptor->file()->name());
  string name = descriptor->full_name();
  StripPrefix(&name, descriptor->file()->package() + ".");
  return module_alias + "." + name;
}

void PrintMethod(const MethodDescriptor* method, Printer* out) {
  const Descriptor* input_type = method->input_type();
  const Descriptor* output_type = method->output_type();
  const ProteusOptions options = method->options().GetExtension(io::netifi::proteus::options);

  std::map<string, string> vars;
  vars["client_name"] = method->service()->name() + "Client";
  vars["service_name"] = method->service()->full_name();
  vars["method_name"] = LowercaseFirstLetter(method->name());
  vars["name"] = method->name();
  vars["input_type"] = NodeObjectPath(input_type);
  vars["output_type"] = NodeObjectPath(output_type);
  if (method->client_streaming()) {
    out->Print(vars, "$client_name$.prototype.$method_name$ = function $method_name$(messages, metadata) {\n");
    out->Indent();
    out->Print("const map = {};\n");
    out->Print(vars, "return this.$method_name$Trace(map)(new rsocket_flowable.Flowable(subscriber => {\n");
    out->Indent();
    out->Print(vars, "var dataBuf;\n");
    out->Print(vars, "var tracingMetadata = rsocket_rpc_tracing.mapToBuffer(map);\n");
    out->Print(vars, "var metadataBuf ;\n");
    out->Indent();
    out->Print("this._rs.requestChannel(messages.map(function (message) {\n");
    out->Indent();
    out->Print("dataBuf = Buffer.from(message.serializeBinary());\n");
    out->Print(vars, "metadataBuf = rsocket_rpc_frames.encodeMetadata('$service_name$', '$name$', tracingMetadata, metadata || Buffer.alloc(0));\n");
    out->Print("return {\n");
    out->Indent();
    out->Print(
        "data: dataBuf,\n"
        "metadata: metadataBuf\n");
    out->Outdent();
    out->Print("};\n");
    out->Outdent();
    out->Print("})).map(function (payload) {\n");
    out->Indent();
    out->Print("//TODO: resolve either 'https://github.com/rsocket/rsocket-js/issues/19' or 'https://github.com/google/protobuf/issues/1319'\n");
    out->Print("var binary = payload.data.constructor === Buffer || payload.data.constructor === Uint8Array ? payload.data : new Uint8Array(payload.data);\n");
    out->Print(vars, "return $output_type$.deserializeBinary(binary);\n");
    out->Outdent();
    out->Print("}).subscribe(subscriber);\n");
    out->Outdent();
    out->Print("})\n");
    out->Outdent();
    out->Print(");\n");
  } else {
    out->Print(vars, "$client_name$.prototype.$method_name$ = function $method_name$(message, metadata) {\n");
    out->Indent();
    if (method->server_streaming()) {
      out->Print("const map = {};\n");
      out->Print(vars, "return this.$method_name$Trace(map)(new rsocket_flowable.Flowable(subscriber => {\n");
      out->Indent();
      out->Print(vars, "var dataBuf = Buffer.from(message.serializeBinary());\n");
      out->Print(vars, "var tracingMetadata = rsocket_rpc_tracing.mapToBuffer(map);\n");
      out->Print(vars, "var metadataBuf = rsocket_rpc_frames.encodeMetadata('$service_name$', '$name$', tracingMetadata, metadata || Buffer.alloc(0));\n");
      out->Indent();
      out->Print("this._rs.requestStream({\n");
      out->Indent();
      out->Print(
          "data: dataBuf,\n"
          "metadata: metadataBuf\n");
      out->Outdent();
      out->Print("}).map(function (payload) {\n");
      out->Indent();
      out->Print("//TODO: resolve either 'https://github.com/rsocket/rsocket-js/issues/19' or 'https://github.com/google/protobuf/issues/1319'\n");
      out->Print("var binary = payload.data.constructor === Buffer || payload.data.constructor === Uint8Array ? payload.data : new Uint8Array(payload.data);\n");
      out->Print(vars, "return $output_type$.deserializeBinary(binary);\n");
      out->Outdent();
      out->Print("}).subscribe(subscriber);\n");
      out->Outdent();
      out->Print("})\n");
      out->Outdent();
      out->Print(");\n");
    } else if (options.fire_and_forget()) {
      out->Print("const map = {};\n");
      out->Print(vars, "this.$method_name$Trace(map)(new rsocket_flowable.Single(function (subscriber) {\n");
      out->Indent();
      out->Print("subscriber.onSubscribe();\n");
      out->Print("subscriber.onComplete();\n");
      out->Outdent();
      out->Print("})).subscribe({ onSubscribe: function onSubscribe() {}, onComplete: function onComplete() {} });\n");
        /*

        this.pingFireAndForgetTrace(map)(new rsocket_flowable.Single(function (subscriber) {
              subscriber.onSubscribe();
              subscriber.onComplete();
            })).subscribe({ onSubscribe: function onSubscribe() {}, onComplete: function onComplete() {} });
        */
      out->Print(vars, "var dataBuf = Buffer.from(message.serializeBinary());\n");
      out->Print(vars, "var tracingMetadata = rsocket_rpc_tracing.mapToBuffer(map);\n");
      out->Print(vars, "var metadataBuf = rsocket_rpc_frames.encodeMetadata('$service_name$', '$name$', tracingMetadata, metadata || Buffer.alloc(0));\n");
      out->Print("this._rs.fireAndForget({\n");
      out->Indent();
      out->Print(
          "data: dataBuf,\n"
          "metadata: metadataBuf\n");
      out->Outdent();
      out->Print("});\n");
    } else {
      out->Print("const map = {};\n");
      out->Print(vars, "return this.$method_name$Trace(map)(new rsocket_flowable.Single(subscriber => {\n");
      out->Indent();
      out->Print(vars, "var dataBuf = Buffer.from(message.serializeBinary());\n");
      out->Print(vars, "var tracingMetadata = rsocket_rpc_tracing.mapToBuffer(map);\n");
      out->Print(vars, "var metadataBuf = rsocket_rpc_frames.encodeMetadata('$service_name$', '$name$', tracingMetadata, metadata || Buffer.alloc(0));\n");
      out->Indent();
      out->Print("this._rs.requestResponse({\n");
      out->Indent();
      out->Print(
          "data: dataBuf,\n"
          "metadata: metadataBuf\n");
      out->Outdent();
      out->Print("}).map(function (payload) {\n");
      out->Indent();
      out->Print("//TODO: resolve either 'https://github.com/rsocket/rsocket-js/issues/19' or 'https://github.com/google/protobuf/issues/1319'\n");
      out->Print("var binary = payload.data.constructor === Buffer || payload.data.constructor === Uint8Array ? payload.data : new Uint8Array(payload.data);\n");
      out->Print(vars, "return $output_type$.deserializeBinary(binary);\n");
      out->Outdent();
      out->Print("}).subscribe(subscriber);\n");
      out->Outdent();
      out->Print("})\n");
      out->Outdent();
      out->Print(");\n");
    }
  }

  out->Outdent();
  out->Print("};\n");
}

void PrintClient(const ServiceDescriptor* service, Printer* out) {
  std::map<string, string> vars;
  out->Print(GetNodeComments(service, true).c_str());
  vars["client_name"] = service->name() + "Client";
  out->Print(vars, "var $client_name$ = function () {\n");
  out->Indent();
  out->Print(vars, "function $client_name$(rs, tracer) {\n");
  out->Indent();
  out->Print("this._rs = rs;\n");
  out->Print("this._tracer = tracer;\n");

  //Set up trace things
  for (int i = 0; i < service->method_count(); i++) {
      const MethodDescriptor* method = service->method(i);
      const Descriptor* output_type = method->output_type();
      std::map<string, string> vars;
      vars["service_short_name"] = method->service()->name();
      vars["service_name"] = method->service()->full_name();
      vars["method_name"] = LowercaseFirstLetter(method->name());
      vars["name"] = method->name();
      vars["output_type"] = NodeObjectPath(output_type);
      if(method->client_streaming() ||
         method->server_streaming()){
         out->Print(vars, "this.$method_name$Trace = rsocket_rpc_tracing.trace(tracer, \"$service_short_name$.$method_name$\", {\"proteus.service\": \"$service_name$\"}, {\"proteus.type\": \"client\"});\n");
      } else {
        out->Print(vars, "this.$method_name$Trace = rsocket_rpc_tracing.traceSingle(tracer, \"$service_short_name$.$method_name$\", {\"proteus.service\": \"$service_name$\"}, {\"proteus.type\": \"client\"});\n");
      }
  }
  out->Outdent();
  out->Print("}\n");

  for (int i = 0; i < service->method_count(); i++) {
    out->Print(GetNodeComments(service->method(i), true).c_str());
    PrintMethod(service->method(i), out);
    out->Print(GetNodeComments(service->method(i), false).c_str());
  }

  out->Print(vars, "return $client_name$;\n");
  out->Outdent();
  out->Print("}();\n\n");
  out->Print(vars, "exports.$client_name$ = $client_name$;\n\n");
  out->Print(GetNodeComments(service, false).c_str());
}

void PrintServer(const ServiceDescriptor* service, Printer* out) {

  std::map<string, string> vars;

  std::vector<const MethodDescriptor*> fire_and_forget;
  std::vector<const MethodDescriptor*> request_response;
  std::vector<const MethodDescriptor*> request_stream;
  std::vector<const MethodDescriptor*> request_channel;

  for (int i = 0; i < service->method_count(); ++i) {
      const MethodDescriptor* method = service->method(i);
      const ProteusOptions options = method->options().GetExtension(io::netifi::proteus::options);
      bool client_streaming = method->client_streaming();
      bool server_streaming = method->server_streaming();

      if (client_streaming) {
        request_channel.push_back(method);
      } else if (server_streaming) {
        request_stream.push_back(method);
      } else {
        const Descriptor* output_type = method->output_type();
        if (options.fire_and_forget()) {
          fire_and_forget.push_back(method);
        } else {
          request_response.push_back(method);
        }
      }
  }

  out->Print(GetNodeComments(service, true).c_str());
  vars["server_name"] = service->name() + "Server";
  out->Print(vars, "var $server_name$ = function () {\n");
  out->Indent();
  out->Print(vars, "function $server_name$(service, tracer) {\n");
  out->Indent();
  out->Print("this._service = service;\n");
  out->Print("this._tracer = tracer;\n");

  for (int i = 0; i < service->method_count(); i++) {
        const MethodDescriptor* method = service->method(i);
        const Descriptor* output_type = method->output_type();
        std::map<string, string> vars;
        vars["service_short_name"] = method->service()->name();
        vars["service_name"] = method->service()->full_name();
        vars["method_name"] = LowercaseFirstLetter(method->name());
        vars["name"] = method->name();
        vars["output_type"] = NodeObjectPath(output_type);
        if(method->client_streaming() ||
           method->server_streaming()){
           out->Print(vars, "this.$method_name$Trace = rsocket_rpc_tracing.traceAsChild(tracer, \"$service_short_name$.$method_name$\", {\"proteus.service\": \"$service_name$\"}, {\"proteus.type\": \"server\"});\n");
        } else {
          out->Print(vars, "this.$method_name$Trace = rsocket_rpc_tracing.traceSingleAsChild(tracer, \"$service_short_name$.$method_name$\", {\"proteus.service\": \"$service_name$\"}, {\"proteus.type\": \"server\"});\n");
        }
  }
  out->Print("this._channelSwitch = (payload, restOfMessages) => {\n");
  out->Indent();
  out->Print("if (payload.metadata == null) {\n");
  out->Indent();
  out->Print("return rsocket_flowable.Flowable.error(new Error('metadata is empty'));\n");
  out->Outdent();
  out->Print("}\n");
  out->Print("var method = rsocket_rpc_frames.getMethod(payload.metadata);\n");
  out->Print("var spanContext = rsocket_rpc_tracing.deserializeTraceData(this._tracer, payload.metadata);\n");
  out->Print("let deserializedMessages;\n");
  out->Print("switch(method){\n");
  out->Indent();
  for (vector<const MethodDescriptor*>::iterator it = request_channel.begin(); it != request_channel.end(); ++it) {
        const MethodDescriptor* method = *it;
        const Descriptor* input_type = method->input_type();
        vars["method_name"] = LowercaseFirstLetter(method->name());
        vars["name"] = method->name();
        vars["input_type"] = NodeObjectPath(input_type);

        out->Print(vars, "case '$name$':\n");
        out->Indent();
        out->Print(vars, "deserializedMessages = restOfMessages.map(message => $input_type$.deserializeBinary(message));\n");
        out->Print(vars, "return this.$method_name$Trace(spanContext)(\n");
        out->Indent();
        out->Print("this._service\n");
        out->Indent();
        out->Print(vars, ".$method_name$(deserializedMessages, payload.metadata)\n");
        out->Print(".map(function (message) {\n");
        out->Indent();
        out->Print("return {\n");
        out->Indent();
        out->Print("data: Buffer.from(message.serializeBinary()),\n");
        out->Print("metadata: Buffer.alloc(0)\n");
        out->Outdent();
        out->Print("}\n");
        out->Outdent();
        out->Print("})\n");
        out->Outdent();
        out->Print(");\n");
        out->Outdent();
        out->Outdent();
      }
  out->Print("default:\n");
  out->Indent();
  out->Print("return rsocket_flowable.Flowable.error(new Error('unknown method'));\n");
  out->Outdent();
  out->Outdent();
  out->Print("}\n");
  out->Outdent();
  out->Print("};\n");

  out->Outdent();
  out->Print("}\n");

  // Fire and forget
  out->Print(vars, "$server_name$.prototype.fireAndForget = function fireAndForget(payload) {\n");
  out->Indent();
  if (fire_and_forget.empty()) {
    out->Print("throw new Error('fireAndForget() is not implemented');\n");
  } else {
    out->Print("if (payload.metadata == null) {\n");
    out->Indent();
    out->Print("throw new Error('metadata is empty');\n");
    out->Outdent();
    out->Print("}\n");
    out->Print("var method = rsocket_rpc_frames.getMethod(payload.metadata);\n");
    out->Print("var spanContext = rsocket_rpc_tracing.deserializeTraceData(this._tracer, payload.metadata);\n");
    out->Print("switch (method) {\n");
    out->Indent();
    for (vector<const MethodDescriptor*>::iterator it = fire_and_forget.begin(); it != fire_and_forget.end(); ++it) {
      const MethodDescriptor* method = *it;
      const Descriptor* input_type = method->input_type();
      vars["method_name"] = LowercaseFirstLetter(method->name());
      vars["name"] = method->name();
      vars["input_type"] = NodeObjectPath(input_type);

      out->Print(vars, "case '$name$':\n");
      out->Indent();
      out->Print(vars, "this.$method_name$Trace(spanContext)(new rsocket_flowable.Single(function (subscriber) {\n");
      out->Indent();
      out->Print("subscriber.onSubscribe();\n");
      out->Print("subscriber.onComplete();\n");
      out->Print("})).subscribe({ onSubscribe: function onSubscribe() {}, onComplete: function onComplete() {} });\n");
      out->Outdent();
      out->Print(vars, "this._service.$method_name$($input_type$.deserializeBinary(payload.data), payload.metadata)\n");
      out->Print("break;\n");
      out->Outdent();
    }
    out->Print("default:\n");
    out->Indent();
    out->Print("throw new Error('unknown method');\n");
    out->Outdent();
    out->Outdent();
    out->Print("}\n");
  }
  out->Outdent();
  out->Print("};\n");

  // Request-Response
  out->Print(vars, "$server_name$.prototype.requestResponse = function requestResponse(payload) {\n");
  out->Indent();
  if (request_response.empty()) {
    out->Print("return rsocket_flowable.Single.error(new Error('requestResponse() is not implemented'));\n");
  } else {
    out->Print("try {\n");
    out->Indent();
    out->Print("if (payload.metadata == null) {\n");
    out->Indent();
    out->Print("return rsocket_flowable.Single.error(new Error('metadata is empty'));\n");
    out->Outdent();
    out->Print("}\n");
    out->Print("var method = rsocket_rpc_frames.getMethod(payload.metadata);\n");
    out->Print("var spanContext = rsocket_rpc_tracing.deserializeTraceData(this._tracer, payload.metadata);\n");
    out->Print("switch (method) {\n");
    out->Indent();
    for (vector<const MethodDescriptor*>::iterator it = request_response.begin(); it != request_response.end(); ++it) {
      const MethodDescriptor* method = *it;
      const Descriptor* input_type = method->input_type();
      vars["method_name"] = LowercaseFirstLetter(method->name());
      vars["name"] = method->name();
      vars["input_type"] = NodeObjectPath(input_type);

      out->Print(vars, "case '$name$':\n");
      out->Indent();
      out->Print(vars, "return this.$method_name$Trace(spanContext)(\n");
      out->Indent();
      out->Print("this._service\n");
      out->Print(vars, ".$method_name$($input_type$.deserializeBinary(payload.data), payload.metadata)\n");
      out->Print(".map(function (message) {\n");
      out->Indent();
      out->Print("return {\n");
      out->Indent();
      out->Print("data: Buffer.from(message.serializeBinary()),\n");
      out->Print("metadata: Buffer.alloc(0)\n");
      out->Outdent();
      out->Print("}\n");
      out->Outdent();
      out->Print("})\n");
      out->Outdent();
      out->Print(");\n");
      out->Outdent();
    }
    out->Print("default:\n");
    out->Indent();
    out->Print("return rsocket_flowable.Single.error(new Error('unknown method'));\n");
    out->Outdent();
    out->Outdent();
    out->Print("}\n");

    out->Outdent();
    out->Print("} catch (error) {\n");
    out->Indent();
    out->Print("return rsocket_flowable.Single.error(error);\n");
    out->Outdent();
    out->Print("}\n");
  }
  out->Outdent();
  out->Print("};\n");

  // Request-Stream
  out->Print(vars, "$server_name$.prototype.requestStream = function requestStream(payload) {\n");
  out->Indent();
  if (request_stream.empty()) {
    out->Print("return rsocket_flowable.Flowable.error(new Error('requestStream() is not implemented'));\n");
  } else {
    out->Print("try {\n");
    out->Indent();
    out->Print("if (payload.metadata == null) {\n");
    out->Indent();
    out->Print("return rsocket_flowable.Flowable.error(new Error('metadata is empty'));\n");
    out->Outdent();
    out->Print("}\n");
    out->Print("var method = rsocket_rpc_frames.getMethod(payload.metadata);\n");
    out->Print("var spanContext = rsocket_rpc_tracing.deserializeTraceData(this._tracer, payload.metadata);\n");
    out->Print("switch (method) {\n");
    out->Indent();
    for (vector<const MethodDescriptor*>::iterator it = request_stream.begin(); it != request_stream.end(); ++it) {
      const MethodDescriptor* method = *it;
      const Descriptor* input_type = method->input_type();
      vars["method_name"] = LowercaseFirstLetter(method->name());
      vars["name"] = method->name();
      vars["input_type"] = NodeObjectPath(input_type);

      out->Print(vars, "case '$name$':\n");
      out->Indent();
      out->Print(vars, "return this.$method_name$Trace(spanContext)(\n");
      out->Indent();
      out->Print("this._service\n");
      out->Indent();
      out->Print(vars, ".$method_name$($input_type$.deserializeBinary(payload.data), payload.metadata)\n");
      out->Print(".map(function (message) {\n");
      out->Indent();
      out->Print("return {\n");
      out->Indent();
      out->Print("data: Buffer.from(message.serializeBinary()),\n");
      out->Print("metadata: Buffer.alloc(0)\n");
      out->Outdent();
      out->Print("}\n");
      out->Outdent();
      out->Print("})\n");
      out->Outdent();
      out->Print(");\n");
      out->Outdent();
      out->Outdent();
    }
    out->Print("default:\n");
    out->Indent();
    out->Print("return rsocket_flowable.Flowable.error(new Error('unknown method'));\n");
    out->Outdent();
    out->Outdent();
    out->Print("}\n");

    out->Outdent();
    out->Print("} catch (error) {\n");
    out->Indent();
    out->Print("return rsocket_flowable.Flowable.error(error);\n");
    out->Outdent();
    out->Print("}\n");
  }
  out->Outdent();
  out->Print("};\n");

  // Request-Channel
  out->Print(vars, "$server_name$.prototype.requestChannel = function requestChannel(payloads) {\n");
  out->Indent();
  out->Print("let once = false;\n");
  out->Print("return new rsocket_flowable.Flowable(subscriber => {\n");
  out->Indent();
  out->Print("const payloadProxy = new rsocket_rpc_core.QueuingFlowableProcessor();\n");
  out->Print("payloads.subscribe({\n");
  out->Indent();
  out->Print("onNext: payload => {\n");
  out->Indent();
  out->Print("if(!once){\n");
  out->Indent();
  out->Print("once = true;\n");
  out->Print("try{\n");
  out->Indent();
  out->Print("let result = this._channelSwitch(payload, payloadProxy);\n");
  out->Print("result.subscribe(subscriber);\n");
  out->Outdent();
  out->Print("} catch (error){\n");
  out->Indent();
  out->Print("subscriber.onError(error);\n");
  out->Outdent();
  out->Print("}\n");
  out->Outdent();
  out->Print("}\n");
  out->Print("payloadProxy.onNext(payload.data);\n");
  out->Outdent();
  out->Print("},\n");
  out->Print("onError: error => {\n");
  out->Indent();
  out->Print("payloadProxy.onError(error);\n");
  out->Outdent();
  out->Print("},\n");
  out->Print("onComplete: () => {\n");
  out->Indent();
  out->Print("payloadProxy.onComplete();\n");
  out->Outdent();
  out->Print("},\n");
  out->Print("onSubscribe: subscription => {\n");
  out->Indent();
  out->Print("payloadProxy.onSubscribe(subscription);\n");
  out->Outdent();
  out->Print("}\n");
  out->Print("});\n");
  out->Outdent();
  out->Print("});\n");
  out->Outdent();
  out->Print("};\n");

  // Metadata-Push
  out->Print(vars, "$server_name$.prototype.metadataPush = function metadataPush(payload) {\n");
  out->Indent();
  out->Print("return rsocket_flowable.Single.error(new Error('metadataPush() is not implemented'));\n");
  out->Outdent();
  out->Print("};\n");

  out->Print(vars, "return $server_name$;\n");
  out->Outdent();
  out->Print("}();\n\n");
  out->Print(vars, "exports.$server_name$ = $server_name$;\n\n");
  out->Print(GetNodeComments(service, false).c_str());
}

void PrintImports(const FileDescriptor* file, Printer* out) {
  out->Print("var rsocket_rpc_frames = require('rsocket-rpc-frames');\n");
  out->Print("var rsocket_rpc_core = require('rsocket-rpc-core');\n");
  out->Print("var rsocket_rpc_tracing = require('rsocket-rpc-tracing');\n");
  out->Print("var rsocket_flowable = require('rsocket-flowable');\n");
  if (file->message_type_count() > 0) {
    string file_path =
        GetRelativePath(file->name(), GetJSMessageFilename(file->name()));
    out->Print("var $module_alias$ = require('$file_path$');\n", "module_alias",
               ModuleAlias(file->name()), "file_path", file_path);
  }

  for (int i = 0; i < file->dependency_count(); i++) {
    string file_path = GetRelativePath(
        file->name(), GetJSMessageFilename(file->dependency(i)->name()));
    out->Print("var $module_alias$ = require('$file_path$');\n", "module_alias",
               ModuleAlias(file->dependency(i)->name()), "file_path",
               file_path);
  }
  out->Print("\n");
}

void PrintClients(const FileDescriptor* file, Printer* out) {
  for (int i = 0; i < file->service_count(); i++) {
    PrintClient(file->service(i), out);
  }
}

void PrintServers(const FileDescriptor* file, Printer* out) {
  for (int i = 0; i < file->service_count(); i++) {
    PrintServer(file->service(i), out);
  }
}
}  // namespace

string GenerateFile(const FileDescriptor* file) {
  string output;
  {
    StringOutputStream output_stream(&output);
    Printer out(&output_stream, '$');

    if (file->service_count() == 0) {
      return output;
    }
    out.Print("// GENERATED CODE -- DO NOT EDIT!\n\n");

    string leading_comments = GetNodeComments(file, true);
    if (!leading_comments.empty()) {
      out.Print("// Original file comments:\n");
      out.PrintRaw(leading_comments.c_str());
    }

    out.Print("'use strict';\n");

    PrintImports(file, &out);

    PrintClients(file, &out);

    PrintServers(file, &out);

    out.Print(GetNodeComments(file, false).c_str());
  }
  return output;
}

}  // namespace rsocket_rpc_js_generator
