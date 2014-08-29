#!/bin/bash
sudo docker ps -a -notrunc | grep 'Exit' | awk '{print $1}' | xargs -r sudo docker rm
sudo docker images -notrunc| grep none | awk '{print $2}' | xargs -r sudo docker rmi
sudo docker build -t __NAMESPACE__/__TARGETNAME__-__BUILDNUMBER__ .

