#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const config = require('./versions.json');

const yarnVersion = '1.22.5';

const yarnKeys = ['6A010C5166006599AA17F08146C2130DFD2497F5']

const nodeKeys = fs.readFileSync(path.join('keys', 'node.keys'), 'utf-8').split('\n')

const versions = Object.keys(config).reverse()

const entrypointScript = `#!/bin/sh
set -e

if [ "\${1#-}" != "\${1}" ] || [ -z "$(command -v "\${1}")" ]; then
  set -- node "$@"
fi

exec "$@"
`
const aplineRE = new RegExp(/alpine*/);
const slimRE = new RegExp(/\*-slim/);

for(version of versions) {

  let variants = config[version].variants
  let pythonVersion = config[version].python
  for(variant in variants) {
    let dockerfilePath = path.join(version, variant, 'Dockerfile');
    let isAlpine = aplineRE.test(variant)
    let isSlim = slimRE.test(variant)

    let templatePath = '';
    let fromTemplate = '';
    if(isAlpine) {
      templatePath = path.join('Dockerfile-alpine.template');
      let alpineVersion = variant.match(/alpine(?<major>\d+)\.(?<minor>\d+)/)
      fromTemplate = `FROM alpine:${alpineVersion.groups.major}.${alpineVersion.groups.minor}`
      // TODO: Get CHECKSUM
    } else if(isSlim) {
      templatePath = path.join('Dockerfile-slim.template');
      fromTemplate = `FROM debian:${variant}`
    } else {
      templatePath = path.join('Dockerfile-debian.template');
      fromTemplate = `FROM buildpack-deps:${variant}`
    }

    // Get the correct template
    let dockerfile = fs.readFileSync(templatePath, 'utf-8');

    // Get FROM
    dockerfile = dockerfile.replace('FROM $FROMTAG', fromTemplate)

    // Get version
    // ENV NODE_VERSION 0.0.0
    // https://nodejs.org/dist/index.json

    // Replace signing keys
    dockerfile = dockerfile.replace('"${NODE_KEYS[@]}"', `${nodeKeys.join(' \\\n      ').trimEnd()}`)

    // Get Yarn
    // https://classic.yarnpkg.com/latest-version
    // ENV YARN_VERSION 0.0.0
    dockerfile = dockerfile.replace('ENV YARN_VERSION 0.0.0', `ENV YARN_VERSION ${yarnVersion}`)
    // ${YARN_KEYS[@]}
    dockerfile = dockerfile.replace('"${YARN_KEYS[@]}"', `${yarnKeys} \\`)

    // Update Python version
    // ${PYTHON_VERSION}
    dockerfile = dockerfile.replace('${PYTHON_VERSION}', `${pythonVersion}`)
    // Write resulting Dockerfile
    fs.writeFileSync(dockerfilePath, dockerfile);

    // update/write the entrypoint script
    let entrypointPath = path.join(version, variant, 'docker-entrypoint.sh');
    fs.writeFileSync(entrypointPath, entrypointScript);
  }
}
