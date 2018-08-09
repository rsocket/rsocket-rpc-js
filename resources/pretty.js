#!/usr/bin/env node
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

const {spawnSync} = require('child_process');
const {join} = require('path');

const INVERSE = '\x1b[7m';
const RESET = '\x1b[0m';
const YELLOW = '\x1b[33m';

const options = [
  '--no-bracket-spacing',
  '--single-quote',
  '--trailing-comma=all',
];
const glob = '{packages/*/{resources,src},resources,src}/**/!(*_pb).js';
const root = join(__dirname, '..');
const executable = join(root, 'node_modules', '.bin', 'prettier');

const check = process.argv.indexOf('--check') !== -1;
const mode = check ? '--list-different' : '--write';
process.chdir(root);

const {stdout, stderr, status, error} = spawnSync(executable, [
  ...options,
  mode,
  glob,
]);
const out = stdout.toString().trim();
const err = stdout.toString().trim();

function print(message) {
  if (message) {
    process.stdout.write(message + '\n');
  }
}

if (status) {
  print(out);
  print(err);
  if (check) {
    print(`\n${YELLOW}The files listed above are not correctly formatted.`);
    print(`Try: ${INVERSE} npm run pretty ${RESET}`);
  }
}
if (error) {
  print('error', error);
}
process.exit(status != null ? status : 1);
