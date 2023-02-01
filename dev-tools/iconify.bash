#!/bin/bash

# Turn a 1024x1024 PNG into an ICNS icon
#
# https://stackoverflow.com/a/20703594/15487978

input_filename='basedash-dev.png'
output_basename='BasedashDev'

mkdir $output_basename.iconset
sips -z 16 16     $input_filename --out $output_basename.iconset/icon_16x16.png
sips -z 32 32     $input_filename --out $output_basename.iconset/icon_16x16@2x.png
sips -z 32 32     $input_filename --out $output_basename.iconset/icon_32x32.png
sips -z 64 64     $input_filename --out $output_basename.iconset/icon_32x32@2x.png
sips -z 128 128   $input_filename --out $output_basename.iconset/icon_128x128.png
sips -z 256 256   $input_filename --out $output_basename.iconset/icon_128x128@2x.png
sips -z 256 256   $input_filename --out $output_basename.iconset/icon_256x256.png
sips -z 512 512   $input_filename --out $output_basename.iconset/icon_256x256@2x.png
sips -z 512 512   $input_filename --out $output_basename.iconset/icon_512x512.png

cp $input_filename $output_basename.iconset/icon_512x512@2x.png
iconutil -c icns $output_basename.iconset
rm -R $output_basename.iconset
