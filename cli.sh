#!/usr/bin/env bash

# Entry point for the Dockhunt CLI

# TODO: Don't allow to run and show an error, unless on macOS

echo 'Scanning your dock...'

# Get the dock as XML and send it to our Node script to be shared
# See `defaults help` "writes domain as an xml plist to stdout"
defaults export com.apple.dock - | share-dock
