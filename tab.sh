#!/bin/bash

curl -o index.tab 'https://nodejs.org/dist/index.tab'

INPUT=index.tab
docker_modules[64]="0"
docker_modules[59]="0"
docker_modules[57]="0"
docker_modules[48]="0"
docker_modules[64]="0"

OLDIFS=$IFS
IFS='	'


[ ! -f $INPUT ] && { echo "$INPUT file not found"; exit 99; }
while read version date files npm v8 uv zlib openssl modules lts
do
  if [ "$modules" == "modules" ]; then
    continue
  fi

  if [[ -n "${docker_modules[modules]}" && "${docker_modules[modules]}" == "0" ]]; then
    docker_modules[${modules}]="$version";
    ./update.sh "$version"
    # echo "${docker_modules[modules]}"
  fi

  if [ "$modules" -eq "48" ]; then
    exit 0;
  fi
done < $INPUT
IFS=$OLDIFS
