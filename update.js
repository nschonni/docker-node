#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const config = require('./versions.json');

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
  for(variant in variants) {
    let dockerfilePath = path.join(version, variant, 'Dockerfile');
    let entrypointPath = path.join(version, variant, 'docker-entrypoint.sh');
    let isAlpine = aplineRE.test(variant)
    let isSlim = slimRE.test(variant)

    let templatePath = '';
    if(isAlpine) {
      templatePath = path.join('Dockerfile-alpine.template');
    } else if(isSlim) {
      templatePath = path.join('Dockerfile-slim.template');
    } else {
      templatePath = path.join('Dockerfile-debian.template');
    }
    let dockerfile = fs.readFileSync(templatePath, 'utf-8');

    // Get FROM
    // FROM alpine:0.0


    // Get version
    // ENV NODE_VERSION 0.0.0
    // https://nodejs.org/dist/index.json

    // Get Yarn
    // https://classic.yarnpkg.com/latest-version
    // ENV YARN_VERSION 0.0.0
    // ${YARN_KEYS[@]}


    // Write resulting Dockerfile
    fs.writeFileSync(dockerfilePath, dockerfile);

    // update/write the entrypoint script
    fs.writeFileSync(entrypointPath, entrypointScript);
  }
}
