#!/usr/bin/env node

const fs = require('fs');

const getDockContents = require('./');


const dockInfo = fs.readFileSync(0).toString();

getDockContents(dockInfo);
