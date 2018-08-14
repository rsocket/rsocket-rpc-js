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

#ifndef PROTEUS_COMPILER_JS_GENERATOR_H
#define PROTEUS_COMPILER_JS_GENERATOR_H

#include <iostream>
#include <string>
#include <google/protobuf/descriptor.h>

using namespace std;

namespace rsocket_rpc_js_generator {

string GenerateFile(const google::protobuf::FileDescriptor* file);

}  // namespace rsocket_rpc_js_generator

#endif  // PROTEUS_COMPILER_JS_GENERATOR_H
