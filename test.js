#!/usr/bin/env node

import fetch, {FormData, fileFrom} from 'node-fetch';

const URL = 'https://dockhunt.com/api/cli/icon-upload';
// const URL = 'http://localhost:3000/api/cli/icon-upload';
const iconPath = '/Users/robertcooper/Projects/dockhunt-cli/temp_1674880185748_icon_conversion/TablePlus.png';

const form = new FormData();

form.append('app', 'TablePlus');
form.append('icon', await fileFrom(iconPath));

const response = await fetch(URL, {
  method: 'POST',
  body: form,
});

const data = await response.json()
console.log(data);
