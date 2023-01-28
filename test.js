#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'fs';

const URL = 'http://dockhunt.com/api/cli/icon-upload';
const iconPath = '/Users/jbs/projects/dockhunt-cli/temp_1674861422483_icon_conversion/Basedash Development.png';

const params = new URLSearchParams();
params.append('app', 'Basedash Development');
params.append('icon', fs.readFileSync(iconPath));

const response = await fetch(URL, {
  method: 'POST',
  body: params,
});

console.log(response);
const data = await response.json()
console.log(data);
