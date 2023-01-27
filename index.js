var xml2js = require('xml2js');
const util = require('util')

function logWithInspect(object) {
  // https://stackoverflow.com/a/10729284/15487978
  console.log(util.inspect(object, { depth: null, colors: true }));
}

function getAppData(parsedDockData) {
  const parsedAppData = parsedDockData.plist.dict[0]

  //logWithInspect(parsedAppData);

  const persistentApps = parsedAppData.array[1].dict;
  const _persistentOthers = parsedAppData.array[2].dict;
  const _recentApps = parsedAppData.array[3].dict;

  const result = [];

  for (const parsedAppData of persistentApps) {
    const appName = parsedAppData.dict[0].string[1];
    const appDirectory = parsedAppData.dict[0].dict[0].string[0];
    result.push({
      appName,
      appDirectory,
    });
  }
  return result;
}

function getDockContents(dockXmlPlist) {
  if (!dockXmlPlist.match(/<!DOCTYPE plist/g)) {
    throw 'Dock data appears to be invalid. Expected: Apple plist XML.';
  }

  xml2js.parseStringPromise(dockXmlPlist).then(function (parsedDockData) {
    const appData = getAppData(parsedDockData);
    console.log('Found the following persistent apps:')
    logWithInspect(appData);

  })
  .catch(function (error) {
    console.error('Problem parsing XML plist');
    console.error(error);
  });

}

module.exports = getDockContents;
