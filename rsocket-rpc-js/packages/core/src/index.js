/**
 * @name rsocket-rpc-js/packages/core
 * @fileoverview The public API of the `core` package.
 * @copyright Copyright (c) 2017-present, Netifi Inc.
 * @license Apache-2.0
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
 *
 * @requires RequestHandlingRSocket
 * @requires RpcClient
 * @requires QueuingFlowableProcessor
 * @requires SwitchTransformOperator
 * @exports ClientConfig
 * @exports RequestHandlingRSocket
 * @exports RpcClient
 * @exports QueuingFlowableProcessor
 * @exports SwitchTransformOperator
 */

'use strict';

import RequestHandlingRSocket from './RequestHandlingRSocket';
import RpcClient from './RpcClient';
import QueuingFlowableProcessor from './QueuingFlowableProcessor';
import SwitchTransformOperator from './SwitchTransformOperator';

export type {ClientConfig} from './RpcClient';

export {
  RequestHandlingRSocket,
  RpcClient,
  QueuingFlowableProcessor,
  SwitchTransformOperator,
};
