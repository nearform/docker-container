#!/bin/bash
# nfd docker build script
# parameters -
#   $1 namespace
#   $2 target name

docker build -t $1/$2tmp .

# export and import to flatten the image
TMPID=$(docker run -d $1/$2tmp /bin/bash)
docker export $TMPID > /tmp/$TMPID
cat /tmp/$TMPID | docker import - $1/$2

# cleandown
DOCKERTMPID=`docker images | grep  '^$1\/$2tmp ' | grep latest | awk -v x=3 '{print $x}'`
docker rmi $DOCKERTMPID
docker ps -a -notrunc | grep 'Exit' | awk '{print $1}' | xargs -r docker rm
docker images -notrunc| grep none | awk '{print $3}' | xargs -r docker rmi

