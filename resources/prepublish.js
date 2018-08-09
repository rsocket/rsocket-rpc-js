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
 */

'use strict';

// NOTE: Because prepublish is also invoked on "npm install", we can't
// rely on babel-node being available. This means two things:
//
// (1) We must stick to a vanilla subset of ES6 features; and:
// (2) We start off with a check to bail out when not invoked as part of
//     "npm publish".

var fs = require('fs');
var path = require('path');

var config = require(path.join(process.cwd(), 'package.json'));
if (config.scripts.prepublish.indexOf('node ') !== 0) {
  // Guard against somebody helpfully trying to make the package.json scripts
  // consistent by using "babel-node" instead of "node" (which would break
  // the initial "npm install").
  console.error('invoke prepublish.js with `node`, not `babel-node`');
  process.exit(1);
}

// Bail unless we're running during `npm publish`.
var argv = JSON.parse(process.env.npm_config_argv).original;
var isPublishing = argv.length > 0 && argv[0].indexOf('pu') === 0;
if (!isPublishing) {
  process.exit(0);
}

// Otherwise, perform a build.
var execFileSync = require('child_process').execFileSync;
process.stdout.write(execFileSync('npm', ['run', 'build']));
