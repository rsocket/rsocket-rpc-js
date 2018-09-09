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

// Generates Javascript RSocket RPC service interface out of Protobuf IDL.

#include <memory>

#include "js_generator.h"
#include "js_generator_helpers.h"
#include <google/protobuf/compiler/code_generator.h>
#include <google/protobuf/compiler/plugin.h>
#include <google/protobuf/descriptor.h>
#include <google/protobuf/io/zero_copy_stream.h>
#include <iostream>

using rsocket_rpc_js_generator::GenerateFile;
using rsocket_rpc_js_generator::GetJSServiceFilename;

class RSocketRpcJsGenerator : public google::protobuf::compiler::CodeGenerator {
 public:
  RSocketRpcJsGenerator() {}
  ~RSocketRpcJsGenerator() {}

  bool Generate(const google::protobuf::FileDescriptor* file,
                const string& parameter,
                google::protobuf::compiler::GeneratorContext* context,
                string* error) const {
    string code = GenerateFile(file);
    if (code.size() == 0) {
      return true;
    }

    // Get output file name
    string file_name = GetJSServiceFilename(file->name());

    std::unique_ptr<google::protobuf::io::ZeroCopyOutputStream> output(
        context->Open(file_name));
    google::protobuf::io::CodedOutputStream coded_out(output.get());
    coded_out.WriteRaw(code.data(), code.size());
    return true;
  }
};

int main(int argc, char* argv[]) {
  RSocketRpcJsGenerator generator;
  return google::protobuf::compiler::PluginMain(argc, argv, &generator);
}
