#!/usr/bin/env node

const request = require('request');
let supported_versions = [];
let latest_versions = [];
request('https://raw.githubusercontent.com/nodejs/Release/master/schedule.json', function (error, response, body) {
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
    // console.log(supported_versions)

    request('https://nodejs.org/dist/index.json', function (error, response, body) {
      if (!error && response.statusCode == 200) {
        let index = JSON.parse(body);
        let lastModule = 0;
        for (var record in index) {
          if (index.hasOwnProperty(record)) {
            let details = index[record];
            let version = details.version;
            let major = version.split('.')[0]
            // let end = new Date(details.end);
            // if (now >= start && now <= end) {
            //   supported_versions.push(version);
            // }
            if (supported_versions.indexOf(major) != -1){
              // console.log(version)
              supported_versions.pop()
              latest_versions.push(details)
            }
          }
        }
        console.log(latest_versions)
        // TODO: run update on templates
      }
    })

  }
});
