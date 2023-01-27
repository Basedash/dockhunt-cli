var xml2js = require('xml2js');
const util = require('util')

function getDockContents(dockXmlPlist) {
  console.log('Your dock contents:')

  xml2js.parseStringPromise(dockXmlPlist).then(function (dockData) {
    // https://stackoverflow.com/a/10729284/15487978
    console.log(util.inspect(dockData, { depth: null, colors: true }));
    console.log('Done');
  })
  .catch(function (err) {
    console.error('Problem parsing XML plist');
  });
}

module.exports = getDockContents;
