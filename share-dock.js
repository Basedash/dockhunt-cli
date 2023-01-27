#!/usr/bin/env node

import { getDockContents } from './index.js';

process.stdin.on("data", data => {
  getDockContents(data.toString());
})
