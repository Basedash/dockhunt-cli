var xml2js = require('xml2js');
const util = require('util')

function logWithInspect(object) {
  // https://stackoverflow.com/a/10729284/15487978
  console.log(util.inspect(object, { depth: null, colors: true }));
}

function getDockContents(dockXmlPlist) {
  xml2js.parseStringPromise(dockXmlPlist).then(function (rawDockData) {
    // TODO: Ensure XML is valid apple p-list
    const rawAppData = rawDockData.plist.dict[0]

    //logWithInspect(appData);

    const persistentApps = rawAppData.array[1].dict;
    const _persistentOthers = rawAppData.array[2].dict;
    const _recentApps = rawAppData.array[3].dict;

    const appData = [];

    for (const rawAppData of persistentApps) {
      const appName = rawAppData.dict[0].string[1];
      const appDirectory = rawAppData.dict[0].dict[0].string[0];
      appData.push({
        appName,
        appDirectory,
      });
    }

    console.log('Found the following persistent apps:')
    logWithInspect(appData);

  })
  .catch(function (error) {
    console.error('Problem parsing XML p-list');
    console.error(error);
  });
}

module.exports = getDockContents;
