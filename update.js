#!/usr/bin/env node

const request = require('request');
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const yaml = require('js-yaml');

const nodeKeys = fs.readFileSync(path.join('keys', 'node.keys')).toString().split('\n').join(' \\\n    ').trim();
const yarnKeys = fs.readFileSync(path.join('keys', 'yarn.keys')).toString().split('\n').join(' \\\n    ').trim();

request('https://raw.githubusercontent.com/nodejs/Release/master/schedule.json', function (error, response, body) {
  let supported_versions = [];
  let supported_versions_chakra = [];

  if (!error && response.statusCode == 200) {
    let schedule = JSON.parse(body);
    const now = Date.now();
    for (var version in schedule) {
      if (schedule.hasOwnProperty(version)) {
        let details = schedule[version];
        let start = new Date(details.start);
        let end = new Date(details.end);
        if (now >= start && now <= end) {
          supported_versions.push(version);
        }
      }
    }

    supported_versions_chakra = Array.from(supported_versions);
    request('https://yarnpkg.com/latest-version', function (error, response, body) {
      if (!error && response.statusCode == 200) {
        let yarn = response.body.toString()

        request('https://nodejs.org/dist/index.json', function (error, response, body) {
          if (!error && response.statusCode == 200) {
            let index = JSON.parse(body);
            for (var record in index) {
              if (index.hasOwnProperty(record)) {
                let details = index[record];
                let version = details.version;
                let major = version.split('.')[0]
                if (supported_versions.indexOf(major) != -1) {
                  supported_versions.pop(); // First hit should be the latests
                  updateDockerFile(details, yarn);
                }
              }
            }

            request('https://nodejs.org/download/chakracore-release/index.json', function (error, response, body) {
              if (!error && response.statusCode == 200) {
                let indexChakra = JSON.parse(body);
                for (var record in indexChakra) {
                  if (indexChakra.hasOwnProperty(record)) {
                    let chakra = indexChakra[record];
                    let version = chakra.version;
                    let major = version.split('.')[0]
                    if (supported_versions_chakra.indexOf(major) != -1) {
                      supported_versions_chakra.pop(); // First hit should be the latests
                      updateDockerFile(chakra, yarn, 'chakracore');
                    }
                  }
                }

                try {
                  let travis = yaml.safeLoad(fs.readFileSync('.travis.yml', 'utf8'));

                  // Filter out the existing Docker jobs
                  travis.jobs.include = travis.jobs.include.filter(record => {
                    return record.stage !== 'Build'
                  });

                  glob(`**/Dockerfile`, {ignore: 'node_modules/**'}, function (err, files) {
                    if (err) {
                      return console.log(err);
                    }
                    files.forEach(file => {
                      let job = {
                        stage: 'Build',
                        env: []
                      }
                      let nodeVersion = file.split('/')[0];
                      let variant = file.replace(/\d*/g, '').replace('Dockerfile', '').replace(/\//g, '');
                      if (variant === 'chakracore')
                      {
                        variant = 'default'
                        nodeVersion = file.replace('/Dockerfile', '');
                      }
                      job.env.push({
                        NODE_VERSION: nodeVersion
                      })
                      job.env.push({
                        VARIANT: variant
                      })
                      travis.jobs.include.push(job);
                    })
                    fs.writeFileSync('.travis.yml', yaml.safeDump(travis))
                  })
                } catch (e) {
                  console.log(e);
                }
              }
            })
          }
        })
      }
    });
  }
});

function updateDockerFile(nodejs, yarn, root = '') {
  let nodeNext = nodejs.version.replace('v', '');
  let nodeMajor = nodeNext.split('.')[0];
  let nodeNextMinor = nodeNext.split('.')[1];
  let versions = JSON.parse(fs.readFileSync(path.join(root, nodeMajor, 'versions.json')));

  // // Check for current version
  let nodePrevious = versions.nodejs;
  let nodePreviousMinor = nodePrevious.split('.')[1];

  if (nodePrevious === nodeNext) {
    // No updates need
    return;
  } else if (nodePreviousMinor !== nodeNextMinor) {
    // Minor patch will bump Yarn
    versions.yarn = yarn;
    // Alpine doesn't have a direct latest endpoint, but parsing git-tags is possible
  }

  // Update version file
  versions.nodejs = nodeNext
  fs.writeFileSync(path.join(root, nodeMajor, 'versions.json'), JSON.stringify(versions, null, '  ') + '\n')

  // Update templates
  let pattern = `${nodeMajor}/**/Dockerfile`
  if (root) {
    pattern = root + '/' + pattern;
  }
  glob(pattern, function (err, files) {
    if (err) {
      return console.log(err);
    }
    files.forEach(file => {
      let variant = file.replace(root, '').replace(nodeMajor, '').replace('Dockerfile', '').replace(/\//g, '');
      let template = '';
      if (root) {
        template = fs.readFileSync(path.join(root, 'Dockerfile.template')).toString();
      } else {
        template = fs.readFileSync(`Dockerfile-${variant}.template`).toString();
      }

      template = template.replace('ENV NODE_VERSION 0.0.0', `ENV NODE_VERSION ${versions.nodejs}`)
      template = template.replace('ENV YARN_VERSION 0.0.0', `ENV YARN_VERSION ${versions.yarn}`)
      template = template.replace('FROM alpine:0.0', `FROM alpine:${versions.alpine}`)
      template = template.replace('FROM node:0.0.0-jessie', `FROM node:${versions.nodejs}-jessie`)

      template = template.replace('"${NODE_KEYS[@]}"\n', `${nodeKeys}\n`)
      template = template.replace('"${YARN_KEYS[@]}"', `${yarnKeys}`)

      fs.writeFileSync(file, template);
    });
  });
}
