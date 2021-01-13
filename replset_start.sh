#!/bin/sh
n=$1
mongodexe="./build/install/bin/mongod"
setParams="--setParameter enableTestCommands=true --setParameter logComponentVerbosity='{command:0}'"

mkdir -p dbdata/test{0,1,2,3,4}

killall mongod

# Clean up.
rm -rf logs/*

for i in `seq 0 4`
do
    $mongodexe --setParameter enableTestCommands=true --fork --pidfilepath /tmp/mongod-node-$i.pid --port 2800$i --dbpath dbdata/test$i --replSet will-replset --logpath logs/node$i.log
done