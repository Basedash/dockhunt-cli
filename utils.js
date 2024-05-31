import fetch, {FormData, fileFrom} from 'node-fetch';
import open from 'open';
import child_process from 'child_process';

import fs from 'fs-extra';
import path from 'path';
import querystring from 'querystring';
import url from 'url';
import util from 'util';
import plist from 'plist';

function logWithInspect(object) {
    // https://stackoverflow.com/a/10729284/15487978
    console.log(util.inspect(object, {depth: null, colors: true}));
}

function isAppNameAllowed(appName) {
    // Finder doesn't seem to appear in the dock data
    const disallowedAppNames = [
        'Preview',
        'Launchpad'
    ];
    return !disallowedAppNames.includes(appName);
}

function parseDockData(rawDockPlist) {
    return plist.parse(rawDockPlist);
}

function getAppNamesWithIconPaths(parsedDockData) {
    //logWithInspect(parsedDockData);

    const persistentApps = parsedDockData['persistent-apps'] ?? [];
    const persistentAppsWithoutSpacers = persistentApps.filter(item => item['tile-type'] === 'file-tile');
    const appNamesWithIconPaths = {};

    for (const app of persistentAppsWithoutSpacers) {
        const appName = app['tile-data']?.['file-label'];
        const appDirectoryUrl = app['tile-data']?.['file-data']?.['_CFURLString'];

        if (appDirectoryUrl && isAppNameAllowed(appName)) {
            const appDirectory = url.fileURLToPath(appDirectoryUrl)
            appNamesWithIconPaths[appName] = getIconPath(appDirectory);
        }
    }

    return appNamesWithIconPaths;
}

/**
 *
 * @param appNames
 * @returns {Promise<Array.<{name: string; foundInDb: boolean; missingAppIcon: boolean}>>}
 */
async function getWhichAppsAreMissingFromDatabase(appNames) {
    if (!appNames.length) {
      return [];
    }
    const queryString = querystring.stringify({app: appNames});
    const url = `https://www.dockhunt.com/api/cli/check-apps?${queryString}`;
    // const url = `http://localhost:3000/api/cli/check-apps?${queryString}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw 'Bad response from Dockhunt `check-apps` endpoint';
    }
    const payload = await response.json();
    return payload.missingAppsInformation;
}

function getIconPath(appDirectory) {
    var appResourcesDirectory = path.join(appDirectory, 'Contents', 'Resources');
    // AppName.app/Contents/Resources may not exist for Catalyst apps.
    if (!fs.pathExistsSync(appResourcesDirectory)) return null
    const files = fs.readdirSync(appResourcesDirectory)
    for (const file of files) {
        if (file.endsWith('.icns')) {
            return path.join(appResourcesDirectory, file);
        }
    }
    return null;
}

/**
 *
 * @param appName {string}
 * @param iconPath {string | null}
 * @returns {Promise<void>}
 */
const addAppToDatabase = async (appName, iconPath) => {
    const URL = 'https://dockhunt.com/api/cli/icon-upload';
    // const URL = 'http://localhost:3000/api/cli/icon-upload';

    const form = new FormData();

    form.append('app', appName);
    if (iconPath !== null) {
        form.append('icon', await fileFrom(iconPath));
    }

    const response = await fetch(URL, {
        method: 'POST',
        body: form,
    });

    await response.json()
}

export function icns2png(appName, icnsPath, outputDir) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, appName + '.png');
        console.log(`Converting icon to PNG (${appName})`);

        // https://stackoverflow.com/a/62892482/15487978
        // https://stackoverflow.com/a/10232330/15487978
        const sips = child_process.spawn('sips',
            ['-s', 'format', 'png', icnsPath, '--out', outputPath]
        );

        sips.stdout.on('data', function (data) {
            //console.log('stdout: ' + data.toString());
        });

        sips.stderr.on('data', function (data) {
            console.error('stderr: ' + data.toString());
        });

        sips.on('exit', function (code) {
            if (!code === 0) {
                console.error('child process exited with code ' + code.toString());
                reject();
            }
            resolve({iconPath: outputPath, appName});
        });
    });
}

export async function scanDockAndBringToWebApp(dockXmlPlist) {
    if (!dockXmlPlist.match(/<!DOCTYPE plist/g)) {
        throw 'Dock data appears to be invalid. Expected: Apple plist XML.';
    }

    const parsedDockData = parseDockData(dockXmlPlist);
    const appNamesWithIconPaths = getAppNamesWithIconPaths(parsedDockData);
    const appNames = Object.keys(appNamesWithIconPaths);

    if (appNames.length) {
      console.log('Found the following pinned apps in your dock:\n')
      for (const name of appNames) {
          console.log(`•  ${name}`);
      }
    } else {
      console.log('Found what appears to be an empty dock.');
    }

    // console.log('\nUploading missing dock icons to dockhunt...');

    const appsMissingFromDatabase = await getWhichAppsAreMissingFromDatabase(
        appNames
    );


    // Make a temporary dir for converted images
    let tempDir;
    if (appsMissingFromDatabase.length) {
      const tempDirname = `temp_${Date.now()}_icon_conversion`;
      tempDir = path.join(process.cwd(), tempDirname);
      fs.mkdirSync(tempDir);
    }

    /** @type {Promise<{iconPath: string | null, appName: string}>[]} */
    const missingAppsToBeAddedToDatabasePromises = [];

    for (const app of appsMissingFromDatabase) {
        const iconPath = appNamesToIconPaths[app.name];
        if (!iconPath) {
            console.warn(`\n${app.name} icon not found.`);
        }
        if (iconPath) {
            missingAppsToBeAddedToDatabasePromises.push(icns2png(app.name, iconPath, tempDir));
        } else if (!iconPath && !app.foundInDb) {
            // We still want to upload apps to our database if they don't have an icon AND are not in our database
            missingAppsToBeAddedToDatabasePromises.push(new Promise((resolve) => resolve({
                iconPath: null,
                appName: app.name
            })));
        }
    }

    try {
        const missingAppsToBeAddedToDatabase = await Promise.all(missingAppsToBeAddedToDatabasePromises);

        /** @type {Promise<void>[]} */
        const appIconUploadPromises = [];
        for (const app of missingAppsToBeAddedToDatabase) {
            appIconUploadPromises.push(addAppToDatabase(app.appName, app.iconPath));
        }

        // Wait for all uploads to complete
        await Promise.all(appIconUploadPromises);

        // Remove temporary directory
        if (tempDir) {
          fs.removeSync(tempDir)
        }

        // Output message saying that upload is complete
        console.log('\nDock scan complete!');

        if (appNames.length) {
          const dockhuntUrl = `https://dockhunt.com/new-dock?${appNames.map(appName => `app=${encodeURIComponent(appName)}`).join('&')}`;
          // const dockhuntUrl = `http://localhost:3000/new-dock?${appNames.map(appName => `app=${encodeURIComponent(appName)}`).join('&')}`;

          console.log(`\nRedirecting to dockhunt: ${dockhuntUrl}`);
          await open(dockhuntUrl);
        } else {
          console.log('\nDockhunt does not currently support users making ' +
            'Docks which contain no apps.');
        }
    } catch (error) {
        console.error("Error converting icons to pngs:", error);
    }
}
