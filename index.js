import child_process from 'child_process';
import fetch, {FormData, fileFrom} from 'node-fetch';
import open from 'open';

import fs from 'fs-extra';
import path from 'path';
import querystring from 'querystring';
import url from 'url';
import util from 'util';

import {parseString} from 'xml2js';

import {icns2png} from './icns2png.js';


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
        const appDirectoryUrl = parsedAppData.dict[0].dict[0].string[0];
        const appDirectory = url.fileURLToPath(appDirectoryUrl)

        if (isAppNameAllowed(appName)) {
            result[appName] = getIconPath(appDirectory);
        }
    }
    return result;
}

async function getWhichAppNamesNeedIconsUploaded(appNames) {
    const queryString = querystring.stringify({app: appNames});
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

const uploadIcon = async (appName, iconPath) => {
    console.log("Uploading icon for app:", appName);
    const URL = 'https://dockhunt.com/api/cli/icon-upload';

    const form = new FormData();

    form.append('app', appName);
    form.append('icon', await fileFrom(iconPath));

    const response = await fetch(URL, {
        method: 'POST',
        body: form,
    });

    const data = await response.json()

    console.log("Uploaded icon for app:", appName);
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
    console.log('Found the following persistent apps in your dock:\n')
    for (const name of appNames) {
        console.log(`•  ${name}`);
    }

    console.log('\nUploading missing dock icons to dockhunt...');

    const appNamesNeedingIconsUploaded = await getWhichAppNamesNeedIconsUploaded(
        appNames
    );
    for (const name of appNamesNeedingIconsUploaded) {
        console.log(`•  ${name}`);
    }


    // Make a temporary dir for converted images
    const tempDirname = `temp_${Date.now()}_icon_conversion`;
    const tempDir = path.join(path.dirname(url.fileURLToPath(import.meta.url)), tempDirname);
    fs.mkdirSync(tempDir);

    const appIconsBeingUploadedPromises = [];

    for (const appName of appNamesNeedingIconsUploaded) {
        const iconPath = appNamesToIconPaths[appName];
        if (iconPath) {
            appIconsBeingUploadedPromises.push(icns2png(appName, iconPath, tempDir));
        } else {
            console.warn(`No icon found          (${appName})`);
        }
    }

    try {
        const appIconsUploaded = await Promise.all(appIconsBeingUploadedPromises);

        if (appIconsUploaded.length > 0) {
            console.log('\nConverted icons to pngs:\n');
            for (const appIconUploaded of appIconsUploaded) {
                console.log(`•  ${appIconUploaded.appName}`);
            }
        }

        const appIconUploadPromises = [];
        for (const appIcon of appIconsUploaded) {
            appIconUploadPromises.push(uploadIcon(appIcon.appName, appIcon.iconPath));
        }

        // Wait for all uploads to complete
        await Promise.all(appIconUploadPromises);

        // Remove temporary directory
        fs.removeSync(tempDir)

        // Output message saying that upload is complete
        console.log('\nDock scan complete!');

        const dockhuntUrl = `https://dockhunt.com/new-dock?${appNames.map(appName => `app=${encodeURIComponent(appName)}`).join('&')}`;
        console.log(`\nRedirecting to dockhunt (${dockhuntUrl})`);
        await open(dockhuntUrl);
    } catch (error) {
        console.error("Error converting icons to pngs:", error);
    }
}
