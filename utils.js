import fetch, {FormData, fileFrom} from 'node-fetch';
import open from 'open';
import child_process from 'child_process';

import fs from 'fs-extra';
import path from 'path';
import querystring from 'querystring';
import url from 'url';
import util from 'util';

import {parseString} from 'xml2js';

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

function getAppNamesToIconPaths(parsedDockData) {
    const parsedAppData = parsedDockData.plist.dict[0]

    //logWithInspect(parsedAppData);

    const persistentApps = parsedAppData.array[1].dict;
    const _persistentOthers = parsedAppData.array[2].dict;
    const _recentApps = parsedAppData.array[3].dict;

    const result = {};

    for (const parsedAppData of persistentApps) {
        const appName = parsedAppData.dict[0].string[1];
        const appDirectoryUrl = parsedAppData.dict[0].dict?.[0].string[0];
        if (appDirectoryUrl && isAppNameAllowed(appName)) {
            const appDirectory = url.fileURLToPath(appDirectoryUrl)
            result[appName] = getIconPath(appDirectory);
        }
    }
    return result;
}

/**
 *
 * @param appNames
 * @returns {Promise<Array.<{name: string; foundInDb: boolean; missingAppIcon: boolean}>>}
 */
async function getWhichAppsAreMissingFromDatabase(appNames) {
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
    const appNames = Object.keys(appNamesToIconPaths);
    console.log('Found the following pinned apps in your dock:\n')
    for (const name of appNames) {
        console.log(`•  ${name}`);
    }

    // console.log('\nUploading missing dock icons to dockhunt...');

    const missingAppInformation = await getWhichAppsAreMissingFromDatabase(
        appNames
    );


    // Make a temporary dir for converted images
    const tempDirname = `temp_${Date.now()}_icon_conversion`;
    const tempDir = path.join(process.cwd(), tempDirname);
    fs.mkdirSync(tempDir);

    /** @type {Promise<{iconPath: string | null, appName: string}>[]} */
    const missingAppsToBeAddedToDatabasePromises = [];

    for (const app of missingAppInformation) {
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
        fs.removeSync(tempDir)

        // Output message saying that upload is complete
        console.log('\nDock scan complete!');

        const dockhuntUrl = `https://dockhunt.com/new-dock?${appNames.map(appName => `app=${encodeURIComponent(appName)}`).join('&')}`;
        // const dockhuntUrl = `http://localhost:3000/new-dock?${appNames.map(appName => `app=${encodeURIComponent(appName)}`).join('&')}`;
        console.log(`\nRedirecting to dockhunt: ${dockhuntUrl}`);
        await open(dockhuntUrl);
    } catch (error) {
        console.error("Error converting icons to pngs:", error);
    }
}
