#!/usr/bin/env node

const request = require('request');

const versions = [];
request('https://nodejs.org/dist/index.json', function (error, response, body) {
  if (!error && response.statusCode == 200) {
      let index = JSON.parse(body);
      let lastModule = 0;
      index.forEach(element => {
        if (lastModule != element.module)
        {
          versions.push(element.version.replace('v',''))
          lastModule = element.module
        }
        if (lastModule == 48)
        {
          return
        }
      //  console.log(element.version)
      });
       console.log(versions)
  }
})
