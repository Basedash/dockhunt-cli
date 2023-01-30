#!/usr/bin/env node

import child_process from 'child_process';
import {getDockContents} from "./utils.js";

// Entry point for the Dockhunt CLI

// TODO: Don't allow to run and show an error, unless on macOS

console.log('Scanning your dock...\n')

child_process.exec('defaults export com.apple.dock -', (error, stdout, stderr) => {
    if (error) {
        console.error(`error: ${error.message}`);
        return;
    }

    if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
    }


    getDockContents(stdout);
})
