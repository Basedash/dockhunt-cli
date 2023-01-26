#!/usr/bin/env node

// TODO: Don't allow to run and show and error, unless on macOS

const scan = require('./');

const result = scan();

console.log(result);
