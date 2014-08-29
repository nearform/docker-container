#!/bin/bash
# nfd docker build script
# parameters -
#   $1 namespace
#   $2 target name

sudo docker build -t $1/$2tmp .

# export and import to flatten the image
TMPID=$(sudo docker run -d $1/$2tmp /bin/bash)
sudo docker export $TMPID > /tmp/$TMPID
sudo cat /tmp/$TMPID | sudo docker import - $1/$2

# cleandown
DOCKERTMPID=`sudo docker images | grep  '^$1\/$2tmp ' | grep latest | awk -v x=3 '{print $x}'`
sudo docker rmi $DOCKERTMPID
sudo docker ps -a -notrunc | grep 'Exit' | awk '{print $1}' | xargs -r sudo docker rm
sudo docker images -notrunc| grep none | awk '{print $3}' | xargs -r sudo docker rmi

