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

const {readdirSync} = require('fs');
const {join} = require('path');

const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const YELLOW = '\x1b[33m';

const mainPackage = require('../package.json');
const otherPackages = readdirSync('packages').map(pkg =>
  require(join(process.cwd(), 'packages', pkg, 'package.json')),
);

function print(msg) {
  process.stdout.write(msg + '\n');
}

function printHighlight(msg) {
  print(`${BOLD}${YELLOW}${msg}${RESET}`);
}

let unhoistedCount = 0;
otherPackages.forEach(pkg => {
  if (pkg.devDependencies) {
    unhoistedCount++;
    const message =
      `Package ${pkg.name} has devDependencies which should be ` +
      'hoisted into the top-level package.json:';
    printHighlight(message);
    Object.keys(pkg.devDependencies).forEach(devDependency => {
      print(`  ${devDependency}`);
    });
    print('');
  }
});

const versions = {};
[mainPackage, ...otherPackages].forEach(pkg => {
  const dependencies = pkg.dependencies;
  if (dependencies) {
    Object.keys(dependencies).forEach(name => {
      const version = dependencies[name];
      if (!versions[name]) {
        versions[name] = {};
      }
      if (!versions[name][version]) {
        versions[name][version] = [];
      }
      versions[name][version].push(pkg.name);
    });
  }
});

let conflictCount = 0;
Object.keys(versions).forEach(pkg => {
  const versionRanges = Object.keys(versions[pkg]);
  if (versionRanges.length > 1) {
    conflictCount++;
    print(`${BOLD}${YELLOW}Package versions for ${pkg} do not match:${RESET}`);
    versionRanges.forEach(range => {
      const dependents = versions[pkg][range];
      dependents.forEach(dependent => {
        print(`    ${dependent}`);
      });
      const pluralSuffix = dependents.length === 1 ? 's' : '';
      print(`  depend${pluralSuffix} on ${pkg} version ${range}`);
    });
    print('');
  }
});

if (unhoistedCount) {
  printHighlight(`Packages with unhoisted devDependencies: ${unhoistedCount}`);
}
if (conflictCount) {
  printHighlight(`Packages with version conflicts: ${conflictCount}`);
}

if (conflictCount || unhoistedCount) {
  process.exit(1);
}
