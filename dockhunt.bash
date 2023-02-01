#! /bin/bash

if [ $(uname -m) = 'arm64' ]; then
  ./dockhunt-arm64
else
  ./dockhunt-x64
fi
