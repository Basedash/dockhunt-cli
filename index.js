import fs from 'fs';
import path from 'path';
import querystring from 'querystring';
import url from 'url';
import util from 'util';

import fetch from 'node-fetch';
import { parseString } from 'xml2js';


function logWithInspect(object) {
  // https://stackoverflow.com/a/10729284/15487978
  console.log(util.inspect(object, { depth: null, colors: true }));
}

function isAppNameAllowed(appName) {
  // Finder doesn't seem to appear in the dock data
  const disallowedAppNames = [
    'Preview',
  ];
  return !disallowedAppNames.includes(appName);
}

function getAppNamesToIconPaths(parsedDockData) {
  const parsedAppData = parsedDockData.plist.dict[0]

  //logWithInspect(parsedAppData);

  const persistentApps = parsedAppData.array[1].dict;
  const _persistentOthers = parsedAppData.array[2].dict;
  const _recentApps = parsedAppData.array[3].dict;

  const result = {};

  for (const parsedAppData of persistentApps) {
    const appName = parsedAppData.dict[0].string[1];
    const appDirectoryUrl = parsedAppData.dict[0].dict[0].string[0];
    const appDirectory = url.fileURLToPath(appDirectoryUrl)

    if (isAppNameAllowed(appName)) {
      result[appName] = getIconPath(appDirectory);
    }
  }
  return result;
}

async function getWhichAppNamesNeedIconsUploaded(appNames) {
  const queryString = querystring.stringify({ app: appNames });
  const url = `https://www.dockhunt.com/api/cli/check-apps?${queryString}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw 'Bad response from Dockhunt `check-apps` endpoint';
  }
  const payload = await response.json();
  return payload.appsMissingIcon;
}

function getIconPath(appDirectory) {
  var appResourcesDirectory = path.join(appDirectory, 'Contents', 'Resources');
  const files = fs.readdirSync(appResourcesDirectory)
  for (const file of files) {
    if (file.endsWith('.icns')) {
      return path.join(appResourcesDirectory, file);
    }
  }
  return null;
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

  const appNamesToIconPaths = getAppNamesToIconPaths(parsedDockData);
  console.log('Found the following persistent apps in your dock:')
  console.log(Object.keys(appNamesToIconPaths));

  const appNamesNeedingIconsUploaded = await getWhichAppNamesNeedIconsUploaded(
    Object.keys(appNamesToIconPaths)
  );
  console.log('Of these, the following will be uploaded:');

  const appNamesToIconPathsNeedingUpload = {};
  appNamesNeedingIconsUploaded.forEach((appName) => {
    appNamesToIconPathsNeedingUpload[appName] = appNamesToIconPaths[appName];
    console.log([appName, appNamesToIconPaths[appName]]);
  });

  console.log();
}
