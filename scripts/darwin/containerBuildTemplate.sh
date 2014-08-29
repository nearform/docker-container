#!/bin/bash
docker ps -a -notrunc | grep 'Exit' | awk '{print $1}' | xargs -r docker rm
docker images -notrunc| grep none | awk '{print $2}' | xargs -r docker rmi
docker build -t __NAMESPACE__/__TARGETNAME__-__BUILDNUMBER__ .

