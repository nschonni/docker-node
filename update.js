#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

const config = require('./versions.json');

const yarnVersion = '1.22.5';

const yarnKeys = ['6A010C5166006599AA17F08146C2130DFD2497F5']

const entrypointScript = `#!/bin/sh
set -e

if [ "\${1#-}" != "\${1}" ] || [ -z "$(command -v "\${1}")" ]; then
  set -- node "$@"
fi

exec "$@"
`
const aplineRE = new RegExp(/alpine*/);
const slimRE = new RegExp(/\*-slim/);
const leadingSpaceRE = new RegExp(/(?<spaces>\s+)"\${NODE_KEYS\[@\]}"/);

// const nodeKeys = fs.readFileSync(path.join('keys', 'node.keys'), 'utf-8').split('\n\r?')
const nodeKeys = [
"4ED778F539E3634C779C87C6D7062848A1AB005C",
"94AE36675C464D64BAFA68DD7434390BDBE9B9C5",
"74F12602B6F1C4E913FAA37AD3A89613643B6201",
"71DCFD284A79C3B38668286BC97EC7A07EDE3FC1",
"8FCCA13FEF1D0C2E91008E09770F7A9A5AE15600",
"C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8",
"C82FA3AE1CBEDC6BE46B9360C43CEC45C17AB93C",
"DD8F2338BAE7501E3DD5AC78C273792F7D83545D",
"A48C2BEE680E841632CD4E44F07496B3EB3C1762",
"108F52B48DB57BB0CC439B2997B01419BD92F80A",
"B9E2F5981AA6E0CD28160D9FF13993A75599653C"
]

const versions = Object.keys(config).reverse()

const nodeVersionsUrl = 'https://nodejs.org/dist/index.json';
let nodeVersionData;

https.get(nodeVersionsUrl, (res) => {
  let body = "";

  res.on("data", (chunk) => {
    body += chunk;
  });

  res.on("end", () => {
    try {
      nodeVersionData = JSON.parse(body);
      nodeVersionData = nodeVersionData.map(item => item.version.replace('v', ''))
      // console.log(nodeVersionData)
      updateImages()
    } catch (error) {
      console.error(error.message);
    };
  });

}).on("error", (error) => {
  console.error(error.message);
});


function updateImages() {

for (version of versions) {

  let variants = config[version].variants
  let pythonVersion = config[version].python
  let currentVersion = nodeVersionData.find((currentValue) => {
    return currentValue.split('.')[0] === version
  })
  // console.log(currentVersion)
  for (variant in variants) {
    let dockerfilePath = path.join(version, variant, 'Dockerfile');
    let isAlpine = aplineRE.test(variant)
    let isSlim = slimRE.test(variant)

    let templatePath = '';
    let fromTemplate = '';
    if (isAlpine) {
      templatePath = path.join('Dockerfile-alpine.template');
      let alpineVersion = variant.match(/alpine(?<major>\d+)\.(?<minor>\d+)/)
      fromTemplate = `FROM alpine:${alpineVersion.groups.major}.${alpineVersion.groups.minor}`
      // TODO: Get CHECKSUM
    } else if (isSlim) {
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
    dockerfile = dockerfile.replace('ENV NODE_VERSION 0.0.0', `ENV NODE_VERSION ${currentVersion}`)

    // Replace signing keys
    let leadingSpace = dockerfile.match(leadingSpaceRE).groups.spaces.replace('\n', '')
    dockerfile = dockerfile.replace('"${NODE_KEYS[@]}"', `${nodeKeys.join(` \\${leadingSpace}`).trimEnd()} \\`)

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
}
