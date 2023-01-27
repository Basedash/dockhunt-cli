import util from 'util';
import querystring from 'querystring';

import fetch from 'node-fetch';
import { parseString } from 'xml2js';


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

export async function checkApps(appNames) {
  const queryString = querystring.stringify({ app: appNames });
  const url = `https://www.dockhunt.com/api/cli/check-apps?${queryString}`;

  const response = await fetch(url);
  const result = await response.json();
  console.log('And of those, our server does not yet know about the following...');
  console.log(result);
}

export async function getDockContents(dockXmlPlist) {
  if (!dockXmlPlist.match(/<!DOCTYPE plist/g)) {
    throw 'Dock data appears to be invalid. Expected: Apple plist XML.';
  }

  const parsedDockData = await new Promise((resolve, reject) => {
    parseString(dockXmlPlist, function (error, result) {
      return error ? reject(error) : resolve(result);
    });
  });

  const appData = getAppData(parsedDockData);
  console.log('Found the following persistent apps in your dock:')
  logWithInspect(appData);

  await checkApps(appData.map((app) => app.appName));
}
